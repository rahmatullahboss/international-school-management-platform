import type { HttpDatabase } from '@school/database';

import type {
  RuntimeProjectionDeadLetterRecoveryInput,
  RuntimeProjectionDeadLetterRecoveryRejectionReason,
  RuntimeProjectionDeadLetterRecoveryStoreResult,
} from './runtime-projection-dead-letter-recovery.js';

interface RecoveryRow extends Record<string, unknown> {
  readonly value: unknown;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ERROR_CODES = new Set(['source-unavailable', 'processor-error']);
const REJECTION_REASONS = new Set<RuntimeProjectionDeadLetterRecoveryRejectionReason>([
  'permission-not-granted',
  'dead-letter-unavailable',
  'dead-letter-not-recoverable',
  'already-recovered',
  'already-applied',
  'projection-state-changed',
  'source-unavailable',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function invalidResponse(): Error {
  return new Error('Runtime projection dead-letter recovery returned an invalid database response.');
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function validateResult(
  value: unknown,
  input: RuntimeProjectionDeadLetterRecoveryInput,
): RuntimeProjectionDeadLetterRecoveryStoreResult {
  if (!isRecord(value)) throw invalidResponse();
  if (value.accepted === false) {
    if (
      !exactKeys(value, ['accepted', 'reason']) ||
      typeof value.reason !== 'string' ||
      !REJECTION_REASONS.has(value.reason as RuntimeProjectionDeadLetterRecoveryRejectionReason)
    ) {
      throw invalidResponse();
    }
    return {
      accepted: false,
      reason: value.reason as RuntimeProjectionDeadLetterRecoveryRejectionReason,
    };
  }
  if (
    value.accepted !== true ||
    typeof value.replayed !== 'boolean' ||
    !exactKeys(value, ['accepted', 'replayed', 'receipt']) ||
    !isRecord(value.receipt)
  ) {
    throw invalidResponse();
  }
  const receipt = value.receipt;
  if (
    !exactKeys(receipt, [
      'recoveryId',
      'state',
      'deadLetterId',
      'originalEventId',
      'replacementEventId',
      'commandId',
      'errorCode',
      'requestedAt',
    ]) ||
    !validUuid(receipt.recoveryId) ||
    receipt.state !== 'accepted' ||
    !validUuid(receipt.deadLetterId) ||
    receipt.deadLetterId !== input.deadLetterId ||
    !validUuid(receipt.originalEventId) ||
    !validUuid(receipt.replacementEventId) ||
    !validUuid(receipt.commandId) ||
    typeof receipt.errorCode !== 'string' ||
    !ERROR_CODES.has(receipt.errorCode) ||
    !validTimestamp(receipt.requestedAt)
  ) {
    throw invalidResponse();
  }
  return {
    accepted: true,
    replayed: value.replayed,
    receipt: {
      recoveryId: receipt.recoveryId,
      state: 'accepted',
      deadLetterId: receipt.deadLetterId,
      originalEventId: receipt.originalEventId,
      replacementEventId: receipt.replacementEventId,
      commandId: receipt.commandId,
      errorCode: receipt.errorCode as 'source-unavailable' | 'processor-error',
      requestedAt: receipt.requestedAt,
    },
  };
}

export class DatabaseProjectionDeadLetterRecoveryStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async recover(
    input: RuntimeProjectionDeadLetterRecoveryInput,
  ): Promise<RuntimeProjectionDeadLetterRecoveryStoreResult> {
    const rows = await this.#database.query<RecoveryRow>(
      `SELECT platform.recover_runtime_projection_dead_letter(
         $1::uuid,
         $2::uuid,
         $3::uuid,
         $4::text,
         $5::text,
         $6::uuid
       ) AS value`,
      [
        input.tenantId,
        input.deadLetterId,
        input.actorAccountId,
        input.idempotencyKey,
        input.reason,
        input.correlationId,
      ],
    );
    const row = rows[0];
    if (rows.length !== 1 || row === undefined) throw invalidResponse();
    return validateResult(row.value, input);
  }
}
