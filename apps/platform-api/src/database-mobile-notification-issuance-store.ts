import type { HttpDatabase } from '@school/database';

import type { MobileNotificationIssuanceInput } from './mobile-notification-issuance.js';

interface PayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
}

export interface MobileNotificationIssuanceReceipt {
  readonly notificationId: string;
  readonly status: 'queued' | 'suppressed';
  readonly targetCount: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export type MobileNotificationIssuanceResult =
  MobileNotificationIssuanceReceipt | { readonly status: 'idempotency-conflict' } | undefined;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const maximumLifetimeMilliseconds = 24 * 60 * 60 * 1000;

function invalidResponse(): Error {
  return new Error('Mobile notification issuance returned an invalid database response.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(value)) throw invalidResponse();
  const expected = new Set(keys);
  const actual = Object.keys(value);
  if (actual.length !== expected.size || actual.some((key) => !expected.has(key))) {
    throw invalidResponse();
  }
  return value;
}

function canonicalTimestamp(value: unknown): string {
  if (typeof value !== 'string') throw invalidResponse();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw invalidResponse();
  return value;
}

function validateReceipt(
  value: unknown,
  expectedExpiresAt: string,
): Exclude<MobileNotificationIssuanceResult, undefined> {
  if (isRecord(value) && value.status === 'idempotency-conflict') {
    exactRecord(value, ['status']);
    return { status: 'idempotency-conflict' };
  }
  const payload = exactRecord(value, [
    'notificationId',
    'status',
    'targetCount',
    'issuedAt',
    'expiresAt',
  ]);
  if (
    typeof payload.notificationId !== 'string' ||
    !UUID_PATTERN.test(payload.notificationId) ||
    (payload.status !== 'queued' && payload.status !== 'suppressed') ||
    typeof payload.targetCount !== 'number' ||
    !Number.isSafeInteger(payload.targetCount) ||
    payload.targetCount < 0 ||
    payload.targetCount > 32
  ) {
    throw invalidResponse();
  }
  if (
    (payload.status === 'queued' && payload.targetCount < 1) ||
    (payload.status === 'suppressed' && payload.targetCount !== 0)
  ) {
    throw invalidResponse();
  }
  const issuedAt = canonicalTimestamp(payload.issuedAt);
  const expiresAt = canonicalTimestamp(payload.expiresAt);
  const issuedMillis = new Date(issuedAt).getTime();
  const expiryMillis = new Date(expiresAt).getTime();
  if (
    expiresAt !== expectedExpiresAt ||
    expiryMillis <= issuedMillis ||
    expiryMillis - issuedMillis > maximumLifetimeMilliseconds
  ) {
    throw invalidResponse();
  }
  return {
    notificationId: payload.notificationId,
    status: payload.status,
    targetCount: payload.targetCount,
    issuedAt,
    expiresAt,
  };
}

export class DatabaseMobileNotificationIssuanceStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async issue(input: MobileNotificationIssuanceInput): Promise<MobileNotificationIssuanceResult> {
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.issue_mobile_notification($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::text,$8::text,$9::text,$10::timestamptz) AS payload`,
      [
        input.tenantId,
        input.campusId,
        input.accountId,
        input.application,
        input.persona,
        input.kind,
        input.resourceId,
        input.notificationEnvironment,
        input.notificationKey,
        input.expiresAt,
      ],
    );
    if (rows.length !== 1 || rows[0] === undefined) throw invalidResponse();
    const payload = rows[0].payload;
    if (payload === null || payload === undefined) return undefined;
    return validateReceipt(payload, input.expiresAt);
  }
}
