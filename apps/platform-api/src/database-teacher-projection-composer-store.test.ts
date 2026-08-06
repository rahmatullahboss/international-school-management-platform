import { describe, expect, it, vi } from 'vitest';

import { DatabaseTeacherProjectionComposerStore } from './database-teacher-projection-composer-store.js';

const tenantId = '30000000-0000-4000-8000-000000000001';
const membershipId = '30000000-0000-4000-8000-000000000006';
const campusId = '30000000-0000-4000-8000-000000000003';
const correlationId = '30000000-0000-4000-8000-000000000050';

function compositionInput() {
  return {
    tenantId,
    membershipId,
    campusId,
    expectedPreviousRevision: 4,
    composerId: 'teacher-home-composer-staging-01',
    correlationId,
  } as const;
}

function databaseWith(rows: readonly Record<string, unknown>[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database teacher projection composer store', () => {
  it('calls the reviewed privileged teacher composition function', async () => {
    const composition = {
      compositionId: '30000000-0000-4000-8000-000000000051',
      tenantId,
      membershipId,
      campusId,
      state: 'published',
      sourceRevision: 5,
      payloadDigest: 'a'.repeat(64),
      payloadBytes: 2048,
      correlationId,
      composedAt: '2026-07-31T18:30:00.000Z',
    };
    const database = databaseWith([{ value: { composed: true, composition } }]);
    const store = new DatabaseTeacherProjectionComposerStore(database);

    await expect(store.compose(compositionInput())).resolves.toEqual({
      composed: true,
      composition,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.compose_teacher_runtime_projection_source'),
      [tenantId, membershipId, campusId, 4, compositionInput().composerId, correlationId],
    );
  });

  it('accepts unchanged evidence and reviewed rejection reasons', async () => {
    const unchanged = {
      compositionId: '30000000-0000-4000-8000-000000000052',
      tenantId,
      membershipId,
      campusId,
      state: 'unchanged',
      sourceRevision: 5,
      payloadDigest: 'b'.repeat(64),
      payloadBytes: 2048,
      correlationId,
      composedAt: '2026-07-31T18:31:00.000Z',
    };
    await expect(
      new DatabaseTeacherProjectionComposerStore(
        databaseWith([{ value: { composed: true, composition: unchanged } }]),
      ).compose(compositionInput()),
    ).resolves.toEqual({ composed: true, composition: unchanged });

    await expect(
      new DatabaseTeacherProjectionComposerStore(
        databaseWith([
          { value: { composed: false, reason: 'revision-conflict', currentRevision: 6 } },
        ]),
      ).compose(compositionInput()),
    ).resolves.toEqual({
      composed: false,
      reason: 'revision-conflict',
      currentRevision: 6,
    });
  });

  it('fails closed on malformed or ambiguous database responses', async () => {
    await expect(
      new DatabaseTeacherProjectionComposerStore(databaseWith([])).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseTeacherProjectionComposerStore(
        databaseWith([{ value: { composed: true } }, { value: { composed: true } }]),
      ).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseTeacherProjectionComposerStore(
        databaseWith([{ value: { composed: false, reason: 'database-secret-leaked' } }]),
      ).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
  });
});
