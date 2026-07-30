import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { OidcJsonWebKey, OidcProviderConfiguration } from './oidc.js';
import {
  MemoryOidcProviderCacheStore,
  OidcProviderCache,
  verifyOidcIdTokenWithRotation,
  type OidcCachedJwksResult,
  type OidcProviderCacheStore,
} from './oidc-provider-cache.js';

const configuration: OidcProviderConfiguration = {
  issuer: 'https://identity.school.test',
  clientId: 'school-platform-web',
  authorizationEndpoint: 'https://identity.school.test/oauth2/authorize',
  tokenEndpoint: 'https://identity.school.test/oauth2/token',
  jwksUri: 'https://keys.school.test/.well-known/jwks.json',
  redirectUri: 'https://school.test/auth/v1/callback',
};
const allowedOrigins = ['https://identity.school.test', 'https://keys.school.test'];
const initialNow = Date.parse('2026-07-30T10:00:00Z');
const nonce = 'nonce-with-sufficient-entropy-for-the-login-transaction';

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'max-age=60',
      ...init.headers,
    },
    ...init,
  });
}

function discoveryDocument(overrides: Readonly<Record<string, unknown>> = {}): unknown {
  return {
    issuer: configuration.issuer,
    authorization_endpoint: configuration.authorizationEndpoint,
    token_endpoint: configuration.tokenEndpoint,
    jwks_uri: configuration.jwksUri,
    response_types_supported: ['code'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
    ...overrides,
  };
}

function rsaKey(kid: string, modulus = `modulus-${kid}`): OidcJsonWebKey {
  return {
    kty: 'RSA',
    kid,
    alg: 'RS256',
    use: 'sig',
    n: modulus,
    e: 'AQAB',
  };
}

function jwksResult(keys: readonly OidcJsonWebKey[]): OidcCachedJwksResult {
  return {
    ok: true,
    jwks: { keys },
    source: 'cache',
    freshUntil: initialNow + 60_000,
    activeKeyIds: keys.map((key) => key.kid!),
    retiredKeyIds: [],
  };
}

let signingPrivateKey: CryptoKey;
let signingPublicJwk: OidcJsonWebKey;
let wrongPublicJwk: OidcJsonWebKey;

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

async function signToken(): Promise<string> {
  const nowSeconds = Math.floor(initialNow / 1000);
  const header = { alg: 'RS256', kid: 'rotated-key', typ: 'JWT' };
  const claims = {
    iss: configuration.issuer,
    sub: 'provider-user-123',
    aud: configuration.clientId,
    exp: nowSeconds + 600,
    iat: nowSeconds,
    nonce,
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedClaims = encodeBase64Url(JSON.stringify(claims));
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    signingPrivateKey,
    new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
  );
  return `${encodedHeader}.${encodedClaims}.${encodeBase64Url(signature)}`;
}

beforeAll(async () => {
  const signingPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  signingPrivateKey = signingPair.privateKey;
  signingPublicJwk = {
    ...(await crypto.subtle.exportKey('jwk', signingPair.publicKey)),
    kid: 'rotated-key',
    alg: 'RS256',
    use: 'sig',
  };

  const wrongPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  wrongPublicJwk = {
    ...(await crypto.subtle.exportKey('jwk', wrongPair.publicKey)),
    kid: 'rotated-key',
    alg: 'RS256',
    use: 'sig',
  };
});

describe('OIDC provider cache governance', () => {
  it('caches discovery metadata and conditionally revalidates with an ETag', async () => {
    let now = initialNow;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(discoveryDocument(), {
          headers: { etag: '"metadata-v1"', 'cache-control': 'max-age=60' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 304,
          headers: { etag: '"metadata-v1"', 'cache-control': 'max-age=120' },
        }),
      );
    const cache = new OidcProviderCache({
      store: new MemoryOidcProviderCacheStore(),
      allowedEndpointOrigins: allowedOrigins,
      fetcher,
      now: () => now,
    });

    await expect(
      cache.resolveDiscovery({
        issuer: configuration.issuer,
        clientId: configuration.clientId,
        redirectUri: configuration.redirectUri,
      }),
    ).resolves.toMatchObject({ ok: true, source: 'network' });
    await expect(
      cache.resolveDiscovery({
        issuer: configuration.issuer,
        clientId: configuration.clientId,
        redirectUri: configuration.redirectUri,
      }),
    ).resolves.toMatchObject({ ok: true, source: 'cache' });
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 61_000;
    await expect(
      cache.resolveDiscovery({
        issuer: configuration.issuer,
        clientId: configuration.clientId,
        redirectUri: configuration.redirectUri,
      }),
    ).resolves.toMatchObject({ ok: true, source: 'revalidated' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const headers = new Headers(fetcher.mock.calls[1]?.[1]?.headers);
    expect(headers.get('if-none-match')).toBe('"metadata-v1"');
  });

  it('denies unpinned endpoint origins and reviewed endpoint changes', async () => {
    const denied = new OidcProviderCache({
      store: new MemoryOidcProviderCacheStore(),
      allowedEndpointOrigins: ['https://identity.school.test'],
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(discoveryDocument())),
      now: () => initialNow,
    });
    await expect(
      denied.resolveDiscovery({
        issuer: configuration.issuer,
        clientId: configuration.clientId,
        redirectUri: configuration.redirectUri,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'oidc_endpoint_origin_denied' });

    let now = initialNow;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(discoveryDocument()))
      .mockResolvedValueOnce(
        jsonResponse(discoveryDocument({ token_endpoint: 'https://keys.school.test/token' })),
      );
    const cache = new OidcProviderCache({
      store: new MemoryOidcProviderCacheStore(),
      allowedEndpointOrigins: allowedOrigins,
      fetcher,
      now: () => now,
    });
    await cache.resolveDiscovery({
      issuer: configuration.issuer,
      clientId: configuration.clientId,
      redirectUri: configuration.redirectUri,
    });
    now += 61_000;
    await expect(
      cache.resolveDiscovery({
        issuer: configuration.issuer,
        clientId: configuration.clientId,
        redirectUri: configuration.redirectUri,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'oidc_provider_endpoint_changed' });
  });

  it('uses one shared provider request for concurrent cache misses', async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher = vi.fn<typeof fetch>(async () => {
      await pending;
      return jsonResponse(discoveryDocument());
    });
    const cache = new OidcProviderCache({
      store: new MemoryOidcProviderCacheStore(),
      allowedEndpointOrigins: allowedOrigins,
      fetcher,
      now: () => initialNow,
    });
    const input = {
      issuer: configuration.issuer,
      clientId: configuration.clientId,
      redirectUri: configuration.redirectUri,
    };
    const first = cache.resolveDiscovery(input);
    const second = cache.resolveDiscovery(input);
    release?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toMatchObject({ ok: true });
    expect(secondResult).toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('retains removed keys for a bounded overlap and denies kid reuse with new material', async () => {
    let now = initialNow;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ keys: [rsaKey('key-1')] }))
      .mockResolvedValueOnce(jsonResponse({ keys: [rsaKey('key-2')] }))
      .mockResolvedValueOnce(jsonResponse({ keys: [rsaKey('key-2')] }));
    const cache = new OidcProviderCache({
      store: new MemoryOidcProviderCacheStore(),
      allowedEndpointOrigins: allowedOrigins,
      fetcher,
      now: () => now,
    });

    await expect(cache.resolveJwks({ configuration })).resolves.toMatchObject({
      ok: true,
      activeKeyIds: ['key-1'],
      retiredKeyIds: [],
    });
    const rotated = await cache.resolveJwks({ configuration, forceRefresh: true });
    expect(rotated).toMatchObject({
      ok: true,
      activeKeyIds: ['key-2'],
      retiredKeyIds: ['key-1'],
    });
    if (!rotated.ok) throw new Error(rotated.message);
    expect(rotated.jwks.keys.map((key) => key.kid)).toEqual(['key-2', 'key-1']);

    now += 901_000;
    await expect(cache.resolveJwks({ configuration, forceRefresh: true })).resolves.toMatchObject({
      ok: true,
      activeKeyIds: ['key-2'],
      retiredKeyIds: [],
    });

    const conflictingFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ keys: [rsaKey('shared', 'first-modulus')] }))
      .mockResolvedValueOnce(jsonResponse({ keys: [rsaKey('shared', 'different-modulus')] }));
    const conflictingCache = new OidcProviderCache({
      store: new MemoryOidcProviderCacheStore(),
      allowedEndpointOrigins: allowedOrigins,
      fetcher: conflictingFetcher,
      now: () => initialNow,
    });
    await conflictingCache.resolveJwks({ configuration });
    await expect(
      conflictingCache.resolveJwks({ configuration, forceRefresh: true }),
    ).resolves.toMatchObject({ ok: false, code: 'oidc_key_rotation_conflict' });
  });

  it('uses stale approved keys only for bounded network failure and rejects poisoned cache entries', async () => {
    let now = initialNow;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ keys: [rsaKey('key-1')] }, { headers: { 'cache-control': 'max-age=30' } }),
      )
      .mockRejectedValueOnce(new TypeError('network unavailable'));
    const cache = new OidcProviderCache({
      store: new MemoryOidcProviderCacheStore(),
      allowedEndpointOrigins: allowedOrigins,
      fetcher,
      now: () => now,
    });
    await cache.resolveJwks({ configuration });
    now += 31_000;
    await expect(cache.resolveJwks({ configuration })).resolves.toMatchObject({
      ok: true,
      source: 'stale',
      activeKeyIds: ['key-1'],
    });

    const poisonedStore: OidcProviderCacheStore = {
      read: async () => {
        await Promise.resolve();
        return { schemaVersion: 1, kind: 'jwks', issuer: 'https://attacker.test' };
      },
      write: async () => {
        await Promise.resolve();
      },
    };
    const poisoned = new OidcProviderCache({
      store: poisonedStore,
      allowedEndpointOrigins: allowedOrigins,
      fetcher: vi.fn<typeof fetch>(),
      now: () => initialNow,
    });
    await expect(poisoned.resolveJwks({ configuration })).resolves.toMatchObject({
      ok: false,
      code: 'oidc_cache_entry_invalid',
    });
  });
});

describe('OIDC unknown-kid rotation verification', () => {
  it('forces exactly one signing-key refresh after a key-not-found result', async () => {
    const resolver = vi
      .fn<(forceRefresh: boolean) => Promise<OidcCachedJwksResult>>()
      .mockResolvedValueOnce(jwksResult([rsaKey('old-key')]))
      .mockResolvedValueOnce(jwksResult([signingPublicJwk]));
    const result = await verifyOidcIdTokenWithRotation({
      idToken: await signToken(),
      nonce,
      configuration,
      now: initialNow,
      resolveJwks: resolver,
    });

    expect(result).toMatchObject({ ok: true });
    expect(resolver).toHaveBeenNthCalledWith(1, false);
    expect(resolver).toHaveBeenNthCalledWith(2, true);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('does not refresh when a known kid has an invalid signature', async () => {
    const resolver = vi
      .fn<(forceRefresh: boolean) => Promise<OidcCachedJwksResult>>()
      .mockResolvedValue(jwksResult([wrongPublicJwk]));
    const result = await verifyOidcIdTokenWithRotation({
      idToken: await signToken(),
      nonce,
      configuration,
      now: initialNow,
      resolveJwks: resolver,
    });

    expect(result).toMatchObject({ ok: false, code: 'oidc_signature_invalid' });
    expect(resolver).toHaveBeenCalledOnce();
    expect(resolver).toHaveBeenCalledWith(false);
  });
});
