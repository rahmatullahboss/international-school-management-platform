import { describe, expect, it, vi } from 'vitest';

import {
  recoverRuntimeProjectionDeadLetter,
  type RuntimeProjectionDeadLetterRecoveryStore,
} from './runtime-projection-dead-letter-recovery.js';

const input = {
  tenantId: '50000000-0000-4000-8000-000000000001',
  deadLetterId: '50000000-0000-4000-8000-000000000002',
  actorAccountId: '50000000-0000-4000-8000-000000000003',
  idempotencyKey: 'projection-recovery-0001',
  reason: 'Source has been repaired and the exact failed command is safe to retry.',
  correlationId: '50000000-0000-4000-8000-000000000004',
} as const;

const accepted = {
  accepted: true as const,
  replayed: false,
  receipt: {
    recoveryId: '50000000-0000-4000-8000-000000000005',
    state: 'accepted' as const,
    deadLetterId: input.deadLetterId,
    originalEventId: '50000000-0000-4000-8000-000000000006',
    replacementEventId: '50000000-0000-4000-8000-000000000007',
    commandId: '50000000-0000-4000-8000-000000000008',
    errorCode: 'source-unavailable' as const,
    requestedAt: '2026-08-12T05:45:00.000Z',
  },
};

function storeWith(result: unknown) {
  const recover = vi.fn().mockResolvedValue(result);
  const store: RuntimeProjectionDeadLetterRecoveryStore = { recover };
  return { recover, store };
}

describe('runtime projection dead-letter recovery', () => {
  it('submits one validated recovery request to the privileged store', async () => {
    const { recover, store } = storeWith(accepted);
    await expect(
      recoverRuntimeProjectionDeadLetter({ configured: true, input, store }),
    ).resolves.toEqual(accepted);
    expect(recover).toHaveBeenCalledWith(input);
  });

  it('stays disabled unless the privileged recovery credential is configured', async () => {
    const { recover, store } = storeWith(accepted);
    await expect(
      recoverRuntimeProjectionDeadLetter({ configured: false, input, store }),
    ).resolves.toEqual({ accepted: false, reason: 'recovery-disabled' });
    expect(recover).not.toHaveBeenCalled();
  });

  it('rejects malformed and caller-expanded requests before privileged storage', async () => {
    const { recover, store } = storeWith(accepted);
    const invalidInputs = [
      { ...input, tenantId: 'cross-tenant' },
      { ...input, deadLetterId: 'not-a-uuid' },
      { ...input, actorAccountId: 'not-a-uuid' },
      { ...input, idempotencyKey: 'short' },
      { ...input, reason: '' },
      { ...input, reason: `bad\nreason` },
      { ...input, correlationId: 'not-a-uuid' },
      { ...input, replacementEventId: 'caller-controlled' },
      { ...input, errorCode: 'processor-error' },
      { ...input, force: true },
    ];
    for (const candidate of invalidInputs) {
      await expect(
        recoverRuntimeProjectionDeadLetter({ configured: true, input: candidate, store }),
      ).resolves.toEqual({ accepted: false, reason: 'invalid-recovery-request' });
    }
    expect(recover).not.toHaveBeenCalled();
  });

  it('passes through reviewed fail-closed rejection reasons', async () => {
    const { store } = storeWith({ accepted: false, reason: 'projection-state-changed' });
    await expect(
      recoverRuntimeProjectionDeadLetter({ configured: true, input, store }),
    ).resolves.toEqual({ accepted: false, reason: 'projection-state-changed' });
  });

  it('sanitizes privileged recovery outages', async () => {
    const recover = vi
      .fn()
      .mockRejectedValue(new Error('postgres://secret@database.internal/projection-recovery'));
    const store: RuntimeProjectionDeadLetterRecoveryStore = { recover };
    await expect(
      recoverRuntimeProjectionDeadLetter({ configured: true, input, store }),
    ).resolves.toEqual({ accepted: false, reason: 'recovery-unavailable' });
  });
});
