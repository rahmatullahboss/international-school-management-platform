import { describe, expect, it } from 'vitest';

import { resolveAuthReadiness } from './auth-boundary.js';

const completeBindings = {
  OIDC_ISSUER: 'https://identity.school.test',
  OIDC_CLIENT_ID: 'school-platform-web',
  OIDC_CLIENT_SECRET: 'confidential-client-secret',
  OIDC_AUTHORIZATION_ENDPOINT: 'https://identity.school.test/oauth2/authorize',
  OIDC_TOKEN_ENDPOINT: 'https://identity.school.test/oauth2/token',
  OIDC_JWKS_URI: 'https://identity.school.test/.well-known/jwks.json',
  OIDC_REDIRECT_URI: 'https://school.test/auth/v1/callback',
  AUTH_TRANSACTION_SECRET: 'transaction-signing-secret-with-at-least-32-characters',
  AUTH_TRANSACTION_REPLAY_SOURCE: 'database',
  AUTH_SESSION_SECRET: 'session-signing-secret-with-at-least-32-characters',
  AUTH_MEMBERSHIP_SOURCE: 'database',
};

describe('OIDC BFF readiness', () => {
  it('reports every missing category without exposing binding names or values', () => {
    const readiness = resolveAuthReadiness({});
    expect(readiness).toEqual({
      schemaVersion: 1,
      mode: 'oidc-bff',
      state: 'disabled',
      loginEnabled: false,
      controls: {
        authorizationCode: true,
        pkceS256: true,
        highEntropyStateNonceVerifier: true,
        browserBoundTransactionCookie: true,
        transactionReplayProtection: true,
        authorizationResponseIssuerValidation: true,
        confidentialClientAuthentication: true,
        serverSideTokenExchange: true,
        providerDiscoveryValidation: true,
        issuerValidation: true,
        audienceValidation: true,
        jwksSignatureValidation: true,
        nonceValidation: true,
        membershipResolution: true,
        httpOnlyHostCookie: true,
        providerTokensWithheldFromBrowser: true,
        stepUpAssurance: true,
      },
      missingConfiguration: [
        'provider-metadata',
        'provider-client-credential',
        'transaction-signing-key',
        'transaction-replay-source',
        'session-signing-key',
        'membership-source',
      ],
    });
    expect(JSON.stringify(readiness)).not.toMatch(/OIDC_|AUTH_|secret|credential-value/u);
  });

  it('distinguishes incomplete configuration from a provider-test-ready contract', () => {
    expect(resolveAuthReadiness({ ...completeBindings, AUTH_MEMBERSHIP_SOURCE: '' })).toMatchObject(
      {
        state: 'incomplete',
        loginEnabled: false,
        missingConfiguration: ['membership-source'],
      },
    );
    expect(resolveAuthReadiness(completeBindings)).toMatchObject({
      state: 'provider-test-ready',
      loginEnabled: false,
      missingConfiguration: [],
    });
  });

  it('treats weak transaction and session keys as missing', () => {
    expect(
      resolveAuthReadiness({
        ...completeBindings,
        AUTH_TRANSACTION_SECRET: 'weak',
        AUTH_SESSION_SECRET: 'weak',
      }),
    ).toMatchObject({
      state: 'incomplete',
      missingConfiguration: ['transaction-signing-key', 'session-signing-key'],
    });
  });
});
