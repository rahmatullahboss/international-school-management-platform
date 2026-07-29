import { Hono } from 'hono';

import { parseRuntimeEnvironment } from '@school/platform';

import { isAllowedPilotWebOrigin, resolvePilotReadSnapshot } from './pilot-read-models.js';

interface Bindings {
  APP_ENV: string;
  APP_REGION: string;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (context, next) => {
  const correlationId = crypto.randomUUID();
  context.header('x-correlation-id', correlationId);
  await next();
});

app.use('/pilot/*', async (context, next) => {
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
    context.header('access-control-allow-methods', 'GET, OPTIONS');
    context.header(
      'access-control-allow-headers',
      'content-type, if-none-match, x-school-tenant-id, x-school-campus-id, x-school-role, x-school-subject-id',
    );
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

app.get('/pilot/v1/snapshots/:role', (context) => {
  const resolution = resolvePilotReadSnapshot(context.req.raw.headers, context.req.param('role'));
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
  context.header(
    'vary',
    'Origin, If-None-Match, x-school-tenant-id, x-school-campus-id, x-school-role, x-school-subject-id',
  );
  if (context.req.header('if-none-match') === resolution.etag) {
    return context.body(null, 304);
  }

  return context.json(resolution.snapshot);
});

export default app;

export * from './operations-application.js';
export * from './operations-routes.js';
export * from './pilot-read-models.js';
