import type { HttpDatabase } from '@school/database';

export type RuntimeReadModelPersona = 'admin' | 'teacher' | 'guardian' | 'student';

export interface RuntimeReadModelHead {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly campusId: string | null;
  readonly persona: RuntimeReadModelPersona;
  readonly subjectRef: string;
  readonly capabilities: readonly string[];
  readonly revision: number;
  readonly generatedAt: string;
  readonly sourceUpdatedAt: string;
  readonly payloadDigest: string;
  readonly capabilityDigest: string;
  readonly payloadBytes: number;
}

interface RuntimeReadModelHeadRow extends Record<string, unknown> {
  readonly tenantId: unknown;
  readonly membershipId: unknown;
  readonly campusId: unknown;
  readonly persona: unknown;
  readonly subjectRef: unknown;
  readonly capabilities: unknown;
  readonly revision: unknown;
  readonly generatedAt: unknown;
  readonly sourceUpdatedAt: unknown;
  readonly payloadDigest: unknown;
  readonly capabilityDigest: unknown;
  readonly payloadBytes: unknown;
}

interface RuntimeReadModelPayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u;
const SUBJECT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_CAPABILITIES = 256;

function invalidResponse(operation: string): Error {
  return new Error(`${operation} returned an invalid database response.`);
}

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} must be a UUID.`);
  return value;
}

function requirePositiveRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('revision must be a positive integer.');
  }
  return value;
}

function requireDigest(value: string, label: string): string {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a SHA-256 digest.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed.toISOString() === value ? value : undefined;
}

function validatedCapabilities(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_CAPABILITIES) return undefined;
  if (
    !value.every(
      (entry) =>
        typeof entry === 'string' &&
        entry.length <= 128 &&
        CAPABILITY_PATTERN.test(entry),
    )
  ) {
    return undefined;
  }
  const capabilities = value as string[];
  const sorted = [...capabilities].sort((left, right) => left.localeCompare(right));
  if (new Set(capabilities).size !== capabilities.length) return undefined;
  if (!capabilities.every((entry, index) => entry === sorted[index])) return undefined;
  return [...capabilities];
}

function validateHeadRow(row: RuntimeReadModelHeadRow): RuntimeReadModelHead {
  const capabilities = validatedCapabilities(row.capabilities);
  const generatedAt = canonicalTimestamp(row.generatedAt);
  const sourceUpdatedAt = canonicalTimestamp(row.sourceUpdatedAt);
  if (
    typeof row.tenantId !== 'string' ||
    !UUID_PATTERN.test(row.tenantId) ||
    typeof row.membershipId !== 'string' ||
    !UUID_PATTERN.test(row.membershipId) ||
    (row.campusId !== null &&
      (typeof row.campusId !== 'string' || !UUID_PATTERN.test(row.campusId))) ||
    (row.persona !== 'admin' &&
      row.persona !== 'teacher' &&
      row.persona !== 'guardian' &&
      row.persona !== 'student') ||
    typeof row.subjectRef !== 'string' ||
    !SUBJECT_REF_PATTERN.test(row.subjectRef) ||
    capabilities === undefined ||
    typeof row.revision !== 'number' ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    generatedAt === undefined ||
    sourceUpdatedAt === undefined ||
    typeof row.payloadDigest !== 'string' ||
    !SHA256_PATTERN.test(row.payloadDigest) ||
    typeof row.capabilityDigest !== 'string' ||
    !SHA256_PATTERN.test(row.capabilityDigest) ||
    typeof row.payloadBytes !== 'number' ||
    !Number.isSafeInteger(row.payloadBytes) ||
    row.payloadBytes < 2 ||
    row.payloadBytes > MAX_PAYLOAD_BYTES
  ) {
    throw invalidResponse('Runtime read-model head resolution');
  }
  return {
    tenantId: row.tenantId,
    membershipId: row.membershipId,
    campusId: row.campusId,
    persona: row.persona,
    subjectRef: row.subjectRef,
    capabilities,
    revision: row.revision,
    generatedAt,
    sourceUpdatedAt,
    payloadDigest: row.payloadDigest,
    capabilityDigest: row.capabilityDigest,
    payloadBytes: row.payloadBytes,
  };
}

function validatePayload(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw invalidResponse('Runtime read-model payload resolution');
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw invalidResponse('Runtime read-model payload resolution');
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_PAYLOAD_BYTES) {
    throw invalidResponse('Runtime read-model payload resolution');
  }
  return value;
}

export class DatabaseReadModelStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async resolveHead(sessionId: string): Promise<RuntimeReadModelHead | undefined> {
    requireUuid(sessionId, 'sessionId');
    const rows = await this.#database.query<RuntimeReadModelHeadRow>(
      `SELECT
         tenant_id::text AS "tenantId",
         membership_id::text AS "membershipId",
         campus_id::text AS "campusId",
         persona,
         subject_ref AS "subjectRef",
         capabilities,
         revision,
         generated_at::text AS "generatedAt",
         source_updated_at::text AS "sourceUpdatedAt",
         payload_digest AS "payloadDigest",
         capability_digest AS "capabilityDigest",
         payload_bytes AS "payloadBytes"
       FROM platform.resolve_runtime_read_model_head($1::uuid)`,
      [sessionId],
    );
    if (rows.length === 0) return undefined;
    const row = rows[0];
    if (rows.length !== 1 || row === undefined) {
      throw invalidResponse('Runtime read-model head resolution');
    }
    return validateHeadRow(row);
  }

  async readPayload(
    sessionId: string,
    revision: number,
    payloadDigest: string,
  ): Promise<Record<string, unknown> | undefined> {
    requireUuid(sessionId, 'sessionId');
    requirePositiveRevision(revision);
    requireDigest(payloadDigest, 'payloadDigest');
    const rows = await this.#database.query<RuntimeReadModelPayloadRow>(
      `SELECT payload
       FROM platform.read_runtime_read_model_payload(
         $1::uuid,
         $2::bigint,
         $3::text
       )`,
      [sessionId, revision, payloadDigest],
    );
    if (rows.length === 0) return undefined;
    const row = rows[0];
    if (rows.length !== 1 || row === undefined) {
      throw invalidResponse('Runtime read-model payload resolution');
    }
    return validatePayload(row.payload);
  }
}
