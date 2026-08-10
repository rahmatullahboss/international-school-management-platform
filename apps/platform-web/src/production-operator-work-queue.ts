export type AdmissionsLifecycleAction =
  'review' | 'issue-offer' | 'accept-offer' | 'convert-applicant';

export interface AdmissionsPlacementOption {
  readonly programId: string;
  readonly programName: string;
  readonly academicYearId: string;
  readonly academicYearName: string;
  readonly gradeLevelId: string;
  readonly gradeLevelLabel: string;
}

export interface AdmissionsLifecycleCandidate {
  readonly applicationId: string;
  readonly applicationNumber: string;
  readonly status: 'submitted' | 'under-review' | 'offered' | 'accepted';
  readonly version: number;
  readonly submittedAt: string | null;
  readonly action: AdmissionsLifecycleAction;
  readonly placementOptions: readonly AdmissionsPlacementOption[];
  readonly offerExpiresAt: string | null;
  readonly suggestedEffectiveFrom: string | null;
}

export interface FinanceReconciliationCandidate {
  readonly bankStatementLineId: string;
  readonly bookingDate: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly paymentId: string;
  readonly paymentReceivedAt: string;
}

export type ProductionOperatorWorkQueue =
  | {
      readonly state: 'ready';
      readonly role: 'admissions';
      readonly items: readonly AdmissionsLifecycleCandidate[];
    }
  | {
      readonly state: 'ready';
      readonly role: 'finance';
      readonly items: readonly FinanceReconciliationCandidate[];
    }
  | {
      readonly state: 'denied' | 'unavailable';
      readonly message: string;
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validDate(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function boundedLabel(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value
  );
}

function placementOption(value: unknown): AdmissionsPlacementOption | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.programId !== 'string' ||
    !UUID_PATTERN.test(value.programId) ||
    !boundedLabel(value.programName) ||
    typeof value.academicYearId !== 'string' ||
    !UUID_PATTERN.test(value.academicYearId) ||
    !boundedLabel(value.academicYearName) ||
    typeof value.gradeLevelId !== 'string' ||
    !UUID_PATTERN.test(value.gradeLevelId) ||
    !boundedLabel(value.gradeLevelLabel)
  ) {
    return undefined;
  }
  return {
    programId: value.programId,
    programName: value.programName,
    academicYearId: value.academicYearId,
    academicYearName: value.academicYearName,
    gradeLevelId: value.gradeLevelId,
    gradeLevelLabel: value.gradeLevelLabel,
  };
}

function admissionsCandidate(value: unknown): AdmissionsLifecycleCandidate | undefined {
  if (!isRecord(value) || !Array.isArray(value.placementOptions)) return undefined;
  const options = value.placementOptions.map(placementOption);
  if (options.some((option) => option === undefined)) return undefined;
  if (
    typeof value.applicationId !== 'string' ||
    !UUID_PATTERN.test(value.applicationId) ||
    typeof value.applicationNumber !== 'string' ||
    value.applicationNumber.length < 1 ||
    value.applicationNumber.length > 128 ||
    value.applicationNumber.trim() !== value.applicationNumber ||
    !['submitted', 'under-review', 'offered', 'accepted'].includes(String(value.status)) ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    !(
      value.submittedAt === null ||
      (typeof value.submittedAt === 'string' && validTimestamp(value.submittedAt))
    ) ||
    !['review', 'issue-offer', 'accept-offer', 'convert-applicant'].includes(
      String(value.action),
    ) ||
    value.placementOptions.length > 50 ||
    !(
      value.offerExpiresAt === null ||
      (typeof value.offerExpiresAt === 'string' && validTimestamp(value.offerExpiresAt))
    ) ||
    !(
      value.suggestedEffectiveFrom === null ||
      (typeof value.suggestedEffectiveFrom === 'string' && validDate(value.suggestedEffectiveFrom))
    )
  ) {
    return undefined;
  }
  const stageValid =
    (value.action === 'review' &&
      (value.status === 'submitted' || value.status === 'under-review') &&
      options.length === 0 &&
      value.offerExpiresAt === null &&
      value.suggestedEffectiveFrom === null) ||
    (value.action === 'issue-offer' &&
      value.status === 'under-review' &&
      options.length > 0 &&
      value.offerExpiresAt === null &&
      value.suggestedEffectiveFrom === null) ||
    (value.action === 'accept-offer' &&
      value.status === 'offered' &&
      options.length === 0 &&
      typeof value.offerExpiresAt === 'string' &&
      value.suggestedEffectiveFrom === null) ||
    (value.action === 'convert-applicant' &&
      value.status === 'accepted' &&
      options.length === 0 &&
      value.offerExpiresAt === null &&
      typeof value.suggestedEffectiveFrom === 'string');
  if (!stageValid) return undefined;
  return {
    applicationId: value.applicationId,
    applicationNumber: value.applicationNumber,
    status: value.status as AdmissionsLifecycleCandidate['status'],
    version: value.version,
    submittedAt: value.submittedAt,
    action: value.action as AdmissionsLifecycleAction,
    placementOptions: options as AdmissionsPlacementOption[],
    offerExpiresAt: value.offerExpiresAt,
    suggestedEffectiveFrom: value.suggestedEffectiveFrom,
  };
}

function financeCandidate(value: unknown): FinanceReconciliationCandidate | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.bankStatementLineId !== 'string' ||
    !UUID_PATTERN.test(value.bankStatementLineId) ||
    typeof value.bookingDate !== 'string' ||
    !DATE_ONLY_PATTERN.test(value.bookingDate) ||
    typeof value.amountMinor !== 'string' ||
    !POSITIVE_INTEGER_PATTERN.test(value.amountMinor) ||
    typeof value.currency !== 'string' ||
    !/^[A-Z]{3}$/u.test(value.currency) ||
    typeof value.paymentId !== 'string' ||
    !UUID_PATTERN.test(value.paymentId) ||
    typeof value.paymentReceivedAt !== 'string' ||
    !validTimestamp(value.paymentReceivedAt)
  ) {
    return undefined;
  }
  return {
    bankStatementLineId: value.bankStatementLineId,
    bookingDate: value.bookingDate,
    amountMinor: value.amountMinor,
    currency: value.currency,
    paymentId: value.paymentId,
    paymentReceivedAt: value.paymentReceivedAt,
  };
}

function readyQueue(value: unknown): ProductionOperatorWorkQueue | undefined {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 25) return undefined;
  if (value.role === 'admissions' && value.schemaVersion === 2) {
    const items = value.items.map(admissionsCandidate);
    if (items.some((item) => item === undefined)) return undefined;
    return { state: 'ready', role: 'admissions', items: items as AdmissionsLifecycleCandidate[] };
  }
  if (value.role === 'finance' && value.schemaVersion === 1) {
    const items = value.items.map(financeCandidate);
    if (items.some((item) => item === undefined)) return undefined;
    return { state: 'ready', role: 'finance', items: items as FinanceReconciliationCandidate[] };
  }
  return undefined;
}

function boundedError(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.error) || typeof value.error.message !== 'string') {
    return undefined;
  }
  return value.error.message.length <= 200 ? value.error.message : undefined;
}

export async function loadProductionOperatorWorkQueue(): Promise<ProductionOperatorWorkQueue> {
  try {
    const response = await fetch('/auth/v1/operator/work-queue', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    const value: unknown = await response.json();
    if (response.ok) {
      return (
        readyQueue(value) ?? {
          state: 'unavailable',
          message: 'The work queue response could not be verified.',
        }
      );
    }
    return {
      state: response.status === 403 ? 'denied' : 'unavailable',
      message: boundedError(value) ?? 'The work queue is unavailable.',
    };
  } catch {
    return { state: 'unavailable', message: 'The work queue could not be reached.' };
  }
}
