export type RuntimeProjectionPersona = 'admin' | 'teacher' | 'guardian' | 'student';

export interface RuntimeProjectionSourcePublicationInput {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly campusId: string | null;
  readonly expectedPreviousRevision: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly sourceUpdatedAt: string;
  readonly publisherId: string;
  readonly correlationId: string;
}

export interface RuntimeProjectionSourcePublication {
  readonly publicationId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly campusId: string | null;
  readonly persona: RuntimeProjectionPersona;
  readonly subjectRef: string;
  readonly sourceRevision: number;
  readonly payloadDigest: string;
  readonly payloadBytes: number;
  readonly correlationId: string;
  readonly publishedAt: string;
}

export type RuntimeProjectionSourcePublicationRejectionReason =
  | 'invalid-publication'
  | 'scope-inactive'
  | 'persona-unmapped'
  | 'persona-ambiguous'
  | 'revision-conflict'
  | 'source-stale';

export type RuntimeProjectionSourcePublicationResult =
  | {
      readonly published: true;
      readonly publication: RuntimeProjectionSourcePublication;
    }
  | {
      readonly published: false;
      readonly reason: RuntimeProjectionSourcePublicationRejectionReason;
      readonly currentRevision?: number;
    };

export interface RuntimeProjectionSourcePublisherStore {
  publish(
    input: RuntimeProjectionSourcePublicationInput,
  ): Promise<RuntimeProjectionSourcePublicationResult>;
}

export type RuntimeProjectionSourcePublisherResolution =
  | RuntimeProjectionSourcePublicationResult
  | {
      readonly published: false;
      readonly reason: 'publisher-disabled' | 'publisher-unavailable';
    };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PUBLISHER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/u;
const MAX_PAYLOAD_BYTES = 262_144;
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'scope',
  'tenantId',
  'membershipId',
  'campusId',
  'role',
  'persona',
  'subjectId',
  'subjectRef',
  'capabilities',
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

function validateInput(value: unknown): RuntimeProjectionSourcePublicationInput | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  const expectedKeys = [
    'tenantId',
    'membershipId',
    'campusId',
    'expectedPreviousRevision',
    'payload',
    'sourceUpdatedAt',
    'publisherId',
    'correlationId',
  ];
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    return undefined;
  }
  if (
    !validUuid(value.tenantId) ||
    !validUuid(value.membershipId) ||
    !(value.campusId === null || validUuid(value.campusId)) ||
    typeof value.expectedPreviousRevision !== 'number' ||
    !Number.isSafeInteger(value.expectedPreviousRevision) ||
    value.expectedPreviousRevision < 0 ||
    !isRecord(value.payload) ||
    Object.keys(value.payload).length === 0 ||
    Object.keys(value.payload).some((key) => FORBIDDEN_PAYLOAD_KEYS.has(key)) ||
    !validTimestamp(value.sourceUpdatedAt) ||
    typeof value.publisherId !== 'string' ||
    !PUBLISHER_ID_PATTERN.test(value.publisherId) ||
    !validUuid(value.correlationId)
  ) {
    return undefined;
  }

  let serializedPayload: string;
  try {
    serializedPayload = JSON.stringify(value.payload);
  } catch {
    return undefined;
  }
  const payloadBytes = new TextEncoder().encode(serializedPayload).byteLength;
  if (payloadBytes < 2 || payloadBytes > MAX_PAYLOAD_BYTES) return undefined;

  return {
    tenantId: value.tenantId,
    membershipId: value.membershipId,
    campusId: value.campusId,
    expectedPreviousRevision: value.expectedPreviousRevision,
    payload: value.payload,
    sourceUpdatedAt: value.sourceUpdatedAt,
    publisherId: value.publisherId,
    correlationId: value.correlationId,
  };
}

export async function publishRuntimeProjectionSource(options: {
  readonly configured: boolean;
  readonly input: unknown;
  readonly store: RuntimeProjectionSourcePublisherStore;
}): Promise<RuntimeProjectionSourcePublisherResolution> {
  if (!options.configured) return { published: false, reason: 'publisher-disabled' };
  const input = validateInput(options.input);
  if (input === undefined) return { published: false, reason: 'invalid-publication' };
  try {
    return await options.store.publish(input);
  } catch {
    return { published: false, reason: 'publisher-unavailable' };
  }
}
