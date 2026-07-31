import type { HttpDatabase } from '@school/database';

import type {
  AdminRuntimeProjectionComposition,
  AdminRuntimeProjectionCompositionInput,
  AdminRuntimeProjectionCompositionRejectionReason,
  AdminRuntimeProjectionCompositionResult,
} from './runtime-admin-projection-composer.js';

interface AdminCompositionRow extends Record<string, unknown> {
  readonly value: unknown;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const COMPOSITION_STATES = new Set(['published', 'unchanged']);
const REJECTION_REASONS = new Set<AdminRuntimeProjectionCompositionRejectionReason>([
  'invalid-composition',
  'scope-inactive',
  'persona-not-admin',
  'revision-conflict',
  'publisher-rejected',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validInteger(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function invalidResponse(): Error {
  return new Error('Admin runtime projection composer returned an invalid database response.');
}

function validateComposition(value: unknown): AdminRuntimeProjectionComposition {
  if (!isRecord(value)) throw invalidResponse();
  const keys = Object.keys(value);
  const expectedKeys = [
    'compositionId',
    'tenantId',
    'membershipId',
    'campusId',
    'state',
    'sourceRevision',
    'payloadDigest',
    'payloadBytes',
    'correlationId',
    'composedAt',
  ];
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    throw invalidResponse();
  }
  if (
    !validUuid(value.compositionId) ||
    !validUuid(value.tenantId) ||
    !validUuid(value.membershipId) ||
    !(value.campusId === null || validUuid(value.campusId)) ||
    typeof value.state !== 'string' ||
    !COMPOSITION_STATES.has(value.state) ||
    !validInteger(value.sourceRevision, 1) ||
    typeof value.payloadDigest !== 'string' ||
    !DIGEST_PATTERN.test(value.payloadDigest) ||
    !validInteger(value.payloadBytes, 2) ||
    value.payloadBytes > 262_144 ||
    !validUuid(value.correlationId) ||
    !validTimestamp(value.composedAt)
  ) {
    throw invalidResponse();
  }
  return {
    compositionId: value.compositionId,
    tenantId: value.tenantId,
    membershipId: value.membershipId,
    campusId: value.campusId,
    state: value.state as AdminRuntimeProjectionComposition['state'],
    sourceRevision: value.sourceRevision,
    payloadDigest: value.payloadDigest,
    payloadBytes: value.payloadBytes,
    correlationId: value.correlationId,
    composedAt: value.composedAt,
  };
}

function validateResult(value: unknown): AdminRuntimeProjectionCompositionResult {
  if (!isRecord(value) || typeof value.composed !== 'boolean') throw invalidResponse();
  if (value.composed) {
    if (Object.keys(value).length !== 2 || !('composition' in value)) throw invalidResponse();
    return { composed: true, composition: validateComposition(value.composition) };
  }
  const keys = Object.keys(value);
  if (
    typeof value.reason !== 'string' ||
    !REJECTION_REASONS.has(value.reason as AdminRuntimeProjectionCompositionRejectionReason) ||
    keys.some((key) => !['composed', 'reason', 'currentRevision'].includes(key)) ||
    keys.length < 2 ||
    keys.length > 3
  ) {
    throw invalidResponse();
  }
  if (value.reason === 'revision-conflict') {
    if (!validInteger(value.currentRevision, 0) || keys.length !== 3) throw invalidResponse();
    return {
      composed: false,
      reason: 'revision-conflict',
      currentRevision: value.currentRevision,
    };
  }
  if ('currentRevision' in value) throw invalidResponse();
  return {
    composed: false,
    reason: value.reason as Exclude<
      AdminRuntimeProjectionCompositionRejectionReason,
      'revision-conflict'
    >,
  };
}

export class DatabaseAdminProjectionComposerStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async compose(
    input: AdminRuntimeProjectionCompositionInput,
  ): Promise<AdminRuntimeProjectionCompositionResult> {
    const rows = await this.#database.query<AdminCompositionRow>(
      `SELECT platform.compose_admin_runtime_projection_source(
         $1::uuid,
         $2::uuid,
         $3::uuid,
         $4::bigint,
         $5::text,
         $6::uuid
       ) AS value`,
      [
        input.tenantId,
        input.membershipId,
        input.campusId,
        input.expectedPreviousRevision,
        input.composerId,
        input.correlationId,
      ],
    );
    const row = rows[0];
    if (rows.length !== 1 || row === undefined) throw invalidResponse();
    return validateResult(row.value);
  }
}
