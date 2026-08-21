import { beforeEach, describe, expect, it, vi } from 'vitest';

const pull = vi.fn();

vi.mock('./database-mobile-sync-store.js', () => ({
  DatabaseMobileSyncStore: class {
    pull = pull;
  },
}));
vi.mock('@school/database', () => ({ createHttpDatabase: vi.fn(() => ({})) }));
vi.mock('./mobile-auth.js', () => ({
  authenticateMobileBearer: vi.fn(() => ({
    ok: true,
    identity: { issuer: 'https://identity.school.test', subject: 'provider-mobile-guardian-1' },
  })),
}));

describe('mobile sync routes', () => {
  beforeEach(() => {
    pull.mockReset();
  });

  it('returns a data-free delta for an authorized Family scope', async () => {
    pull.mockResolvedValue({
      cursor: '40000000-0000-4000-8000-000000000001',
      changed: true,
      serverTime: '2026-08-22T00:00:00.000Z',
    });
    const { default: app } = await import('./mobile-sync-routes.js');
    const response = await app.request(
      '/v1/mobile/sync/delta',
      {
        headers: {
          authorization: 'Bearer token',
          'x-tenant-id': '10000000-0000-4000-8000-000000000001',
          'x-campus-id': '10000000-0000-4000-8000-000000000003',
          'x-persona': 'guardian',
        },
      },
      {
        DATABASE_URL: 'postgres://test',
        MOBILE_MEMBERSHIP_SOURCE: 'database',
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      cursor: '40000000-0000-4000-8000-000000000001',
      changed: true,
      serverTime: '2026-08-22T00:00:00.000Z',
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('maps stale/foreign cursors to a non-disclosing conflict', async () => {
    pull.mockResolvedValue({ status: 'cursor-invalid' });
    const { default: app } = await import('./mobile-sync-routes.js');
    const response = await app.request(
      '/v1/mobile/sync/delta?cursor=40000000-0000-4000-8000-000000000001',
      {
        headers: {
          authorization: 'Bearer token',
          'x-tenant-id': '10000000-0000-4000-8000-000000000001',
          'x-campus-id': '10000000-0000-4000-8000-000000000003',
          'x-persona': 'guardian',
        },
      },
      { DATABASE_URL: 'postgres://test', MOBILE_MEMBERSHIP_SOURCE: 'database' },
    );
    expect(response.status).toBe(409);
  });

  it('rejects unknown or duplicate query parameters before persistence', async () => {
    const { default: app } = await import('./mobile-sync-routes.js');
    const headers = {
      authorization: 'Bearer token',
      'x-tenant-id': '10000000-0000-4000-8000-000000000001',
      'x-campus-id': '10000000-0000-4000-8000-000000000003',
      'x-persona': 'teacher',
    };
    const env = { DATABASE_URL: 'postgres://test', MOBILE_MEMBERSHIP_SOURCE: 'database' };

    expect((await app.request('/v1/mobile/sync/delta?limit=1', { headers }, env)).status).toBe(400);
    expect(
      (
        await app.request(
          '/v1/mobile/sync/delta?cursor=40000000-0000-4000-8000-000000000001&cursor=40000000-0000-4000-8000-000000000002',
          { headers },
          env,
        )
      ).status,
    ).toBe(400);
    expect(pull).not.toHaveBeenCalled();
  });

  it('rejects malformed cursors before persistence', async () => {
    const { default: app } = await import('./mobile-sync-routes.js');
    const response = await app.request(
      '/v1/mobile/sync/delta?cursor=NOT-CANONICAL',
      {
        headers: {
          authorization: 'Bearer token',
          'x-tenant-id': '10000000-0000-4000-8000-000000000001',
          'x-campus-id': '10000000-0000-4000-8000-000000000003',
          'x-persona': 'teacher',
        },
      },
      { DATABASE_URL: 'postgres://test', MOBILE_MEMBERSHIP_SOURCE: 'database' },
    );
    expect(response.status).toBe(400);
    expect(pull).not.toHaveBeenCalled();
  });
});
