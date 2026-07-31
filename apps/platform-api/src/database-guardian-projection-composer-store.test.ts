import { describe, expect, it, vi } from 'vitest';

import { DatabaseGuardianProjectionComposerStore } from './database-guardian-projection-composer-store.js';

const tenantId = '40000000-0000-4000-8000-000000000001';
const membershipId = '40000000-0000-4000-8000-000000000006';
const campusId = '40000000-0000-4000-8000-000000000003';
const correlationId = '40000000-0000-4000-8000-000000000050';

function compositionInput() {
  return {
    tenantId,
    membershipId,
    campusId,
    expectedPreviousRevision: 0,
    composerId: 'guardian-home-composer-staging-01',
    correlationId,
  } as const;
}

function databaseWith(rows: readonly Record<string, unknown>[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database guardian projection composer store', () => {
  it('calls the reviewed privileged guardian composition function', async () => {
    const composition = {
      compositionId: '40000000-0000-4000-8000-000000000051',
      tenantId,
      membershipId,
      campusId,
      state: 'published',
      sourceRevision: 1,
      payloadDigest: 'a'.repeat(64),
      payloadBytes: 2048,
      correlationId,
      composedAt: '2026-08-01T01:00:00.000Z',
    };
    const database = databaseWith([{ value: { composed: true, composition } }]);
    const store = new DatabaseGuardianProjectionComposerStore(database);

    await expect(store.compose(compositionInput())).resolves.toEqual({
      composed: true,
      composition,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.compose_guardian_runtime_projection_source'),
      [tenantId, membershipId, campusId, 0, compositionInput().composerId, correlationId],
    );
  });

  it('accepts unchanged evidence and reviewed rejection reasons', async () => {
    const unchanged = {
      compositionId: '40000000-0000-4000-8000-000000000052',
      tenantId,
      membershipId,
      campusId,
      state: 'unchanged',
      sourceRevision: 1,
      payloadDigest: 'b'.repeat(64),
      payloadBytes: 2048,
      correlationId,
      composedAt: '2026-08-01T01:01:00.000Z',
    };
    await expect(
      new DatabaseGuardianProjectionComposerStore(
        databaseWith([{ value: { composed: true, composition: unchanged } }]),
      ).compose(compositionInput()),
    ).resolves.toEqual({ composed: true, composition: unchanged });

    await expect(
      new DatabaseGuardianProjectionComposerStore(
        databaseWith([
          { value: { composed: false, reason: 'revision-conflict', currentRevision: 2 } },
        ]),
      ).compose(compositionInput()),
    ).resolves.toEqual({
      composed: false,
      reason: 'revision-conflict',
      currentRevision: 2,
    });
  });

  it('fails closed on malformed or ambiguous database responses', async () => {
    await expect(
      new DatabaseGuardianProjectionComposerStore(databaseWith([])).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseGuardianProjectionComposerStore(
        databaseWith([{ value: { composed: true } }, { value: { composed: true } }]),
      ).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseGuardianProjectionComposerStore(
        databaseWith([{ value: { composed: false, reason: 'database-secret-leaked' } }]),
      ).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
  });
});
