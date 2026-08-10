import { describe, expect, it, vi } from 'vitest';

import { DatabaseOperatorDomainCommandStore } from './database-operator-domain-command-store.js';

const sessionId = '71000000-0000-4000-8000-000000000001';
const correlationId = '71000000-0000-4000-8000-000000000002';
const applicationId = '71000000-0000-4000-8000-000000000003';
const bankStatementLineId = '71000000-0000-4000-8000-000000000004';
const paymentId = '71000000-0000-4000-8000-000000000005';
const programId = '71000000-0000-4000-8000-000000000006';
const academicYearId = '71000000-0000-4000-8000-000000000007';

function databaseWith(value: unknown) {
  return { query: vi.fn().mockResolvedValue([{ value }]) };
}

const receipt = {
  commandId: '71000000-0000-4000-8000-000000000010',
  command: 'admissions.application.review.record',
  domainEvidenceId: '71000000-0000-4000-8000-000000000011',
  idempotencyKey: 'admissions-review-0001',
  correlationId,
  acceptedAt: '2026-08-01T10:30:00.000Z',
};

describe('database operator domain command store', () => {
  it('calls only the reviewed admissions function with server-resolved session scope', async () => {
    const database = databaseWith({ accepted: true, replayed: false, receipt });
    const store = new DatabaseOperatorDomainCommandStore(database);
    const input = {
      sessionId,
      idempotencyKey: 'admissions-review-0001',
      correlationId,
      command: 'admissions.application.review.record' as const,
      applicationId,
      expectedVersion: 3,
      recommendation: 'more-information' as const,
      score: 82.5,
      notes: 'Request one additional verified school record before the decision review.',
    };

    await expect(store.submit(input)).resolves.toEqual({
      accepted: true,
      replayed: false,
      receipt,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('admissions.record_application_review_command'),
      [
        sessionId,
        applicationId,
        3,
        'more-information',
        82.5,
        input.notes,
        input.idempotencyKey,
        correlationId,
      ],
    );
  });

  it('calls only the server-scoped admissions offer function', async () => {
    const offerReceipt = {
      ...receipt,
      command: 'admissions.application.offer.issue' as const,
      domainEvidenceId: '71000000-0000-4000-8000-000000000012',
      idempotencyKey: 'admissions-offer-0001',
    };
    const database = databaseWith({ accepted: true, replayed: false, receipt: offerReceipt });
    const store = new DatabaseOperatorDomainCommandStore(database);
    const input = {
      sessionId,
      idempotencyKey: 'admissions-offer-0001',
      correlationId,
      command: 'admissions.application.offer.issue' as const,
      applicationId,
      expectedVersion: 4,
      programId,
      academicYearId,
      gradeLevelId: null,
      expiresAt: '2026-09-01T00:00:00.000Z',
    };

    await expect(store.submit(input)).resolves.toEqual({
      accepted: true,
      replayed: false,
      receipt: offerReceipt,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('admissions.issue_application_offer_catalog_command'),
      [
        sessionId,
        applicationId,
        4,
        programId,
        academicYearId,
        null,
        input.expiresAt,
        input.idempotencyKey,
        correlationId,
      ],
    );
  });

  it('calls only the server-scoped admissions offer acceptance function', async () => {
    const acceptReceipt = {
      ...receipt,
      command: 'admissions.application.offer.accept' as const,
      domainEvidenceId: '71000000-0000-4000-8000-000000000013',
      idempotencyKey: 'admissions-accept-0001',
    };
    const database = databaseWith({ accepted: true, replayed: false, receipt: acceptReceipt });
    const store = new DatabaseOperatorDomainCommandStore(database);
    const input = {
      sessionId,
      idempotencyKey: 'admissions-accept-0001',
      correlationId,
      command: 'admissions.application.offer.accept' as const,
      applicationId,
      expectedVersion: 5,
    };

    await expect(store.submit(input)).resolves.toEqual({
      accepted: true,
      replayed: false,
      receipt: acceptReceipt,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('admissions.accept_application_offer_command'),
      [sessionId, applicationId, 5, input.idempotencyKey, correlationId],
    );
  });

  it('calls only the server-scoped accepted-applicant conversion function', async () => {
    const conversionReceipt = {
      ...receipt,
      command: 'admissions.application.applicant.convert' as const,
      domainEvidenceId: '71000000-0000-4000-8000-000000000014',
      idempotencyKey: 'admissions-convert-0001',
    };
    const database = databaseWith({ accepted: true, replayed: false, receipt: conversionReceipt });
    const store = new DatabaseOperatorDomainCommandStore(database);
    const input = {
      sessionId,
      idempotencyKey: 'admissions-convert-0001',
      correlationId,
      command: 'admissions.application.applicant.convert' as const,
      applicationId,
      expectedVersion: 6,
      effectiveFrom: '2026-09-15',
    };

    await expect(store.submit(input)).resolves.toEqual({
      accepted: true,
      replayed: false,
      receipt: conversionReceipt,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('admissions.convert_accepted_applicant_command'),
      [sessionId, applicationId, 6, input.effectiveFrom, input.idempotencyKey, correlationId],
    );
  });

  it('calls only the reviewed finance reconciliation function', async () => {
    const database = databaseWith({
      accepted: false,
      reason: 'domain-conflict',
    });
    const store = new DatabaseOperatorDomainCommandStore(database);
    const input = {
      sessionId,
      idempotencyKey: 'finance-reconcile-0001',
      correlationId,
      command: 'finance.bank-line.reconcile' as const,
      bankStatementLineId,
      paymentId,
      reason: 'Verified the bank reference, amount and currency against the settled receipt.',
    };

    await expect(store.submit(input)).resolves.toEqual({
      accepted: false,
      reason: 'domain-conflict',
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('billing.reconcile_bank_statement_line_command'),
      [
        sessionId,
        bankStatementLineId,
        paymentId,
        input.reason,
        input.idempotencyKey,
        correlationId,
      ],
    );
  });

  it('calls only the reviewed AAL2 support request function', async () => {
    const database = databaseWith({
      accepted: false,
      reason: 'step-up-required',
      requiredAssurance: 'aal2',
    });
    const store = new DatabaseOperatorDomainCommandStore(database);
    const input = {
      sessionId,
      idempotencyKey: 'support-break-glass-0001',
      correlationId,
      command: 'support.break-glass.request' as const,
      reason: 'Investigate a tenant-scoped authentication outage using approved diagnostics.',
      requestedMinutes: 15,
    };

    await expect(store.submit(input)).resolves.toEqual({
      accepted: false,
      reason: 'step-up-required',
      requiredAssurance: 'aal2',
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('iam.request_privileged_support_access_command'),
      [sessionId, input.reason, 15, input.idempotencyKey, correlationId],
    );
  });

  it('fails closed on malformed, secret-bearing or ambiguous database responses', async () => {
    const input = {
      sessionId,
      idempotencyKey: 'support-break-glass-0001',
      correlationId,
      command: 'support.break-glass.request' as const,
      reason: 'Investigate a tenant-scoped authentication outage using approved diagnostics.',
      requestedMinutes: 15,
    };

    const malformedValues = [
      undefined,
      { accepted: true },
      { accepted: false, reason: 'postgres://secret@internal' },
      { accepted: false, reason: 'step-up-required' },
      { accepted: false, reason: 'permission-not-granted', requiredAssurance: 'aal2' },
    ];

    for (const value of malformedValues) {
      const database = databaseWith(value);
      const store = new DatabaseOperatorDomainCommandStore(database);
      await expect(store.submit(input)).rejects.toThrow(/invalid database response/u);
    }

    const ambiguousDatabase = {
      query: vi
        .fn()
        .mockResolvedValue([
          { value: { accepted: false, reason: 'session-inactive' } },
          { value: { accepted: false, reason: 'session-inactive' } },
        ]),
    };
    await expect(
      new DatabaseOperatorDomainCommandStore(ambiguousDatabase).submit(input),
    ).rejects.toThrow(/invalid database response/u);
  });
});
