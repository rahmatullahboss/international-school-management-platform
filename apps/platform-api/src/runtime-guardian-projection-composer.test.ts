import { describe, expect, it, vi } from 'vitest';

import {
  composeGuardianRuntimeProjection,
  type GuardianRuntimeProjectionComposerStore,
} from './runtime-guardian-projection-composer.js';

const tenantId = '40000000-0000-4000-8000-000000000001';
const membershipId = '40000000-0000-4000-8000-000000000006';
const campusId = '40000000-0000-4000-8000-000000000003';
const correlationId = '40000000-0000-4000-8000-000000000050';

function input() {
  return {
    tenantId,
    membershipId,
    campusId,
    expectedPreviousRevision: 0,
    composerId: 'guardian-home-composer-staging-01',
    correlationId,
  } as const;
}

function storeWith(result: unknown) {
  const compose = vi.fn().mockResolvedValue(result);
  const store: GuardianRuntimeProjectionComposerStore = { compose };
  return { compose, store };
}

describe('guardian runtime projection composer', () => {
  it('composes one validated database-owned guardian home source', async () => {
    const result = {
      composed: true as const,
      composition: {
        compositionId: '40000000-0000-4000-8000-000000000051',
        tenantId,
        membershipId,
        campusId,
        state: 'published' as const,
        sourceRevision: 1,
        payloadDigest: 'a'.repeat(64),
        payloadBytes: 2048,
        correlationId,
        composedAt: '2026-08-01T01:00:00.000Z',
      },
    };
    const { compose, store } = storeWith(result);

    await expect(
      composeGuardianRuntimeProjection({ configured: true, input: input(), store }),
    ).resolves.toEqual(result);
    expect(compose).toHaveBeenCalledWith(input());
  });

  it('stays disabled without an explicitly configured privileged composer', async () => {
    const { compose, store } = storeWith({ composed: true });
    await expect(
      composeGuardianRuntimeProjection({ configured: false, input: input(), store }),
    ).resolves.toEqual({ composed: false, reason: 'composer-disabled' });
    expect(compose).not.toHaveBeenCalled();
  });

  it('rejects malformed or caller-expanded composition inputs before storage', async () => {
    const { compose, store } = storeWith({ composed: true });
    const invalidInputs = [
      { ...input(), tenantId: 'tenant-browser-selected' },
      { ...input(), membershipId: 'membership-browser-selected' },
      { ...input(), campusId: null },
      { ...input(), expectedPreviousRevision: -1 },
      { ...input(), expectedPreviousRevision: 1.5 },
      { ...input(), expectedPreviousRevision: Number.MAX_SAFE_INTEGER + 1 },
      { ...input(), expectedPreviousRevision: Number.POSITIVE_INFINITY },
      { ...input(), composerId: 'bad composer id' },
      { ...input(), correlationId: 'not-a-uuid' },
      { ...input(), payload: { children: [] } },
      { ...input(), persona: 'guardian' },
      { ...input(), guardianPersonId: 'browser-selected-guardian' },
      { ...input(), childIds: ['browser-selected-child'] },
      { ...input(), authorities: ['education'] },
      { ...input(), capabilities: ['student.household.read'] },
    ];

    for (const candidate of invalidInputs) {
      await expect(
        composeGuardianRuntimeProjection({ configured: true, input: candidate, store }),
      ).resolves.toEqual({ composed: false, reason: 'invalid-composition' });
    }
    expect(compose).not.toHaveBeenCalled();
  });

  it('sanitizes privileged composer outages', async () => {
    const compose = vi
      .fn()
      .mockRejectedValue(new Error('postgres://secret@database.internal/guardian-composer'));
    const store: GuardianRuntimeProjectionComposerStore = { compose };

    await expect(
      composeGuardianRuntimeProjection({ configured: true, input: input(), store }),
    ).resolves.toEqual({ composed: false, reason: 'composer-unavailable' });
  });
});
