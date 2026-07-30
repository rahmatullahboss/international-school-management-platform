import { describe, expect, it } from 'vitest';

import { BROWSER_SESSION_COOKIE_NAME, issueBrowserSession } from '@school/policy';

import app from './index.js';

const authSessionSecret = 'browser-session-test-secret-with-at-least-32-characters';
const environment = {
  APP_ENV: 'test',
  APP_REGION: 'local',
  PILOT_SESSION_SECRET: 'pilot-test-session-secret-with-at-least-32-characters',
  AUTH_SESSION_SECRET: authSessionSecret,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function issueSession(role: string): Promise<string> {
  const response = await app.request(`/pilot/v1/sessions/${role}`, { method: 'POST' }, environment);
  expect(response.status).toBe(201);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.accessToken !== 'string') {
    throw new Error('Expected a signed pilot access token.');
  }
  return payload.accessToken;
}

function bearer(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
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

  it('reports provider-neutral OIDC controls without exposing secrets or enabling login', async () => {
    const response = await app.request(
      '/auth/v1/readiness',
      {},
      { APP_ENV: 'test', APP_REGION: 'local' },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({
      schemaVersion: 1,
      mode: 'oidc-bff',
      state: 'disabled',
      loginEnabled: false,
      controls: {
        authorizationCode: true,
        pkceS256: true,
        issuerValidation: true,
        audienceValidation: true,
        jwksSignatureValidation: true,
        nonceValidation: true,
        membershipResolution: true,
        httpOnlyHostCookie: true,
        stepUpAssurance: true,
      },
    });
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('introspects only a valid HttpOnly-cookie session and denies missing configuration or cookie', async () => {
    const unconfigured = await app.request(
      '/auth/v1/session',
      {},
      { APP_ENV: 'test', APP_REGION: 'local' },
    );
    expect(unconfigured.status).toBe(503);

    const missing = await app.request('/auth/v1/session', {}, environment);
    expect(missing.status).toBe(401);

    const issued = await issueBrowserSession({
      secret: authSessionSecret,
      now: Date.now(),
      identity: {
        issuer: 'https://identity.school.test',
        subject: 'provider-user-123',
        assurance: 'aal2',
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 600,
      },
      membership: {
        membershipId: 'membership-main-admin',
        principalId: 'principal-1',
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        roleIds: ['school-admin'],
      },
    });
    if (!issued.ok) throw new Error(issued.message);
    const response = await app.request(
      '/auth/v1/session',
      { headers: { cookie: `${BROWSER_SESSION_COOKIE_NAME}=${issued.token}` } },
      environment,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      session: {
        principalId: 'principal-1',
        membershipId: 'membership-main-admin',
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        roleIds: ['school-admin'],
        assurance: 'aal2',
      },
    });
  });

  it('issues a short-lived synthetic session with fixed tenant, campus, role and subject context', async () => {
    const response = await app.request('/pilot/v1/sessions/admin', { method: 'POST' }, environment);

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const payload: unknown = await response.json();
    expect(isRecord(payload)).toBe(true);
    if (!isRecord(payload)) throw new Error('Expected a session response object.');
    expect(payload.schemaVersion).toBe(1);
    expect(payload.tokenType).toBe('Bearer');
    expect(typeof payload.accessToken).toBe('string');
    expect(typeof payload.expiresAt).toBe('string');
    expect(payload.scope).toEqual({
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      role: 'admin',
      subjectId: 'principal-1',
    });
  });

  it('returns only the signed role snapshot and server-resolved capability scope', async () => {
    const token = await issueSession('admin');
    const response = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: bearer(token) },
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

  it('revalidates a signed scoped snapshot with an etag without returning another body', async () => {
    const token = await issueSession('admin');
    const initial = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: bearer(token) },
      environment,
    );
    const etag = initial.headers.get('etag');
    expect(etag).not.toBeNull();

    const response = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: { ...bearer(token), 'if-none-match': etag ?? '' } },
      environment,
    );
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
  });

  it('denies missing, tampered and cross-role sessions', async () => {
    const missing = await app.request('/pilot/v1/snapshots/admin', {}, environment);
    expect(missing.status).toBe(401);

    const adminToken = await issueSession('admin');
    const tampered = await app.request(
      '/pilot/v1/snapshots/admin',
      { headers: bearer(`${adminToken}a`) },
      environment,
    );
    expect(tampered.status).toBe(401);

    const crossRole = await app.request(
      '/pilot/v1/snapshots/teacher',
      { headers: bearer(adminToken) },
      environment,
    );
    expect(crossRole.status).toBe(401);
  });

  it('fails closed when the session signing secret is unavailable', async () => {
    const response = await app.request(
      '/pilot/v1/sessions/admin',
      { method: 'POST' },
      { APP_ENV: 'staging', APP_REGION: 'global' },
    );
    expect(response.status).toBe(503);
  });

  it('does not expose synthetic pilot routes in a production runtime', async () => {
    const response = await app.request(
      '/pilot/v1/sessions/admin',
      { method: 'POST' },
      {
        APP_ENV: 'production',
        APP_REGION: 'global',
        PILOT_SESSION_SECRET: environment.PILOT_SESSION_SECRET,
      },
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
      '/pilot/v1/sessions/admin',
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
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
    expect(preflight.headers.get('access-control-allow-headers')).toContain('authorization');

    const denied = await app.request(
      '/pilot/v1/sessions/admin',
      { method: 'POST', headers: { origin: 'https://example.com' } },
      environment,
    );
    expect(denied.status).toBe(403);
  });
});
