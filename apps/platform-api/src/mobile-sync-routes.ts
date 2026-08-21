import { Hono, type Context } from 'hono';

import { createHttpDatabase } from '@school/database';

import { DatabaseMobileSyncStore } from './database-mobile-sync-store.js';
import { authenticateMobileBearer, type MobileAuthBindings } from './mobile-auth.js';
import { resolveMobileRequestScope } from './mobile-request-scope.js';
import { parseMobileSyncCursor } from './mobile-sync.js';

interface MobileSyncBindings extends MobileAuthBindings {
  readonly DATABASE_URL?: string;
}

type MobileSyncContext = Context<{ Bindings: MobileSyncBindings }>;
const allMobilePersonas = new Set(['guardian', 'student', 'teacher'] as const);
const app = new Hono<{ Bindings: MobileSyncBindings }>();

function databaseUrl(env: MobileSyncBindings): string | undefined {
  const value = env.DATABASE_URL?.trim();
  if (value === undefined || value === '' || env.MOBILE_MEMBERSHIP_SOURCE?.trim() !== 'database') {
    return undefined;
  }
  return value;
}

function configurationUnavailable(context: MobileSyncContext) {
  return context.json(
    {
      error: {
        code: 'mobile_access_configuration_unavailable',
        message: 'Mobile account access is not configured.',
      },
    },
    503,
  );
}

function temporarilyUnavailable(context: MobileSyncContext) {
  return context.json(
    {
      error: {
        code: 'mobile_sync_temporarily_unavailable',
        message: 'Mobile synchronization is temporarily unavailable.',
      },
    },
    503,
  );
}

app.get('/v1/mobile/sync/delta', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);

  const scope = resolveMobileRequestScope(
    {
      tenantId: context.req.header('x-tenant-id'),
      campusId: context.req.header('x-campus-id'),
      persona: context.req.header('x-persona'),
    },
    allMobilePersonas,
  );
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }

  const query = new URL(context.req.raw.url).searchParams;
  if ([...query.keys()].some((key) => key !== 'cursor') || query.getAll('cursor').length > 1) {
    return context.json(
      {
        error: {
          code: 'mobile_sync_query_invalid',
          message: 'The mobile synchronization query is invalid.',
        },
      },
      400,
    );
  }
  const cursor = parseMobileSyncCursor(query.get('cursor') ?? undefined);
  if (cursor === undefined) {
    return context.json(
      {
        error: {
          code: 'mobile_sync_cursor_invalid',
          message: 'The mobile synchronization cursor is invalid.',
        },
      },
      400,
    );
  }

  const authentication = await authenticateMobileBearer(
    context.env,
    context.req.header('authorization'),
  );
  if (!authentication.ok) {
    return context.json(
      { error: { code: authentication.code, message: authentication.message } },
      authentication.status,
    );
  }

  try {
    const result = await new DatabaseMobileSyncStore(createHttpDatabase(resolvedDatabaseUrl)).pull(
      authentication.identity,
      scope.scope,
      cursor,
    );
    if (result === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_scope_denied',
            message: 'The requested mobile synchronization scope is not authorized.',
          },
        },
        403,
      );
    }
    if ('status' in result) {
      return context.json(
        {
          error: {
            code: 'mobile_sync_cursor_invalid',
            message: 'The mobile synchronization cursor cannot be used for this scope.',
          },
        },
        409,
      );
    }
    return context.json(result);
  } catch {
    return temporarilyUnavailable(context);
  }
});

export default app;
