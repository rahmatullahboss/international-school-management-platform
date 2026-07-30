import { Hono } from 'hono';

import { createHttpDatabase } from '@school/database';
import { OidcProviderCache, processOidcBackchannelLogout } from '@school/policy';
import { parseRuntimeEnvironment } from '@school/platform';

import {
  resolveAuthenticatedBrowserSession,
  resolveAuthProviderConfiguration,
  resolveAuthProviderEndpointOrigins,
  resolveAuthReadiness,
  type AuthBindings,
} from './auth-boundary.js';
import { handleOidcBackchannelLogoutRequest } from './auth-backchannel.js';
import { DurableAuthStore, DurableOidcProviderCacheStore } from './auth-durable-store.js';
import {
  hasValidAuthMutationOrigins,
  isAllowedAuthMutationOrigin,
  terminateBrowserSession,
  type LogoutRegistry,
  type LogoutScope,
} from './auth-logout.js';
import { isAllowedPilotWebOrigin, resolvePilotReadSnapshot } from './pilot-read-models.js';
import { issuePilotSession, pilotSessionHeaders, verifyPilotSession } from './pilot-sessions.js';

interface Bindings extends AuthBindings {
  APP_ENV: string;
  APP_REGION: string;
  DATABASE_URL?: string;
  PILOT_SESSION_SECRET?: string;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (context, next) => {
  const correlationId = crypto.randomUUID();
  context.header('x-correlation-id', correlationId);
  await next();
});

app.use('/pilot/*', async (context, next) => {
  const runtime = parseRuntimeEnvironment(context.env);
  if (runtime.environment === 'production') {
    return context.json(
      {
        error: {
          code: 'not_found',
          message: 'The requested resource was not found.',
        },
      },
      404,
    );
  }

  const origin = context.req.header('origin');
  const isAllowedOrigin = isAllowedPilotWebOrigin(origin);

  if (origin !== undefined && !isAllowedOrigin) {
    return context.json(
      {
        error: {
          code: 'pilot_origin_denied',
          message: 'The requesting origin is not permitted for the pilot API.',
        },
      },
      403,
    );
  }

  if (isAllowedOrigin && origin !== undefined) {
    context.header('access-control-allow-origin', origin);
    context.header('access-control-allow-methods', 'GET, POST, OPTIONS');
    context.header('access-control-allow-headers', 'authorization, content-type, if-none-match');
    context.header('access-control-expose-headers', 'etag, x-correlation-id');
    context.header('access-control-max-age', '600');
  }

  context.header('vary', 'Origin');
  if (context.req.method === 'OPTIONS') return context.body(null, 204);
  await next();
});

app.get('/health', (context) => {
  const runtime = parseRuntimeEnvironment(context.env);
  return context.json({
    status: 'ok',
    environment: runtime.environment,
    region: runtime.region,
  });
});

app.get('/auth/v1/readiness', (context) => {
  context.header('cache-control', 'no-store');
  return context.json(resolveAuthReadiness(context.env));
});

function applyAuthMutationCors(
  headers: (name: string, value: string) => void,
  allowedOrigins: string | undefined,
  origin: string | undefined,
): boolean {
  if (!isAllowedAuthMutationOrigin(allowedOrigins, origin) || origin === undefined) return false;
  headers('access-control-allow-origin', origin);
  headers('access-control-allow-credentials', 'true');
  headers('access-control-allow-methods', 'POST, OPTIONS');
  headers('access-control-allow-headers', 'content-type');
  headers('access-control-max-age', '600');
  return true;
}

app.post('/auth/v1/backchannel-logout', async (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Content-Type');
  const configuration = resolveAuthProviderConfiguration(context.env);
  const allowedOrigins = resolveAuthProviderEndpointOrigins(context.env);
  const configured =
    configuration !== undefined &&
    allowedOrigins !== undefined &&
    context.env.OIDC_PROVIDER_CACHE_SOURCE === 'database' &&
    context.env.OIDC_BACKCHANNEL_LOGOUT_SOURCE === 'database' &&
    context.env.DATABASE_URL !== undefined &&
    context.env.DATABASE_URL.trim() !== '';

  let rawBody = '';
  if (configured) {
    try {
      rawBody = await context.req.text();
    } catch {
      rawBody = '';
    }
  }
  const result = await handleOidcBackchannelLogoutRequest({
    configured,
    contentType: context.req.header('content-type'),
    ...(context.req.header('content-length') === undefined
      ? {}
      : { contentLength: context.req.header('content-length')! }),
    rawBody,
    processor: async (logoutToken) => {
      if (
        configuration === undefined ||
        allowedOrigins === undefined ||
        context.env.DATABASE_URL === undefined
      ) {
        throw new Error('Back-channel logout configuration disappeared.');
      }
      const database = createHttpDatabase(context.env.DATABASE_URL);
      const durableAuth = new DurableAuthStore(database);
      const cache = new OidcProviderCache({
        store: new DurableOidcProviderCacheStore(database),
        allowedEndpointOrigins: allowedOrigins,
      });
      return processOidcBackchannelLogout({
        logoutToken,
        configuration,
        resolveJwks: (forceRefresh) =>
          cache.resolveJwks({ configuration, ...(forceRefresh ? { forceRefresh: true } : {}) }),
        consumeToken: (claims) => durableAuth.consumeBackchannelLogoutToken(claims),
        revokeSessions: (claims) =>
          durableAuth.revokeProviderSessions(claims, 'provider back-channel logout'),
      });
    },
  });
  if (result.ok) return context.body(null, result.status);
  return context.json({ error: { code: result.code, message: result.message } }, result.status);
});

app.options('/auth/v1/logout', (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Origin');
  if (!hasValidAuthMutationOrigins(context.env.AUTH_ALLOWED_WEB_ORIGINS)) {
    return context.json(
      {
        error: {
          code: 'logout_configuration_invalid',
          message: 'Browser logout is not configured.',
        },
      },
      503,
    );
  }
  if (
    !applyAuthMutationCors(
      (name, value) => context.header(name, value),
      context.env.AUTH_ALLOWED_WEB_ORIGINS,
      context.req.header('origin'),
    )
  ) {
    return context.json(
      {
        error: {
          code: 'logout_origin_denied',
          message: 'The requesting origin is not permitted.',
        },
      },
      403,
    );
  }
  return context.body(null, 204);
});

function isLogoutScope(value: unknown): value is LogoutScope {
  return value === 'current' || value === 'all';
}

function parseLogoutRequest(value: unknown): LogoutScope | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'scope' || !isLogoutScope(record.scope)) return undefined;
  return record.scope;
}

function durableLogoutRegistry(environment: Bindings): LogoutRegistry | undefined {
  if (
    environment.AUTH_SESSION_REGISTRY_SOURCE !== 'database' ||
    environment.DATABASE_URL === undefined ||
    environment.DATABASE_URL.trim() === ''
  ) {
    return undefined;
  }
  return new DurableAuthStore(createHttpDatabase(environment.DATABASE_URL));
}

app.post('/auth/v1/logout', async (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Origin, Cookie');
  const origin = context.req.header('origin');
  applyAuthMutationCors(
    (name, value) => context.header(name, value),
    context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
  );

  const contentLength = context.req.header('content-length');
  if (contentLength !== undefined) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0 || parsedLength > 1024) {
      return context.json(
        {
          error: {
            code: 'logout_request_invalid',
            message: 'The logout request is invalid.',
          },
        },
        400,
      );
    }
  }

  let requestBody: unknown;
  try {
    const rawBody = await context.req.text();
    if (rawBody.length > 1024) throw new Error('Logout request is too large.');
    requestBody = JSON.parse(rawBody) as unknown;
  } catch {
    return context.json(
      {
        error: {
          code: 'logout_request_invalid',
          message: 'The logout request is invalid.',
        },
      },
      400,
    );
  }
  const scope = parseLogoutRequest(requestBody);
  if (scope === undefined) {
    return context.json(
      {
        error: {
          code: 'logout_request_invalid',
          message: 'The logout request is invalid.',
        },
      },
      400,
    );
  }

  const registry = durableLogoutRegistry(context.env);
  const result = await terminateBrowserSession({
    sessionSecret: context.env.AUTH_SESSION_SECRET,
    registrySource: context.env.AUTH_SESSION_REGISTRY_SOURCE,
    allowedOrigins: context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
    contentType: context.req.header('content-type'),
    cookieHeader: context.req.header('cookie'),
    scope,
    ...(registry === undefined ? {} : { registry }),
  });
  if (result.setCookie !== undefined) context.header('set-cookie', result.setCookie);
  if (!result.ok) {
    return context.json(
      {
        error: {
          code: result.code,
          message: result.message,
        },
      },
      result.status,
    );
  }
  return context.body(null, result.status);
});

app.get('/auth/v1/session', async (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Cookie');

  let activityCheck: ((sessionId: string) => Promise<boolean>) | undefined;
  if (
    context.env.AUTH_SESSION_REGISTRY_SOURCE === 'database' &&
    context.env.DATABASE_URL !== undefined &&
    context.env.DATABASE_URL.trim() !== ''
  ) {
    const store = new DurableAuthStore(createHttpDatabase(context.env.DATABASE_URL));
    activityCheck = (sessionId) => store.isSessionActive(sessionId);
  }

  const resolution = await resolveAuthenticatedBrowserSession(
    context.env,
    context.req.header('cookie'),
    activityCheck,
  );
  if (!resolution.ok) {
    return context.json(
      {
        error: {
          code: resolution.code,
          message: resolution.message,
        },
      },
      resolution.status,
    );
  }
  return context.json({ schemaVersion: 1, session: resolution.session });
});

app.post('/pilot/v1/sessions/:role', async (context) => {
  const issuance = await issuePilotSession(
    context.env.PILOT_SESSION_SECRET,
    context.req.param('role'),
  );
  context.header('cache-control', 'no-store');
  if (!issuance.ok) {
    return context.json(
      {
        error: {
          code: issuance.code,
          message: issuance.message,
        },
      },
      issuance.status,
    );
  }

  return context.json(
    {
      schemaVersion: 1,
      tokenType: 'Bearer',
      accessToken: issuance.token,
      expiresAt: issuance.expiresAt,
      scope: issuance.scope,
    },
    201,
  );
});

app.get('/pilot/v1/snapshots/:role', async (context) => {
  const role = context.req.param('role');
  const session = await verifyPilotSession(
    context.env.PILOT_SESSION_SECRET,
    context.req.header('authorization'),
    role,
  );
  if (!session.ok) {
    context.header('cache-control', 'no-store');
    return context.json(
      {
        error: {
          code: session.code,
          message: session.message,
        },
      },
      session.status,
    );
  }

  const resolution = resolvePilotReadSnapshot(pilotSessionHeaders(session.claims), role);
  if (!resolution.ok) {
    return context.json(
      {
        error: {
          code: resolution.code,
          message: resolution.message,
        },
      },
      resolution.status,
    );
  }

  context.header('etag', resolution.etag);
  context.header('cache-control', 'private, max-age=0, must-revalidate');
  context.header('vary', 'Origin, Authorization, If-None-Match');
  if (context.req.header('if-none-match') === resolution.etag) {
    return context.body(null, 304);
  }

  return context.json(resolution.snapshot);
});

export default app;

export * from './auth-backchannel.js';
export * from './auth-boundary.js';
export * from './auth-durable-store.js';
export * from './auth-logout.js';
export * from './operations-application.js';
export * from './operations-routes.js';
export * from './pilot-read-models.js';
export * from './pilot-sessions.js';
