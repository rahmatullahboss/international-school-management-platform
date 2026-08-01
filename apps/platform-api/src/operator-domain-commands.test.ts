import { describe, expect, it, vi } from 'vitest';

import {
  submitOperatorDomainCommand,
  type OperatorDomainCommandStore,
} from './operator-domain-commands.js';

const sessionId = '71000000-0000-4000-8000-000000000001';
const correlationId = '71000000-0000-4000-8000-000000000002';
const applicationId = '71000000-0000-4000-8000-000000000003';
const bankStatementLineId = '71000000-0000-4000-8000-000000000004';
const paymentId = '71000000-0000-4000-8000-000000000005';

function storeWith(result: unknown) {
  const submit = vi.fn().mockResolvedValue(result);
  const store: OperatorDomainCommandStore = { submit };
  return { store, submit };
}

function admissionsInput() {
  return {
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
}

function financeInput() {
  return {
    sessionId,
    idempotencyKey: 'finance-reconcile-0001',
    correlationId,
    command: 'finance.bank-line.reconcile' as const,
    bankStatementLineId,
    paymentId,
    reason: 'Verified the bank reference, amount and currency against the settled receipt.',
  };
}

function supportInput() {
  return {
    sessionId,
    idempotencyKey: 'support-break-glass-0001',
    correlationId,
    command: 'support.break-glass.request' as const,
    reason: 'Investigate a tenant-scoped authentication outage using approved diagnostics.',
    requestedMinutes: 15,
  };
}

const accepted = {
  accepted: true as const,
  replayed: false,
  receipt: {
    commandId: '71000000-0000-4000-8000-000000000010',
    command: 'admissions.application.review.record' as const,
    domainEvidenceId: '71000000-0000-4000-8000-000000000011',
    idempotencyKey: 'admissions-review-0001',
    correlationId,
    acceptedAt: '2026-08-01T10:30:00.000Z',
  },
};

describe('operator domain command boundary', () => {
  it('submits exact server-scoped admissions, finance and support commands', async () => {
    for (const input of [admissionsInput(), financeInput(), supportInput()]) {
      const { store, submit } = storeWith(accepted);
      await expect(
        submitOperatorDomainCommand({ configured: true, input, store }),
      ).resolves.toEqual(accepted);
      expect(submit).toHaveBeenCalledWith(input);
    }
  });

  it('stays disabled without an explicitly configured durable command store', async () => {
    const { store, submit } = storeWith(accepted);
    await expect(
      submitOperatorDomainCommand({ configured: false, input: admissionsInput(), store }),
    ).resolves.toEqual({ accepted: false, reason: 'command-disabled' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects caller-expanded scope and malformed command-specific fields before storage', async () => {
    const { store, submit } = storeWith(accepted);
    const invalidInputs: unknown[] = [
      { ...admissionsInput(), sessionId: 'browser-session' },
      { ...admissionsInput(), tenantId: 'browser-selected-tenant' },
      { ...admissionsInput(), campusId: 'browser-selected-campus' },
      { ...admissionsInput(), accountId: 'browser-selected-account' },
      { ...admissionsInput(), idempotencyKey: 'bad key' },
      { ...admissionsInput(), correlationId: 'bad-correlation' },
      { ...admissionsInput(), expectedVersion: 0 },
      { ...admissionsInput(), expectedVersion: 3.5 },
      { ...admissionsInput(), recommendation: 'auto-admit' },
      { ...admissionsInput(), score: 101 },
      { ...admissionsInput(), notes: 'x'.repeat(2001) },
      { ...financeInput(), reason: 'short' },
      { ...financeInput(), applicationId },
      { ...supportInput(), requestedMinutes: 31 },
      { ...supportInput(), requestedMinutes: 4 },
      { ...supportInput(), targetTenantId: 'caller-selected-tenant' },
    ];

    for (const input of invalidInputs) {
      await expect(
        submitOperatorDomainCommand({ configured: true, input, store }),
      ).resolves.toEqual({ accepted: false, reason: 'invalid-command' });
    }
    expect(submit).not.toHaveBeenCalled();
  });

  it('sanitizes durable command store outages', async () => {
    const store: OperatorDomainCommandStore = {
      submit: vi.fn().mockRejectedValue(new Error('postgres://secret@internal/operator-command')),
    };
    await expect(
      submitOperatorDomainCommand({ configured: true, input: financeInput(), store }),
    ).resolves.toEqual({ accepted: false, reason: 'command-unavailable' });
  });
});
