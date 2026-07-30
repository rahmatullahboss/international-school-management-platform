import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { OidcJsonWebKey, OidcProviderConfiguration } from './oidc.js';
import {
  processOidcBackchannelLogout,
  verifyOidcBackchannelLogoutToken,
  verifyOidcBackchannelLogoutTokenWithRotation,
  type OidcBackchannelLogoutClaims,
} from './oidc-backchannel-logout.js';
import type { OidcCachedJwksResult } from './oidc-provider-cache.js';

const configuration: OidcProviderConfiguration = {
  issuer: 'https://identity.school.test',
  clientId: 'school-platform-web',
  authorizationEndpoint: 'https://identity.school.test/oauth2/authorize',
  tokenEndpoint: 'https://identity.school.test/oauth2/token',
  jwksUri: 'https://identity.school.test/.well-known/jwks.json',
  redirectUri: 'https://school.test/auth/v1/callback',
};
const now = Date.parse('2026-07-31T00:00:00Z');
const nowSeconds = Math.floor(now / 1000);
const event = 'http://schemas.openid.net/event/backchannel-logout';
let privateKey: CryptoKey;
let publicJwk: OidcJsonWebKey;

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

async function signToken(
  claimOverrides: Readonly<Record<string, unknown>> = {},
  headerOverrides: Readonly<Record<string, unknown>> = {},
): Promise<string> {
  const header = { alg: 'RS256', kid: 'logout-key-1', typ: 'logout+jwt', ...headerOverrides };
  const claims = {
    iss: configuration.issuer,
    sub: 'provider-user-123',
    sid: 'provider-session-abc',
    aud: configuration.clientId,
    iat: nowSeconds - 30,
    exp: nowSeconds + 270,
    jti: 'logout-token-123',
    events: { [event]: {} },
    ...claimOverrides,
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

function jwksResult(keys: readonly OidcJsonWebKey[]): OidcCachedJwksResult {
  return {
    ok: true,
    jwks: { keys },
    source: 'cache',
    freshUntil: now + 60_000,
    activeKeyIds: keys.map((key) => key.kid!),
    retiredKeyIds: [],
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
    kid: 'logout-key-1',
    alg: 'RS256',
    use: 'sig',
  };
});

describe('OIDC back-channel Logout Token policy', () => {
  it('verifies a typed signed token containing both provider subject and session id', async () => {
    await expect(
      verifyOidcBackchannelLogoutToken({
        logoutToken: await signToken(),
        configuration,
        jwks: { keys: [publicJwk] },
        now,
      }),
    ).resolves.toEqual({
      ok: true,
      claims: {
        issuer: configuration.issuer,
        subject: 'provider-user-123',
        providerSessionId: 'provider-session-abc',
        tokenId: 'logout-token-123',
        issuedAt: nowSeconds - 30,
        expiresAt: nowSeconds + 270,
      },
    });
  });

  it('requires the logout event, explicit token type, no nonce and a subject or session id', async () => {
    const cases = [
      signToken({ events: {} }),
      signToken({ events: { [event]: { unexpected: true } } }),
      signToken({ nonce: 'forbidden' }),
      signToken({ sub: undefined, sid: undefined }),
      signToken({}, { typ: 'JWT' }),
    ];
    for (const token of cases) {
      await expect(
        verifyOidcBackchannelLogoutToken({
          logoutToken: await token,
          configuration,
          jwks: { keys: [publicJwk] },
          now,
        }),
      ).resolves.toMatchObject({ ok: false });
    }
  });

  it('rejects wrong issuer, audience, expiry, future issue time and overlong lifetime', async () => {
    const cases = [
      [signToken({ iss: 'https://attacker.test' }), 'oidc_backchannel_issuer_mismatch'],
      [signToken({ aud: 'different-client' }), 'oidc_backchannel_audience_mismatch'],
      [signToken({ exp: nowSeconds - 61 }), 'oidc_backchannel_token_expired'],
      [
        signToken({ iat: nowSeconds + 61, exp: nowSeconds + 361 }),
        'oidc_backchannel_token_not_yet_valid',
      ],
      [
        signToken({ iat: nowSeconds - 700, exp: nowSeconds + 1 }),
        'oidc_backchannel_claims_invalid',
      ],
      [
        signToken({ iat: nowSeconds - 400, exp: nowSeconds + 100 }),
        'oidc_backchannel_token_too_old',
      ],
    ] as const;
    for (const [token, code] of cases) {
      await expect(
        verifyOidcBackchannelLogoutToken({
          logoutToken: await token,
          configuration,
          jwks: { keys: [publicJwk] },
          now,
        }),
      ).resolves.toMatchObject({ ok: false, code });
    }
  });

  it('forces exactly one signing-key refresh for an unknown kid', async () => {
    const resolver = vi
      .fn<(forceRefresh: boolean) => Promise<OidcCachedJwksResult>>()
      .mockResolvedValueOnce(jwksResult([{ ...publicJwk, kid: 'old-key' }]))
      .mockResolvedValueOnce(jwksResult([publicJwk]));
    await expect(
      verifyOidcBackchannelLogoutTokenWithRotation({
        logoutToken: await signToken(),
        configuration,
        resolveJwks: resolver,
        now,
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(resolver).toHaveBeenNthCalledWith(1, false);
    expect(resolver).toHaveBeenNthCalledWith(2, true);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('persists replay denial and provider-session revocation in one atomic operation', async () => {
    const applyLogout = vi
      .fn<
        (
          claims: OidcBackchannelLogoutClaims,
        ) => Promise<{ readonly replayed: boolean; readonly revokedSessions: number }>
      >()
      .mockResolvedValueOnce({ replayed: false, revokedSessions: 2 })
      .mockResolvedValueOnce({ replayed: true, revokedSessions: 0 });
    const input = {
      logoutToken: await signToken(),
      configuration,
      resolveJwks: async () => {
        await Promise.resolve();
        return jwksResult([publicJwk]);
      },
      applyLogout,
      now,
    };

    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      revokedSessions: 2,
    });
    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: true,
      replayed: true,
      revokedSessions: 0,
    });
    expect(applyLogout).toHaveBeenCalledTimes(2);
    expect(applyLogout.mock.calls[0]?.[0]).toMatchObject({
      tokenId: 'logout-token-123',
      subject: 'provider-user-123',
      providerSessionId: 'provider-session-abc',
    });
  });

  it('allows a provider retry after atomic persistence is unavailable', async () => {
    const applyLogout = vi
      .fn<
        (
          claims: OidcBackchannelLogoutClaims,
        ) => Promise<{ readonly replayed: boolean; readonly revokedSessions: number }>
      >()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ replayed: false, revokedSessions: 1 });
    const input = {
      logoutToken: await signToken(),
      configuration,
      resolveJwks: async () => {
        await Promise.resolve();
        return jwksResult([publicJwk]);
      },
      applyLogout,
      now,
    };

    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: false,
      code: 'oidc_backchannel_persistence_unavailable',
    });
    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      revokedSessions: 1,
    });
    expect(applyLogout).toHaveBeenCalledTimes(2);
  });
});
