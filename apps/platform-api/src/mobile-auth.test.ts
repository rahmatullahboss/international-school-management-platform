import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OidcJsonWebKey } from '@school/policy';

import {
  MobileJwksCache,
  authenticateMobileBearer,
  resolveMobileAuthReadiness,
  type MobileAuthBindings,
} from './mobile-auth.js';

const now = Date.parse('2026-08-19T11:30:00Z');
const nowSeconds = Math.floor(now / 1000);
const bindings: MobileAuthBindings = {
  MOBILE_OIDC_ISSUER: 'https://identity.school.test',
  MOBILE_OIDC_AUDIENCE: 'school-platform-api',
  MOBILE_OIDC_JWKS_URI: 'https://identity.school.test/jwks',
  MOBILE_OIDC_JWKS_ORIGIN: 'https://identity.school.test',
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

async function credential(overrides: Readonly<Record<string, unknown>> = {}): Promise<string> {
  const header = { alg: 'RS256', kid: 'mobile-key-1', typ: 'at+jwt' };
  const claims = {
    iss: bindings.MOBILE_OIDC_ISSUER,
    sub: 'provider-mobile-user-1',
    aud: bindings.MOBILE_OIDC_AUDIENCE,
    exp: nowSeconds + 600,
    iat: nowSeconds,
    scope: 'openid school_api',
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

function jwksFetcher(keys: readonly OidcJsonWebKey[]) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify({ keys }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
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
    kid: 'mobile-key-1',
    alg: 'RS256',
    use: 'sig',
  };
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('mobile bearer authentication boundary', () => {
  it('reports disabled, incomplete and ready configuration without exposing values', () => {
    expect(resolveMobileAuthReadiness({})).toMatchObject({
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
    expect(
      resolveMobileAuthReadiness({ MOBILE_OIDC_ISSUER: 'https://identity.school.test' }),
    ).toMatchObject({ state: 'incomplete', tokenValidationEnabled: false });
    expect(resolveMobileAuthReadiness(bindings)).toMatchObject({
      state: 'ready',
      tokenValidationEnabled: true,
      missingConfiguration: [],
    });
  });

  it('fails closed before provider access when configuration or bearer header is absent', async () => {
    const fetcher = jwksFetcher([publicJwk]);
    await expect(authenticateMobileBearer({}, undefined, { fetcher, now })).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'mobile_auth_configuration_unavailable',
    });
    await expect(
      authenticateMobileBearer(bindings, undefined, { fetcher, now, cache: new MobileJwksCache() }),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: 'mobile_bearer_required',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts a valid scoped signed credential and caches JWKS', async () => {
    const fetcher = jwksFetcher([publicJwk]);
    const cache = new MobileJwksCache();
    const value = await credential();
    const first = await authenticateMobileBearer(bindings, `Bearer ${value}`, {
      fetcher,
      now,
      cache,
    });
    const second = await authenticateMobileBearer(bindings, `Bearer ${value}`, {
      fetcher,
      now,
      cache,
    });

    expect(first).toMatchObject({
      ok: true,
      identity: {
        issuer: bindings.MOBILE_OIDC_ISSUER,
        subject: 'provider-mobile-user-1',
      },
    });
    expect(second).toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects wrong API scope and an unpinned JWKS origin', async () => {
    const fetcher = jwksFetcher([publicJwk]);
    const wrongScope = await authenticateMobileBearer(
      bindings,
      `Bearer ${await credential({ scope: 'openid profile' })}`,
      { fetcher, now, cache: new MobileJwksCache() },
    );
    expect(wrongScope).toMatchObject({ ok: false, status: 401, code: 'mobile_bearer_invalid' });

    const originMismatch = await authenticateMobileBearer(
      { ...bindings, MOBILE_OIDC_JWKS_ORIGIN: 'https://keys.school.test' },
      `Bearer ${await credential()}`,
      { fetcher, now, cache: new MobileJwksCache() },
    );
    expect(originMismatch).toMatchObject({
      ok: false,
      status: 503,
      code: 'mobile_auth_configuration_unavailable',
    });
  });
});
