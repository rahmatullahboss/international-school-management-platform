import { describe, expect, it, vi } from 'vitest';

import type { HttpDatabase } from '@school/database';

import { DatabaseReadModelStore } from './database-read-model-store.js';

const ids = {
  session: '50000000-0000-4000-8000-000000000001',
  tenant: '50000000-0000-4000-8000-000000000002',
  membership: '50000000-0000-4000-8000-000000000003',
  campus: '50000000-0000-4000-8000-000000000004',
};

function databaseReturning(rows: Record<string, unknown>[]): {
  database: HttpDatabase;
  query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn().mockResolvedValue(rows);
  return { database: { query }, query };
}

const headRow = {
  tenantId: ids.tenant,
  membershipId: ids.membership,
  campusId: ids.campus,
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

describe('DatabaseReadModelStore', () => {
  it('resolves an exact server-owned snapshot head for the active session', async () => {
    const { database, query } = databaseReturning([headRow]);
    const store = new DatabaseReadModelStore(database);

    await expect(store.resolveHead(ids.session)).resolves.toEqual(headRow);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('platform.resolve_runtime_read_model_head'),
      [ids.session],
    );
  });

  it('returns undefined when no current projection exists for the exact session scope', async () => {
    const store = new DatabaseReadModelStore(databaseReturning([]).database);
    await expect(store.resolveHead(ids.session)).resolves.toBeUndefined();
  });

  it('reads payload only for the exact session, revision and digest tuple', async () => {
    const { database, query } = databaseReturning([
      { payload: { metrics: [{ id: 'students' }] } },
    ]);
    const store = new DatabaseReadModelStore(database);

    await expect(store.readPayload(ids.session, 7, 'a'.repeat(64))).resolves.toEqual({
      metrics: [{ id: 'students' }],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('platform.read_runtime_read_model_payload'),
      [ids.session, 7, 'a'.repeat(64)],
    );
  });

  it('fails closed for malformed head rows, capability order and oversized payload metadata', async () => {
    for (const row of [
      { ...headRow, tenantId: 'not-a-uuid' },
      { ...headRow, persona: 'super-admin' },
      { ...headRow, capabilities: ['reports.read', 'finance.read'] },
      { ...headRow, capabilities: ['finance.read', 'finance.read'] },
      { ...headRow, payloadDigest: 'not-a-digest' },
      { ...headRow, revision: 0 },
      { ...headRow, payloadBytes: 262145 },
      { ...headRow, sourceUpdatedAt: 'not-a-date' },
    ]) {
      const store = new DatabaseReadModelStore(databaseReturning([row]).database);
      await expect(store.resolveHead(ids.session)).rejects.toThrow(
        'invalid database response',
      );
    }
  });

  it('rejects malformed payload rows, unsafe inputs and non-object payloads', async () => {
    const malformed = new DatabaseReadModelStore(
      databaseReturning([{ payload: ['not', 'object'] }]).database,
    );
    await expect(malformed.readPayload(ids.session, 7, 'a'.repeat(64))).rejects.toThrow(
      'invalid database response',
    );

    const store = new DatabaseReadModelStore(databaseReturning([]).database);
    await expect(store.resolveHead('browser-supplied-session')).rejects.toThrow(
      'sessionId must be a UUID',
    );
    await expect(store.readPayload(ids.session, 0, 'a'.repeat(64))).rejects.toThrow(
      'revision must be a positive integer',
    );
    await expect(store.readPayload(ids.session, 7, 'bad')).rejects.toThrow(
      'payloadDigest must be a SHA-256 digest',
    );
  });
});
