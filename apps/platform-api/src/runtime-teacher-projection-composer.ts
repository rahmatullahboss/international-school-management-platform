export interface TeacherRuntimeProjectionCompositionInput {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly campusId: string;
  readonly expectedPreviousRevision: number;
  readonly composerId: string;
  readonly correlationId: string;
}

export interface TeacherRuntimeProjectionComposition {
  readonly compositionId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly campusId: string;
  readonly state: 'published' | 'unchanged';
  readonly sourceRevision: number;
  readonly payloadDigest: string;
  readonly payloadBytes: number;
  readonly correlationId: string;
  readonly composedAt: string;
}

export type TeacherRuntimeProjectionCompositionRejectionReason =
  | 'invalid-composition'
  | 'scope-inactive'
  | 'persona-not-teacher'
  | 'staff-unlinked'
  | 'revision-conflict'
  | 'publisher-rejected';

export type TeacherRuntimeProjectionCompositionResult =
  | {
      readonly composed: true;
      readonly composition: TeacherRuntimeProjectionComposition;
    }
  | {
      readonly composed: false;
      readonly reason: TeacherRuntimeProjectionCompositionRejectionReason;
      readonly currentRevision?: number;
    };

export interface TeacherRuntimeProjectionComposerStore {
  compose(
    input: TeacherRuntimeProjectionCompositionInput,
  ): Promise<TeacherRuntimeProjectionCompositionResult>;
}

export type TeacherRuntimeProjectionComposerResolution =
  | TeacherRuntimeProjectionCompositionResult
  | {
      readonly composed: false;
      readonly reason: 'composer-disabled' | 'composer-unavailable';
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const COMPOSER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validateInput(value: unknown): TeacherRuntimeProjectionCompositionInput | undefined {
  if (!isRecord(value)) return undefined;
  const expectedKeys = [
    'tenantId',
    'membershipId',
    'campusId',
    'expectedPreviousRevision',
    'composerId',
    'correlationId',
  ];
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    return undefined;
  }
  if (
    !validUuid(value.tenantId) ||
    !validUuid(value.membershipId) ||
    !validUuid(value.campusId) ||
    typeof value.expectedPreviousRevision !== 'number' ||
    !Number.isSafeInteger(value.expectedPreviousRevision) ||
    value.expectedPreviousRevision < 0 ||
    typeof value.composerId !== 'string' ||
    !COMPOSER_ID_PATTERN.test(value.composerId) ||
    !validUuid(value.correlationId)
  ) {
    return undefined;
  }
  return {
    tenantId: value.tenantId,
    membershipId: value.membershipId,
    campusId: value.campusId,
    expectedPreviousRevision: value.expectedPreviousRevision,
    composerId: value.composerId,
    correlationId: value.correlationId,
  };
}

export async function composeTeacherRuntimeProjection(options: {
  readonly configured: boolean;
  readonly input: unknown;
  readonly store: TeacherRuntimeProjectionComposerStore;
}): Promise<TeacherRuntimeProjectionComposerResolution> {
  if (!options.configured) return { composed: false, reason: 'composer-disabled' };
  const input = validateInput(options.input);
  if (input === undefined) return { composed: false, reason: 'invalid-composition' };
  try {
    return await options.store.compose(input);
  } catch {
    return { composed: false, reason: 'composer-unavailable' };
  }
}
