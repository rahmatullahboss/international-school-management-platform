export interface MobileDeviceSessionRegistrationInput {
  readonly installationId: string;
  readonly application: 'family' | 'staff';
  readonly platform: 'android' | 'ios';
  readonly appVersion: string;
  readonly pushProvider: 'firebase' | 'apns';
  readonly notificationEnvironment: 'development' | 'production';
  readonly pushToken: string;
}

const INSTALLATION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const MAX_PUSH_TOKEN_LENGTH = 4096;
const EXPECTED_KEYS = new Set([
  'installationId',
  'application',
  'platform',
  'appVersion',
  'pushProvider',
  'notificationEnvironment',
  'pushToken',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length === EXPECTED_KEYS.size && keys.every((key) => EXPECTED_KEYS.has(key));
}

export function isMobileDeviceSessionIdempotencyKey(value: string | undefined): value is string {
  return value !== undefined && IDEMPOTENCY_KEY_PATTERN.test(value);
}

export function parseMobileDeviceSessionRegistration(
  text: string | undefined,
): MobileDeviceSessionRegistrationInput | undefined {
  if (text === undefined || text.trim() === '') return undefined;
  let decoded: unknown;
  try {
    decoded = JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
  if (!isRecord(decoded) || !exactKeys(decoded)) return undefined;

  const installationId = decoded.installationId;
  const application = decoded.application;
  const platform = decoded.platform;
  const appVersion = decoded.appVersion;
  const pushProvider = decoded.pushProvider;
  const notificationEnvironment = decoded.notificationEnvironment;
  const pushToken = decoded.pushToken;

  if (typeof installationId !== 'string' || !INSTALLATION_ID_PATTERN.test(installationId)) {
    return undefined;
  }
  if (application !== 'family' && application !== 'staff') return undefined;
  if (platform !== 'android' && platform !== 'ios') return undefined;
  if (typeof appVersion !== 'string' || appVersion.trim() === '' || appVersion.length > 64) {
    return undefined;
  }
  if (pushProvider !== 'firebase' && pushProvider !== 'apns') return undefined;
  if (notificationEnvironment !== 'development' && notificationEnvironment !== 'production') {
    return undefined;
  }
  if (
    typeof pushToken !== 'string' ||
    pushToken.length < 1 ||
    pushToken.length > MAX_PUSH_TOKEN_LENGTH
  ) {
    return undefined;
  }
  if (
    (platform === 'android' && pushProvider !== 'firebase') ||
    (platform === 'ios' && pushProvider !== 'apns')
  ) {
    return undefined;
  }

  return {
    installationId,
    application,
    platform,
    appVersion: appVersion.trim(),
    pushProvider,
    notificationEnvironment,
    pushToken,
  };
}

export function isEmptyMobileMutationBody(text: string | undefined): boolean {
  if (text === undefined) return false;
  try {
    const decoded = JSON.parse(text) as unknown;
    return isRecord(decoded) && Object.keys(decoded).length === 0;
  } catch {
    return false;
  }
}

export function mobileDeviceSessionDatabaseErrorCode(
  error: unknown,
): 'idempotency_conflict' | undefined {
  if (!(error instanceof Error)) return undefined;
  return error.message.includes('MOBILE_DEVICE_SESSION_IDEMPOTENCY_CONFLICT')
    ? 'idempotency_conflict'
    : undefined;
}
