import { describe, expect, it } from 'vitest';

import {
  OidcSsoAdapter,
  SamlAssertionValidator,
  type OidcSsoConfiguration,
  type SamlAssertionInput,
} from '../../packages/modules/integrations/src/sso.js';

const oidcConfiguration: OidcSsoConfiguration = {
  issuer: 'https://idp.example.test',
  clientId: 'school-client',
  authorizationEndpoint: 'https://idp.example.test/authorize',
  redirectUri: 'https://school.example.test/auth/oidc/callback',
  scopes: ['openid', 'profile', 'openid'],
};

function validOidcClaims(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    iss: oidcConfiguration.issuer,
    aud: [oidcConfiguration.clientId, 'secondary-audience'],
    sub: 'idp-user-1',
    nonce: 'expected-nonce',
    exp: 2_000,
    iat: 1_000,
    email: 'jane@example.test',
    email_verified: true,
    name: 'Jane Doe',
    groups: ['Teachers', 42, 'Untrusted'],
    ...overrides,
  };
}

const samlConfiguration = {
  entityId: 'https://idp.example.test/saml',
  audience: 'https://school.example.test/saml/metadata',
  recipient: 'https://school.example.test/auth/saml/acs',
};

function validSamlAssertion(overrides: Partial<SamlAssertionInput> = {}): SamlAssertionInput {
  return {
    assertionId: 'assertion-1',
    issuer: samlConfiguration.entityId,
    audience: samlConfiguration.audience,
    recipient: samlConfiguration.recipient,
    inResponseTo: 'request-1',
    subject: 'idp-user-1',
    notBefore: 1_400,
    notOnOrAfter: 1_600,
    signatureVerified: true,
    attributes: {
      email: 'jane@example.test',
      displayName: 'Jane Doe',
      groups: ['Teachers', 42, 'Untrusted'],
    },
    ...overrides,
  };
}

describe('OIDC SSO fail-closed boundaries', () => {
  it('requires HTTPS endpoints and the openid scope', () => {
    expect(
      () => new OidcSsoAdapter({ ...oidcConfiguration, issuer: 'http://idp.example.test' }),
    ).toThrow('OIDC issuer must use HTTPS');
    expect(
      () =>
        new OidcSsoAdapter({
          ...oidcConfiguration,
          authorizationEndpoint: 'http://idp.example.test/authorize',
        }),
    ).toThrow('OIDC authorization endpoint must use HTTPS');
    expect(
      () =>
        new OidcSsoAdapter({
          ...oidcConfiguration,
          redirectUri: 'http://school.example.test/auth/oidc/callback',
        }),
    ).toThrow('OIDC redirect URI must use HTTPS');
    expect(
      () => new OidcSsoAdapter({ ...oidcConfiguration, scopes: ['profile', 'email'] }),
    ).toThrow('OIDC scopes must include openid');
  });

  it('validates state, nonce and PKCE verifier bounds before authorization', async () => {
    const adapter = new OidcSsoAdapter(oidcConfiguration);

    await expect(
      adapter.createAuthorizationRequest({
        state: 'short',
        nonce: 'valid-nonce',
        verifier: 'v'.repeat(43),
      }),
    ).rejects.toThrow('OIDC state and nonce must be at least 8 characters');
    await expect(
      adapter.createAuthorizationRequest({
        state: 'valid-state',
        nonce: 'short',
        verifier: 'v'.repeat(43),
      }),
    ).rejects.toThrow('OIDC state and nonce must be at least 8 characters');
    for (const verifier of ['v'.repeat(42), 'v'.repeat(129)]) {
      await expect(
        adapter.createAuthorizationRequest({
          state: 'valid-state',
          nonce: 'valid-nonce',
          verifier,
        }),
      ).rejects.toThrow('OIDC PKCE verifier must be between 43 and 128 characters');
    }

    const request = await adapter.createAuthorizationRequest({
      state: 'valid-state',
      nonce: 'valid-nonce',
      verifier: 'v'.repeat(43),
    });
    expect(new URL(request.url).searchParams.has('login_hint')).toBe(false);
    expect(new URL(request.url).searchParams.get('scope')).toBe('openid profile');
  });

  it('rejects unbound or invalid identity claims and minimizes optional profile data', () => {
    const adapter = new OidcSsoAdapter(oidcConfiguration);
    const input = {
      expectedNonce: 'expected-nonce',
      nowSeconds: 1_500,
      allowedGroups: ['Teachers'],
    };

    expect(adapter.validateClaims(validOidcClaims(), input)).toEqual({
      subject: 'idp-user-1',
      email: 'jane@example.test',
      displayName: 'Jane Doe',
      groups: ['Teachers'],
    });
    expect(
      adapter.validateClaims(
        validOidcClaims({ email_verified: false, name: 42, groups: 'Teachers' }),
        input,
      ),
    ).toEqual({ subject: 'idp-user-1', email: null, displayName: null, groups: [] });

    const failures: readonly [Readonly<Record<string, unknown>>, string][] = [
      [validOidcClaims({ aud: ['other-audience'] }), 'OIDC audience does not match'],
      [validOidcClaims({ aud: 42 }), 'OIDC audience does not match'],
      [validOidcClaims({ nonce: 'wrong-nonce' }), 'OIDC nonce does not match'],
      [validOidcClaims({ exp: 1_500 }), 'OIDC claims are expired'],
      [validOidcClaims({ exp: 'later' }), 'OIDC claims are expired'],
      [validOidcClaims({ iat: 1_561 }), 'OIDC issue time is invalid'],
      [validOidcClaims({ iat: 'earlier' }), 'OIDC issue time is invalid'],
      [validOidcClaims({ sub: '' }), 'OIDC subject is required'],
      [validOidcClaims({ sub: 42 }), 'OIDC subject is required'],
    ];
    for (const [claims, message] of failures) {
      expect(() => adapter.validateClaims(claims, input)).toThrow(message);
    }
  });
});

describe('SAML SSO fail-closed boundaries', () => {
  it('requires HTTPS entity, audience and recipient configuration', () => {
    expect(
      () =>
        new SamlAssertionValidator({
          ...samlConfiguration,
          entityId: 'http://idp.example.test/saml',
        }),
    ).toThrow('SAML entity ID must use HTTPS');
    expect(
      () =>
        new SamlAssertionValidator({
          ...samlConfiguration,
          audience: 'http://school.example.test/saml',
        }),
    ).toThrow('SAML audience must use HTTPS');
    expect(
      () =>
        new SamlAssertionValidator({
          ...samlConfiguration,
          recipient: 'http://school.example.test/acs',
        }),
    ).toThrow('SAML recipient must use HTTPS');
  });

  it('binds assertions to issuer, audience, recipient, request, time and subject', () => {
    const input = {
      expectedRequestId: 'request-1',
      nowSeconds: 1_500,
      allowedGroups: ['Teachers'],
    };
    const cases: readonly [Partial<SamlAssertionInput>, string][] = [
      [{ issuer: 'https://other.example.test/saml' }, 'SAML issuer does not match'],
      [{ audience: 'https://other.example.test/audience' }, 'SAML audience does not match'],
      [{ recipient: 'https://other.example.test/acs' }, 'SAML recipient does not match'],
      [
        { inResponseTo: 'other-request' },
        'SAML assertion response does not match the login request',
      ],
      [{ notBefore: 1_561 }, 'SAML assertion is outside its validity window'],
      [{ subject: '' }, 'SAML subject is required'],
    ];

    for (const [overrides, message] of cases) {
      const validator = new SamlAssertionValidator(samlConfiguration);
      expect(() => validator.validate(validSamlAssertion(overrides), input)).toThrow(message);
    }
  });

  it('minimizes optional attributes and accepts only allowlisted string groups', () => {
    const validator = new SamlAssertionValidator(samlConfiguration);
    expect(
      validator.validate(
        validSamlAssertion({
          attributes: { email: 42, displayName: false, groups: ['Teachers', 42, 'Untrusted'] },
        }),
        { expectedRequestId: 'request-1', nowSeconds: 1_500, allowedGroups: ['Teachers'] },
      ),
    ).toEqual({ subject: 'idp-user-1', email: null, displayName: null, groups: ['Teachers'] });
  });
});
