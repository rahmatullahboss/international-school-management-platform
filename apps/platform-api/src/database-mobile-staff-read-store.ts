import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

import type { MobileReadScope } from './database-mobile-read-store.js';
import { requireSchoolTimeZone, schoolLocalTimestamp } from './mobile-school-time.js';

interface PayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
  readonly timeZoneId?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_TEXT = 512;

function invalidResponse(operation: string): Error {
  return new Error(`${operation} returned an invalid database response.`);
}

function record(value: unknown, operation: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw invalidResponse(operation);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  operation: string,
): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw invalidResponse(operation);
  }
}

function text(value: unknown, operation: string, maximum = MAX_TEXT): string {
  if (typeof value !== 'string') throw invalidResponse(operation);
  const normalized = value.trim();
  if (normalized === '' || normalized.length > maximum) throw invalidResponse(operation);
  return normalized;
}

function uuid(value: unknown, operation: string): string {
  const normalized = text(value, operation, 64);
  if (!UUID_PATTERN.test(normalized)) throw invalidResponse(operation);
  return normalized;
}

function timestamp(value: unknown, operation: string): string {
  const normalized = text(value, operation, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw invalidResponse(operation);
  }
  return normalized;
}

function integer(value: unknown, operation: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw invalidResponse(operation);
  }
  return value;
}

function bool(value: unknown, operation: string): boolean {
  if (typeof value !== 'boolean') throw invalidResponse(operation);
  return value;
}

function array(value: unknown, maximum: number, operation: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw invalidResponse(operation);
  return value;
}

function assessment(
  value: unknown,
  operation: string,
  timeZoneId: string,
): Record<string, unknown> {
  const item = record(value, operation);
  exactKeys(
    item,
    [
      'assessmentId',
      'sectionId',
      'sectionLabel',
      'subjectLabel',
      'assessmentTitle',
      'categoryLabel',
      'dueAt',
      'state',
      'lockState',
      'version',
      'scoreScale',
      'maximumScoreUnits',
      'rosterCount',
      'enteredCount',
    ],
    operation,
  );
  const state = text(item.state, operation, 16);
  const lockState = text(item.lockState, operation, 16);
  if (
    !['draft', 'published', 'closed'].includes(state) ||
    !['open', 'locked'].includes(lockState)
  ) {
    throw invalidResponse(operation);
  }
  const rosterCount = integer(item.rosterCount, operation);
  const enteredCount = integer(item.enteredCount, operation);
  if (enteredCount > rosterCount) throw invalidResponse(operation);
  return {
    assessmentId: uuid(item.assessmentId, operation),
    sectionId: uuid(item.sectionId, operation),
    sectionLabel: text(item.sectionLabel, operation),
    subjectLabel: text(item.subjectLabel, operation),
    assessmentTitle: text(item.assessmentTitle, operation),
    categoryLabel: text(item.categoryLabel, operation),
    dueAt: schoolLocalTimestamp(timestamp(item.dueAt, operation), timeZoneId, operation),
    state,
    lockState,
    version: integer(item.version, operation, 1),
    scoreScale: integer(item.scoreScale, operation, 1),
    maximumScoreUnits: integer(item.maximumScoreUnits, operation, 1),
    rosterCount,
    enteredCount,
  };
}

function validateAssessments(value: unknown, timeZoneValue: unknown): Record<string, unknown> {
  const operation = 'Mobile teacher assessments';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = record(value, operation);
  exactKeys(payload, ['assessments', 'generatedAt', 'hasMore'], operation);
  return {
    assessments: array(payload.assessments, 64, operation).map((item) =>
      assessment(item, operation, timeZoneId),
    ),
    generatedAt: schoolLocalTimestamp(
      timestamp(payload.generatedAt, operation),
      timeZoneId,
      operation,
    ),
    timeZoneId,
    hasMore: bool(payload.hasMore, operation),
  };
}

function conversation(
  value: unknown,
  operation: string,
  timeZoneId: string,
): Record<string, unknown> {
  const item = record(value, operation);
  exactKeys(
    item,
    ['conversationId', 'studentId', 'studentDisplayName', 'subject', 'latestMessageAt', 'canReply'],
    operation,
  );
  return {
    conversationId: uuid(item.conversationId, operation),
    studentId: uuid(item.studentId, operation),
    studentDisplayName: text(item.studentDisplayName, operation),
    subject: text(item.subject, operation),
    latestMessageAt: schoolLocalTimestamp(
      timestamp(item.latestMessageAt, operation),
      timeZoneId,
      operation,
    ),
    canReply: bool(item.canReply, operation),
  };
}

function validateConversations(value: unknown, timeZoneValue: unknown): Record<string, unknown> {
  const operation = 'Mobile teacher conversations';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = record(value, operation);
  exactKeys(payload, ['conversations', 'generatedAt', 'hasMore'], operation);
  return {
    conversations: array(payload.conversations, 50, operation).map((item) =>
      conversation(item, operation, timeZoneId),
    ),
    generatedAt: schoolLocalTimestamp(
      timestamp(payload.generatedAt, operation),
      timeZoneId,
      operation,
    ),
    timeZoneId,
    hasMore: bool(payload.hasMore, operation),
  };
}

function conversationMessage(
  value: unknown,
  operation: string,
  timeZoneId: string,
): Record<string, unknown> {
  const item = record(value, operation);
  exactKeys(item, ['messageId', 'authorLabel', 'body', 'sentAt', 'authoredByViewer'], operation);
  return {
    messageId: uuid(item.messageId, operation),
    authorLabel: text(item.authorLabel, operation),
    body: text(item.body, operation, 4000),
    sentAt: schoolLocalTimestamp(timestamp(item.sentAt, operation), timeZoneId, operation),
    authoredByViewer: bool(item.authoredByViewer, operation),
  };
}

function validateConversationMessages(
  value: unknown,
  timeZoneValue: unknown,
): Record<string, unknown> {
  const operation = 'Mobile teacher conversation messages';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = record(value, operation);
  exactKeys(
    payload,
    ['conversationId', 'studentDisplayName', 'subject', 'messages', 'hasMore'],
    operation,
  );
  return {
    conversationId: uuid(payload.conversationId, operation),
    studentDisplayName: text(payload.studentDisplayName, operation),
    subject: text(payload.subject, operation),
    messages: array(payload.messages, 100, operation).map((item) =>
      conversationMessage(item, operation, timeZoneId),
    ),
    timeZoneId,
    hasMore: bool(payload.hasMore, operation),
  };
}

function identity(identity: Pick<OidcIdentity, 'issuer' | 'subject'>): readonly [string, string] {
  const issuer = identity.issuer.trim();
  const subject = identity.subject.trim();
  if (issuer === '' || subject === '' || issuer.length > 2048 || subject.length > 512) {
    throw new Error('Mobile identity is invalid.');
  }
  return [issuer, subject];
}

function teacherScope(scope: MobileReadScope): void {
  if (
    scope.persona !== 'teacher' ||
    !UUID_PATTERN.test(scope.tenantId) ||
    !UUID_PATTERN.test(scope.campusId)
  ) {
    throw new Error('Mobile teacher scope is invalid.');
  }
}

export class DatabaseMobileStaffReadStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async assessments(
    requestIdentity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
  ): Promise<Record<string, unknown> | undefined> {
    const [issuer, subject] = identity(requestIdentity);
    teacherScope(scope);
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_teacher_assessments($1::text, $2::text, $3::uuid, $4::uuid, 64) AS payload,
       (SELECT request_scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text, $2::text, $3::uuid, $4::uuid, 'teacher'::text
       ) AS request_scope) AS "timeZoneId"`,
      [issuer, subject, scope.tenantId, scope.campusId],
    );
    return this.#payload(rows, validateAssessments, 'Mobile teacher assessments');
  }

  async conversations(
    requestIdentity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
  ): Promise<Record<string, unknown> | undefined> {
    const [issuer, subject] = identity(requestIdentity);
    teacherScope(scope);
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_teacher_conversations($1::text, $2::text, $3::uuid, $4::uuid, 50) AS payload,
       (SELECT request_scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text, $2::text, $3::uuid, $4::uuid, 'teacher'::text
       ) AS request_scope) AS "timeZoneId"`,
      [issuer, subject, scope.tenantId, scope.campusId],
    );
    return this.#payload(rows, validateConversations, 'Mobile teacher conversations');
  }

  async conversationMessages(
    requestIdentity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    conversationId: string,
  ): Promise<Record<string, unknown> | undefined> {
    const [issuer, subject] = identity(requestIdentity);
    teacherScope(scope);
    if (!UUID_PATTERN.test(conversationId))
      throw new Error('Mobile conversation identifier is invalid.');
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_teacher_conversation_messages($1::text, $2::text, $3::uuid, $4::uuid, $5::uuid, 100) AS payload,
       (SELECT request_scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text, $2::text, $3::uuid, $4::uuid, 'teacher'::text
       ) AS request_scope) AS "timeZoneId"`,
      [issuer, subject, scope.tenantId, scope.campusId, conversationId],
    );
    return this.#payload(
      rows,
      validateConversationMessages,
      'Mobile teacher conversation messages',
    );
  }

  #payload(
    rows: readonly PayloadRow[],
    validator: (value: unknown, timeZoneValue: unknown) => Record<string, unknown>,
    operation: string,
  ): Record<string, unknown> | undefined {
    if (rows.length !== 1) throw invalidResponse(operation);
    const row = rows[0];
    const payload = row?.payload;
    if (payload === null || payload === undefined) return undefined;
    return validator(payload, row?.timeZoneId);
  }
}
