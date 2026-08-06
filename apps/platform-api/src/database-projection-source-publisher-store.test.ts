import { describe, expect, it, vi } from 'vitest';

import { DatabaseProjectionSourcePublisherStore } from './database-projection-source-publisher-store.js';

const tenantId = '30000000-0000-4000-8000-000000000001';
const membershipId = '30000000-0000-4000-8000-000000000006';
const campusId = '30000000-0000-4000-8000-000000000003';
const correlationId = '30000000-0000-4000-8000-000000000020';

function publicationInput() {
  return {
    tenantId,
    membershipId,
    campusId,
    expectedPreviousRevision: 0,
    payload: { metrics: [{ id: 'students', value: 42 }], source: 'database-composer' },
    sourceUpdatedAt: '2026-07-31T12:00:00.000Z',
    publisherId: 'projection-composer-staging-01',
    correlationId,
  } as const;
}

function databaseWith(rows: readonly Record<string, unknown>[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database projection source publisher store', () => {
  it('calls the reviewed privileged source publication function', async () => {
    const publication = {
      publicationId: '30000000-0000-4000-8000-000000000021',
      tenantId,
      membershipId,
      campusId,
      persona: 'admin',
      subjectRef: 'account:30000000-0000-4000-8000-000000000004',
      sourceRevision: 1,
      payloadDigest: 'a'.repeat(64),
      payloadBytes: 71,
      correlationId,
      publishedAt: '2026-07-31T12:00:01.000Z',
    };
    const database = databaseWith([{ value: { published: true, publication } }]);
    const store = new DatabaseProjectionSourcePublisherStore(database);

    await expect(store.publish(publicationInput())).resolves.toEqual({
      published: true,
      publication,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.publish_runtime_projection_source'),
      [
        tenantId,
        membershipId,
        campusId,
        0,
        JSON.stringify(publicationInput().payload),
        publicationInput().sourceUpdatedAt,
        publicationInput().publisherId,
        correlationId,
      ],
    );
  });

  it('accepts only reviewed sanitized rejection reasons', async () => {
    const store = new DatabaseProjectionSourcePublisherStore(
      databaseWith([
        { value: { published: false, reason: 'revision-conflict', currentRevision: 4 } },
      ]),
    );
    await expect(store.publish(publicationInput())).resolves.toEqual({
      published: false,
      reason: 'revision-conflict',
      currentRevision: 4,
    });
  });

  it('fails closed on malformed or ambiguous database responses', async () => {
    await expect(
      new DatabaseProjectionSourcePublisherStore(databaseWith([])).publish(publicationInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseProjectionSourcePublisherStore(
        databaseWith([{ value: { published: true } }, { value: { published: true } }]),
      ).publish(publicationInput()),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseProjectionSourcePublisherStore(
        databaseWith([{ value: { published: false, reason: 'database-secret-leaked' } }]),
      ).publish(publicationInput()),
    ).rejects.toThrow(/invalid database response/u);
  });
});
