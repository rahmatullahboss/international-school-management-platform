import { Hono } from 'hono';

import { parseRuntimeEnvironment } from '@school/platform';

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

app.get('/health', (context) => {
  const runtime = parseRuntimeEnvironment(context.env);
  return context.json({
    status: 'ok',
    environment: runtime.environment,
    region: runtime.region,
  });
});

export default app;
