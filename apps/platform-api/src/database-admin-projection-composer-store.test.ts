import { describe, expect, it, vi } from 'vitest';

import { DatabaseAdminProjectionComposerStore } from './database-admin-projection-composer-store.js';

const tenantId = '30000000-0000-4000-8000-000000000001';
const membershipId = '30000000-0000-4000-8000-000000000006';
const campusId = '30000000-0000-4000-8000-000000000003';
const correlationId = '30000000-0000-4000-8000-000000000030';

function compositionInput() {
  return {
    tenantId,
    membershipId,
    campusId,
    expectedPreviousRevision: 2,
    composerId: 'admin-home-composer-staging-01',
    correlationId,
  } as const;
}

function databaseWith(rows: readonly Record<string, unknown>[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database admin projection composer store', () => {
  it('calls the reviewed privileged admin composition function', async () => {
    const composition = {
      compositionId: '30000000-0000-4000-8000-000000000031',
      tenantId,
      membershipId,
      campusId,
      state: 'published',
      sourceRevision: 3,
      payloadDigest: 'a'.repeat(64),
      payloadBytes: 1024,
      correlationId,
      composedAt: '2026-07-31T17:00:00.000Z',
    };
    const database = databaseWith([{ value: { composed: true, composition } }]);
    const store = new DatabaseAdminProjectionComposerStore(database);

    await expect(store.compose(compositionInput())).resolves.toEqual({
      composed: true,
      composition,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.compose_admin_runtime_projection_source'),
      [tenantId, membershipId, campusId, 2, compositionInput().composerId, correlationId],
    );
  });

  it('accepts unchanged composition evidence and reviewed rejection reasons', async () => {
    const unchanged = {
      compositionId: '30000000-0000-4000-8000-000000000032',
      tenantId,
      membershipId,
      campusId,
      state: 'unchanged',
      sourceRevision: 3,
      payloadDigest: 'b'.repeat(64),
      payloadBytes: 1024,
      correlationId,
      composedAt: '2026-07-31T17:01:00.000Z',
    };
    await expect(
      new DatabaseAdminProjectionComposerStore(
        databaseWith([{ value: { composed: true, composition: unchanged } }]),
      ).compose(compositionInput()),
    ).resolves.toEqual({ composed: true, composition: unchanged });

    await expect(
      new DatabaseAdminProjectionComposerStore(
        databaseWith([
          { value: { composed: false, reason: 'revision-conflict', currentRevision: 4 } },
        ]),
      ).compose(compositionInput()),
    ).resolves.toEqual({
      composed: false,
      reason: 'revision-conflict',
      currentRevision: 4,
    });
  });

  it('fails closed on malformed or ambiguous database responses', async () => {
    await expect(
      new DatabaseAdminProjectionComposerStore(databaseWith([])).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseAdminProjectionComposerStore(
        databaseWith([{ value: { composed: true } }, { value: { composed: true } }]),
      ).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseAdminProjectionComposerStore(
        databaseWith([{ value: { composed: false, reason: 'database-secret-leaked' } }]),
      ).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
  });
});
