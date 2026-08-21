export interface FamilyFormSubmissionInput {
  readonly studentId: string;
  readonly schemaVersion: number;
  readonly baseVersion: number;
  readonly answers: Readonly<Record<string, string | boolean | null>>;
}

export interface FamilyConsentDecisionInput {
  readonly studentId: string;
  readonly policyVersion: string;
  readonly decision: 'grant' | 'decline';
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const FORM_SUBMISSION_KEYS = new Set(['studentId', 'schemaVersion', 'baseVersion', 'answers']);
const CONSENT_DECISION_KEYS = new Set(['studentId', 'policyVersion', 'decision']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonRecord(text: string | undefined): Record<string, unknown> | undefined {
  if (text === undefined || text.trim() === '') return undefined;
  try {
    const decoded = JSON.parse(text) as unknown;
    return isRecord(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function hasExactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function safeInteger(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validPolicyVersion(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (normalized === '' || normalized.length > 128 || normalized !== value) return false;
  return [...normalized].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 33 && code <= 126;
  });
}

export function isMobileFamilyInteractionIdempotencyKey(
  value: string | undefined,
): value is string {
  return value !== undefined && IDEMPOTENCY_KEY_PATTERN.test(value);
}

export function parseFamilyFormSubmission(
  text: string | undefined,
): FamilyFormSubmissionInput | undefined {
  const decoded = parseJsonRecord(text);
  if (decoded === undefined || !hasExactKeys(decoded, FORM_SUBMISSION_KEYS)) return undefined;
  if (
    !validUuid(decoded.studentId) ||
    !safeInteger(decoded.schemaVersion, 1) ||
    !safeInteger(decoded.baseVersion, 0) ||
    !isRecord(decoded.answers)
  ) {
    return undefined;
  }
  const entries = Object.entries(decoded.answers);
  if (entries.length > 128) return undefined;
  const answers: Record<string, string | boolean | null> = {};
  for (const [fieldId, value] of entries) {
    if (!IDENTIFIER_PATTERN.test(fieldId)) return undefined;
    if (value === null || typeof value === 'boolean') {
      answers[fieldId] = value;
      continue;
    }
    if (typeof value !== 'string' || value.length > 4000) return undefined;
    answers[fieldId] = value;
  }
  return {
    studentId: decoded.studentId,
    schemaVersion: decoded.schemaVersion,
    baseVersion: decoded.baseVersion,
    answers,
  };
}

export function parseFamilyConsentDecision(
  text: string | undefined,
): FamilyConsentDecisionInput | undefined {
  const decoded = parseJsonRecord(text);
  if (decoded === undefined || !hasExactKeys(decoded, CONSENT_DECISION_KEYS)) return undefined;
  if (
    !validUuid(decoded.studentId) ||
    !validPolicyVersion(decoded.policyVersion) ||
    (decoded.decision !== 'grant' && decoded.decision !== 'decline')
  ) {
    return undefined;
  }
  return {
    studentId: decoded.studentId,
    policyVersion: decoded.policyVersion,
    decision: decoded.decision,
  };
}
