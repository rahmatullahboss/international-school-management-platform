import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createHttpDatabase: vi.fn(() => ({})),
  beginOidcLogin: vi.fn(),
  completeOidcLogin: vi.fn(),
  resolveDiscovery: vi.fn(),
  resolveJwks: vi.fn(),
  resolveSessionContext: vi.fn(),
  consumeTransaction: vi.fn(),
  resolveMembership: vi.fn(),
  registerSession: vi.fn(),
  isSessionActive: vi.fn(),
  resolveWorkspace: vi.fn(),
}));

vi.mock('@school/database', () => ({
  createHttpDatabase: mocks.createHttpDatabase,
}));

vi.mock('@school/policy', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    beginOidcLogin: mocks.beginOidcLogin,
    completeOidcLogin: mocks.completeOidcLogin,
    OidcProviderCache: class {
      readonly resolveDiscovery = mocks.resolveDiscovery;
      readonly resolveJwks = mocks.resolveJwks;

      constructor(options: unknown) {
        void options;
      }
    },
  };
});

vi.mock('./auth-boundary.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    resolveAuthenticatedBrowserSessionContext: mocks.resolveSessionContext,
  };
});

vi.mock('./auth-durable-store.js', () => ({
  DurableAuthStore: class {
    readonly consumeTransaction = mocks.consumeTransaction;
    readonly resolveMembership = mocks.resolveMembership;
    readonly registerSession = mocks.registerSession;
    readonly isSessionActive = mocks.isSessionActive;

    constructor(database: unknown) {
      void database;
    }
  },
  DurableOidcProviderCacheStore: class {
    constructor(database: unknown) {
      void database;
    }
  },
}));

vi.mock('./database-workspace-store.js', () => ({
  DatabaseWorkspaceStore: class {
    readonly resolve = mocks.resolveWorkspace;

    constructor(database: unknown) {
      void database;
    }
  },
}));

import { handleAuthLoginRequest, type AuthLoginBindings } from './auth-login-routes.js';

const configured: AuthLoginBindings = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://runtime.example.invalid/neondb',
  OIDC_ISSUER: 'https://id.example.com',
  OIDC_CLIENT_ID: 'school-platform',
  OIDC_CLIENT_SECRET: 'provider-client-secret',
  OIDC_AUTHORIZATION_ENDPOINT: 'https://id.example.com/authorize',
  OIDC_TOKEN_ENDPOINT: 'https://id.example.com/token',
  OIDC_JWKS_URI: 'https://id.example.com/jwks',
  OIDC_REDIRECT_URI: 'https://api.example.com/auth/v1/callback',
  OIDC_ENDPOINT_ORIGINS: 'https://id.example.com',
  OIDC_PROVIDER_CACHE_SOURCE: 'database',
  OIDC_BACKCHANNEL_LOGOUT_SOURCE: 'database',
  AUTH_TRANSACTION_SECRET: 'transaction-secret-0123456789abcdef',
  AUTH_TRANSACTION_REPLAY_SOURCE: 'database',
  AUTH_SESSION_SECRET: 'session-secret-0123456789abcdef0123',
  AUTH_SESSION_REGISTRY_SOURCE: 'database',
  AUTH_MEMBERSHIP_SOURCE: 'database',
  AUTH_PERMISSION_SOURCE: 'database',
  RUNTIME_READ_MODEL_SOURCE: 'database',
  RUNTIME_MUTATION_SOURCE: 'database',
  RUNTIME_PROJECTION_WORKER_SOURCE: 'database',
  AUTH_ALLOWED_WEB_ORIGINS: 'https://web.example.com',
};

const providerConfiguration = {
  issuer: 'https://id.example.com',
  clientId: 'school-platform',
  authorizationEndpoint: 'https://id.example.com/authorize',
  tokenEndpoint: 'https://id.example.com/token',
  jwksUri: 'https://id.example.com/jwks',
  redirectUri: 'https://api.example.com/auth/v1/callback',
} as const;

const provider = {
  configuration: providerConfiguration,
  authorizationResponseIssuerParameterSupported: true,
} as const;

const sessionContext = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  principalId: '22222222-2222-4222-8222-222222222222',
  membershipId: '33333333-3333-4333-8333-333333333333',
  tenantId: '44444444-4444-4444-8444-444444444444',
  campusId: '55555555-5555-4555-8555-555555555555',
  roleIds: ['66666666-6666-4666-8666-666666666666'],
  assurance: 'aal2' as const,
  expiresAt: '2026-08-18T04:00:00.000Z',
};

interface CompletionDependencies {
  readonly consumeTransaction: (
    transactionId: string,
    providerIssuer: string,
    expiresAt: string,
  ) => Promise<boolean>;
  readonly resolveMembership: (identity: unknown, selection: unknown) => Promise<unknown>;
  readonly registerSession: (claims: unknown) => Promise<void>;
  readonly resolveSigningKeys: (
    configuration: typeof providerConfiguration,
    forceRefresh: boolean,
  ) => Promise<unknown>;
}

interface CompletionInput {
  readonly dependencies: CompletionDependencies;
}

async function requiredResponse(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await handleAuthLoginRequest(
    new Request(`https://api.example.com${path}`, options),
    configured,
  );
  if (response === undefined) throw new Error('expected auth response');
  return response;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createHttpDatabase.mockReturnValue({});
  mocks.resolveDiscovery.mockResolvedValue({ ok: true, provider });
  mocks.resolveJwks.mockResolvedValue({ ok: true, jwks: { keys: [] } });
  mocks.resolveSessionContext.mockResolvedValue({ ok: true, context: sessionContext });
  mocks.consumeTransaction.mockResolvedValue(true);
  mocks.resolveMembership.mockResolvedValue({
    ok: true,
    context: {
      membershipId: sessionContext.membershipId,
      principalId: sessionContext.principalId,
      tenantId: sessionContext.tenantId,
      campusId: sessionContext.campusId,
      roleIds: sessionContext.roleIds,
    },
  });
  mocks.registerSession.mockResolvedValue(undefined);
  mocks.isSessionActive.mockResolvedValue(true);
  mocks.resolveWorkspace.mockResolvedValue({
    role: 'admin',
    capabilities: ['school.read'],
  });
});

describe('authenticated workspace coverage', () => {
  it('rejects unsupported methods and unavailable workspace configuration', async () => {
    const method = await requiredResponse('/auth/v1/workspace', { method: 'POST' });
    expect(method.status).toBe(405);

    const unavailable = await handleAuthLoginRequest(
      new Request('https://api.example.com/auth/v1/workspace'),
      { APP_ENV: 'production' },
    );
    expect(unavailable?.status).toBe(503);
    await expect(unavailable?.json()).resolves.toMatchObject({
      error: { code: 'workspace_unavailable' },
    });
  });

  it('propagates browser-session failures without querying workspace state', async () => {
    mocks.resolveSessionContext.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'browser_session_revoked',
      message: 'The browser session is no longer active.',
    });

    const response = await requiredResponse('/auth/v1/workspace', {
      headers: { cookie: '__Host-school-session=revoked' },
    });
    expect(response.status).toBe(401);
    expect(mocks.resolveWorkspace).not.toHaveBeenCalled();
  });

  it('fails closed when workspace lookup throws or resolves ambiguously', async () => {
    mocks.resolveWorkspace.mockRejectedValueOnce(new Error('database unavailable'));
    const unavailable = await requiredResponse('/auth/v1/workspace');
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toMatchObject({
      error: { code: 'workspace_unavailable' },
    });

    mocks.resolveWorkspace.mockResolvedValueOnce(undefined);
    const ambiguous = await requiredResponse('/auth/v1/workspace');
    expect(ambiguous.status).toBe(409);
    await expect(ambiguous.json()).resolves.toMatchObject({
      error: { code: 'workspace_role_ambiguous' },
    });
  });

  it.each([
    ['admin', '/admin'],
    ['teacher', '/teacher'],
    ['guardian', '/family'],
    ['student', '/student'],
    ['admissions', '/admissions'],
    ['finance', '/finance'],
    ['support', '/support'],
  ] as const)('returns the canonical %s workspace path', async (role, path) => {
    mocks.resolveWorkspace.mockResolvedValue({ role, capabilities: [`${role}.read`] });
    const response = await requiredResponse('/auth/v1/workspace', {
      headers: { cookie: '__Host-school-session=active' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      workspace: {
        role,
        path,
        assurance: 'aal2',
        expiresAt: sessionContext.expiresAt,
        capabilities: [`${role}.read`],
      },
    });
  });
});

describe('durable OIDC runtime coverage', () => {
  it('fails closed when provider discovery fails', async () => {
    mocks.resolveDiscovery.mockResolvedValue({
      ok: false,
      code: 'oidc_discovery_unavailable',
      message: 'Provider discovery unavailable.',
    });
    const response = await requiredResponse('/auth/v1/login?returnTo=%2Fadmin');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'oidc_discovery_unavailable' },
    });
  });

  it('rejects provider endpoint drift before beginning login', async () => {
    mocks.resolveDiscovery.mockResolvedValue({
      ok: true,
      provider: {
        ...provider,
        configuration: {
          ...providerConfiguration,
          tokenEndpoint: 'https://id.example.com/review-required-token-endpoint',
        },
      },
    });
    const response = await requiredResponse('/auth/v1/login');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'oidc_provider_endpoint_changed' },
    });
    expect(mocks.beginOidcLogin).not.toHaveBeenCalled();
  });

  it('returns begin-login failures and successful provider redirects', async () => {
    mocks.beginOidcLogin.mockResolvedValueOnce({
      ok: false,
      status: 502,
      code: 'oidc_authorization_failed',
      message: 'Unable to create authorization request.',
    });
    const failed = await requiredResponse('/auth/v1/login?returnTo=%2Fadmin');
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toMatchObject({
      error: { code: 'oidc_authorization_failed' },
    });

    mocks.beginOidcLogin.mockResolvedValueOnce({
      ok: true,
      authorizationUrl: 'https://id.example.com/authorize?state=reviewed',
      setCookie: '__Host-school-oidc=transaction; Path=/; Secure; HttpOnly; SameSite=Lax',
    });
    const redirected = await requiredResponse('/auth/v1/login');
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get('location')).toContain('https://id.example.com/authorize');
    expect(redirected.headers.get('set-cookie')).toContain('__Host-school-oidc=transaction');
    expect(mocks.beginOidcLogin).toHaveBeenCalledTimes(2);
  });

  it('returns callback failures with the clearing cookie', async () => {
    mocks.completeOidcLogin.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'oidc_callback_failed',
      message: 'OIDC callback validation failed.',
      setCookie: '__Host-school-oidc=; Max-Age=0; Path=/; Secure; HttpOnly',
    });
    const response = await requiredResponse('/auth/v1/callback?code=code-1&state=state-1', {
      headers: { cookie: '__Host-school-oidc=transaction' },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('wires durable callback dependencies and redirects after completion', async () => {
    mocks.completeOidcLogin.mockImplementation(async (input: CompletionInput) => {
      const { dependencies } = input;
      await dependencies.consumeTransaction(
        'transaction-1',
        providerConfiguration.issuer,
        '2026-08-18T04:00:00.000Z',
      );
      await dependencies.resolveMembership(
        { issuer: providerConfiguration.issuer, subject: 'provider-user-1' },
        { tenantId: sessionContext.tenantId },
      );
      await dependencies.registerSession({ sessionId: sessionContext.sessionId });
      const normalKeys = await dependencies.resolveSigningKeys(providerConfiguration, false);
      const refreshedKeys = await dependencies.resolveSigningKeys(providerConfiguration, true);
      expect(normalKeys).toEqual({ ok: true, jwks: { keys: [] } });
      expect(refreshedKeys).toEqual({ ok: true, jwks: { keys: [] } });
      return {
        ok: true,
        redirectTo: '/admin',
        setCookies: [
          '__Host-school-session=active; Path=/; Secure; HttpOnly',
          '__Host-school-oidc=; Max-Age=0; Path=/; Secure; HttpOnly',
        ],
      };
    });

    const response = await requiredResponse(
      '/auth/v1/callback?code=code-1&state=state-1&iss=https%3A%2F%2Fid.example.com',
      { headers: { cookie: '__Host-school-oidc=transaction' } },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/admin');
    expect(mocks.consumeTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.resolveMembership).toHaveBeenCalledTimes(1);
    expect(mocks.registerSession).toHaveBeenCalledTimes(1);
    expect(mocks.resolveJwks).toHaveBeenNthCalledWith(1, {
      configuration: providerConfiguration,
    });
    expect(mocks.resolveJwks).toHaveBeenNthCalledWith(2, {
      configuration: providerConfiguration,
      forceRefresh: true,
    });
  });

  it('maps provider signing-key failures through the callback dependency', async () => {
    mocks.resolveJwks.mockResolvedValue({
      ok: false,
      code: 'oidc_jwks_unavailable',
      message: 'Signing keys unavailable.',
    });
    mocks.completeOidcLogin.mockImplementation(async (input: CompletionInput) => {
      const keys = await input.dependencies.resolveSigningKeys(providerConfiguration, false);
      expect(keys).toEqual({
        ok: false,
        code: 'oidc_jwks_unavailable',
        message: 'Signing keys unavailable.',
      });
      return {
        ok: false,
        status: 503,
        code: 'oidc_jwks_unavailable',
        message: 'Signing keys unavailable.',
        setCookie: '__Host-school-oidc=; Max-Age=0; Path=/; Secure; HttpOnly',
      };
    });

    const response = await requiredResponse('/auth/v1/callback?code=code-1&state=state-1');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'oidc_jwks_unavailable' },
    });
  });
});
