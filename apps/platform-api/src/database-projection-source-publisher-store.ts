import type { HttpDatabase } from '@school/database';

import type {
  RuntimeProjectionPersona,
  RuntimeProjectionSourcePublication,
  RuntimeProjectionSourcePublicationInput,
  RuntimeProjectionSourcePublicationRejectionReason,
  RuntimeProjectionSourcePublicationResult,
  RuntimeProjectionSourcePublisherStore,
} from './runtime-projection-source-publisher.js';

interface RuntimeProjectionSourcePublicationRow extends Record<string, unknown> {
  readonly value: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const PERSONAS = new Set<RuntimeProjectionPersona>(['admin', 'teacher', 'guardian', 'student']);
const REJECTION_REASONS = new Set<RuntimeProjectionSourcePublicationRejectionReason>([
  'invalid-publication',
  'scope-inactive',
  'persona-unmapped',
  'persona-ambiguous',
  'revision-conflict',
  'source-stale',
]);

function invalidResponse(): Error {
  return new Error('Runtime projection source publisher returned an invalid database response.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function validRevision(value: unknown, allowZero = false): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && (allowZero ? value >= 0 : value > 0)
  );
}

function validatePublication(value: unknown): RuntimeProjectionSourcePublication {
  if (!isRecord(value)) throw invalidResponse();
  const keys = [
    'publicationId',
    'tenantId',
    'membershipId',
    'campusId',
    'persona',
    'subjectRef',
    'sourceRevision',
    'payloadDigest',
    'payloadBytes',
    'correlationId',
    'publishedAt',
  ];
  if (
    !hasExactKeys(value, keys) ||
    !validUuid(value.publicationId) ||
    !validUuid(value.tenantId) ||
    !validUuid(value.membershipId) ||
    !(value.campusId === null || validUuid(value.campusId)) ||
    typeof value.persona !== 'string' ||
    !PERSONAS.has(value.persona as RuntimeProjectionPersona) ||
    typeof value.subjectRef !== 'string' ||
    !/^(?:account|person):[0-9a-f-]{36}$/u.test(value.subjectRef) ||
    !validRevision(value.sourceRevision) ||
    typeof value.payloadDigest !== 'string' ||
    !DIGEST_PATTERN.test(value.payloadDigest) ||
    typeof value.payloadBytes !== 'number' ||
    !Number.isSafeInteger(value.payloadBytes) ||
    value.payloadBytes < 2 ||
    value.payloadBytes > 262_144 ||
    !validUuid(value.correlationId) ||
    !validTimestamp(value.publishedAt)
  ) {
    throw invalidResponse();
  }
  return {
    publicationId: value.publicationId,
    tenantId: value.tenantId,
    membershipId: value.membershipId,
    campusId: value.campusId,
    persona: value.persona as RuntimeProjectionPersona,
    subjectRef: value.subjectRef,
    sourceRevision: value.sourceRevision,
    payloadDigest: value.payloadDigest,
    payloadBytes: value.payloadBytes,
    correlationId: value.correlationId,
    publishedAt: value.publishedAt,
  };
}

function validateResult(value: unknown): RuntimeProjectionSourcePublicationResult {
  if (!isRecord(value) || typeof value.published !== 'boolean') throw invalidResponse();
  if (value.published) {
    if (!hasExactKeys(value, ['published', 'publication'])) throw invalidResponse();
    return { published: true, publication: validatePublication(value.publication) };
  }
  if (typeof value.reason !== 'string' || !REJECTION_REASONS.has(value.reason as never)) {
    throw invalidResponse();
  }
  if (value.reason === 'revision-conflict') {
    if (
      !hasExactKeys(value, ['published', 'reason', 'currentRevision']) ||
      !validRevision(value.currentRevision, true)
    ) {
      throw invalidResponse();
    }
    return {
      published: false,
      reason: 'revision-conflict',
      currentRevision: value.currentRevision,
    };
  }
  if (!hasExactKeys(value, ['published', 'reason'])) throw invalidResponse();
  return {
    published: false,
    reason: value.reason as RuntimeProjectionSourcePublicationRejectionReason,
  };
}

export class DatabaseProjectionSourcePublisherStore implements RuntimeProjectionSourcePublisherStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async publish(
    input: RuntimeProjectionSourcePublicationInput,
  ): Promise<RuntimeProjectionSourcePublicationResult> {
    const rows = await this.#database.query<RuntimeProjectionSourcePublicationRow>(
      `SELECT platform.publish_runtime_projection_source(
         $1::uuid,
         $2::uuid,
         $3::uuid,
         $4::bigint,
         $5::jsonb,
         $6::timestamptz,
         $7::text,
         $8::uuid
       ) AS value`,
      [
        input.tenantId,
        input.membershipId,
        input.campusId,
        input.expectedPreviousRevision,
        JSON.stringify(input.payload),
        input.sourceUpdatedAt,
        input.publisherId,
        input.correlationId,
      ],
    );
    const row = rows[0];
    if (rows.length !== 1 || row === undefined) throw invalidResponse();
    return validateResult(row.value);
  }
}
