import type { HttpDatabase } from '@school/database';

import type {
  OperatorDomainCommandInput,
  OperatorDomainCommandName,
  OperatorDomainCommandReceipt,
  OperatorDomainCommandRejectionReason,
  OperatorDomainCommandResult,
  OperatorDomainCommandStore,
} from './operator-domain-commands.js';

interface OperatorDomainCommandRow extends Record<string, unknown> {
  readonly value: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const COMMANDS = new Set<OperatorDomainCommandName>([
  'admissions.application.review.record',
  'finance.bank-line.reconcile',
  'support.break-glass.request',
]);
const REJECTION_REASONS = new Set<OperatorDomainCommandRejectionReason>([
  'invalid-command',
  'session-inactive',
  'permission-not-granted',
  'step-up-required',
  'idempotency-conflict',
  'scope-not-found',
  'revision-conflict',
  'domain-conflict',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function invalidResponse(): Error {
  return new Error('Operator domain command returned an invalid database response.');
}

function validateReceipt(
  value: unknown,
  input: OperatorDomainCommandInput,
): OperatorDomainCommandReceipt {
  if (!isRecord(value)) throw invalidResponse();
  const expectedKeys = [
    'commandId',
    'command',
    'domainEvidenceId',
    'idempotencyKey',
    'correlationId',
    'acceptedAt',
  ];
  const keys = Object.keys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => !expectedKeys.includes(key)) ||
    !validUuid(value.commandId) ||
    typeof value.command !== 'string' ||
    !COMMANDS.has(value.command as OperatorDomainCommandName) ||
    value.command !== input.command ||
    !validUuid(value.domainEvidenceId) ||
    typeof value.idempotencyKey !== 'string' ||
    !IDEMPOTENCY_KEY_PATTERN.test(value.idempotencyKey) ||
    value.idempotencyKey !== input.idempotencyKey ||
    !validUuid(value.correlationId) ||
    value.correlationId !== input.correlationId ||
    !validTimestamp(value.acceptedAt)
  ) {
    throw invalidResponse();
  }
  return {
    commandId: value.commandId,
    command: value.command,
    domainEvidenceId: value.domainEvidenceId,
    idempotencyKey: value.idempotencyKey,
    correlationId: value.correlationId,
    acceptedAt: value.acceptedAt,
  };
}

function validateResult(
  value: unknown,
  input: OperatorDomainCommandInput,
): OperatorDomainCommandResult {
  if (!isRecord(value) || typeof value.accepted !== 'boolean') throw invalidResponse();
  if (value.accepted) {
    const keys = Object.keys(value);
    if (
      keys.length !== 3 ||
      keys.some((key) => !['accepted', 'replayed', 'receipt'].includes(key)) ||
      typeof value.replayed !== 'boolean'
    ) {
      throw invalidResponse();
    }
    return {
      accepted: true,
      replayed: value.replayed,
      receipt: validateReceipt(value.receipt, input),
    };
  }

  if (
    typeof value.reason !== 'string' ||
    !REJECTION_REASONS.has(value.reason as OperatorDomainCommandRejectionReason)
  ) {
    throw invalidResponse();
  }
  const keys = Object.keys(value);
  if (value.reason === 'step-up-required') {
    if (
      keys.length !== 3 ||
      keys.some((key) => !['accepted', 'reason', 'requiredAssurance'].includes(key)) ||
      value.requiredAssurance !== 'aal2'
    ) {
      throw invalidResponse();
    }
    return { accepted: false, reason: 'step-up-required', requiredAssurance: 'aal2' };
  }
  if (value.reason === 'revision-conflict') {
    if (
      keys.length !== 3 ||
      keys.some((key) => !['accepted', 'reason', 'currentVersion'].includes(key)) ||
      typeof value.currentVersion !== 'number' ||
      !Number.isSafeInteger(value.currentVersion) ||
      value.currentVersion < 1
    ) {
      throw invalidResponse();
    }
    return {
      accepted: false,
      reason: 'revision-conflict',
      currentVersion: value.currentVersion,
    };
  }
  if (keys.length !== 2 || keys.some((key) => !['accepted', 'reason'].includes(key))) {
    throw invalidResponse();
  }
  return {
    accepted: false,
    reason: value.reason as Exclude<
      OperatorDomainCommandRejectionReason,
      'step-up-required' | 'revision-conflict'
    >,
  };
}

export class DatabaseOperatorDomainCommandStore implements OperatorDomainCommandStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async submit(input: OperatorDomainCommandInput): Promise<OperatorDomainCommandResult> {
    let rows: readonly OperatorDomainCommandRow[];
    if (input.command === 'admissions.application.review.record') {
      rows = await this.#database.query<OperatorDomainCommandRow>(
        `SELECT admissions.record_application_review_command(
           $1::uuid, $2::uuid, $3::bigint, $4::text, $5::numeric,
           $6::text, $7::text, $8::uuid
         ) AS value`,
        [
          input.sessionId,
          input.applicationId,
          input.expectedVersion,
          input.recommendation,
          input.score,
          input.notes,
          input.idempotencyKey,
          input.correlationId,
        ],
      );
    } else if (input.command === 'finance.bank-line.reconcile') {
      rows = await this.#database.query<OperatorDomainCommandRow>(
        `SELECT billing.reconcile_bank_statement_line_command(
           $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::uuid
         ) AS value`,
        [
          input.sessionId,
          input.bankStatementLineId,
          input.paymentId,
          input.reason,
          input.idempotencyKey,
          input.correlationId,
        ],
      );
    } else {
      rows = await this.#database.query<OperatorDomainCommandRow>(
        `SELECT iam.request_privileged_support_access_command(
           $1::uuid, $2::text, $3::integer, $4::text, $5::uuid
         ) AS value`,
        [
          input.sessionId,
          input.reason,
          input.requestedMinutes,
          input.idempotencyKey,
          input.correlationId,
        ],
      );
    }
    const row = rows[0];
    if (rows.length !== 1 || row === undefined) throw invalidResponse();
    return validateResult(row.value, input);
  }
}
