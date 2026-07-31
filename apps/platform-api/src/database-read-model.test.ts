import { describe, expect, it, vi } from 'vitest';

import type { RuntimeReadModelHead } from './database-read-model-store.js';
import { resolveDatabaseReadModel, RuntimeReadModelCache } from './database-read-model.js';

const head: RuntimeReadModelHead = {
  tenantId: '50000000-0000-4000-8000-000000000002',
  membershipId: '50000000-0000-4000-8000-000000000003',
  campusId: '50000000-0000-4000-8000-000000000004',
  persona: 'admin',
  subjectRef: 'principal-dashboard',
  capabilities: ['finance.read', 'reports.read'],
  revision: 7,
  generatedAt: '2026-07-31T03:40:00.000Z',
  sourceUpdatedAt: '2026-07-31T03:39:30.000Z',
  payloadDigest: 'a'.repeat(64),
  capabilityDigest: 'b'.repeat(64),
  payloadBytes: 2048,
};
const sessionId = '50000000-0000-4000-8000-000000000001';

describe('database runtime read-model resolution', () => {
  it('revalidates the head on every request and caches only its exact digest tuple', async () => {
    const store = {
      resolveHead: vi.fn().mockResolvedValue(head),
      readPayload: vi.fn().mockResolvedValue({ metrics: [{ id: 'students', value: 42 }] }),
    };
    const cache = new RuntimeReadModelCache(4, 15_000);
    const first = await resolveDatabaseReadModel({ sessionId, store, cache, now: 1_000 });
    expect(first).toMatchObject({
      ok: true,
      status: 200,
      cache: 'miss',
      snapshot: {
        scope: {
          tenantId: head.tenantId,
          membershipId: head.membershipId,
          campusId: head.campusId,
          capabilities: head.capabilities,
        },
        revision: 7,
      },
    });
    if (!first.ok || first.status !== 200) throw new Error('Expected a database snapshot.');
    expect(first.etag).toMatch(/^"rm1-[A-Za-z0-9_-]+"$/u);

    const second = await resolveDatabaseReadModel({ sessionId, store, cache, now: 2_000 });
    expect(second).toMatchObject({ ok: true, status: 200, cache: 'hit' });
    expect(store.resolveHead).toHaveBeenCalledTimes(2);
    expect(store.readPayload).toHaveBeenCalledTimes(1);
  });

  it('returns 304 after current head revalidation without reading the payload', async () => {
    const store = {
      resolveHead: vi.fn().mockResolvedValue(head),
      readPayload: vi.fn().mockResolvedValue({}),
    };
    const cache = new RuntimeReadModelCache();
    const first = await resolveDatabaseReadModel({ sessionId, store, cache });
    if (!first.ok || first.status !== 200) throw new Error('Expected a database snapshot.');
    const result = await resolveDatabaseReadModel({
      sessionId,
      store,
      cache,
      ifNoneMatch: `"other", ${first.etag}`,
    });
    expect(result).toEqual({ ok: true, status: 304, etag: first.etag });
    expect(store.resolveHead).toHaveBeenCalledTimes(2);
    expect(store.readPayload).toHaveBeenCalledTimes(1);
  });

  it('changes the ETag and bypasses stale payload cache when current capabilities change', async () => {
    const changed = { ...head, capabilities: ['reports.read'], capabilityDigest: 'c'.repeat(64) };
    const store = {
      resolveHead: vi.fn().mockResolvedValueOnce(head).mockResolvedValueOnce(changed),
      readPayload: vi.fn().mockResolvedValue({}),
    };
    const cache = new RuntimeReadModelCache();
    const first = await resolveDatabaseReadModel({ sessionId, store, cache });
    const second = await resolveDatabaseReadModel({ sessionId, store, cache });
    expect(first).toMatchObject({ ok: true, status: 200, cache: 'miss' });
    expect(second).toMatchObject({ ok: true, status: 200, cache: 'miss' });
    if (!first.ok || !second.ok) throw new Error('Expected database snapshots.');
    expect(first.etag).not.toBe(second.etag);
    expect(store.readPayload).toHaveBeenCalledTimes(2);
  });

  it('bounds cache entries and expires them', async () => {
    const cache = new RuntimeReadModelCache(2, 10);
    cache.set('one', { value: 1 }, 0);
    cache.set('two', { value: 2 }, 0);
    cache.set('three', { value: 3 }, 0);
    expect(cache.size).toBe(2);
    expect(cache.get('one', 1)).toBeUndefined();
    expect(cache.get('two', 11)).toBeUndefined();
  });

  it('fails closed when no exact projection exists or the head/payload race changes', async () => {
    await expect(
      resolveDatabaseReadModel({
        sessionId,
        cache: new RuntimeReadModelCache(),
        store: { resolveHead: async () => undefined, readPayload: async () => ({}) },
      }),
    ).resolves.toMatchObject({ ok: false, status: 404, code: 'runtime_read_model_not_found' });

    await expect(
      resolveDatabaseReadModel({
        sessionId,
        cache: new RuntimeReadModelCache(),
        store: { resolveHead: async () => head, readPayload: async () => undefined },
      }),
    ).resolves.toMatchObject({ ok: false, status: 503, code: 'runtime_read_model_unavailable' });
  });
});
