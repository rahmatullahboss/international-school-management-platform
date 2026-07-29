import { describe, expect, it } from 'vitest';

import app from './index.js';

const environment = { APP_ENV: 'test', APP_REGION: 'local' };
const adminHeaders = {
  'x-school-tenant-id': 'tenant-pilot-001',
  'x-school-campus-id': 'campus-main',
  'x-school-role': 'admin',
  'x-school-subject-id': 'principal-1',
};

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
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      scope: {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        role: 'admin',
        subjectId: 'principal-1',
        capabilities: expect.arrayContaining(['finance.read']),
      },
      data: {
        metrics: expect.arrayContaining([expect.objectContaining({ id: 'students' })]),
      },
    });
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
