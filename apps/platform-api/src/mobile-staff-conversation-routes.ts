import { Hono, type Context } from 'hono';

import { createHttpDatabase } from '@school/database';

import { readBoundedUtf8RequestBody } from './bounded-request-body.js';
import { DatabaseMobileStaffConversationStore } from './database-mobile-staff-conversation-store.js';
import { authenticateMobileBearer, type MobileAuthBindings } from './mobile-auth.js';
import { isMobileUuid, resolveMobileRequestScope } from './mobile-request-scope.js';
import {
  isMobileTeacherConversationIdempotencyKey,
  parseTeacherConversationMessageSend,
  parseTeacherConversationReadReceipt,
} from './mobile-staff-conversations.js';

interface MobileStaffConversationBindings extends MobileAuthBindings {
  readonly DATABASE_URL?: string;
}

type MobileStaffConversationContext = Context<{ Bindings: MobileStaffConversationBindings }>;
type MutationStatus = 'idempotency-conflict' | 'locked' | 'message-not-found';

const app = new Hono<{ Bindings: MobileStaffConversationBindings }>();
const teacherPersona = new Set(['teacher'] as const);

function databaseUrl(env: MobileStaffConversationBindings): string | undefined {
  const value = env.DATABASE_URL?.trim();
  if (value === undefined || value === '' || env.MOBILE_MEMBERSHIP_SOURCE?.trim() !== 'database') {
    return undefined;
  }
  return value;
}

function teacherScope(context: MobileStaffConversationContext) {
  return resolveMobileRequestScope(
    {
      tenantId: context.req.header('x-tenant-id'),
      campusId: context.req.header('x-campus-id'),
      persona: context.req.header('x-persona'),
    },
    teacherPersona,
  );
}

function configurationUnavailable(context: MobileStaffConversationContext) {
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

function invalidRequest(context: MobileStaffConversationContext, code: string, message: string) {
  return context.json({ error: { code, message } }, 400);
}

function scopeDenied(context: MobileStaffConversationContext) {
  return context.json(
    {
      error: {
        code: 'mobile_scope_denied',
        message: 'The requested Teacher conversation is not authorized for this scope.',
      },
    },
    403,
  );
}

function temporarilyUnavailable(context: MobileStaffConversationContext) {
  return context.json(
    {
      error: {
        code: 'mobile_teacher_conversation_temporarily_unavailable',
        message: 'Teacher conversations are temporarily unavailable.',
      },
    },
    503,
  );
}

function mutationFailure(context: MobileStaffConversationContext, status: MutationStatus) {
  const code = `mobile_teacher_conversation_${status.replaceAll('-', '_')}`;
  const message =
    status === 'locked'
      ? 'This conversation is read-only.'
      : status === 'message-not-found'
        ? 'The requested message is not available in this conversation.'
        : 'The conversation command conflicts with a previous request.';
  return context.json({ error: { code, message } }, status === 'message-not-found' ? 404 : 409);
}

async function authenticate(context: MobileStaffConversationContext) {
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

app.post('/v1/mobile/teacher/conversations/:conversationId/messages', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = teacherScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const conversationId = context.req.param('conversationId');
  const idempotencyKey = context.req.header('idempotency-key');
  const input = parseTeacherConversationMessageSend(
    await readBoundedUtf8RequestBody(context.req.raw.body, 16 * 1024),
  );
  if (
    !isMobileUuid(conversationId) ||
    !isMobileTeacherConversationIdempotencyKey(idempotencyKey) ||
    input === undefined
  ) {
    return invalidRequest(
      context,
      'mobile_teacher_conversation_message_invalid',
      'The Teacher conversation message is invalid.',
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileStaffConversationStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).sendMessage(authentication.identity, scope.scope, conversationId, idempotencyKey, input);
    if (payload === undefined) return scopeDenied(context);
    if ('status' in payload) return mutationFailure(context, payload.status);
    return context.json(payload);
  } catch {
    return temporarilyUnavailable(context);
  }
});

app.post('/v1/mobile/teacher/conversations/:conversationId/read-receipts', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = teacherScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const conversationId = context.req.param('conversationId');
  const idempotencyKey = context.req.header('idempotency-key');
  const input = parseTeacherConversationReadReceipt(
    await readBoundedUtf8RequestBody(context.req.raw.body, 4 * 1024),
  );
  if (
    !isMobileUuid(conversationId) ||
    !isMobileTeacherConversationIdempotencyKey(idempotencyKey) ||
    input === undefined
  ) {
    return invalidRequest(
      context,
      'mobile_teacher_conversation_read_invalid',
      'The Teacher conversation read receipt is invalid.',
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileStaffConversationStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).markRead(authentication.identity, scope.scope, conversationId, idempotencyKey, input);
    if (payload === undefined) return scopeDenied(context);
    if ('status' in payload) return mutationFailure(context, payload.status);
    return context.json(payload);
  } catch {
    return temporarilyUnavailable(context);
  }
});

export default app;
