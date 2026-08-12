export interface RuntimeProjectionDeadLetterRecoveryInput {
  readonly tenantId: string;
  readonly deadLetterId: string;
  readonly actorAccountId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly correlationId: string;
}

export interface RuntimeProjectionDeadLetterRecoveryReceipt {
  readonly recoveryId: string;
  readonly state: 'accepted';
  readonly deadLetterId: string;
  readonly originalEventId: string;
  readonly replacementEventId: string;
  readonly commandId: string;
  readonly errorCode: 'source-unavailable' | 'processor-error';
  readonly requestedAt: string;
}

export type RuntimeProjectionDeadLetterRecoveryRejectionReason =
  | 'permission-not-granted'
  | 'dead-letter-unavailable'
  | 'dead-letter-not-recoverable'
  | 'already-recovered'
  | 'already-applied'
  | 'projection-state-changed'
  | 'source-unavailable';

export type RuntimeProjectionDeadLetterRecoveryStoreResult =
  | {
      readonly accepted: true;
      readonly replayed: boolean;
      readonly receipt: RuntimeProjectionDeadLetterRecoveryReceipt;
    }
  | {
      readonly accepted: false;
      readonly reason: RuntimeProjectionDeadLetterRecoveryRejectionReason;
    };

export interface RuntimeProjectionDeadLetterRecoveryStore {
  recover(
    input: RuntimeProjectionDeadLetterRecoveryInput,
  ): Promise<RuntimeProjectionDeadLetterRecoveryStoreResult>;
}

export type RuntimeProjectionDeadLetterRecoveryResolution =
  | RuntimeProjectionDeadLetterRecoveryStoreResult
  | { readonly accepted: false; readonly reason: 'invalid-recovery-request' }
  | { readonly accepted: false; readonly reason: 'recovery-disabled' }
  | { readonly accepted: false; readonly reason: 'recovery-unavailable' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function validateInput(value: unknown): RuntimeProjectionDeadLetterRecoveryInput | undefined {
  if (!isRecord(value)) return undefined;
  const expectedKeys = [
    'tenantId',
    'deadLetterId',
    'actorAccountId',
    'idempotencyKey',
    'reason',
    'correlationId',
  ];
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    return undefined;
  }
  if (
    typeof value.tenantId !== 'string' ||
    !UUID_PATTERN.test(value.tenantId) ||
    typeof value.deadLetterId !== 'string' ||
    !UUID_PATTERN.test(value.deadLetterId) ||
    typeof value.actorAccountId !== 'string' ||
    !UUID_PATTERN.test(value.actorAccountId) ||
    typeof value.correlationId !== 'string' ||
    !UUID_PATTERN.test(value.correlationId) ||
    typeof value.idempotencyKey !== 'string' ||
    !IDEMPOTENCY_PATTERN.test(value.idempotencyKey) ||
    typeof value.reason !== 'string' ||
    value.reason.length < 1 ||
    value.reason.length > 500 ||
    value.reason !== value.reason.trim() ||
    hasControlCharacter(value.reason)
  ) {
    return undefined;
  }
  return {
    tenantId: value.tenantId,
    deadLetterId: value.deadLetterId,
    actorAccountId: value.actorAccountId,
    idempotencyKey: value.idempotencyKey,
    reason: value.reason,
    correlationId: value.correlationId,
  };
}

export async function recoverRuntimeProjectionDeadLetter(options: {
  readonly configured: boolean;
  readonly input: unknown;
  readonly store: RuntimeProjectionDeadLetterRecoveryStore;
}): Promise<RuntimeProjectionDeadLetterRecoveryResolution> {
  if (!options.configured) return { accepted: false, reason: 'recovery-disabled' };
  const input = validateInput(options.input);
  if (input === undefined) return { accepted: false, reason: 'invalid-recovery-request' };
  try {
    return await options.store.recover(input);
  } catch {
    return { accepted: false, reason: 'recovery-unavailable' };
  }
}
