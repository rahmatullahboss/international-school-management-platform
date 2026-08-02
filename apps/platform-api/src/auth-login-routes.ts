import { createHttpDatabase } from '@school/database';
import { beginOidcLogin, completeOidcLogin, OidcProviderCache } from '@school/policy';

import {
  resolveAuthenticatedBrowserSessionContext,
  resolveAuthProviderConfiguration,
  resolveAuthProviderEndpointOrigins,
  resolveAuthReadiness,
  type AuthBindings,
} from './auth-boundary.js';
import { DurableAuthStore, DurableOidcProviderCacheStore } from './auth-durable-store.js';

export interface AuthLoginBindings extends AuthBindings {
  readonly APP_ENV: string;
  readonly DATABASE_URL?: string;
}

interface AuthLoginRuntime {
  readonly provider: {
    readonly configuration: NonNullable<ReturnType<typeof resolveAuthProviderConfiguration>>;
    readonly authorizationResponseIssuerParameterSupported: boolean;
  };
  readonly clientSecret: string;
  readonly transactionSecret: string;
  readonly sessionSecret: string;
  readonly store: DurableAuthStore;
  readonly cache: OidcProviderCache;
}

interface WorkspaceRoleRow extends Record<string, unknown> {
  readonly role_id: string;
  readonly role_key: string;
}

interface WorkspaceCapabilityRow extends Record<string, unknown> {
  readonly permission_key: string;
}

const workspaceByRole = {
  admin: '/admin',
  teacher: '/teacher',
  guardian: '/family',
  student: '/student',
  admissions: '/admissions',
  finance: '/finance',
  support: '/support',
} as const;

type WorkspaceRole = keyof typeof workspaceByRole;

function configuredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized === '' ? undefined : normalized;
}

function strongSecret(value: string | undefined): value is string {
  return value !== undefined && value.length >= 32;
}

function isWorkspaceRole(value: string): value is WorkspaceRole {
  return Object.prototype.hasOwnProperty.call(workspaceByRole, value);
}

function hasDurableLoginConfiguration(environment: AuthLoginBindings): boolean {
  return (
    configuredValue(environment.DATABASE_URL) !== undefined &&
    environment.OIDC_PROVIDER_CACHE_SOURCE === 'database' &&
    environment.AUTH_TRANSACTION_REPLAY_SOURCE === 'database' &&
    environment.AUTH_MEMBERSHIP_SOURCE === 'database' &&
    environment.AUTH_SESSION_REGISTRY_SOURCE === 'database' &&
    configuredValue(environment.OIDC_CLIENT_SECRET) !== undefined &&
    strongSecret(configuredValue(environment.AUTH_TRANSACTION_SECRET)) &&
    strongSecret(configuredValue(environment.AUTH_SESSION_SECRET)) &&
    resolveAuthProviderConfiguration(environment) !== undefined &&
    resolveAuthProviderEndpointOrigins(environment) !== undefined
  );
}

function jsonResponse(body: unknown, status: number, headers?: Headers): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function failureResponse(code: string, message: string, status = 503, headers?: Headers): Response {
  return jsonResponse({ error: { code, message } }, status, headers);
}

function exactStaticProviderMatch(
  discovered: AuthLoginRuntime['provider']['configuration'],
  configured: AuthLoginRuntime['provider']['configuration'],
): boolean {
  return (
    discovered.issuer === configured.issuer &&
    discovered.clientId === configured.clientId &&
    discovered.authorizationEndpoint === configured.authorizationEndpoint &&
    discovered.tokenEndpoint === configured.tokenEndpoint &&
    discovered.jwksUri === configured.jwksUri &&
    discovered.redirectUri === configured.redirectUri
  );
}

async function resolveRuntime(
  environment: AuthLoginBindings,
): Promise<AuthLoginRuntime | Response> {
  if (!hasDurableLoginConfiguration(environment)) {
    return failureResponse('oidc_login_unavailable', 'OIDC login is not configured.');
  }

  const configured = resolveAuthProviderConfiguration(environment);
  const allowedOrigins = resolveAuthProviderEndpointOrigins(environment);
  const databaseUrl = configuredValue(environment.DATABASE_URL);
  const clientSecret = configuredValue(environment.OIDC_CLIENT_SECRET);
  const transactionSecret = configuredValue(environment.AUTH_TRANSACTION_SECRET);
  const sessionSecret = configuredValue(environment.AUTH_SESSION_SECRET);
  if (
    configured === undefined ||
    allowedOrigins === undefined ||
    databaseUrl === undefined ||
    clientSecret === undefined ||
    transactionSecret === undefined ||
    sessionSecret === undefined
  ) {
    return failureResponse('oidc_login_unavailable', 'OIDC login is not configured.');
  }

  const database = createHttpDatabase(databaseUrl);
  const store = new DurableAuthStore(database);
  const cache = new OidcProviderCache({
    store: new DurableOidcProviderCacheStore(database),
    allowedEndpointOrigins: allowedOrigins,
  });
  const discovery = await cache.resolveDiscovery({
    issuer: configured.issuer,
    clientId: configured.clientId,
    redirectUri: configured.redirectUri,
  });
  if (!discovery.ok) {
    return failureResponse(discovery.code, discovery.message);
  }
  if (!exactStaticProviderMatch(discovery.provider.configuration, configured)) {
    return failureResponse(
      'oidc_provider_endpoint_changed',
      'OIDC provider endpoints do not match the reviewed configuration.',
    );
  }

  return {
    provider: discovery.provider,
    clientSecret,
    transactionSecret,
    sessionSecret,
    store,
    cache,
  };
}

async function workspaceResponse(
  request: Request,
  environment: AuthLoginBindings,
): Promise<Response> {
  const databaseUrl = configuredValue(environment.DATABASE_URL);
  if (
    databaseUrl === undefined ||
    environment.AUTH_SESSION_REGISTRY_SOURCE !== 'database' ||
    !strongSecret(configuredValue(environment.AUTH_SESSION_SECRET))
  ) {
    return failureResponse('workspace_unavailable', 'The authenticated workspace is unavailable.');
  }

  const database = createHttpDatabase(databaseUrl);
  const store = new DurableAuthStore(database);
  const session = await resolveAuthenticatedBrowserSessionContext(
    environment,
    request.headers.get('cookie') ?? undefined,
    (sessionId) => store.isSessionActive(sessionId),
  );
  if (!session.ok) return failureResponse(session.code, session.message, session.status);

  let roles: readonly WorkspaceRoleRow[];
  let capabilities: readonly WorkspaceCapabilityRow[];
  try {
    roles = await database.query<WorkspaceRoleRow>(
      `SELECT role.role_id::text AS role_id, role.role_key
       FROM iam.membership_role AS membership_role
       JOIN iam.role AS role
         ON role.tenant_id = membership_role.tenant_id
        AND role.role_id = membership_role.role_id
       WHERE membership_role.tenant_id = $1::uuid
         AND membership_role.membership_id = $2::uuid
       ORDER BY role.role_id`,
      [session.context.tenantId, session.context.membershipId],
    );
    capabilities = await database.query<WorkspaceCapabilityRow>(
      `SELECT DISTINCT role_permission.permission_key
       FROM iam.membership_role AS membership_role
       JOIN iam.role_permission AS role_permission
         ON role_permission.tenant_id = membership_role.tenant_id
        AND role_permission.role_id = membership_role.role_id
       WHERE membership_role.tenant_id = $1::uuid
         AND membership_role.membership_id = $2::uuid
       ORDER BY role_permission.permission_key`,
      [session.context.tenantId, session.context.membershipId],
    );
  } catch {
    return failureResponse('workspace_unavailable', 'The authenticated workspace is unavailable.');
  }

  const currentRoleIds = roles.map((row) => row.role_id).sort();
  const sessionRoleIds = [...session.context.roleIds].sort();
  if (
    currentRoleIds.length !== sessionRoleIds.length ||
    currentRoleIds.some((roleId, index) => roleId !== sessionRoleIds[index])
  ) {
    return failureResponse('browser_session_revoked', 'The browser session is no longer active.', 401);
  }

  const workspaceRoles = [...new Set(roles.map((row) => row.role_key).filter(isWorkspaceRole))];
  if (workspaceRoles.length !== 1) {
    return failureResponse(
      'workspace_role_ambiguous',
      'The authenticated account does not resolve to one workspace.',
      409,
    );
  }
  const role = workspaceRoles[0];
  if (role === undefined) {
    return failureResponse('workspace_role_ambiguous', 'The authenticated workspace is unavailable.', 409);
  }

  return jsonResponse(
    {
      schemaVersion: 1,
      workspace: {
        role,
        path: workspaceByRole[role],
        assurance: session.context.assurance,
        expiresAt: session.context.expiresAt,
        capabilities: capabilities.map((row) => row.permission_key),
      },
    },
    200,
  );
}

function optionalQueryValue(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  return value === null || value === '' ? undefined : value;
}

export async function handleAuthLoginRequest(
  request: Request,
  environment: AuthLoginBindings,
): Promise<Response | undefined> {
  const url = new URL(request.url);

  if (url.pathname === '/auth/v1/readiness') {
    if (request.method !== 'GET')
      return failureResponse('method_not_allowed', 'Method not allowed.', 405);
    const readiness = resolveAuthReadiness(environment);
    return jsonResponse(
      {
        ...readiness,
        loginEnabled:
          readiness.state === 'provider-test-ready' && hasDurableLoginConfiguration(environment),
      },
      200,
    );
  }

  if (url.pathname === '/auth/v1/workspace') {
    if (request.method !== 'GET')
      return failureResponse('method_not_allowed', 'Method not allowed.', 405);
    return workspaceResponse(request, environment);
  }

  if (url.pathname !== '/auth/v1/login' && url.pathname !== '/auth/v1/callback') {
    return undefined;
  }
  if (request.method !== 'GET')
    return failureResponse('method_not_allowed', 'Method not allowed.', 405);

  const runtime = await resolveRuntime(environment);
  if (runtime instanceof Response) return runtime;
  const configuration = {
    provider: runtime.provider,
    clientSecret: runtime.clientSecret,
    transactionSecret: runtime.transactionSecret,
    sessionSecret: runtime.sessionSecret,
  };

  if (url.pathname === '/auth/v1/login') {
    const returnTo = optionalQueryValue(url, 'returnTo');
    const result = await beginOidcLogin({
      configuration,
      ...(returnTo === undefined ? {} : { returnTo }),
    });
    if (!result.ok) return failureResponse(result.code, result.message, result.status);
    const headers = new Headers({
      location: result.authorizationUrl,
      'cache-control': 'no-store',
    });
    headers.append('set-cookie', result.setCookie);
    return new Response(null, { status: 302, headers });
  }

  const code = optionalQueryValue(url, 'code');
  const state = optionalQueryValue(url, 'state');
  const issuer = optionalQueryValue(url, 'iss');
  const error = optionalQueryValue(url, 'error');
  const result = await completeOidcLogin({
    configuration,
    callback: {
      ...(code === undefined ? {} : { code }),
      ...(state === undefined ? {} : { state }),
      ...(issuer === undefined ? {} : { issuer }),
      ...(error === undefined ? {} : { error }),
    },
    cookieHeader: request.headers.get('cookie') ?? undefined,
    dependencies: {
      consumeTransaction: (transactionId, providerIssuer, expiresAt) =>
        runtime.store.consumeTransaction(transactionId, providerIssuer, expiresAt),
      resolveMembership: (identity, selection) =>
        runtime.store.resolveMembership(identity, selection),
      registerSession: (claims) => runtime.store.registerSession(claims),
      resolveSigningKeys: async (providerConfiguration, forceRefresh) => {
        const keys = await runtime.cache.resolveJwks({
          configuration: providerConfiguration,
          ...(forceRefresh ? { forceRefresh: true } : {}),
        });
        return keys.ok
          ? { ok: true as const, jwks: keys.jwks }
          : { ok: false as const, code: keys.code, message: keys.message };
      },
    },
  });

  if (!result.ok) {
    const headers = new Headers();
    headers.append('set-cookie', result.setCookie);
    return failureResponse(result.code, result.message, result.status, headers);
  }

  const headers = new Headers({
    location: result.redirectTo,
    'cache-control': 'no-store',
  });
  for (const cookie of result.setCookies) headers.append('set-cookie', cookie);
  return new Response(null, { status: 302, headers });
}
