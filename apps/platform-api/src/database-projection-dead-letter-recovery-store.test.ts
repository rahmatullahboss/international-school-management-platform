import { describe, expect, it, vi } from 'vitest';

import { DatabaseProjectionDeadLetterRecoveryStore } from './database-projection-dead-letter-recovery-store.js';

const input = {
  tenantId: '50000000-0000-4000-8000-000000000001',
  deadLetterId: '50000000-0000-4000-8000-000000000002',
  actorAccountId: '50000000-0000-4000-8000-000000000003',
  idempotencyKey: 'projection-recovery-0001',
  reason: 'Source has been repaired and the exact failed command is safe to retry.',
  correlationId: '50000000-0000-4000-8000-000000000004',
} as const;

const accepted = {
  accepted: true,
  replayed: false,
  receipt: {
    recoveryId: '50000000-0000-4000-8000-000000000005',
    state: 'accepted',
    deadLetterId: input.deadLetterId,
    originalEventId: '50000000-0000-4000-8000-000000000006',
    replacementEventId: '50000000-0000-4000-8000-000000000007',
    commandId: '50000000-0000-4000-8000-000000000008',
    errorCode: 'source-unavailable',
    requestedAt: '2026-08-12T05:45:00.000Z',
  },
};

function databaseWith(rows: readonly Record<string, unknown>[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database projection dead-letter recovery store', () => {
  it('calls only the reviewed function with exact bounded arguments', async () => {
    const database = databaseWith([{ value: accepted }]);
    const store = new DatabaseProjectionDeadLetterRecoveryStore(database);
    await expect(store.recover(input)).resolves.toEqual(accepted);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.recover_runtime_projection_dead_letter'),
      [
        input.tenantId,
        input.deadLetterId,
        input.actorAccountId,
        input.idempotencyKey,
        input.reason,
        input.correlationId,
      ],
    );
  });

  it('accepts only allowlisted database rejection reasons', async () => {
    const store = new DatabaseProjectionDeadLetterRecoveryStore(
      databaseWith([{ value: { accepted: false, reason: 'dead-letter-not-recoverable' } }]),
    );
    await expect(store.recover(input)).resolves.toEqual({
      accepted: false,
      reason: 'dead-letter-not-recoverable',
    });
  });

  it('fails closed on malformed, expanded, cross-dead-letter or secret-bearing responses', async () => {
    const invalidRows = [
      [],
      [{ value: accepted }, { value: accepted }],
      [{ value: { accepted: false, reason: 'force-replayed' } }],
      [{ value: { ...accepted, receipt: { ...accepted.receipt, deadLetterId: input.tenantId } } }],
      [{ value: { ...accepted, receipt: { ...accepted.receipt, errorCode: 'invalid-event' } } }],
      [{ value: { ...accepted, databaseUrl: 'postgres://secret@database.internal' } }],
      [{ value: { ...accepted, receipt: { ...accepted.receipt, payload: { secret: true } } } }],
    ];
    for (const rows of invalidRows) {
      await expect(
        new DatabaseProjectionDeadLetterRecoveryStore(databaseWith(rows)).recover(input),
      ).rejects.toThrow(/invalid database response/u);
    }
  });
});
