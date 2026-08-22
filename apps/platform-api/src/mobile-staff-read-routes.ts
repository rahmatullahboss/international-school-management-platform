import { Hono, type Context } from 'hono';

import { createHttpDatabase } from '@school/database';

import { DatabaseMobileStaffReadStore } from './database-mobile-staff-read-store.js';
import { authenticateMobileBearer, type MobileAuthBindings } from './mobile-auth.js';
import { isMobileUuid, resolveMobileRequestScope } from './mobile-request-scope.js';

interface MobileStaffReadBindings extends MobileAuthBindings {
  readonly DATABASE_URL?: string;
}

type MobileStaffReadContext = Context<{ Bindings: MobileStaffReadBindings }>;
const app = new Hono<{ Bindings: MobileStaffReadBindings }>();
const teacherPersona = new Set(['teacher'] as const);

function databaseUrl(env: MobileStaffReadBindings): string | undefined {
  const value = env.DATABASE_URL?.trim();
  if (value === undefined || value === '' || env.MOBILE_MEMBERSHIP_SOURCE?.trim() !== 'database') {
    return undefined;
  }
  return value;
}

function configurationUnavailable(context: MobileStaffReadContext) {
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

function invalidQuery(context: MobileStaffReadContext) {
  return context.json(
    {
      error: {
        code: 'mobile_teacher_read_query_invalid',
        message: 'The Teacher read request is invalid.',
      },
    },
    400,
  );
}

function scopeDenied(context: MobileStaffReadContext) {
  return context.json(
    {
      error: {
        code: 'mobile_scope_denied',
        message: 'The requested Teacher data is not authorized for this scope.',
      },
    },
    403,
  );
}

function temporarilyUnavailable(context: MobileStaffReadContext) {
  return context.json(
    {
      error: {
        code: 'mobile_teacher_read_temporarily_unavailable',
        message: 'Teacher data is temporarily unavailable.',
      },
    },
    503,
  );
}

function teacherScope(context: MobileStaffReadContext) {
  return resolveMobileRequestScope(
    {
      tenantId: context.req.header('x-tenant-id'),
      campusId: context.req.header('x-campus-id'),
      persona: context.req.header('x-persona'),
    },
    teacherPersona,
  );
}

function hasQuery(context: MobileStaffReadContext): boolean {
  return [...new URL(context.req.raw.url).searchParams.keys()].length > 0;
}

async function authentication(context: MobileStaffReadContext) {
  const result = await authenticateMobileBearer(context.env, context.req.header('authorization'));
  if (!result.ok) {
    return {
      response: context.json(
        { error: { code: result.code, message: result.message } },
        result.status,
      ),
    } as const;
  }
  return { identity: result.identity } as const;
}

app.get('/v1/mobile/teacher/assessments', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = teacherScope(context);
  if (!scope.ok)
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  if (hasQuery(context)) return invalidQuery(context);
  const auth = await authentication(context);
  if ('response' in auth) return auth.response;
  try {
    const payload = await new DatabaseMobileStaffReadStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).assessments(auth.identity, scope.scope);
    return payload === undefined ? scopeDenied(context) : context.json(payload);
  } catch {
    return temporarilyUnavailable(context);
  }
});

app.get('/v1/mobile/teacher/conversations', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = teacherScope(context);
  if (!scope.ok)
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  if (hasQuery(context)) return invalidQuery(context);
  const auth = await authentication(context);
  if ('response' in auth) return auth.response;
  try {
    const payload = await new DatabaseMobileStaffReadStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).conversations(auth.identity, scope.scope);
    return payload === undefined ? scopeDenied(context) : context.json(payload);
  } catch {
    return temporarilyUnavailable(context);
  }
});

app.get('/v1/mobile/teacher/conversations/:conversationId/messages', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = teacherScope(context);
  if (!scope.ok)
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  if (hasQuery(context) || !isMobileUuid(context.req.param('conversationId')))
    return invalidQuery(context);
  const auth = await authentication(context);
  if ('response' in auth) return auth.response;
  try {
    const payload = await new DatabaseMobileStaffReadStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).conversationMessages(auth.identity, scope.scope, context.req.param('conversationId'));
    return payload === undefined ? scopeDenied(context) : context.json(payload);
  } catch {
    return temporarilyUnavailable(context);
  }
});

export default app;
