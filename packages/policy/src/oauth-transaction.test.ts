import { describe, expect, it } from 'vitest';

import {
  OAUTH_TRANSACTION_COOKIE_NAME,
  clearOAuthTransactionCookie,
  issueOAuthTransaction,
  verifyOAuthCallbackTransaction,
} from './oauth-transaction.js';
import type { OidcProviderConfiguration } from './oidc.js';

const configuration: OidcProviderConfiguration = {
  issuer: 'https://identity.school.test',
  clientId: 'school-platform-web',
  authorizationEndpoint: 'https://identity.school.test/oauth2/authorize',
  tokenEndpoint: 'https://identity.school.test/oauth2/token',
  jwksUri: 'https://identity.school.test/.well-known/jwks.json',
  redirectUri: 'https://school.test/auth/v1/callback',
};
const secret = 'oauth-transaction-test-secret-with-at-least-32-characters';
const now = Date.parse('2026-07-30T05:30:00Z');

function cookieHeader(setCookie: string): string {
  return setCookie.split(';', 1)[0] ?? '';
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

describe('OAuth PKCE transaction', () => {
  it('issues high-entropy state, nonce and an S256 challenge in a secure cookie', async () => {
    const result = await issueOAuthTransaction({
      configuration,
      secret,
      returnTo: '/admin/academics?tab=attendance',
      requireAuthorizationResponseIssuer: true,
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const url = new URL(result.request.authorizationUrl);
    expect(url.origin + url.pathname).toBe(configuration.authorizationEndpoint);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe(configuration.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(configuration.redirectUri);
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('state')).toBe(result.request.transaction.state);
    expect(url.searchParams.get('nonce')).toBe(result.request.transaction.nonce);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(result.request.transaction.state).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(result.request.transaction.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(result.request.transaction.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/u);

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(result.request.transaction.codeVerifier),
    );
    expect(decodeBase64Url(result.request.codeChallenge)).toEqual(new Uint8Array(digest));
    expect(result.request.setCookie).toContain(`${OAUTH_TRANSACTION_COOKIE_NAME}=`);
    expect(result.request.setCookie).toContain('Path=/');
    expect(result.request.setCookie).toContain('HttpOnly');
    expect(result.request.setCookie).toContain('Secure');
    expect(result.request.setCookie).toContain('SameSite=Lax');
    expect(result.request.setCookie).toContain('Max-Age=300');
  });

  it('requests a fresh reviewed AAL2 provider authentication for step-up', async () => {
    const result = await issueOAuthTransaction({
      configuration,
      secret,
      returnTo: '/admin/finance/close',
      stepUp: {
        assurance: 'aal2',
        freshnessSeconds: 300,
        acrValues: ['urn:school:aal2', 'urn:school:phishing-resistant'],
      },
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const url = new URL(result.request.authorizationUrl);
    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.get('max_age')).toBe('0');
    expect(url.searchParams.get('acr_values')).toBe(
      'urn:school:aal2 urn:school:phishing-resistant',
    );
    expect(result.request.transaction).toMatchObject({
      requestedAssurance: 'aal2',
      stepUpFreshnessSeconds: 300,
      acrValues: ['urn:school:aal2', 'urn:school:phishing-resistant'],
    });
  });

  it('rejects unbounded freshness and malformed reviewed ACR values', async () => {
    for (const stepUp of [
      { assurance: 'aal2', freshnessSeconds: 301 },
      { assurance: 'aal2', freshnessSeconds: 0 },
      { assurance: 'aal2', freshnessSeconds: 300, acrValues: [] },
      { assurance: 'aal2', freshnessSeconds: 300, acrValues: ['urn:school:aal2 bad'] },
    ]) {
      await expect(
        issueOAuthTransaction({
          configuration,
          secret,
          stepUp,
          now,
        } as Parameters<typeof issueOAuthTransaction>[0]),
      ).resolves.toMatchObject({
        ok: false,
        code: 'oauth_transaction_configuration_invalid',
      });
    }
  });

  it('verifies the browser-bound state and exact authorization response issuer', async () => {
    const issued = await issueOAuthTransaction({
      configuration,
      secret,
      returnTo: '/teacher/attendance',
      requireAuthorizationResponseIssuer: true,
      now,
    });
    if (!issued.ok) throw new Error(issued.message);

    const result = await verifyOAuthCallbackTransaction({
      secret,
      cookieHeader: cookieHeader(issued.request.setCookie),
      state: issued.request.transaction.state,
      authorizationResponseIssuer: configuration.issuer,
      now: now + 1_000,
    });
    expect(result).toEqual({ ok: true, transaction: issued.request.transaction });
  });

  it('denies state, issuer, signature and expiry failures', async () => {
    const issued = await issueOAuthTransaction({
      configuration,
      secret,
      requireAuthorizationResponseIssuer: true,
      now,
      ttlSeconds: 60,
    });
    if (!issued.ok) throw new Error(issued.message);
    const cookie = cookieHeader(issued.request.setCookie);

    expect(
      await verifyOAuthCallbackTransaction({
        secret,
        cookieHeader: cookie,
        state: 'different-state-value-with-sufficient-length-1234567890',
        authorizationResponseIssuer: configuration.issuer,
        now,
      }),
    ).toMatchObject({ ok: false, code: 'oauth_state_mismatch' });

    expect(
      await verifyOAuthCallbackTransaction({
        secret,
        cookieHeader: cookie,
        state: issued.request.transaction.state,
        authorizationResponseIssuer: 'https://attacker.test',
        now,
      }),
    ).toMatchObject({ ok: false, code: 'oauth_issuer_mismatch' });

    expect(
      await verifyOAuthCallbackTransaction({
        secret,
        cookieHeader: `${cookie}x`,
        state: issued.request.transaction.state,
        authorizationResponseIssuer: configuration.issuer,
        now,
      }),
    ).toMatchObject({ ok: false, code: 'oauth_transaction_invalid' });

    expect(
      await verifyOAuthCallbackTransaction({
        secret,
        cookieHeader: cookie,
        state: issued.request.transaction.state,
        authorizationResponseIssuer: configuration.issuer,
        now: now + 60_000,
      }),
    ).toMatchObject({ ok: false, code: 'oauth_transaction_expired' });
  });

  it('requires the issuer parameter when the selected provider advertises it', async () => {
    const issued = await issueOAuthTransaction({
      configuration,
      secret,
      requireAuthorizationResponseIssuer: true,
      now,
    });
    if (!issued.ok) throw new Error(issued.message);
    expect(
      await verifyOAuthCallbackTransaction({
        secret,
        cookieHeader: cookieHeader(issued.request.setCookie),
        state: issued.request.transaction.state,
        now,
      }),
    ).toMatchObject({ ok: false, code: 'oauth_issuer_mismatch' });
  });

  it('rejects open redirects, weak keys and invalid transaction lifetimes', async () => {
    for (const returnTo of [
      'https://attacker.test',
      '//attacker.test/path',
      '/safe\\@attacker.test',
    ]) {
      expect(await issueOAuthTransaction({ configuration, secret, returnTo, now })).toMatchObject({
        ok: false,
        code: 'oauth_return_path_invalid',
      });
    }
    expect(await issueOAuthTransaction({ configuration, secret: 'weak', now })).toMatchObject({
      ok: false,
      code: 'oauth_transaction_configuration_invalid',
    });
    expect(
      await issueOAuthTransaction({ configuration, secret, now, ttlSeconds: 59 }),
    ).toMatchObject({ ok: false, code: 'oauth_transaction_configuration_invalid' });
    expect(
      await issueOAuthTransaction({ configuration, secret, now, ttlSeconds: 601 }),
    ).toMatchObject({ ok: false, code: 'oauth_transaction_configuration_invalid' });
  });

  it('clears the transaction cookie after every callback outcome', () => {
    expect(clearOAuthTransactionCookie()).toBe(
      `${OAUTH_TRANSACTION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    );
  });
});
