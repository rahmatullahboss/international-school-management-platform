import { beforeAll, describe, expect, it } from 'vitest';

import type { OidcJsonWebKey, OidcProviderConfiguration } from './oidc.js';
import { validateOidcProviderConfiguration, verifyOidcIdToken } from './oidc.js';

const configuration: OidcProviderConfiguration = {
  issuer: 'https://identity.school.test',
  clientId: 'school-platform-web',
  authorizationEndpoint: 'https://identity.school.test/oauth2/authorize',
  tokenEndpoint: 'https://identity.school.test/oauth2/token',
  jwksUri: 'https://identity.school.test/.well-known/jwks.json',
  redirectUri: 'https://school.test/auth/v1/callback',
};
const now = Date.parse('2026-07-30T04:30:00Z');
const nowSeconds = Math.floor(now / 1000);
const nonce = 'nonce-with-sufficient-entropy-for-the-login-transaction';

let privateKey: CryptoKey;
let publicJwk: OidcJsonWebKey;

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

async function signToken(
  overrides: Readonly<Record<string, unknown>> = {},
  headerOverrides: Readonly<Record<string, unknown>> = {},
): Promise<string> {
  const header = {
    alg: 'RS256',
    kid: 'school-key-1',
    typ: 'JWT',
    ...headerOverrides,
  };
  const claims = {
    iss: configuration.issuer,
    sub: 'provider-user-123',
    sid: 'provider-session-abc',
    aud: configuration.clientId,
    exp: nowSeconds + 600,
    iat: nowSeconds,
    nonce,
    auth_time: nowSeconds - 30,
    email: 'principal@school.test',
    email_verified: true,
    name: 'Pilot Principal',
    acr: 'urn:school:aal2',
    amr: ['pwd', 'webauthn'],
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
    kid: 'school-key-1',
    alg: 'RS256',
    use: 'sig',
  };
});

describe('OIDC trust boundary', () => {
  it('verifies an approved RS256 token and derives AAL2 assurance', async () => {
    const result = await verifyOidcIdToken({
      idToken: await signToken(),
      nonce,
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });

    expect(result).toEqual({
      ok: true,
      identity: {
        issuer: configuration.issuer,
        subject: 'provider-user-123',
        providerSessionId: 'provider-session-abc',
        email: 'principal@school.test',
        emailVerified: true,
        displayName: 'Pilot Principal',
        assurance: 'aal2',
        authenticationTime: nowSeconds - 30,
        issuedAt: nowSeconds,
        expiresAt: nowSeconds + 600,
      },
    });
  });

  it('rejects denied algorithms before considering token claims', async () => {
    const encodedHeader = encodeBase64Url(JSON.stringify({ alg: 'none', kid: 'school-key-1' }));
    const encodedClaims = encodeBase64Url(
      JSON.stringify({
        iss: configuration.issuer,
        sub: 'provider-user-123',
        aud: configuration.clientId,
        exp: nowSeconds + 600,
        iat: nowSeconds,
        nonce,
      }),
    );
    const result = await verifyOidcIdToken({
      idToken: `${encodedHeader}.${encodedClaims}.unsigned`,
      nonce,
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });

    expect(result).toMatchObject({ ok: false, code: 'oidc_token_algorithm_denied' });
  });

  it('rejects issuer, audience and nonce mismatches', async () => {
    const issuer = await verifyOidcIdToken({
      idToken: await signToken({ iss: 'https://attacker.test' }),
      nonce,
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(issuer).toMatchObject({ ok: false, code: 'oidc_issuer_mismatch' });

    const audience = await verifyOidcIdToken({
      idToken: await signToken({ aud: ['school-platform-web', 'another-client'] }),
      nonce,
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(audience).toMatchObject({ ok: false, code: 'oidc_audience_mismatch' });

    const nonceResult = await verifyOidcIdToken({
      idToken: await signToken(),
      nonce: 'different-login-transaction',
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(nonceResult).toMatchObject({ ok: false, code: 'oidc_nonce_mismatch' });
  });

  it('accepts multiple audiences only when azp identifies this client', async () => {
    const result = await verifyOidcIdToken({
      idToken: await signToken({
        aud: ['school-platform-web', 'school-platform-api'],
        azp: configuration.clientId,
      }),
      nonce,
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('rejects expired, future and excessive-lifetime tokens', async () => {
    const expired = await verifyOidcIdToken({
      idToken: await signToken({ exp: nowSeconds - 61, iat: nowSeconds - 600 }),
      nonce,
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(expired).toMatchObject({ ok: false, code: 'oidc_token_expired' });

    const future = await verifyOidcIdToken({
      idToken: await signToken({ iat: nowSeconds + 61, exp: nowSeconds + 661 }),
      nonce,
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(future).toMatchObject({ ok: false, code: 'oidc_token_not_yet_valid' });

    const excessive = await verifyOidcIdToken({
      idToken: await signToken({ iat: nowSeconds, exp: nowSeconds + 3601 }),
      nonce,
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(excessive).toMatchObject({ ok: false, code: 'oidc_claims_invalid' });
  });

  it('rejects missing signing keys and tampered signatures', async () => {
    const token = await signToken();
    const missingKey = await verifyOidcIdToken({
      idToken: token,
      nonce,
      configuration,
      jwks: { keys: [{ ...publicJwk, kid: 'different-key' }] },
      now,
    });
    expect(missingKey).toMatchObject({ ok: false, code: 'oidc_signing_key_not_found' });

    const segments = token.split('.');
    const signature = segments[2];
    if (segments[0] === undefined || segments[1] === undefined || signature === undefined) {
      throw new Error('Expected complete JWT segments.');
    }
    const replacement = signature.startsWith('A') ? 'B' : 'A';
    const tampered = `${segments[0]}.${segments[1]}.${replacement}${signature.slice(1)}`;
    const tamperedResult = await verifyOidcIdToken({
      idToken: tampered,
      nonce,
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(tamperedResult).toMatchObject({ ok: false, code: 'oidc_signature_invalid' });
  });

  it('fails closed for insecure or non-canonical provider configuration', () => {
    expect(
      validateOidcProviderConfiguration({
        ...configuration,
        issuer: 'http://identity.school.test',
      }),
    ).toMatchObject({ ok: false, code: 'oidc_configuration_invalid' });
    expect(
      validateOidcProviderConfiguration({ ...configuration, issuer: `${configuration.issuer}/` }),
    ).toMatchObject({ ok: false, code: 'oidc_configuration_invalid' });
  });
});
