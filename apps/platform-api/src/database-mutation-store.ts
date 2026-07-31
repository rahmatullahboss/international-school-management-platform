import type { HttpDatabase } from '@school/database';

export interface RuntimeSnapshotRefreshCommandInput {
  readonly sessionId: string;
  readonly idempotencyKey: string;
  readonly expectedRevision: number;
  readonly reason: string;
  readonly correlationId: string;
}

export interface RuntimeMutationReceipt {
  readonly commandId: string;
  readonly commandType: 'runtime.snapshot.refresh';
  readonly state: 'accepted';
  readonly expectedRevision: number;
  readonly correlationId: string;
  readonly acceptedAt: string;
}

export type RuntimeMutationDecision =
  | {
      readonly accepted: true;
      readonly replayed: boolean;
      readonly receipt: RuntimeMutationReceipt;
    }
  | { readonly accepted: false; readonly reason: 'session-inactive' }
  | { readonly accepted: false; readonly reason: 'permission-not-granted' }
  | {
      readonly accepted: false;
      readonly reason: 'step-up-required';
      readonly requiredAssurance: 'aal2';
    }
  | { readonly accepted: false; readonly reason: 'projection-not-found' }
  | {
      readonly accepted: false;
      readonly reason: 'revision-conflict';
      readonly currentRevision: number;
    }
  | { readonly accepted: false; readonly reason: 'idempotency-conflict' };

interface RuntimeMutationRow extends Record<string, unknown> {
  readonly value: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) return true;
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(): Error {
  return new Error('Runtime mutation submission returned an invalid database response.');
}

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} must be a UUID.`);
  return value;
}

function requireIdempotencyKey(value: string): string {
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new Error('idempotencyKey is invalid.');
  }
  return value;
}

function requireRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('expectedRevision must be a positive integer.');
  }
  return value;
}

function requireReason(value: string): string {
  const reason = value.trim();
  if (
    reason.length < 1 ||
    reason.length > 500 ||
    reason !== value ||
    hasControlCharacters(reason)
  ) {
    throw new Error('reason is invalid.');
  }
  return reason;
}

function canonicalTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed.toISOString() === value ? value : undefined;
}

function validatedReceipt(value: unknown): RuntimeMutationReceipt | undefined {
  if (!isRecord(value)) return undefined;
  const acceptedAt = canonicalTimestamp(value.acceptedAt);
  if (
    typeof value.commandId !== 'string' ||
    !UUID_PATTERN.test(value.commandId) ||
    value.commandType !== 'runtime.snapshot.refresh' ||
    value.state !== 'accepted' ||
    typeof value.expectedRevision !== 'number' ||
    !Number.isSafeInteger(value.expectedRevision) ||
    value.expectedRevision < 1 ||
    typeof value.correlationId !== 'string' ||
    !UUID_PATTERN.test(value.correlationId) ||
    acceptedAt === undefined
  ) {
    return undefined;
  }
  return {
    commandId: value.commandId,
    commandType: value.commandType,
    state: value.state,
    expectedRevision: value.expectedRevision,
    correlationId: value.correlationId,
    acceptedAt,
  };
}

function validateDecision(value: unknown): RuntimeMutationDecision {
  if (!isRecord(value) || typeof value.accepted !== 'boolean') throw invalidResponse();
  if (value.accepted) {
    if (typeof value.replayed !== 'boolean') throw invalidResponse();
    const receipt = validatedReceipt(value.receipt);
    if (receipt === undefined) throw invalidResponse();
    return { accepted: true, replayed: value.replayed, receipt };
  }

  if (value.reason === 'session-inactive') {
    return { accepted: false, reason: 'session-inactive' };
  }
  if (value.reason === 'permission-not-granted') {
    return { accepted: false, reason: 'permission-not-granted' };
  }
  if (value.reason === 'step-up-required' && value.requiredAssurance === 'aal2') {
    return {
      accepted: false,
      reason: 'step-up-required',
      requiredAssurance: 'aal2',
    };
  }
  if (value.reason === 'projection-not-found') {
    return { accepted: false, reason: 'projection-not-found' };
  }
  if (
    value.reason === 'revision-conflict' &&
    typeof value.currentRevision === 'number' &&
    Number.isSafeInteger(value.currentRevision) &&
    value.currentRevision > 0
  ) {
    return {
      accepted: false,
      reason: 'revision-conflict',
      currentRevision: value.currentRevision,
    };
  }
  if (value.reason === 'idempotency-conflict') {
    return { accepted: false, reason: 'idempotency-conflict' };
  }
  throw invalidResponse();
}

export class DatabaseMutationStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async submitRuntimeSnapshotRefresh(
    input: RuntimeSnapshotRefreshCommandInput,
  ): Promise<RuntimeMutationDecision> {
    const sessionId = requireUuid(input.sessionId, 'sessionId');
    const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
    const expectedRevision = requireRevision(input.expectedRevision);
    const reason = requireReason(input.reason);
    const correlationId = requireUuid(input.correlationId, 'correlationId');

    const rows = await this.#database.query<RuntimeMutationRow>(
      `SELECT platform.submit_runtime_snapshot_refresh(
         $1::uuid,
         $2::text,
         $3::bigint,
         $4::text,
         $5::uuid
       ) AS value`,
      [sessionId, idempotencyKey, expectedRevision, reason, correlationId],
    );
    const row = rows[0];
    if (rows.length !== 1 || row === undefined) throw invalidResponse();
    const decision = validateDecision(row.value);
    if (
      decision.accepted &&
      (decision.receipt.expectedRevision !== expectedRevision ||
        (!decision.replayed && decision.receipt.correlationId !== correlationId))
    ) {
      throw invalidResponse();
    }
    return decision;
  }
}
