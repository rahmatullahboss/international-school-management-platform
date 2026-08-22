import { isMobileUuid } from './mobile-request-scope.js';

export interface TeacherConversationMessageSendInput {
  readonly body: string;
}

export interface TeacherConversationReadReceiptInput {
  readonly messageId: string;
}

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;

function exactJsonObject(
  body: string | undefined,
  expectedKeys: readonly string[],
): Record<string, unknown> | undefined {
  if (body === undefined) return undefined;
  try {
    const value = JSON.parse(body) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
      return undefined;
    }
    return record;
  } catch {
    return undefined;
  }
}

export function isMobileTeacherConversationIdempotencyKey(
  value: string | undefined,
): value is string {
  return value !== undefined && IDEMPOTENCY_KEY_PATTERN.test(value);
}

export function parseTeacherConversationMessageSend(
  body: string | undefined,
): TeacherConversationMessageSendInput | undefined {
  const input = exactJsonObject(body, ['body']);
  if (input === undefined || typeof input.body !== 'string') return undefined;
  const normalized = input.body.trim();
  if (normalized === '' || normalized !== input.body || normalized.length > 4000) return undefined;
  return { body: normalized };
}

export function parseTeacherConversationReadReceipt(
  body: string | undefined,
): TeacherConversationReadReceiptInput | undefined {
  const input = exactJsonObject(body, ['messageId']);
  if (
    input === undefined ||
    typeof input.messageId !== 'string' ||
    !isMobileUuid(input.messageId)
  ) {
    return undefined;
  }
  return { messageId: input.messageId };
}
