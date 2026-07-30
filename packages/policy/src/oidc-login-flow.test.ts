import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { MembershipResolution } from './membership.js';
import {
  beginOidcLogin,
  completeOidcLogin,
  type OidcLoginFlowConfiguration,
  type OidcLoginFlowDependencies,
} from './oidc-login-flow.js';
import type { OidcJsonWebKey } from './oidc.js';

const now = Date.parse('2026-07-30T06:00:00Z');
const nowSeconds = Math.floor(now / 1000);
const flowConfiguration: OidcLoginFlowConfiguration = {
  provider: {
    configuration: {
      issuer: 'https://identity.school.test',
      clientId: 'school-platform-web',
      authorizationEndpoint: 'https://identity.school.test/oauth2/authorize',
      tokenEndpoint: 'https://identity.school.test/oauth2/token',
      jwksUri: 'https://identity.school.test/.well-known/jwks.json',
      redirectUri: 'https://school.test/auth/v1/callback',
    },
    authorizationResponseIssuerParameterSupported: true,
  },
  clientSecret: 'confidential-client-secret',
  transactionSecret: 'transaction-signing-secret-with-at-least-32-characters',
  sessionSecret: 'session-signing-secret-with-at-least-32-characters',
};

let privateKey: CryptoKey;
let publicJwk: OidcJsonWebKey;

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

async function idToken(nonce: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', kid: 'key-1', typ: 'JWT' }));
  const claims = encodeBase64Url(
    JSON.stringify({
      iss: flowConfiguration.provider.configuration.issuer,
      sub: 'provider-user-123',
      aud: flowConfiguration.provider.configuration.clientId,
      exp: nowSeconds + 600,
      iat: nowSeconds,
      nonce,
      auth_time: nowSeconds - 30,
      acr: 'urn:school:aal2',
      amr: ['pwd', 'webauthn'],
      ...overrides,
    }),
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${encodeBase64Url(signature)}`;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function cookieHeader(setCookie: string): string {
  return setCookie.split(';', 1)[0] ?? '';
}

function activeMembership(): MembershipResolution {
  return {
    ok: true,
    context: {
      membershipId: 'membership-main-admin',
      principalId: 'principal-1',
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      roleIds: ['school-admin'],
    },
  };
}

async function preparedFlow(options: { nonceOverride?: string } = {}): Promise<{
  state: string;
  cookie: string;
  fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
  consumed: Set<string>;
}> {
  const started = await beginOidcLogin({
    configuration: flowConfiguration,
    returnTo: '/admin/academics',
    now,
  });
  if (!started.ok) throw new Error(started.message);
  const authorizationUrl = new URL(started.authorizationUrl);
  const state = authorizationUrl.searchParams.get('state');
  const nonce = authorizationUrl.searchParams.get('nonce');
  if (state === null || nonce === null) throw new Error('Expected OAuth state and nonce.');
  const signedIdToken = await idToken(options.nonceOverride ?? nonce);
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    await Promise.resolve();
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === flowConfiguration.provider.configuration.tokenEndpoint) {
      return jsonResponse({
        access_token: 'server-access-token',
        token_type: 'Bearer',
        expires_in: 300,
        id_token: signedIdToken,
        refresh_token: 'server-refresh-token',
      });
    }
    if (url === flowConfiguration.provider.configuration.jwksUri) {
      return jsonResponse({ keys: [publicJwk] });
    }
    throw new Error(`Unexpected provider URL: ${url}`);
  });
  return {
    state,
    cookie: cookieHeader(started.setCookie),
    fetcher,
    consumed: new Set<string>(),
  };
}

function dependencies(
  prepared: Awaited<ReturnType<typeof preparedFlow>>,
  membership: MembershipResolution = activeMembership(),
): OidcLoginFlowDependencies {
  return {
    fetcher: prepared.fetcher,
    consumeTransaction: async (transactionId) => {
      await Promise.resolve();
      if (prepared.consumed.has(transactionId)) return false;
      prepared.consumed.add(transactionId);
      return true;
    },
    resolveMembership: async () => {
      await Promise.resolve();
      return membership;
    },
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
    kid: 'key-1',
    alg: 'RS256',
    use: 'sig',
  };
});

describe('OIDC login flow orchestration', () => {
  it('completes code exchange, ID-token verification, membership and secure session issuance', async () => {
    const prepared = await preparedFlow();
    const result = await completeOidcLogin({
      configuration: flowConfiguration,
      callback: {
        code: 'authorization-code',
        state: prepared.state,
        issuer: flowConfiguration.provider.configuration.issuer,
      },
      cookieHeader: prepared.cookie,
      dependencies: dependencies(prepared),
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.redirectTo).toBe('/admin/academics');
    expect(result.session).toMatchObject({
      principalId: 'principal-1',
      membershipId: 'membership-main-admin',
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      roleIds: ['school-admin'],
      assurance: 'aal2',
    });
    expect(result.setCookies).toHaveLength(2);
    expect(result.setCookies[0]).toContain('__Host-school_session=');
    expect(result.setCookies[1]).toContain('__Host-school_oauth=;');
    expect(JSON.stringify(result)).not.toContain('server-access-token');
    expect(JSON.stringify(result)).not.toContain('server-refresh-token');
    expect(JSON.stringify(result)).not.toContain('signed.id.token');
    expect(prepared.fetcher).toHaveBeenCalledTimes(2);
  });

  it('denies replay before another provider request is made', async () => {
    const prepared = await preparedFlow();
    const input = {
      configuration: flowConfiguration,
      callback: {
        code: 'authorization-code',
        state: prepared.state,
        issuer: flowConfiguration.provider.configuration.issuer,
      },
      cookieHeader: prepared.cookie,
      dependencies: dependencies(prepared),
      now,
    } as const;
    expect(await completeOidcLogin(input)).toMatchObject({ ok: true });
    prepared.fetcher.mockClear();
    expect(await completeOidcLogin(input)).toMatchObject({
      ok: false,
      status: 401,
      code: 'oauth_transaction_replayed',
    });
    expect(prepared.fetcher).not.toHaveBeenCalled();
  });

  it('denies provider errors and callback state failures without token exchange', async () => {
    const prepared = await preparedFlow();
    expect(
      await completeOidcLogin({
        configuration: flowConfiguration,
        callback: { error: 'access_denied' },
        cookieHeader: prepared.cookie,
        dependencies: dependencies(prepared),
        now,
      }),
    ).toMatchObject({ ok: false, status: 401, code: 'oidc_authorization_rejected' });

    expect(
      await completeOidcLogin({
        configuration: flowConfiguration,
        callback: {
          code: 'authorization-code',
          state: 'wrong-state-with-sufficient-length-12345678901234567890',
          issuer: flowConfiguration.provider.configuration.issuer,
        },
        cookieHeader: prepared.cookie,
        dependencies: dependencies(prepared),
        now,
      }),
    ).toMatchObject({ ok: false, status: 401, code: 'oauth_state_mismatch' });
    expect(prepared.fetcher).not.toHaveBeenCalled();
  });

  it('rejects an ID token that is not bound to the transaction nonce', async () => {
    const prepared = await preparedFlow({
      nonceOverride: 'different-nonce-value-123456789012345678901234567890',
    });
    const result = await completeOidcLogin({
      configuration: flowConfiguration,
      callback: {
        code: 'authorization-code',
        state: prepared.state,
        issuer: flowConfiguration.provider.configuration.issuer,
      },
      cookieHeader: prepared.cookie,
      dependencies: dependencies(prepared),
      now,
    });
    expect(result).toMatchObject({ ok: false, status: 401, code: 'oidc_nonce_mismatch' });
  });

  it('returns a selection boundary instead of issuing a session for ambiguous membership', async () => {
    const prepared = await preparedFlow();
    const result = await completeOidcLogin({
      configuration: flowConfiguration,
      callback: {
        code: 'authorization-code',
        state: prepared.state,
        issuer: flowConfiguration.provider.configuration.issuer,
      },
      cookieHeader: prepared.cookie,
      dependencies: dependencies(prepared, {
        ok: false,
        code: 'membership_selection_required',
        options: [
          {
            membershipId: 'membership-main',
            tenantId: 'tenant-pilot-001',
            campusIds: ['campus-main'],
            roleIds: ['school-admin'],
          },
        ],
      }),
      now,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'membership_selection_required',
    });
    expect(JSON.stringify(result)).not.toContain('server-access-token');
  });

  it('fails closed and clears the transaction cookie on token or JWKS failure', async () => {
    const prepared = await preparedFlow();
    prepared.fetcher.mockResolvedValueOnce(
      jsonResponse({ error: 'invalid_grant', error_description: 'provider detail' }, 400),
    );
    const tokenFailure = await completeOidcLogin({
      configuration: flowConfiguration,
      callback: {
        code: 'authorization-code',
        state: prepared.state,
        issuer: flowConfiguration.provider.configuration.issuer,
      },
      cookieHeader: prepared.cookie,
      dependencies: dependencies(prepared),
      now,
    });
    expect(tokenFailure).toMatchObject({
      ok: false,
      status: 502,
      code: 'oidc_token_exchange_rejected',
    });
    if (tokenFailure.ok) throw new Error('Expected failure.');
    expect(tokenFailure.setCookie).toContain('Max-Age=0');
  });

  it('does not begin login with an invalid return path or missing confidential credential', async () => {
    expect(
      await beginOidcLogin({
        configuration: flowConfiguration,
        returnTo: 'https://attacker.test',
        now,
      }),
    ).toMatchObject({ ok: false, status: 400, code: 'oauth_return_path_invalid' });
    expect(
      await beginOidcLogin({
        configuration: { ...flowConfiguration, clientSecret: '' },
        now,
      }),
    ).toMatchObject({ ok: false, status: 503, code: 'oidc_login_unavailable' });
  });
});
