import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

import type { MobileDeviceSessionRegistrationInput } from './mobile-device-session.js';

interface PayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function invalidResponse(operation: string): Error {
  return new Error(`${operation} returned an invalid database response.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function requireText(value: unknown, operation: string, maximum: number): string {
  if (typeof value !== 'string') throw invalidResponse(operation);
  const normalized = value.trim();
  if (normalized === '' || normalized.length > maximum) throw invalidResponse(operation);
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

function requireRevision(value: unknown, operation: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw invalidResponse(operation);
  }
  return value;
}

function validateRegistration(value: unknown): Record<string, unknown> {
  const operation = 'Mobile device registration';
  if (!isRecord(value)) throw invalidResponse(operation);
  if (!hasExactKeys(value, ['deviceSessionId', 'installationId', 'registeredAt', 'revision'])) {
    throw invalidResponse(operation);
  }
  return {
    deviceSessionId: requireUuid(value.deviceSessionId, operation),
    installationId: requireText(value.installationId, operation, 128),
    registeredAt: requireTimestamp(value.registeredAt, operation),
    revision: requireRevision(value.revision, operation),
  };
}

function validateRevocation(value: unknown): Record<string, unknown> {
  const operation = 'Mobile device revocation';
  if (!isRecord(value)) throw invalidResponse(operation);
  if (!hasExactKeys(value, ['deviceSessionId', 'revokedAt', 'revision'])) {
    throw invalidResponse(operation);
  }
  return {
    deviceSessionId: requireUuid(value.deviceSessionId, operation),
    revokedAt: requireTimestamp(value.revokedAt, operation),
    revision: requireRevision(value.revision, operation),
  };
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

export class DatabaseMobileDeviceSessionStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async register(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    idempotencyKey: string,
    input: MobileDeviceSessionRegistrationInput,
  ): Promise<Record<string, unknown> | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.register_mobile_device_session(
         $1::text, $2::text, $3::text, $4::text, $5::text,
         $6::text, $7::text, $8::text, $9::text, $10::text
       ) AS payload`,
      [
        issuer,
        subject,
        idempotencyKey,
        input.installationId,
        input.application,
        input.platform,
        input.appVersion,
        input.pushProvider,
        input.notificationEnvironment,
        input.pushToken,
      ],
    );
    return this.#onePayload(rows, validateRegistration, 'Mobile device registration');
  }

  async revoke(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    idempotencyKey: string,
    deviceSessionId: string,
  ): Promise<Record<string, unknown> | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    if (!UUID_PATTERN.test(deviceSessionId))
      throw new Error('Mobile device session identifier is invalid.');
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.revoke_mobile_device_session(
         $1::text, $2::text, $3::text, $4::uuid
       ) AS payload`,
      [issuer, subject, idempotencyKey, deviceSessionId],
    );
    return this.#onePayload(rows, validateRevocation, 'Mobile device revocation');
  }

  #onePayload(
    rows: readonly PayloadRow[],
    validator: (value: unknown) => Record<string, unknown>,
    operation: string,
  ): Record<string, unknown> | undefined {
    if (rows.length !== 1) throw invalidResponse(operation);
    const row = rows[0];
    if (row === undefined) throw invalidResponse(operation);
    if (row.payload === null || row.payload === undefined) return undefined;
    return validator(row.payload);
  }
}
