import { Hono } from 'hono';

import { parseRuntimeEnvironment } from '@school/platform';

import { isAllowedPilotWebOrigin, resolvePilotReadSnapshot } from './pilot-read-models.js';
import { issuePilotSession, pilotSessionHeaders, verifyPilotSession } from './pilot-sessions.js';

interface Bindings {
  APP_ENV: string;
  APP_REGION: string;
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

export * from './operations-application.js';
export * from './operations-routes.js';
export * from './pilot-read-models.js';
export * from './pilot-sessions.js';
