import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

import type { MobileReadScope } from './database-mobile-read-store.js';
import type {
  TeacherConversationMessageSendInput,
  TeacherConversationReadReceiptInput,
} from './mobile-staff-conversations.js';

interface PayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
}

export interface MobileTeacherConversationMessage {
  readonly messageId: string;
  readonly authorLabel: string;
  readonly body: string;
  readonly sentAt: string;
}

export type MobileTeacherConversationMutationResult =
  | { readonly acceptedRevision: number }
  | { readonly status: 'idempotency-conflict' | 'locked' | 'message-not-found' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
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

function requireText(value: unknown, operation: string, maximum: number): string {
  if (typeof value !== 'string') throw invalidResponse(operation);
  const normalized = value.trim();
  if (normalized === '' || normalized !== value || normalized.length > maximum) {
    throw invalidResponse(operation);
  }
  return normalized;
}

function requireUuid(value: unknown, operation: string): string {
  const normalized = requireText(value, operation, 64);
  if (!UUID_PATTERN.test(normalized)) throw invalidResponse(operation);
  return normalized;
}

function requireTimestamp(value: unknown, operation: string): string {
  const normalized = requireText(value, operation, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== normalized) {
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

function validateMessage(value: unknown): MobileTeacherConversationMessage {
  const operation = 'Mobile teacher conversation message';
  const payload = exactRecord(
    value,
    new Set(['messageId', 'authorLabel', 'body', 'sentAt']),
    operation,
  );
  return {
    messageId: requireUuid(payload.messageId, operation),
    authorLabel: requireText(payload.authorLabel, operation, 512),
    body: requireText(payload.body, operation, 4000),
    sentAt: requireTimestamp(payload.sentAt, operation),
  };
}

function validateMutation(value: unknown): MobileTeacherConversationMutationResult {
  const operation = 'Mobile teacher conversation mutation';
  if (isRecord(value) && 'acceptedRevision' in value) {
    const payload = exactRecord(value, new Set(['acceptedRevision']), operation);
    return { acceptedRevision: requireInteger(payload.acceptedRevision, operation, 0) };
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

function requireTeacherScope(scope: MobileReadScope): void {
  if (
    scope.persona !== 'teacher' ||
    !UUID_PATTERN.test(scope.tenantId) ||
    !UUID_PATTERN.test(scope.campusId)
  ) {
    throw new Error('Mobile teacher conversation scope is invalid.');
  }
}

function requireConversationId(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error('Mobile teacher conversation id is invalid.');
}

function requireIdempotencyKey(value: string): void {
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new Error('Mobile teacher conversation idempotency key is invalid.');
  }
}

export class DatabaseMobileStaffConversationStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async sendMessage(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    conversationId: string,
    idempotencyKey: string,
    input: TeacherConversationMessageSendInput,
  ): Promise<
    | MobileTeacherConversationMessage
    | { readonly status: 'idempotency-conflict' | 'locked' }
    | undefined
  > {
    const [issuer, subject] = requireIdentity(identity);
    requireTeacherScope(scope);
    requireConversationId(conversationId);
    requireIdempotencyKey(idempotencyKey);
    if (input.body.trim() !== input.body || input.body.length < 1 || input.body.length > 4000) {
      throw new Error('Mobile teacher conversation message is invalid.');
    }
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.send_mobile_teacher_conversation_message($1::text,$2::text,$3::uuid,$4::uuid,$5::uuid,$6::text,$7::text) AS payload`,
      [issuer, subject, scope.tenantId, scope.campusId, conversationId, input.body, idempotencyKey],
    );
    return this.#onePayload(
      rows,
      (value) => {
        if (isRecord(value) && 'status' in value) {
          const mutation = validateMutation(value);
          if (
            'status' in mutation &&
            (mutation.status === 'idempotency-conflict' || mutation.status === 'locked')
          ) {
            return { status: mutation.status } as const;
          }
          throw invalidResponse('Mobile teacher conversation message');
        }
        return validateMessage(value);
      },
      'Mobile teacher conversation message',
    );
  }

  async markRead(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    conversationId: string,
    idempotencyKey: string,
    input: TeacherConversationReadReceiptInput,
  ): Promise<MobileTeacherConversationMutationResult | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireTeacherScope(scope);
    requireConversationId(conversationId);
    requireIdempotencyKey(idempotencyKey);
    if (!UUID_PATTERN.test(input.messageId)) {
      throw new Error('Mobile teacher conversation read receipt is invalid.');
    }
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.mark_mobile_teacher_conversation_read($1::text,$2::text,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::text) AS payload`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        conversationId,
        input.messageId,
        idempotencyKey,
      ],
    );
    return this.#onePayload(rows, validateMutation, 'Mobile teacher conversation read receipt');
  }

  #onePayload<T>(
    rows: readonly PayloadRow[],
    validator: (value: unknown) => T,
    operation: string,
  ): T | undefined {
    if (rows.length !== 1) throw invalidResponse(operation);
    const row = rows[0];
    if (row === undefined) throw invalidResponse(operation);
    if (row.payload === null || row.payload === undefined) return undefined;
    return validator(row.payload);
  }
}
