import { describe, expect, it } from 'vitest';

import {
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
} from '../../packages/modules/hr/src/index.js';
import {
  InMemoryLibraryFineGateway,
  LibraryService,
  type LibraryFineSourceDocument,
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

function setup() {
  const fines = new InMemoryLibraryFineGateway();
  const service = new LibraryService(
    scope,
    new InMemoryOperationsEventPublisher(),
    new InMemoryOperationsAuditWriter(),
    fines,
  );
  return { service, fines };
}

function registerTitle(service: LibraryService, id = 'title-1', isbn = '9780000000001') {
  return service.registerTitle(
    {
      id,
      isbn,
      title: `Title ${id}`,
      authors: ['A. Author'],
      subjectCodes: ['GENERAL'],
      publisher: 'Learning Press',
      publicationYear: 2024,
      language: 'en',
    },
    librarian,
    `corr-${id}`,
  );
}

function registerCopy(
  service: LibraryService,
  id = 'copy-1',
  titleId = 'title-1',
  barcode = 'LIB-0001',
) {
  return service.registerCopy(
    {
      id,
      titleId,
      barcode,
      homeLocationRef: 'library-main',
      replacementCostMinor: 2_000,
      currency: 'BDT',
    },
    librarian,
    `corr-${id}`,
  );
}

function registerPatron(
  service: LibraryService,
  id: string,
  patronType: 'student' | 'staff' | 'guardian' | 'external' = 'student',
  active = true,
) {
  return service.registerPatron(
    {
      id,
      personRef: `person-${id}`,
      patronType,
      displayName: `Patron ${id}`,
      active,
    },
    librarian,
    `corr-${id}`,
  );
}

function checkout(
  service: LibraryService,
  loanId: string,
  copyId: string,
  patronId: string,
  checkedOutAt = '2026-08-01T10:00:00.000Z',
) {
  return service.checkout(
    { id: loanId, copyId, patronId, checkedOutAt },
    librarian,
    `corr-${loanId}`,
  );
}

describe('library integrity boundaries', () => {
  it('rejects malformed or duplicate catalogue, copy and patron identities', () => {
    const { service } = setup();

    expect(() =>
      service.registerTitle(
        {
          id: 'title-invalid-year',
          isbn: '9780000000999',
          title: 'Invalid Year',
          authors: ['A. Author'],
          subjectCodes: [],
          publisher: 'Learning Press',
          publicationYear: 999,
          language: 'en',
        },
        librarian,
        'corr-invalid-year',
      ),
    ).toThrow('OPS_INVALID_PUBLICATION_YEAR');
    expect(() =>
      service.registerTitle(
        {
          id: 'title-no-author',
          isbn: '9780000000998',
          title: 'No Author',
          authors: [],
          subjectCodes: [],
          publisher: 'Learning Press',
          publicationYear: 2024,
          language: 'en',
        },
        librarian,
        'corr-no-author',
      ),
    ).toThrow('OPS_LIBRARY_AUTHOR_REQUIRED');

    registerTitle(service);
    expect(() => registerTitle(service, 'title-2', '978-0000000001')).toThrow(
      'OPS_DUPLICATE_LIBRARY_TITLE',
    );
    expect(() =>
      service.registerCopy(
        {
          id: 'copy-invalid-cost',
          titleId: 'title-1',
          barcode: 'LIB-BAD',
          homeLocationRef: 'library-main',
          replacementCostMinor: -1,
          currency: 'BDT',
        },
        librarian,
        'corr-invalid-cost',
      ),
    ).toThrow('OPS_INVALID_MONEY:replacementCostMinor');

    registerCopy(service);
    expect(() => registerCopy(service, 'copy-2', 'title-1', ' lib-0001 ')).toThrow(
      'OPS_DUPLICATE_LIBRARY_COPY',
    );
    registerPatron(service, 'patron-1');
    expect(() =>
      service.registerPatron(
        {
          id: 'patron-2',
          personRef: 'person-patron-1',
          patronType: 'student',
          displayName: 'Duplicate person',
          active: true,
        },
        librarian,
        'corr-duplicate-person',
      ),
    ).toThrow('OPS_DUPLICATE_LIBRARY_PATRON');
  });

  it('enforces patron activity, loan limits and duplicate-loan identifiers', () => {
    const { service } = setup();
    registerTitle(service);
    registerCopy(service, 'copy-1', 'title-1', 'LIB-0001');
    registerCopy(service, 'copy-2', 'title-1', 'LIB-0002');
    registerCopy(service, 'copy-3', 'title-1', 'LIB-0003');
    registerPatron(service, 'inactive', 'external', false);
    registerPatron(service, 'external', 'external');

    expect(() => checkout(service, 'loan-inactive', 'copy-1', 'inactive')).toThrow(
      'OPS_LIBRARY_PATRON_INACTIVE',
    );
    checkout(service, 'loan-1', 'copy-1', 'external');
    checkout(service, 'loan-2', 'copy-2', 'external');
    expect(() => checkout(service, 'loan-3', 'copy-3', 'external')).toThrow(
      'OPS_LIBRARY_LOAN_LIMIT',
    );

    service.returnCopy(
      { loanId: 'loan-2', returnedAt: '2026-08-02T10:00:00.000Z', condition: 'good' },
      librarian,
      'corr-return-loan-2',
    );
    expect(() => checkout(service, 'loan-1', 'copy-2', 'external')).toThrow(
      'OPS_DUPLICATE_LIBRARY_LOAN',
    );
  });

  it('permits bounded renewal and blocks further renewal at the patron policy limit', () => {
    const { service } = setup();
    registerTitle(service);
    registerCopy(service);
    registerPatron(service, 'guardian', 'guardian');
    const loan = checkout(service, 'loan-1', 'copy-1', 'guardian');

    const renewed = service.renewLoan(loan.id, librarian, 'corr-renew-1');
    expect(renewed.renewals).toBe(1);
    expect(renewed.dueAt).toBe('2026-08-29T10:00:00.000Z');
    expect(() => service.renewLoan(loan.id, librarian, 'corr-renew-2')).toThrow(
      'OPS_LIBRARY_RENEWAL_LIMIT',
    );

    service.returnCopy(
      { loanId: loan.id, returnedAt: '2026-08-10T10:00:00.000Z', condition: 'good' },
      librarian,
      'corr-return',
    );
    expect(() => service.renewLoan(loan.id, librarian, 'corr-renew-returned')).toThrow(
      'OPS_LIBRARY_LOAN_NOT_ACTIVE',
    );
  });

  it('deduplicates holds, honors deterministic priority and fulfills the winning hold on checkout', () => {
    const { service } = setup();
    registerTitle(service);
    registerCopy(service);
    registerPatron(service, 'patron-a');
    registerPatron(service, 'patron-b');

    const placedAt = '2026-08-01T09:00:00.000Z';
    service.placeHold(
      { id: 'hold-b', titleId: 'title-1', patronId: 'patron-b', placedAt },
      librarian,
      'corr-hold-b',
    );
    service.placeHold(
      { id: 'hold-a', titleId: 'title-1', patronId: 'patron-a', placedAt },
      librarian,
      'corr-hold-a',
    );
    expect(() =>
      service.placeHold(
        { id: 'hold-a-duplicate', titleId: 'title-1', patronId: 'patron-a', placedAt },
        librarian,
        'corr-hold-duplicate',
      ),
    ).toThrow('OPS_DUPLICATE_LIBRARY_HOLD');
    expect(() => checkout(service, 'loan-b', 'copy-1', 'patron-b')).toThrow(
      'OPS_LIBRARY_HOLD_PRIORITY',
    );

    checkout(service, 'loan-a', 'copy-1', 'patron-a');
    service.returnCopy(
      { loanId: 'loan-a', returnedAt: '2026-08-02T10:00:00.000Z', condition: 'good' },
      librarian,
      'corr-return-a',
    );
    expect(service.findCopy('copy-1')?.status).toBe('on-hold');
    const loanB = checkout(service, 'loan-b', 'copy-1', 'patron-b');
    expect(loanB.patronId).toBe('patron-b');
  });

  it('records damaged and lost copy fines idempotently and keeps terminal loan states stable', () => {
    const { service, fines } = setup();
    registerTitle(service);
    registerCopy(service, 'copy-1', 'title-1', 'LIB-0001');
    registerCopy(service, 'copy-2', 'title-1', 'LIB-0002');
    registerPatron(service, 'patron-1');
    const damagedLoan = checkout(service, 'loan-damaged', 'copy-1', 'patron-1');

    const damaged = service.returnCopy(
      {
        loanId: damagedLoan.id,
        returnedAt: '2026-08-02T10:00:00.000Z',
        condition: 'damaged',
      },
      librarian,
      'corr-damaged',
    );
    expect(damaged.fineMinor).toBe(0);
    expect(service.findCopy('copy-1')?.status).toBe('damaged');
    expect(fines.documents).toEqual([
      expect.objectContaining({ sourceType: 'library-damaged', amountMinor: 1_000 }),
    ]);
    expect(
      service.returnCopy(
        {
          loanId: damagedLoan.id,
          returnedAt: '2026-08-03T10:00:00.000Z',
          condition: 'good',
        },
        librarian,
        'corr-return-replay',
      ),
    ).toEqual(damaged);

    const lostLoan = checkout(service, 'loan-lost', 'copy-2', 'patron-1');
    const lost = service.markLost(lostLoan.id, '2026-08-03T10:00:00.000Z', librarian, 'corr-lost');
    expect(
      service.markLost(lostLoan.id, '2026-08-04T10:00:00.000Z', librarian, 'corr-lost-replay'),
    ).toEqual(lost);
    expect(() =>
      service.returnCopy(
        { loanId: lostLoan.id, returnedAt: '2026-08-04T10:00:00.000Z', condition: 'good' },
        librarian,
        'corr-return-lost',
      ),
    ).not.toThrow();

    const source: LibraryFineSourceDocument = {
      contractVersion: '1.0',
      tenantId: scope.tenantId,
      legalEntityId: scope.legalEntityId,
      campusId: scope.campusId,
      sourceType: 'library-lost',
      sourceId: 'manual-lost-source',
      patronRef: 'person-patron-1',
      copyRef: 'copy-2',
      amountMinor: 2_000,
      currency: 'BDT',
      occurredAt: '2026-08-03T10:00:00.000Z',
      correlationId: 'corr-manual-fine',
      idempotencyKey: 'manual-fine-key',
    };
    const firstRef = fines.submitFineSource(source);
    expect(fines.submitFineSource(source)).toBe(firstRef);
  });

  it('reports active holds and lost copies while keeping lookups fail-safe', () => {
    const { service } = setup();
    registerTitle(service);
    registerCopy(service, 'copy-1', 'title-1', 'LIB-0001');
    registerCopy(service, 'copy-2', 'title-1', 'LIB-0002');
    registerPatron(service, 'patron-1');
    registerPatron(service, 'patron-2');
    const loan = checkout(service, 'loan-1', 'copy-1', 'patron-1', '2026-07-01T10:00:00.000Z');
    const second = checkout(service, 'loan-2', 'copy-2', 'patron-1', '2026-07-03T10:00:00.000Z');
    service.markLost(second.id, '2026-07-05T10:00:00.000Z', librarian, 'corr-lost');
    service.placeHold(
      {
        id: 'hold-1',
        titleId: 'title-1',
        patronId: 'patron-2',
        placedAt: '2026-07-06T10:00:00.000Z',
      },
      librarian,
      'corr-hold',
    );

    expect(service.libraryReport('2026-07-20T10:00:00.000Z', librarian)).toMatchObject({
      titles: 1,
      copies: 2,
      availableCopies: 0,
      activeLoans: 1,
      overdueLoans: 1,
      activeHolds: 1,
      lostCopies: 1,
      overdueLoanIds: [loan.id],
    });
    expect(service.findTitle('missing')).toBeUndefined();
    expect(service.findCopy('missing')).toBeUndefined();
    expect(service.findPatron('missing')).toBeUndefined();
    expect(service.findLoan('missing')).toBeUndefined();
    expect(() => service.renewLoan('missing', librarian, 'corr-missing-loan')).toThrow(
      'OPS_NOT_FOUND:library-loan',
    );
  });
});
