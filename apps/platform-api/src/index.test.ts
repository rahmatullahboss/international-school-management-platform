import { describe, expect, it } from 'vitest';

import app from './index.js';

const environment = { APP_ENV: 'test', APP_REGION: 'local' };
const adminHeaders = {
  'x-school-tenant-id': 'tenant-pilot-001',
  'x-school-campus-id': 'campus-main',
  'x-school-role': 'admin',
  'x-school-subject-id': 'principal-1',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('platform API', () => {
  it('returns a correlation id and non-sensitive health response', async () => {
    const response = await app.request('/health', {}, environment);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      environment: 'test',
      region: 'local',
    });
  });

  it('returns only the declared role snapshot and server capability scope', async () => {
    const response = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: adminHeaders },
      environment,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, max-age=0, must-revalidate');
    expect(response.headers.get('etag')).toContain('pilot-read-v1');

    const payload: unknown = await response.json();
    expect(isRecord(payload)).toBe(true);
    if (!isRecord(payload)) throw new Error('Expected a scoped snapshot object.');
    expect(payload.schemaVersion).toBe(1);

    const scope = payload.scope;
    expect(isRecord(scope)).toBe(true);
    if (!isRecord(scope)) throw new Error('Expected a scoped snapshot scope.');
    expect(scope.tenantId).toBe('tenant-pilot-001');
    expect(scope.campusId).toBe('campus-main');
    expect(scope.role).toBe('admin');
    expect(scope.subjectId).toBe('principal-1');
    expect(Array.isArray(scope.capabilities)).toBe(true);
    if (!Array.isArray(scope.capabilities)) throw new Error('Expected scoped capabilities.');
    expect(scope.capabilities).toContain('finance.read');
    expect(scope.capabilities).not.toContain('gradebook.assigned.write');

    const data = payload.data;
    expect(isRecord(data)).toBe(true);
    if (!isRecord(data)) throw new Error('Expected scoped snapshot data.');
    expect(Array.isArray(data.metrics)).toBe(true);
    if (!Array.isArray(data.metrics)) throw new Error('Expected scoped readiness metrics.');
    expect(data.metrics.length).toBeGreaterThan(0);
  });

  it('revalidates a scoped snapshot with an etag without returning another body', async () => {
    const initial = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: adminHeaders },
      environment,
    );
    const etag = initial.headers.get('etag');
    expect(etag).not.toBeNull();

    const response = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: { ...adminHeaders, 'if-none-match': etag ?? '' } },
      environment,
    );
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
  });

  it('denies incomplete, cross-role and cross-subject scope', async () => {
    const incomplete = await app.request('/pilot/v1/snapshots/admin', {}, environment);
    expect(incomplete.status).toBe(400);

    const crossRole = await app.request(
      '/pilot/v1/snapshots/teacher',
      { headers: adminHeaders },
      environment,
    );
    expect(crossRole.status).toBe(403);

    const crossSubject = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: { ...adminHeaders, 'x-school-subject-id': 'student-1' } },
      environment,
    );
    expect(crossSubject.status).toBe(403);
  });

  it('does not expose synthetic pilot routes in a production runtime', async () => {
    const response = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: adminHeaders },
      { APP_ENV: 'production', APP_REGION: 'global' },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'not_found',
        message: 'The requested resource was not found.',
      },
    });
  });

  it('permits the staging web origin and rejects an unrelated browser origin', async () => {
    const preflight = await app.request(
      '/pilot/v1/snapshots/admin',
      {
        method: 'OPTIONS',
        headers: {
          origin: 'https://international-school-platform-web-staging.rahmatullahzisan.workers.dev',
        },
      },
      environment,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toContain(
      'international-school-platform-web-staging',
    );

    const denied = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: { ...adminHeaders, origin: 'https://example.com' } },
      environment,
    );
    expect(denied.status).toBe(403);
  });
});
