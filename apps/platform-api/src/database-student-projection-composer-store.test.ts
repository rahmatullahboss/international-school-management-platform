import { describe, expect, it, vi } from 'vitest';

import { DatabaseStudentProjectionComposerStore } from './database-student-projection-composer-store.js';

const tenantId = '50000000-0000-4000-8000-000000000001';
const membershipId = '50000000-0000-4000-8000-000000000006';
const campusId = '50000000-0000-4000-8000-000000000003';
const correlationId = '50000000-0000-4000-8000-000000000050';

function compositionInput() {
  return {
    tenantId,
    membershipId,
    campusId,
    expectedPreviousRevision: 0,
    composerId: 'student-home-composer-staging-01',
    correlationId,
  } as const;
}

function databaseWith(rows: readonly Record<string, unknown>[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database student projection composer store', () => {
  it('calls the reviewed privileged student composition function', async () => {
    const composition = {
      compositionId: '50000000-0000-4000-8000-000000000051',
      tenantId,
      membershipId,
      campusId,
      state: 'published',
      sourceRevision: 1,
      payloadDigest: 'a'.repeat(64),
      payloadBytes: 2048,
      correlationId,
      composedAt: '2026-08-01T02:00:00.000Z',
    };
    const database = databaseWith([{ value: { composed: true, composition } }]);
    const store = new DatabaseStudentProjectionComposerStore(database);

    await expect(store.compose(compositionInput())).resolves.toEqual({
      composed: true,
      composition,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.compose_student_runtime_projection_source'),
      [tenantId, membershipId, campusId, 0, compositionInput().composerId, correlationId],
    );
  });

  it('accepts unchanged evidence and reviewed rejection reasons', async () => {
    const unchanged = {
      compositionId: '50000000-0000-4000-8000-000000000052',
      tenantId,
      membershipId,
      campusId,
      state: 'unchanged',
      sourceRevision: 1,
      payloadDigest: 'b'.repeat(64),
      payloadBytes: 2048,
      correlationId,
      composedAt: '2026-08-01T02:01:00.000Z',
    };
    await expect(
      new DatabaseStudentProjectionComposerStore(
        databaseWith([{ value: { composed: true, composition: unchanged } }]),
      ).compose(compositionInput()),
    ).resolves.toEqual({ composed: true, composition: unchanged });

    await expect(
      new DatabaseStudentProjectionComposerStore(
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
      new DatabaseStudentProjectionComposerStore(databaseWith([])).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseStudentProjectionComposerStore(
        databaseWith([{ value: { composed: true } }, { value: { composed: true } }]),
      ).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseStudentProjectionComposerStore(
        databaseWith([{ value: { composed: false, reason: 'database-secret-leaked' } }]),
      ).compose(compositionInput()),
    ).rejects.toThrow(/invalid database response/u);
  });
});
