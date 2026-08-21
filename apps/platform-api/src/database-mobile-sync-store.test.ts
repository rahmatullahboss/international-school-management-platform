import { describe, expect, it, vi } from 'vitest';

import { DatabaseMobileSyncStore } from './database-mobile-sync-store.js';

const identity = { issuer: 'https://identity.school.test', subject: 'provider-mobile-guardian-1' };
const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  campusId: '10000000-0000-4000-8000-000000000003',
  persona: 'guardian' as const,
};

describe('DatabaseMobileSyncStore', () => {
  it('calls the reviewed database function with exact identity and scope', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        payload: {
          cursor: '40000000-0000-4000-8000-000000000001',
          changed: false,
          serverTime: '2026-08-22T00:00:00.000Z',
        },
      },
    ]);
    const store = new DatabaseMobileSyncStore({ query } as never);

    await expect(store.pull(identity, scope, null)).resolves.toEqual({
      cursor: '40000000-0000-4000-8000-000000000001',
      changed: false,
      serverTime: '2026-08-22T00:00:00.000Z',
    });
    expect(query).toHaveBeenCalledWith(
      'SELECT platform.resolve_mobile_sync_delta($1::text, $2::text, $3::uuid, $4::uuid, $5::text, $6::uuid) AS payload',
      [identity.issuer, identity.subject, scope.tenantId, scope.campusId, scope.persona, null],
    );
  });

  it('accepts cursor-invalid but rejects leaked or malformed fields', async () => {
    const conflict = new DatabaseMobileSyncStore({
      query: vi.fn().mockResolvedValue([{ payload: { status: 'cursor-invalid' } }]),
    } as never);
    await expect(conflict.pull(identity, scope, null)).resolves.toEqual({
      status: 'cursor-invalid',
    });

    const leaked = new DatabaseMobileSyncStore({
      query: vi.fn().mockResolvedValue([
        {
          payload: {
            cursor: '40000000-0000-4000-8000-000000000001',
            changed: true,
            serverTime: '2026-08-22T00:00:00.000Z',
            revision: 42,
          },
        },
      ]),
    } as never);
    await expect(leaked.pull(identity, scope, null)).rejects.toThrow(/invalid database response/i);
  });

  it('fails closed on invalid cardinality or timestamps', async () => {
    const empty = new DatabaseMobileSyncStore({ query: vi.fn().mockResolvedValue([]) } as never);
    await expect(empty.pull(identity, scope, null)).resolves.toBeUndefined();

    const malformed = new DatabaseMobileSyncStore({
      query: vi.fn().mockResolvedValue([
        {
          payload: {
            cursor: '40000000-0000-4000-8000-000000000001',
            changed: true,
            serverTime: '2026-08-22 00:00:00',
          },
        },
      ]),
    } as never);
    await expect(malformed.pull(identity, scope, null)).rejects.toThrow(
      /invalid database response/i,
    );
  });
});
