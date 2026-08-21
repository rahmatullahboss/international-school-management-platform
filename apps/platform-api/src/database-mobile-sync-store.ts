import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

import type { MobileReadScope } from './database-mobile-read-store.js';

export interface MobileSyncDeltaPayload {
  readonly cursor: string;
  readonly changed: boolean;
  readonly serverTime: string;
}

export type MobileSyncPullResult = MobileSyncDeltaPayload | { readonly status: 'cursor-invalid' };

interface MobileSyncRow extends Record<string, unknown> {
  readonly payload: unknown;
}

const CANONICAL_CURSOR_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const EXACT_PAYLOAD_KEYS = new Set(['cursor', 'changed', 'serverTime']);

function invalidResponse(): Error {
  return new Error('Mobile sync resolution returned an invalid database response.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function validatePayload(value: unknown): MobileSyncPullResult {
  if (!isRecord(value)) throw invalidResponse();
  const keys = Object.keys(value);
  if (keys.length === 1 && value.status === 'cursor-invalid') {
    return { status: 'cursor-invalid' };
  }
  if (keys.length !== EXACT_PAYLOAD_KEYS.size || keys.some((key) => !EXACT_PAYLOAD_KEYS.has(key))) {
    throw invalidResponse();
  }
  if (
    typeof value.cursor !== 'string' ||
    !CANONICAL_CURSOR_PATTERN.test(value.cursor) ||
    typeof value.changed !== 'boolean' ||
    !canonicalInstant(value.serverTime)
  ) {
    throw invalidResponse();
  }
  return { cursor: value.cursor, changed: value.changed, serverTime: value.serverTime };
}

export class DatabaseMobileSyncStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async pull(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    cursor: string | null,
  ): Promise<MobileSyncPullResult | undefined> {
    const issuer = identity.issuer.trim();
    const subject = identity.subject.trim();
    if (issuer === '' || subject === '' || issuer.length > 2048 || subject.length > 512) {
      throw new Error('Mobile identity is invalid.');
    }
    const rows = await this.#database.query<MobileSyncRow>(
      'SELECT platform.resolve_mobile_sync_delta($1::text, $2::text, $3::uuid, $4::uuid, $5::text, $6::uuid) AS payload',
      [issuer, subject, scope.tenantId, scope.campusId, scope.persona, cursor],
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw invalidResponse();
    return validatePayload(rows[0]?.payload);
  }
}
