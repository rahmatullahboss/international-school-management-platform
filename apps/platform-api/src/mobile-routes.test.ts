import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OidcJsonWebKey } from '@school/policy';

const databaseQuery = vi.hoisted(() => vi.fn());
vi.mock('@school/database', () => ({
  createHttpDatabase: () => ({ query: databaseQuery }),
}));

import app from './index.js';

const nowSeconds = Math.floor(Date.now() / 1000);
const readyEnvironment = {
  APP_ENV: 'test',
  APP_REGION: 'local',
  DATABASE_URL: 'postgresql://test.invalid/school',
  MOBILE_OIDC_ISSUER: 'https://mobile-identity.school.test',
  MOBILE_OIDC_AUDIENCE: 'school-platform-api',
  MOBILE_OIDC_JWKS_URI: 'https://mobile-identity.school.test/jwks',
  MOBILE_OIDC_JWKS_ORIGIN: 'https://mobile-identity.school.test',
  MOBILE_OIDC_REQUIRED_SCOPE: 'school_api',
  MOBILE_MEMBERSHIP_SOURCE: 'database',
};

let privateKey: CryptoKey;
let publicJwk: OidcJsonWebKey;

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

async function signedCredential(
  overrides: Readonly<Record<string, unknown>> = {},
): Promise<string> {
  const header = { alg: 'RS256', kid: 'mobile-route-key-1', typ: 'at+jwt' };
  const claims = {
    iss: readyEnvironment.MOBILE_OIDC_ISSUER,
    sub: 'provider-mobile-user-1',
    aud: readyEnvironment.MOBILE_OIDC_AUDIENCE,
    exp: nowSeconds + 600,
    iat: nowSeconds,
    scope: 'openid profile school_api',
    ...overrides,
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedClaims = encodeBase64Url(JSON.stringify(claims));
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
  );
  return `${encodedHeader}.${encodedClaims}.${encodeBase64Url(signature)}`;
}

function installJwksFetcher(): ReturnType<typeof vi.fn> {
  const fetcher = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

function activeGuardianRow(): Record<string, unknown> {
  return {
    accountId: '40000000-0000-4000-8000-000000000001',
    tenantId: '40000000-0000-4000-8000-000000000002',
    tenantName: 'International School',
    campusId: '40000000-0000-4000-8000-000000000003',
    campusName: 'Main Campus',
    timeZone: 'Asia/Dhaka',
    persona: 'guardian',
    capabilities: [
      'attendance.read',
      'billing.read',
      'documents.read',
      'forms.consent',
      'grades.read.published',
      'messages.read',
      'messages.send',
      'timetable.read',
    ],
  };
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  privateKey = pair.privateKey;
  publicJwk = {
    ...(await crypto.subtle.exportKey('jwk', pair.publicKey)),
    kid: 'mobile-route-key-1',
    alg: 'RS256',
    use: 'sig',
  };
});

beforeEach(() => {
  databaseQuery.mockReset();
  vi.unstubAllGlobals();
});

describe('platform mobile routes', () => {
  it('reports mobile auth readiness without configuration values', async () => {
    const response = await app.request(
      '/v1/mobile/readiness',
      {},
      {
        APP_ENV: 'test',
        APP_REGION: 'local',
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({
      schemaVersion: 1,
      mode: 'oidc-bearer',
      state: 'disabled',
      tokenValidationEnabled: false,
      missingConfiguration: [
        'issuer',
        'audience',
        'jwks-uri',
        'jwks-origin',
        'required-scope',
        'membership-source',
      ],
    });
    expect(JSON.stringify(payload)).not.toContain('mobile-identity.school.test');
  });

  it('fails closed when mobile provider configuration or bearer credential is absent', async () => {
    const missingConfiguration = await app.request(
      '/v1/mobile/bootstrap',
      {},
      {
        APP_ENV: 'test',
        APP_REGION: 'local',
        DATABASE_URL: readyEnvironment.DATABASE_URL,
        MOBILE_MEMBERSHIP_SOURCE: 'database',
      },
    );
    expect(missingConfiguration.status).toBe(503);
    await expect(missingConfiguration.json()).resolves.toMatchObject({
      error: { code: 'mobile_auth_configuration_unavailable' },
    });

    const fetcher = installJwksFetcher();
    const missingCredential = await app.request('/v1/mobile/bootstrap', {}, readyEnvironment);
    expect(missingCredential.status).toBe(401);
    await expect(missingCredential.json()).resolves.toMatchObject({
      error: { code: 'mobile_bearer_required' },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it('returns tenant-safe campus-specific mobile access for a valid credential', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([activeGuardianRow()]);
    const credential = await signedCredential();
    const response = await app.request(
      '/v1/mobile/bootstrap',
      { headers: { authorization: `Bearer ${credential}` } },
      readyEnvironment,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      accountId: '40000000-0000-4000-8000-000000000001',
      locale: 'en',
      schools: [
        {
          tenantId: '40000000-0000-4000-8000-000000000002',
          tenantName: 'International School',
          campuses: [
            {
              campusId: '40000000-0000-4000-8000-000000000003',
              campusName: 'Main Campus',
              timeZone: 'Asia/Dhaka',
              personas: [
                {
                  persona: 'guardian',
                  capabilities: activeGuardianRow().capabilities,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(databaseQuery).toHaveBeenCalledWith(
      expect.stringContaining('resolve_mobile_bootstrap_access'),
      [readyEnvironment.MOBILE_OIDC_ISSUER, 'provider-mobile-user-1'],
    );
  });

  it('returns 403 for a verified account with no active mobile access', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([]);
    const response = await app.request(
      '/v1/mobile/bootstrap',
      { headers: { authorization: `Bearer ${await signedCredential()}` } },
      readyEnvironment,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'mobile_access_unavailable' },
    });
  });

  it('redacts database failures behind a temporary-unavailable response', async () => {
    installJwksFetcher();
    databaseQuery.mockRejectedValue(new Error('database host password=do-not-expose'));
    const response = await app.request(
      '/v1/mobile/bootstrap',
      { headers: { authorization: `Bearer ${await signedCredential()}` } },
      readyEnvironment,
    );

    expect(response.status).toBe(503);
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({
      error: { code: 'mobile_access_temporarily_unavailable' },
    });
    expect(JSON.stringify(payload)).not.toContain('do-not-expose');
  });
});
