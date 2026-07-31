import { describe, expect, it, vi } from 'vitest';

import {
  composeAdminRuntimeProjection,
  type AdminRuntimeProjectionComposerStore,
} from './runtime-admin-projection-composer.js';

const tenantId = '30000000-0000-4000-8000-000000000001';
const membershipId = '30000000-0000-4000-8000-000000000006';
const campusId = '30000000-0000-4000-8000-000000000003';
const correlationId = '30000000-0000-4000-8000-000000000030';

function input() {
  return {
    tenantId,
    membershipId,
    campusId,
    expectedPreviousRevision: 2,
    composerId: 'admin-home-composer-staging-01',
    correlationId,
  } as const;
}

function storeWith(result: unknown) {
  const compose = vi.fn().mockResolvedValue(result);
  const store: AdminRuntimeProjectionComposerStore = { compose };
  return { compose, store };
}

describe('admin runtime projection composer', () => {
  it('composes one validated database-owned admin home source', async () => {
    const result = {
      composed: true as const,
      composition: {
        compositionId: '30000000-0000-4000-8000-000000000031',
        tenantId,
        membershipId,
        campusId,
        state: 'published' as const,
        sourceRevision: 3,
        payloadDigest: 'a'.repeat(64),
        payloadBytes: 1024,
        correlationId,
        composedAt: '2026-07-31T17:00:00.000Z',
      },
    };
    const { compose, store } = storeWith(result);

    await expect(
      composeAdminRuntimeProjection({ configured: true, input: input(), store }),
    ).resolves.toEqual(result);
    expect(compose).toHaveBeenCalledWith(input());
  });

  it('preserves an explicitly resolved tenant-level null-campus scope', async () => {
    const tenantInput = { ...input(), campusId: null };
    const result = {
      composed: true as const,
      composition: {
        compositionId: '30000000-0000-4000-8000-000000000032',
        tenantId,
        membershipId,
        campusId: null,
        state: 'unchanged' as const,
        sourceRevision: 3,
        payloadDigest: 'b'.repeat(64),
        payloadBytes: 1024,
        correlationId,
        composedAt: '2026-07-31T17:01:00.000Z',
      },
    };
    const { compose, store } = storeWith(result);

    await expect(
      composeAdminRuntimeProjection({ configured: true, input: tenantInput, store }),
    ).resolves.toEqual(result);
    expect(compose).toHaveBeenCalledWith(tenantInput);
  });

  it('stays disabled without an explicitly configured privileged composer', async () => {
    const { compose, store } = storeWith({ composed: true });
    await expect(
      composeAdminRuntimeProjection({ configured: false, input: input(), store }),
    ).resolves.toEqual({ composed: false, reason: 'composer-disabled' });
    expect(compose).not.toHaveBeenCalled();
  });

  it('rejects malformed or caller-expanded composition inputs before storage', async () => {
    const { compose, store } = storeWith({ composed: true });
    const invalidInputs = [
      { ...input(), tenantId: 'tenant-browser-selected' },
      { ...input(), membershipId: 'membership-browser-selected' },
      { ...input(), campusId: 'campus-browser-selected' },
      { ...input(), expectedPreviousRevision: -1 },
      { ...input(), composerId: 'bad composer id' },
      { ...input(), correlationId: 'not-a-uuid' },
      { ...input(), payload: { metrics: [] } },
      { ...input(), persona: 'admin' },
      { ...input(), capabilities: ['reports.read'] },
    ];

    for (const candidate of invalidInputs) {
      await expect(
        composeAdminRuntimeProjection({ configured: true, input: candidate, store }),
      ).resolves.toEqual({ composed: false, reason: 'invalid-composition' });
    }
    expect(compose).not.toHaveBeenCalled();
  });

  it('sanitizes privileged composer outages', async () => {
    const compose = vi
      .fn()
      .mockRejectedValue(new Error('postgres://secret@database.internal/admin-composer'));
    const store: AdminRuntimeProjectionComposerStore = { compose };

    await expect(
      composeAdminRuntimeProjection({ configured: true, input: input(), store }),
    ).resolves.toEqual({ composed: false, reason: 'composer-unavailable' });
  });
});
