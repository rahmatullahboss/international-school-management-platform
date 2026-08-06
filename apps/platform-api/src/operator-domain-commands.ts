export type OperatorDomainCommandName =
  | 'admissions.application.review.record'
  | 'finance.bank-line.reconcile'
  | 'support.break-glass.request';

interface OperatorDomainCommandBase {
  readonly sessionId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly command: OperatorDomainCommandName;
}

export interface AdmissionsApplicationReviewCommand extends OperatorDomainCommandBase {
  readonly command: 'admissions.application.review.record';
  readonly applicationId: string;
  readonly expectedVersion: number;
  readonly recommendation: 'admit' | 'waitlist' | 'decline' | 'more-information';
  readonly score: number | null;
  readonly notes: string | null;
}

export interface FinanceBankLineReconcileCommand extends OperatorDomainCommandBase {
  readonly command: 'finance.bank-line.reconcile';
  readonly bankStatementLineId: string;
  readonly paymentId: string;
  readonly reason: string;
}

export interface SupportBreakGlassRequestCommand extends OperatorDomainCommandBase {
  readonly command: 'support.break-glass.request';
  readonly reason: string;
  readonly requestedMinutes: number;
}

export type OperatorDomainCommandInput =
  | AdmissionsApplicationReviewCommand
  | FinanceBankLineReconcileCommand
  | SupportBreakGlassRequestCommand;

export interface OperatorDomainCommandReceipt {
  readonly commandId: string;
  readonly command: OperatorDomainCommandName;
  readonly domainEvidenceId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly acceptedAt: string;
}

export type OperatorDomainCommandRejectionReason =
  | 'invalid-command'
  | 'session-inactive'
  | 'permission-not-granted'
  | 'step-up-required'
  | 'idempotency-conflict'
  | 'scope-not-found'
  | 'revision-conflict'
  | 'domain-conflict';

export type OperatorDomainCommandResult =
  | {
      readonly accepted: true;
      readonly replayed: boolean;
      readonly receipt: OperatorDomainCommandReceipt;
    }
  | {
      readonly accepted: false;
      readonly reason: OperatorDomainCommandRejectionReason;
      readonly requiredAssurance?: 'aal2';
      readonly currentVersion?: number;
    };

export interface OperatorDomainCommandStore {
  readonly submit: (input: OperatorDomainCommandInput) => Promise<OperatorDomainCommandResult>;
}

export type OperatorDomainCommandResolution =
  | OperatorDomainCommandResult
  | {
      readonly accepted: false;
      readonly reason: 'command-disabled' | 'command-unavailable';
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const ADMISSIONS_RECOMMENDATIONS = new Set(['admit', 'waitlist', 'decline', 'more-information']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validCommon(value: Record<string, unknown>): boolean {
  return (
    validUuid(value.sessionId) &&
    typeof value.idempotencyKey === 'string' &&
    IDEMPOTENCY_KEY_PATTERN.test(value.idempotencyKey) &&
    validUuid(value.correlationId)
  );
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
}

function validBoundedText(value: unknown, minimum: number, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.trim() === value
  );
}

function validateAdmissions(
  value: Record<string, unknown>,
): AdmissionsApplicationReviewCommand | undefined {
  const expectedKeys = [
    'sessionId',
    'idempotencyKey',
    'correlationId',
    'command',
    'applicationId',
    'expectedVersion',
    'recommendation',
    'score',
    'notes',
  ];
  if (!hasExactKeys(value, expectedKeys) || !validCommon(value)) return undefined;
  if (
    value.command !== 'admissions.application.review.record' ||
    !validUuid(value.applicationId) ||
    typeof value.expectedVersion !== 'number' ||
    !Number.isSafeInteger(value.expectedVersion) ||
    value.expectedVersion < 1 ||
    typeof value.recommendation !== 'string' ||
    !ADMISSIONS_RECOMMENDATIONS.has(value.recommendation) ||
    !(
      value.score === null ||
      (typeof value.score === 'number' &&
        Number.isFinite(value.score) &&
        value.score >= 0 &&
        value.score <= 100)
    ) ||
    !(value.notes === null || validBoundedText(value.notes, 1, 2000))
  ) {
    return undefined;
  }
  return value as unknown as AdmissionsApplicationReviewCommand;
}

function validateFinance(
  value: Record<string, unknown>,
): FinanceBankLineReconcileCommand | undefined {
  const expectedKeys = [
    'sessionId',
    'idempotencyKey',
    'correlationId',
    'command',
    'bankStatementLineId',
    'paymentId',
    'reason',
  ];
  if (!hasExactKeys(value, expectedKeys) || !validCommon(value)) return undefined;
  if (
    value.command !== 'finance.bank-line.reconcile' ||
    !validUuid(value.bankStatementLineId) ||
    !validUuid(value.paymentId) ||
    !validBoundedText(value.reason, 8, 500)
  ) {
    return undefined;
  }
  return value as unknown as FinanceBankLineReconcileCommand;
}

function validateSupport(
  value: Record<string, unknown>,
): SupportBreakGlassRequestCommand | undefined {
  const expectedKeys = [
    'sessionId',
    'idempotencyKey',
    'correlationId',
    'command',
    'reason',
    'requestedMinutes',
  ];
  if (!hasExactKeys(value, expectedKeys) || !validCommon(value)) return undefined;
  if (
    value.command !== 'support.break-glass.request' ||
    !validBoundedText(value.reason, 8, 500) ||
    typeof value.requestedMinutes !== 'number' ||
    !Number.isSafeInteger(value.requestedMinutes) ||
    value.requestedMinutes < 5 ||
    value.requestedMinutes > 30
  ) {
    return undefined;
  }
  return value as unknown as SupportBreakGlassRequestCommand;
}

function validateInput(value: unknown): OperatorDomainCommandInput | undefined {
  if (!isRecord(value) || typeof value.command !== 'string') return undefined;
  if (value.command === 'admissions.application.review.record') return validateAdmissions(value);
  if (value.command === 'finance.bank-line.reconcile') return validateFinance(value);
  if (value.command === 'support.break-glass.request') return validateSupport(value);
  return undefined;
}

export async function submitOperatorDomainCommand(options: {
  readonly configured: boolean;
  readonly input: unknown;
  readonly store: OperatorDomainCommandStore;
}): Promise<OperatorDomainCommandResolution> {
  if (!options.configured) return { accepted: false, reason: 'command-disabled' };
  const input = validateInput(options.input);
  if (input === undefined) return { accepted: false, reason: 'invalid-command' };
  try {
    return await options.store.submit(input);
  } catch {
    return { accepted: false, reason: 'command-unavailable' };
  }
}
