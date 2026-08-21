import { Hono, type Context } from 'hono';

import { createHttpDatabase } from '@school/database';

import { readBoundedUtf8RequestBody } from './bounded-request-body.js';
import { DatabaseMobileFamilyConversationStore } from './database-mobile-family-conversation-store.js';
import { authenticateMobileBearer, type MobileAuthBindings } from './mobile-auth.js';
import {
  parseFamilyConversationPageQuery,
  parseFamilyMessageSend,
  parseFamilyReadReceipt,
} from './mobile-family-conversations.js';
import { isMobileFamilyInteractionIdempotencyKey } from './mobile-family-forms-consents.js';
import { isMobileUuid, resolveMobileRequestScope } from './mobile-request-scope.js';

interface MobileFamilyConversationBindings extends MobileAuthBindings {
  readonly DATABASE_URL?: string;
}

type MobileFamilyConversationContext = Context<{ Bindings: MobileFamilyConversationBindings }>;
type ConversationMutationStatus = 'idempotency-conflict' | 'locked' | 'message-not-found';

const app = new Hono<{ Bindings: MobileFamilyConversationBindings }>();
const familyMobilePersonas = new Set(['guardian', 'student'] as const);

function databaseUrl(env: MobileFamilyConversationBindings): string | undefined {
  const value = env.DATABASE_URL?.trim();
  if (value === undefined || value === '' || env.MOBILE_MEMBERSHIP_SOURCE?.trim() !== 'database') {
    return undefined;
  }
  return value;
}

function familyScope(context: { req: { header(name: string): string | undefined } }) {
  return resolveMobileRequestScope(
    {
      tenantId: context.req.header('x-tenant-id'),
      campusId: context.req.header('x-campus-id'),
      persona: context.req.header('x-persona'),
    },
    familyMobilePersonas,
  );
}

function configurationUnavailable(context: MobileFamilyConversationContext) {
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

async function authenticate(context: MobileFamilyConversationContext) {
  const authentication = await authenticateMobileBearer(
    context.env,
    context.req.header('authorization'),
  );
  if (!authentication.ok) {
    return {
      response: context.json(
        { error: { code: authentication.code, message: authentication.message } },
        authentication.status,
      ),
    } as const;
  }
  return { identity: authentication.identity } as const;
}

function invalidRequest(context: MobileFamilyConversationContext, code: string, message: string) {
  return context.json({ error: { code, message } }, 400);
}

function scopeDenied(context: MobileFamilyConversationContext) {
  return context.json(
    {
      error: {
        code: 'mobile_scope_denied',
        message: 'The requested conversation is not authorized for this Family scope.',
      },
    },
    403,
  );
}

function temporarilyUnavailable(context: MobileFamilyConversationContext) {
  return context.json(
    {
      error: {
        code: 'mobile_family_conversation_temporarily_unavailable',
        message: 'Family conversations are temporarily unavailable.',
      },
    },
    503,
  );
}

function mutationFailure(
  context: MobileFamilyConversationContext,
  status: ConversationMutationStatus,
) {
  const code = `mobile_family_conversation_${status.replaceAll('-', '_')}`;
  const message =
    status === 'locked'
      ? 'This conversation is read-only.'
      : status === 'message-not-found'
        ? 'The requested message is not available in this conversation.'
        : 'The conversation command conflicts with a previous request.';
  return context.json({ error: { code, message } }, status === 'message-not-found' ? 404 : 409);
}

app.get('/v1/mobile/family/students/:studentId/conversations', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = familyScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const studentId = context.req.param('studentId');
  const page = parseFamilyConversationPageQuery(
    context.req.query('cursor'),
    context.req.query('limit'),
    25,
  );
  if (!isMobileUuid(studentId) || page === undefined) {
    return invalidRequest(
      context,
      'mobile_family_conversation_query_invalid',
      'The Family conversation request is invalid.',
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileFamilyConversationStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).listConversations(authentication.identity, scope.scope, studentId, page.cursor, page.limit);
    if (payload === undefined) return scopeDenied(context);
    return context.json(payload);
  } catch {
    return temporarilyUnavailable(context);
  }
});

app.get('/v1/mobile/family/conversations/:conversationId/messages', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = familyScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const conversationId = context.req.param('conversationId');
  const page = parseFamilyConversationPageQuery(
    context.req.query('cursor'),
    context.req.query('limit'),
    50,
  );
  if (!isMobileUuid(conversationId) || page === undefined) {
    return invalidRequest(
      context,
      'mobile_family_conversation_query_invalid',
      'The Family conversation request is invalid.',
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileFamilyConversationStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).listMessages(authentication.identity, scope.scope, conversationId, page.cursor, page.limit);
    if (payload === undefined) return scopeDenied(context);
    return context.json(payload);
  } catch {
    return temporarilyUnavailable(context);
  }
});

app.post('/v1/mobile/family/conversations/:conversationId/messages', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = familyScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const conversationId = context.req.param('conversationId');
  const idempotencyKey = context.req.header('idempotency-key');
  const input = parseFamilyMessageSend(
    await readBoundedUtf8RequestBody(context.req.raw.body, 16 * 1024),
  );
  if (
    !isMobileUuid(conversationId) ||
    !isMobileFamilyInteractionIdempotencyKey(idempotencyKey) ||
    input === undefined
  ) {
    return invalidRequest(
      context,
      'mobile_family_conversation_message_invalid',
      'The Family conversation message is invalid.',
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileFamilyConversationStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).sendMessage(authentication.identity, scope.scope, conversationId, idempotencyKey, input);
    if (payload === undefined) return scopeDenied(context);
    if ('status' in payload) return mutationFailure(context, payload.status);
    return context.json(payload);
  } catch {
    return temporarilyUnavailable(context);
  }
});

app.post('/v1/mobile/family/conversations/:conversationId/read-receipts', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = familyScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const conversationId = context.req.param('conversationId');
  const idempotencyKey = context.req.header('idempotency-key');
  const input = parseFamilyReadReceipt(
    await readBoundedUtf8RequestBody(context.req.raw.body, 4 * 1024),
  );
  if (
    !isMobileUuid(conversationId) ||
    !isMobileFamilyInteractionIdempotencyKey(idempotencyKey) ||
    input === undefined
  ) {
    return invalidRequest(
      context,
      'mobile_family_conversation_read_invalid',
      'The Family conversation read receipt is invalid.',
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileFamilyConversationStore(
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
