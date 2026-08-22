import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

import type { MobileReadScope } from './database-mobile-read-store.js';
import type {
  FamilyMessageSendInput,
  FamilyReadReceiptInput,
} from './mobile-family-conversations.js';
import { requireSchoolTimeZone, schoolLocalTimestamp } from './mobile-school-time.js';

interface PayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
  readonly timeZoneId?: unknown;
}

export interface MobileFamilyConversationSummary {
  readonly conversationId: string;
  readonly subject: string;
  readonly unreadCount: number;
  readonly latestMessageAt: string;
}

export interface MobileFamilyConversationMessage {
  readonly messageId: string;
  readonly authorLabel: string;
  readonly body: string;
  readonly sentAt: string;
}

export interface MobileFamilyConversationPage {
  readonly conversations: readonly MobileFamilyConversationSummary[];
  readonly nextCursor: string | null;
  readonly timeZoneId: string;
}

export interface MobileFamilyConversationMessagePage {
  readonly conversationId: string;
  readonly messages: readonly MobileFamilyConversationMessage[];
  readonly nextCursor: string | null;
  readonly timeZoneId: string;
}

export interface MobileFamilyConversationSentMessage extends MobileFamilyConversationMessage {
  readonly timeZoneId: string;
}

export type MobileFamilyConversationMutationResult =
  | { readonly acceptedRevision: number }
  | { readonly status: 'idempotency-conflict' | 'locked' | 'message-not-found' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CURSOR_PATTERN =
  /^\d{17}\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;

function invalidResponse(operation: string): Error {
  return new Error(`${operation} returned an invalid database response.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactRecord(
  value: unknown,
  expected: ReadonlySet<string>,
  operation: string,
): Record<string, unknown> {
  if (!isRecord(value)) throw invalidResponse(operation);
  const keys = Object.keys(value);
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) {
    throw invalidResponse(operation);
  }
  return value;
}

function requireUuid(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw invalidResponse(operation);
  return value;
}

function requireText(value: unknown, operation: string, maximum: number): string {
  if (typeof value !== 'string') throw invalidResponse(operation);
  const normalized = value.trim();
  if (normalized === '' || normalized !== value || normalized.length > maximum) {
    throw invalidResponse(operation);
  }
  return normalized;
}

function requireInteger(value: unknown, operation: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw invalidResponse(operation);
  }
  return value;
}

function requireTimestamp(value: unknown, operation: string): string {
  const timestamp = requireText(value, operation, 64);
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    throw invalidResponse(operation);
  }
  return timestamp;
}

function requireCursorOrNull(value: unknown, operation: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !CURSOR_PATTERN.test(value)) throw invalidResponse(operation);
  return value;
}

function validateConversation(
  value: unknown,
  operation: string,
  timeZoneId: string,
): MobileFamilyConversationSummary {
  const row = exactRecord(
    value,
    new Set(['conversationId', 'subject', 'unreadCount', 'latestMessageAt']),
    operation,
  );
  return {
    conversationId: requireUuid(row.conversationId, operation),
    subject: requireText(row.subject, operation, 512),
    unreadCount: requireInteger(row.unreadCount, operation, 0),
    latestMessageAt: schoolLocalTimestamp(
      requireTimestamp(row.latestMessageAt, operation),
      timeZoneId,
      operation,
    ),
  };
}

function validateMessage(
  value: unknown,
  operation: string,
  timeZoneId: string,
): MobileFamilyConversationMessage {
  const row = exactRecord(
    value,
    new Set(['messageId', 'authorLabel', 'body', 'sentAt']),
    operation,
  );
  return {
    messageId: requireUuid(row.messageId, operation),
    authorLabel: requireText(row.authorLabel, operation, 512),
    body: requireText(row.body, operation, 4000),
    sentAt: schoolLocalTimestamp(requireTimestamp(row.sentAt, operation), timeZoneId, operation),
  };
}

function validateConversationPage(
  value: unknown,
  timeZoneValue: unknown,
): MobileFamilyConversationPage {
  const operation = 'Mobile family conversations';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = exactRecord(value, new Set(['conversations', 'nextCursor']), operation);
  if (!Array.isArray(payload.conversations) || payload.conversations.length > 100) {
    throw invalidResponse(operation);
  }
  const conversations = payload.conversations.map((row) =>
    validateConversation(row, operation, timeZoneId),
  );
  if (new Set(conversations.map((row) => row.conversationId)).size !== conversations.length) {
    throw invalidResponse(operation);
  }
  return {
    conversations,
    nextCursor: requireCursorOrNull(payload.nextCursor, operation),
    timeZoneId,
  };
}

function validateMessagePage(
  value: unknown,
  expectedConversationId: string,
  timeZoneValue: unknown,
): MobileFamilyConversationMessagePage {
  const operation = 'Mobile family conversation messages';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = exactRecord(
    value,
    new Set(['conversationId', 'messages', 'nextCursor']),
    operation,
  );
  const conversationId = requireUuid(payload.conversationId, operation);
  if (
    conversationId !== expectedConversationId ||
    !Array.isArray(payload.messages) ||
    payload.messages.length > 100
  ) {
    throw invalidResponse(operation);
  }
  const messages = payload.messages.map((row) => validateMessage(row, operation, timeZoneId));
  if (new Set(messages.map((row) => row.messageId)).size !== messages.length) {
    throw invalidResponse(operation);
  }
  return {
    conversationId,
    messages,
    nextCursor: requireCursorOrNull(payload.nextCursor, operation),
    timeZoneId,
  };
}

function validateMutation(value: unknown): MobileFamilyConversationMutationResult {
  const operation = 'Mobile family conversation mutation';
  if (isRecord(value) && 'acceptedRevision' in value) {
    const payload = exactRecord(value, new Set(['acceptedRevision']), operation);
    return { acceptedRevision: requireInteger(payload.acceptedRevision, operation, 1) };
  }
  const payload = exactRecord(value, new Set(['status']), operation);
  if (
    payload.status !== 'idempotency-conflict' &&
    payload.status !== 'locked' &&
    payload.status !== 'message-not-found'
  ) {
    throw invalidResponse(operation);
  }
  return { status: payload.status };
}

function requireIdentity(
  identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
): readonly [string, string] {
  const issuer = identity.issuer.trim();
  const subject = identity.subject.trim();
  if (issuer === '' || subject === '' || issuer.length > 2048 || subject.length > 512) {
    throw new Error('Mobile identity is invalid.');
  }
  return [issuer, subject];
}

function requireFamilyScope(scope: MobileReadScope): void {
  if (
    !UUID_PATTERN.test(scope.tenantId) ||
    !UUID_PATTERN.test(scope.campusId) ||
    (scope.persona !== 'guardian' && scope.persona !== 'student')
  ) {
    throw new Error('Mobile Family conversation scope is invalid.');
  }
}

function requireCursor(cursor: string | undefined): string | null {
  if (cursor === undefined) return null;
  if (!CURSOR_PATTERN.test(cursor))
    throw new Error('Mobile Family conversation cursor is invalid.');
  return cursor;
}

function requireLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Mobile Family conversation page limit is invalid.');
  }
}

function requireIdempotencyKey(value: string): void {
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new Error('Mobile Family conversation idempotency key is invalid.');
  }
}

export class DatabaseMobileFamilyConversationStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async listConversations(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    studentId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<MobileFamilyConversationPage | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireFamilyScope(scope);
    requireLimit(limit);
    if (!UUID_PATTERN.test(studentId)) throw new Error('Mobile Family student id is invalid.');
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_family_conversations($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::uuid,$7::text,$8::integer) AS payload,
       (SELECT scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text,$2::text,$3::uuid,$4::uuid,$5::text
       ) AS scope) AS "timeZoneId"`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        studentId,
        requireCursor(cursor),
        limit,
      ],
    );
    return this.#onePayload(rows, validateConversationPage, 'Mobile family conversations');
  }

  async listMessages(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    conversationId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<MobileFamilyConversationMessagePage | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireFamilyScope(scope);
    requireLimit(limit);
    if (!UUID_PATTERN.test(conversationId))
      throw new Error('Mobile Family conversation id is invalid.');
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_family_conversation_messages($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::uuid,$7::text,$8::integer) AS payload,
       (SELECT scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text,$2::text,$3::uuid,$4::uuid,$5::text
       ) AS scope) AS "timeZoneId"`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        conversationId,
        requireCursor(cursor),
        limit,
      ],
    );
    return this.#onePayload(
      rows,
      (value, timeZoneValue) => validateMessagePage(value, conversationId, timeZoneValue),
      'Mobile family conversation messages',
    );
  }

  async sendMessage(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    conversationId: string,
    idempotencyKey: string,
    input: FamilyMessageSendInput,
  ): Promise<
    | MobileFamilyConversationSentMessage
    | { readonly status: 'idempotency-conflict' | 'locked' }
    | undefined
  > {
    const [issuer, subject] = requireIdentity(identity);
    requireFamilyScope(scope);
    requireIdempotencyKey(idempotencyKey);
    if (
      !UUID_PATTERN.test(conversationId) ||
      input.body.trim() !== input.body ||
      input.body.length < 1 ||
      input.body.length > 4000
    ) {
      throw new Error('Mobile Family conversation message is invalid.');
    }
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.send_mobile_family_conversation_message($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::uuid,$7::text,$8::text) AS payload,
       (SELECT scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text,$2::text,$3::uuid,$4::uuid,$5::text
       ) AS scope) AS "timeZoneId"`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        conversationId,
        input.body,
        idempotencyKey,
      ],
    );
    return this.#onePayload(
      rows,
      (value, timeZoneValue) => {
        if (isRecord(value) && 'status' in value) {
          const mutation = validateMutation(value);
          if (
            'status' in mutation &&
            (mutation.status === 'idempotency-conflict' || mutation.status === 'locked')
          ) {
            return { status: mutation.status } as const;
          }
          throw invalidResponse('Mobile family conversation message');
        }
        const operation = 'Mobile family conversation message';
        const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
        return { ...validateMessage(value, operation, timeZoneId), timeZoneId };
      },
      'Mobile family conversation message',
    );
  }

  async markRead(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    conversationId: string,
    idempotencyKey: string,
    input: FamilyReadReceiptInput,
  ): Promise<MobileFamilyConversationMutationResult | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireFamilyScope(scope);
    requireIdempotencyKey(idempotencyKey);
    if (!UUID_PATTERN.test(conversationId) || !UUID_PATTERN.test(input.messageId)) {
      throw new Error('Mobile Family conversation read receipt is invalid.');
    }
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.mark_mobile_family_conversation_read($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::uuid,$7::uuid,$8::text) AS payload`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        conversationId,
        input.messageId,
        idempotencyKey,
      ],
    );
    return this.#onePayload(rows, validateMutation, 'Mobile family conversation read receipt');
  }

  #onePayload<T>(
    rows: readonly PayloadRow[],
    validator: (value: unknown, timeZoneValue: unknown) => T,
    operation: string,
  ): T | undefined {
    if (rows.length !== 1) throw invalidResponse(operation);
    const row = rows[0];
    if (row === undefined) throw invalidResponse(operation);
    if (row.payload === null || row.payload === undefined) return undefined;
    return validator(row.payload, row.timeZoneId);
  }
}
