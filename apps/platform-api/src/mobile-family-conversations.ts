import { isMobileUuid } from './mobile-request-scope.js';

export interface FamilyMessageSendInput {
  readonly body: string;
}

export interface FamilyReadReceiptInput {
  readonly messageId: string;
}

export interface FamilyConversationPageQuery {
  readonly cursor?: string;
  readonly limit: number;
}

const FAMILY_CURSOR_PATTERN =
  /^\d{17}\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) return undefined;
  return record;
}

function parseJsonObject(
  body: string | undefined,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (body === undefined) return undefined;
  try {
    return exactRecord(JSON.parse(body) as unknown, keys);
  } catch {
    return undefined;
  }
}

export function parseFamilyMessageSend(
  body: string | undefined,
): FamilyMessageSendInput | undefined {
  const input = parseJsonObject(body, ['body']);
  if (input === undefined || typeof input.body !== 'string') return undefined;
  const normalized = input.body.trim();
  if (normalized === '' || normalized !== input.body || normalized.length > 4000) return undefined;
  return { body: normalized };
}

export function parseFamilyReadReceipt(
  body: string | undefined,
): FamilyReadReceiptInput | undefined {
  const input = parseJsonObject(body, ['messageId']);
  if (
    input === undefined ||
    typeof input.messageId !== 'string' ||
    !isMobileUuid(input.messageId)
  ) {
    return undefined;
  }
  return { messageId: input.messageId };
}

export function parseFamilyConversationPageQuery(
  cursor: string | undefined,
  limitText: string | undefined,
  defaultLimit: number,
): FamilyConversationPageQuery | undefined {
  if (!Number.isSafeInteger(defaultLimit) || defaultLimit < 1 || defaultLimit > 100)
    return undefined;
  if (cursor !== undefined && !FAMILY_CURSOR_PATTERN.test(cursor)) return undefined;
  const limit = limitText === undefined ? defaultLimit : Number(limitText);
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (limitText !== undefined && String(limit) !== limitText)
  ) {
    return undefined;
  }
  return cursor === undefined ? { limit } : { cursor, limit };
}
