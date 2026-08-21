export type MobileNotificationApplication = 'family' | 'staff';
export type MobileNotificationEnvironment = 'development' | 'production';
export type MobileNotificationPersona = 'guardian' | 'student' | 'teacher';
export type MobileNotificationKind =
  | 'familyHome'
  | 'familyAttendance'
  | 'familyResults'
  | 'familyFees'
  | 'familyDocuments'
  | 'familyForms'
  | 'familyConsent'
  | 'familyMessages'
  | 'familyConversation'
  | 'staffToday'
  | 'staffAttendance'
  | 'staffGradebook'
  | 'staffMessages';

export interface MobileNotificationIssuanceInput {
  readonly accountId: string;
  readonly application: MobileNotificationApplication;
  readonly campusId: string;
  readonly expiresAt: string;
  readonly kind: MobileNotificationKind;
  readonly notificationEnvironment: MobileNotificationEnvironment;
  readonly notificationKey: string;
  readonly persona: MobileNotificationPersona;
  readonly resourceId: string | null;
  readonly tenantId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/u;
const NOTIFICATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const maximumLifetimeMilliseconds = 24 * 60 * 60 * 1000;
const expectedKeys = new Set([
  'accountId',
  'application',
  'campusId',
  'expiresAt',
  'kind',
  'notificationEnvironment',
  'notificationKey',
  'persona',
  'resourceId',
  'tenantId',
]);
const familyKinds = new Set<MobileNotificationKind>([
  'familyHome',
  'familyAttendance',
  'familyResults',
  'familyFees',
  'familyDocuments',
  'familyForms',
  'familyConsent',
  'familyMessages',
  'familyConversation',
]);
const staffKinds = new Set<MobileNotificationKind>([
  'staffToday',
  'staffAttendance',
  'staffGradebook',
  'staffMessages',
]);
const resourceKinds = new Set<MobileNotificationKind>(['familyForms', 'familyConversation']);
const guardianOnlyKinds = new Set<MobileNotificationKind>([
  'familyFees',
  'familyConsent',
  'familyForms',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactRecord(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.size || keys.some((key) => !expectedKeys.has(key))) {
    return undefined;
  }
  return value;
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    IDENTIFIER_PATTERN.test(value) &&
    !value.includes('://') &&
    value.trim() === value
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isCanonicalFutureExpiry(value: unknown, now: Date): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) return false;
  const lifetime = parsed.getTime() - now.getTime();
  return lifetime > 0 && lifetime <= maximumLifetimeMilliseconds;
}

function kindPolicy(
  application: unknown,
  persona: unknown,
  kind: unknown,
  resourceId: unknown,
): kind is MobileNotificationKind {
  if (application !== 'family' && application !== 'staff') {
    return false;
  }
  if (persona !== 'guardian' && persona !== 'student' && persona !== 'teacher') return false;
  if (
    typeof kind !== 'string' ||
    (!familyKinds.has(kind as MobileNotificationKind) &&
      !staffKinds.has(kind as MobileNotificationKind))
  ) {
    return false;
  }
  const typedKind = kind as MobileNotificationKind;
  if (application === 'family') {
    if (!familyKinds.has(typedKind) || (persona !== 'guardian' && persona !== 'student'))
      return false;
  } else if (!staffKinds.has(typedKind) || persona !== 'teacher') {
    return false;
  }
  if (guardianOnlyKinds.has(typedKind) && persona !== 'guardian') return false;
  if (resourceId === null) return true;
  return resourceKinds.has(typedKind) && isIdentifier(resourceId);
}

export function parseMobileNotificationIssuance(
  body: string,
  now: Date = new Date(),
): MobileNotificationIssuanceInput | undefined {
  if (!Number.isFinite(now.getTime())) return undefined;
  let decoded: unknown;
  try {
    decoded = JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
  const input = exactRecord(decoded);
  if (input === undefined) return undefined;
  if (
    !isUuid(input.accountId) ||
    !isUuid(input.tenantId) ||
    !isUuid(input.campusId) ||
    !isCanonicalFutureExpiry(input.expiresAt, now) ||
    (input.notificationEnvironment !== 'development' &&
      input.notificationEnvironment !== 'production') ||
    typeof input.notificationKey !== 'string' ||
    !NOTIFICATION_KEY_PATTERN.test(input.notificationKey) ||
    input.notificationKey.trim() !== input.notificationKey ||
    !kindPolicy(input.application, input.persona, input.kind, input.resourceId)
  ) {
    return undefined;
  }
  return {
    accountId: input.accountId,
    application: input.application as MobileNotificationApplication,
    campusId: input.campusId,
    expiresAt: input.expiresAt,
    kind: input.kind,
    notificationEnvironment: input.notificationEnvironment,
    notificationKey: input.notificationKey,
    persona: input.persona as MobileNotificationPersona,
    resourceId: input.resourceId as string | null,
    tenantId: input.tenantId,
  };
}
