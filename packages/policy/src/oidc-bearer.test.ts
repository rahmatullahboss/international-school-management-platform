import { beforeAll, describe, expect, it } from 'vitest';

import type { OidcBearerConfiguration, OidcJsonWebKey } from './oidc.js';
import { validateOidcBearerConfiguration, verifyOidcBearerToken } from './oidc.js';

const configuration: OidcBearerConfiguration = {
  issuer: 'https://identity.school.test',
  audience: 'school-platform-api',
  requiredScope: 'school_api',
};
const now = Date.parse('2026-08-19T11:00:00Z');
const nowSeconds = Math.floor(now / 1000);

let privateKey: CryptoKey;
let publicJwk: OidcJsonWebKey;

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

async function signBearerToken(
  overrides: Readonly<Record<string, unknown>> = {},
  headerOverrides: Readonly<Record<string, unknown>> = {},
): Promise<string> {
  const header = {
    alg: 'RS256',
    kid: 'mobile-key-1',
    typ: 'at+jwt',
    ...headerOverrides,
  };
  const claims = {
    iss: configuration.issuer,
    sub: 'provider-mobile-user-1',
    sid: 'provider-mobile-session-1',
    aud: configuration.audience,
    exp: nowSeconds + 600,
    iat: nowSeconds,
    auth_time: nowSeconds - 30,
    scope: 'openid profile school_api',
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
    kid: 'mobile-key-1',
    alg: 'RS256',
    use: 'sig',
  };
});

describe('OIDC mobile bearer trust boundary', () => {
  it('verifies RS256 signature issuer audience scope and assurance', async () => {
    const result = await verifyOidcBearerToken({
      bearerToken: await signBearerToken(),
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });

    expect(result).toMatchObject({
      ok: true,
      identity: {
        issuer: configuration.issuer,
        subject: 'provider-mobile-user-1',
        providerSessionId: 'provider-mobile-session-1',
        assurance: 'aal2',
        issuedAt: nowSeconds,
        expiresAt: nowSeconds + 600,
      },
    });
  });

  it('accepts either scope or scp exact token membership', async () => {
    const result = await verifyOidcBearerToken({
      bearerToken: await signBearerToken({ scope: undefined, scp: ['profile', 'school_api'] }),
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('rejects missing scope and wrong audience', async () => {
    const scope = await verifyOidcBearerToken({
      bearerToken: await signBearerToken({ scope: 'openid profile' }),
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(scope).toMatchObject({ ok: false, code: 'oidc_scope_missing' });

    const audience = await verifyOidcBearerToken({
      bearerToken: await signBearerToken({ aud: 'other-api' }),
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(audience).toMatchObject({ ok: false, code: 'oidc_audience_mismatch' });
  });

  it('rejects denied algorithms, expired tokens and unknown keys', async () => {
    const denied = await verifyOidcBearerToken({
      bearerToken: await signBearerToken({}, { alg: 'none' }),
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(denied).toMatchObject({ ok: false, code: 'oidc_token_algorithm_denied' });

    const expired = await verifyOidcBearerToken({
      bearerToken: await signBearerToken({ exp: nowSeconds - 61, iat: nowSeconds - 600 }),
      configuration,
      jwks: { keys: [publicJwk] },
      now,
    });
    expect(expired).toMatchObject({ ok: false, code: 'oidc_token_expired' });

    const missingKey = await verifyOidcBearerToken({
      bearerToken: await signBearerToken(),
      configuration,
      jwks: { keys: [{ ...publicJwk, kid: 'other-key' }] },
      now,
    });
    expect(missingKey).toMatchObject({ ok: false, code: 'oidc_signing_key_not_found' });
  });

  it('fails closed for insecure or ambiguous mobile bearer configuration', () => {
    expect(
      validateOidcBearerConfiguration({ ...configuration, issuer: 'http://identity.school.test' }),
    ).toMatchObject({ ok: false, code: 'oidc_configuration_invalid' });
    expect(
      validateOidcBearerConfiguration({ ...configuration, requiredScope: 'school_api other' }),
    ).toMatchObject({ ok: false, code: 'oidc_configuration_invalid' });
  });
});
