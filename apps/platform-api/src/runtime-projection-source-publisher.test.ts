import { describe, expect, it, vi } from 'vitest';

import {
  publishRuntimeProjectionSource,
  type RuntimeProjectionSourcePublisherStore,
} from './runtime-projection-source-publisher.js';

const tenantId = '30000000-0000-4000-8000-000000000001';
const membershipId = '30000000-0000-4000-8000-000000000006';
const campusId = '30000000-0000-4000-8000-000000000003';
const correlationId = '30000000-0000-4000-8000-000000000020';

function input() {
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

function storeWith(result: unknown): RuntimeProjectionSourcePublisherStore {
  return { publish: vi.fn().mockResolvedValue(result) };
}

describe('runtime projection source publisher', () => {
  it('publishes one validated database-owned home source', async () => {
    const result = {
      published: true as const,
      publication: {
        publicationId: '30000000-0000-4000-8000-000000000021',
        tenantId,
        membershipId,
        campusId,
        persona: 'admin' as const,
        subjectRef: 'account:30000000-0000-4000-8000-000000000004',
        sourceRevision: 1,
        payloadDigest: 'a'.repeat(64),
        payloadBytes: 71,
        correlationId,
        publishedAt: '2026-07-31T12:00:01.000Z',
      },
    };
    const store = storeWith(result);

    await expect(
      publishRuntimeProjectionSource({ configured: true, input: input(), store }),
    ).resolves.toEqual(result);
    expect(store.publish).toHaveBeenCalledWith(input());
  });

  it('stays disabled without an explicitly configured privileged publisher', async () => {
    const store = storeWith({ published: true });
    await expect(
      publishRuntimeProjectionSource({ configured: false, input: input(), store }),
    ).resolves.toEqual({ published: false, reason: 'publisher-disabled' });
    expect(store.publish).not.toHaveBeenCalled();
  });

  it('rejects browser-like scope injection and malformed publication inputs before storage', async () => {
    const store = storeWith({ published: true });
    const invalidInputs = [
      { ...input(), tenantId: 'tenant-browser-selected' },
      { ...input(), membershipId: 'membership-browser-selected' },
      { ...input(), campusId: 'campus-browser-selected' },
      { ...input(), expectedPreviousRevision: -1 },
      { ...input(), publisherId: 'bad publisher id' },
      { ...input(), correlationId: 'not-a-uuid' },
      { ...input(), sourceUpdatedAt: 'not-a-time' },
      { ...input(), payload: [] },
      { ...input(), payload: {} },
      { ...input(), payload: { scope: { tenantId } } },
      { ...input(), payload: { capabilities: ['finance.read'] } },
    ];

    for (const candidate of invalidInputs) {
      await expect(
        publishRuntimeProjectionSource({ configured: true, input: candidate, store }),
      ).resolves.toEqual({ published: false, reason: 'invalid-publication' });
    }
    expect(store.publish).not.toHaveBeenCalled();
  });

  it('enforces the source payload byte budget before storage', async () => {
    const store = storeWith({ published: true });
    await expect(
      publishRuntimeProjectionSource({
        configured: true,
        input: { ...input(), payload: { content: 'x'.repeat(262_145) } },
        store,
      }),
    ).resolves.toEqual({ published: false, reason: 'invalid-publication' });
    expect(store.publish).not.toHaveBeenCalled();
  });

  it('sanitizes privileged publisher outages', async () => {
    const store: RuntimeProjectionSourcePublisherStore = {
      publish: vi.fn().mockRejectedValue(new Error('postgres://secret@database.internal/source')),
    };
    await expect(
      publishRuntimeProjectionSource({ configured: true, input: input(), store }),
    ).resolves.toEqual({ published: false, reason: 'publisher-unavailable' });
  });
});
