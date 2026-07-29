import { describe, expect, it } from 'vitest';

import {
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
} from '../../packages/modules/hr/src/index.js';
import {
  InMemoryLibraryFineGateway,
  LibraryService,
} from '../../packages/modules/library/src/index.js';

const scope = { tenantId: 'tenant-ops', legalEntityId: 'entity-school', campusId: 'campus-main' };

const librarian: OperationsPrincipal = {
  principalId: 'librarian',
  tenantId: scope.tenantId,
  campusIds: [scope.campusId],
  assurance: 'aal2',
  permissions: [
    'operations.library.catalog.write',
    'operations.library.copy.write',
    'operations.library.patron.write',
    'operations.library.circulation.write',
    'operations.library.hold.write',
    'operations.library.loss.write',
    'operations.library.report.read',
  ],
};

function setup(): { service: LibraryService; fines: InMemoryLibraryFineGateway } {
  const fines = new InMemoryLibraryFineGateway();
  return {
    service: new LibraryService(
      scope,
      new InMemoryOperationsEventPublisher(),
      new InMemoryOperationsAuditWriter(),
      fines,
    ),
    fines,
  };
}

function seed(service: LibraryService): void {
  service.registerTitle(
    {
      id: 'title-1',
      isbn: '9780000000001',
      title: 'World History',
      authors: ['A. Author'],
      subjectCodes: ['HISTORY'],
      publisher: 'Learning Press',
      publicationYear: 2024,
      language: 'en',
    },
    librarian,
    'corr-title',
  );
  service.registerCopy(
    {
      id: 'copy-1',
      titleId: 'title-1',
      barcode: 'LIB-0001',
      homeLocationRef: 'library-main',
      replacementCostMinor: 2_000,
      currency: 'BDT',
    },
    librarian,
    'corr-copy',
  );
  service.registerPatron(
    {
      id: 'patron-1',
      personRef: 'sis-student-1',
      patronType: 'student',
      displayName: 'Student One',
      active: true,
    },
    librarian,
    'corr-patron-1',
  );
  service.registerPatron(
    {
      id: 'patron-2',
      personRef: 'sis-student-2',
      patronType: 'student',
      displayName: 'Student Two',
      active: true,
    },
    librarian,
    'corr-patron-2',
  );
}

describe('OPS library', () => {
  it('catalogues titles and physical copies with opaque SIS patron references', () => {
    const { service } = setup();
    seed(service);
    expect(service.findTitle('title-1')).toMatchObject({ title: 'World History', language: 'en' });
    expect(service.findCopy('copy-1')).toMatchObject({ barcode: 'LIB-0001', status: 'available' });
    expect(service.findPatron('patron-1')).toMatchObject({ personRef: 'sis-student-1' });
  });

  it('checks out an available copy using policy-driven due dates', () => {
    const { service } = setup();
    seed(service);
    const loan = service.checkout(
      {
        id: 'loan-1',
        copyId: 'copy-1',
        patronId: 'patron-1',
        checkedOutAt: '2026-07-28T10:00:00.000Z',
      },
      librarian,
      'corr-checkout',
    );
    expect(loan.dueAt).toBe('2026-08-11T10:00:00.000Z');
    expect(service.findCopy('copy-1')?.status).toBe('on-loan');
    expect(() =>
      service.checkout(
        {
          id: 'loan-2',
          copyId: 'copy-1',
          patronId: 'patron-2',
          checkedOutAt: '2026-07-28T10:01:00.000Z',
        },
        librarian,
        'corr-double-checkout',
      ),
    ).toThrow('OPS_LIBRARY_COPY_UNAVAILABLE');
  });

  it('honours hold queue order and blocks renewal when another patron is waiting', () => {
    const { service } = setup();
    seed(service);
    service.checkout(
      {
        id: 'loan-1',
        copyId: 'copy-1',
        patronId: 'patron-1',
        checkedOutAt: '2026-07-28T10:00:00.000Z',
      },
      librarian,
      'corr-checkout',
    );
    service.placeHold(
      {
        id: 'hold-1',
        titleId: 'title-1',
        patronId: 'patron-2',
        placedAt: '2026-07-29T10:00:00.000Z',
      },
      librarian,
      'corr-hold',
    );
    expect(() => service.renewLoan('loan-1', librarian, 'corr-renew')).toThrow(
      'OPS_LIBRARY_RENEWAL_BLOCKED_BY_HOLD',
    );
    service.returnCopy(
      { loanId: 'loan-1', returnedAt: '2026-08-01T10:00:00.000Z', condition: 'good' },
      librarian,
      'corr-return',
    );
    expect(service.findCopy('copy-1')?.status).toBe('on-hold');
    expect(() =>
      service.checkout(
        {
          id: 'loan-wrong',
          copyId: 'copy-1',
          patronId: 'patron-1',
          checkedOutAt: '2026-08-01T11:00:00.000Z',
        },
        librarian,
        'corr-wrong-patron',
      ),
    ).toThrow('OPS_LIBRARY_HOLD_PRIORITY');
  });

  it('returns overdue copies and exports an immutable fine source record', () => {
    const { service, fines } = setup();
    seed(service);
    service.checkout(
      {
        id: 'loan-1',
        copyId: 'copy-1',
        patronId: 'patron-1',
        checkedOutAt: '2026-07-01T10:00:00.000Z',
      },
      librarian,
      'corr-checkout',
    );
    const returned = service.returnCopy(
      { loanId: 'loan-1', returnedAt: '2026-07-20T10:00:00.000Z', condition: 'good' },
      librarian,
      'corr-return',
    );
    expect(returned.fineMinor).toBe(500);
    expect(fines.documents).toHaveLength(1);
    expect(fines.documents[0]).toMatchObject({
      sourceType: 'library-overdue',
      patronRef: 'sis-student-1',
      amountMinor: 500,
      currency: 'BDT',
    });
  });

  it('marks a lost copy and exports replacement-cost evidence without deleting the loan', () => {
    const { service, fines } = setup();
    seed(service);
    service.checkout(
      {
        id: 'loan-1',
        copyId: 'copy-1',
        patronId: 'patron-1',
        checkedOutAt: '2026-07-28T10:00:00.000Z',
      },
      librarian,
      'corr-checkout',
    );
    service.markLost('loan-1', '2026-08-02T10:00:00.000Z', librarian, 'corr-lost');
    expect(service.findCopy('copy-1')?.status).toBe('lost');
    expect(service.findLoan('loan-1')).toMatchObject({ status: 'lost' });
    expect(fines.documents.at(-1)).toMatchObject({
      sourceType: 'library-lost',
      amountMinor: 2_000,
    });
  });

  it('reports circulation, overdue, holds and collection exceptions', () => {
    const { service } = setup();
    seed(service);
    service.checkout(
      {
        id: 'loan-1',
        copyId: 'copy-1',
        patronId: 'patron-1',
        checkedOutAt: '2026-07-01T10:00:00.000Z',
      },
      librarian,
      'corr-checkout',
    );
    expect(service.libraryReport('2026-07-20T10:00:00.000Z', librarian)).toEqual({
      titles: 1,
      copies: 1,
      availableCopies: 0,
      activeLoans: 1,
      overdueLoans: 1,
      activeHolds: 0,
      lostCopies: 0,
      overdueLoanIds: ['loan-1'],
    });
  });
});
