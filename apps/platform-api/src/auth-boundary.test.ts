import { describe, expect, it } from 'vitest';

import { BROWSER_SESSION_COOKIE_NAME, issueBrowserSession } from '@school/policy';

import { resolveAuthenticatedBrowserSession, resolveAuthReadiness } from './auth-boundary.js';

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
  AUTH_SESSION_REGISTRY_SOURCE: 'database',
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
        durableReplayLedger: true,
        authorizationResponseIssuerValidation: true,
        confidentialClientAuthentication: true,
        serverSideTokenExchange: true,
        providerDiscoveryValidation: true,
        issuerValidation: true,
        audienceValidation: true,
        jwksSignatureValidation: true,
        nonceValidation: true,
        membershipResolution: true,
        databaseMembershipProjection: true,
        httpOnlyHostCookie: true,
        browserSessionRegistry: true,
        sessionRevocation: true,
        providerTokensWithheldFromBrowser: true,
        stepUpAssurance: true,
      },
      missingConfiguration: [
        'provider-metadata',
        'provider-client-credential',
        'transaction-signing-key',
        'transaction-replay-source',
        'session-signing-key',
        'session-registry-source',
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

describe('durable browser-session introspection', () => {
  it('requires a live registry record after cryptographic cookie verification', async () => {
    const issued = await issueBrowserSession({
      secret: completeBindings.AUTH_SESSION_SECRET,
      identity: {
        issuer: completeBindings.OIDC_ISSUER,
        subject: 'provider-user-123',
        assurance: 'aal2',
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 600,
      },
      membership: {
        membershipId: '40000000-0000-4000-8000-000000000001',
        principalId: '40000000-0000-4000-8000-000000000002',
        tenantId: '40000000-0000-4000-8000-000000000003',
        campusId: '40000000-0000-4000-8000-000000000004',
        roleIds: ['40000000-0000-4000-8000-000000000005'],
      },
    });
    if (!issued.ok) throw new Error(issued.message);
    const cookie = `${BROWSER_SESSION_COOKIE_NAME}=${issued.token}`;

    await expect(
      resolveAuthenticatedBrowserSession(completeBindings, cookie, async () => {
        await Promise.resolve();
        return true;
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      resolveAuthenticatedBrowserSession(completeBindings, cookie, async () => {
        await Promise.resolve();
        return false;
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: 'browser_session_revoked',
    });
    await expect(
      resolveAuthenticatedBrowserSession(completeBindings, cookie),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'session_registry_unavailable',
    });
  });
});
