import { describe, expect, test } from 'vitest';

import {
  OidcSsoAdapter,
  SamlAssertionValidator,
  ScimContract,
} from '../../packages/modules/integrations/src/index.js';

describe('OIDC SSO contract', () => {
  test('builds an HTTPS authorisation request with PKCE and nonce', async () => {
    const adapter = new OidcSsoAdapter({
      issuer: 'https://idp.example.test',
      clientId: 'school-client',
      authorizationEndpoint: 'https://idp.example.test/authorize',
      redirectUri: 'https://school.example.test/auth/oidc/callback',
      scopes: ['openid', 'profile', 'email'],
    });
    const request = await adapter.createAuthorizationRequest({
      state: 'oidc-state',
      nonce: 'oidc-nonce',
      verifier: 'v'.repeat(50),
      loginHint: 'jane@example.test',
    });

    expect(request.url).toContain('response_type=code');
    expect(request.url).toContain('code_challenge_method=S256');
    expect(request.url).toContain('nonce=oidc-nonce');
    expect(request.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  test('validates issuer, audience, nonce, time and approved groups', () => {
    const adapter = new OidcSsoAdapter({
      issuer: 'https://idp.example.test',
      clientId: 'school-client',
      authorizationEndpoint: 'https://idp.example.test/authorize',
      redirectUri: 'https://school.example.test/auth/oidc/callback',
      scopes: ['openid', 'profile', 'email'],
    });

    expect(
      adapter.validateClaims(
        {
          iss: 'https://idp.example.test',
          aud: 'school-client',
          sub: 'idp-user-1',
          nonce: 'oidc-nonce',
          exp: 2_000,
          iat: 1_000,
          email: 'jane@example.test',
          email_verified: true,
          name: 'Jane Doe',
          groups: ['Teachers', 'Untrusted'],
        },
        { expectedNonce: 'oidc-nonce', nowSeconds: 1_500, allowedGroups: ['Teachers'] },
      ),
    ).toEqual({
      subject: 'idp-user-1',
      email: 'jane@example.test',
      displayName: 'Jane Doe',
      groups: ['Teachers'],
    });
    expect(() =>
      adapter.validateClaims(
        {
          iss: 'https://other.example.test',
          aud: 'school-client',
          sub: 'idp-user-1',
          nonce: 'oidc-nonce',
          exp: 2_000,
          iat: 1_000,
        },
        { expectedNonce: 'oidc-nonce', nowSeconds: 1_500, allowedGroups: [] },
      ),
    ).toThrow('OIDC issuer does not match');
  });
});

describe('SAML assertion contract', () => {
  test('validates signed assertion semantics and filters groups', () => {
    const validator = new SamlAssertionValidator({
      entityId: 'https://idp.example.test/saml',
      audience: 'https://school.example.test/saml/metadata',
      recipient: 'https://school.example.test/auth/saml/acs',
      clockSkewSeconds: 60,
    });
    const assertion = {
      assertionId: 'assertion-1',
      issuer: 'https://idp.example.test/saml',
      audience: 'https://school.example.test/saml/metadata',
      recipient: 'https://school.example.test/auth/saml/acs',
      inResponseTo: 'request-1',
      subject: 'idp-user-1',
      notBefore: 1_400,
      notOnOrAfter: 1_600,
      signatureVerified: true,
      attributes: {
        email: 'jane@example.test',
        displayName: 'Jane Doe',
        groups: ['Teachers', 'Untrusted'],
      },
    };

    expect(
      validator.validate(assertion, {
        expectedRequestId: 'request-1',
        nowSeconds: 1_500,
        allowedGroups: ['Teachers'],
      }),
    ).toEqual({
      subject: 'idp-user-1',
      email: 'jane@example.test',
      displayName: 'Jane Doe',
      groups: ['Teachers'],
    });
    expect(() =>
      validator.validate(assertion, {
        expectedRequestId: 'request-1',
        nowSeconds: 1_500,
        allowedGroups: ['Teachers'],
      }),
    ).toThrow('SAML assertion was already used');
  });

  test('rejects unsigned, unsolicited or expired assertions', () => {
    const validator = new SamlAssertionValidator({
      entityId: 'https://idp.example.test/saml',
      audience: 'https://school.example.test/saml/metadata',
      recipient: 'https://school.example.test/auth/saml/acs',
    });
    const base = {
      assertionId: 'assertion-2',
      issuer: 'https://idp.example.test/saml',
      audience: 'https://school.example.test/saml/metadata',
      recipient: 'https://school.example.test/auth/saml/acs',
      inResponseTo: 'request-2',
      subject: 'idp-user-2',
      notBefore: 1_400,
      notOnOrAfter: 1_600,
      signatureVerified: true,
      attributes: {},
    };

    expect(() =>
      validator.validate(
        { ...base, signatureVerified: false },
        {
          expectedRequestId: 'request-2',
          nowSeconds: 1_500,
          allowedGroups: [],
        },
      ),
    ).toThrow('SAML assertion signature is not verified');
    expect(() =>
      validator.validate(base, {
        expectedRequestId: 'other-request',
        nowSeconds: 1_500,
        allowedGroups: [],
      }),
    ).toThrow('SAML assertion response does not match the login request');
    expect(() =>
      validator.validate(
        { ...base, assertionId: 'assertion-3' },
        {
          expectedRequestId: 'request-2',
          nowSeconds: 1_700,
          allowedGroups: [],
        },
      ),
    ).toThrow('SAML assertion is outside its validity window');
  });
});

describe('SCIM provisioning contract', () => {
  test('defines resource paths, filters, patches and weak versions', () => {
    const scim = new ScimContract('/api/v1/scim/v2');

    expect(scim.resourcePath('Users', 'user-1')).toBe('/api/v1/scim/v2/Users/user-1');
    expect(scim.parseFilter('userName eq "jane@example.test"')).toEqual({
      attribute: 'userName',
      operator: 'eq',
      value: 'jane@example.test',
    });
    expect(
      scim.validatePatch([
        { op: 'replace', path: 'active', value: false },
        { op: 'add', path: 'groups', value: [{ value: 'group-1' }] },
      ]),
    ).toHaveLength(2);
    expect(scim.etag(7)).toBe('W/"7"');
    expect(() => scim.validatePatch([{ op: 'remove', path: 'id' }])).toThrow(
      'SCIM patch path is not writable',
    );
  });

  test('rejects unsupported filters and patch operations', () => {
    const scim = new ScimContract('/api/v1/scim/v2');

    expect(() => scim.parseFilter('displayName co "Jane"')).toThrow(
      'SCIM filter supports only the eq operator',
    );
    expect(() => scim.validatePatch([{ op: 'move', path: 'active', value: true }])).toThrow(
      'SCIM patch operation is not supported',
    );
  });
});
