export interface AdmissionsReviewCandidate {
  readonly applicationId: string;
  readonly applicationNumber: string;
  readonly status: 'submitted' | 'under-review';
  readonly version: number;
  readonly submittedAt: string | null;
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
      readonly items: readonly AdmissionsReviewCandidate[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function admissionsCandidate(value: unknown): AdmissionsReviewCandidate | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.applicationId !== 'string' ||
    !UUID_PATTERN.test(value.applicationId) ||
    typeof value.applicationNumber !== 'string' ||
    value.applicationNumber.length < 1 ||
    value.applicationNumber.length > 128 ||
    value.applicationNumber.trim() !== value.applicationNumber ||
    (value.status !== 'submitted' && value.status !== 'under-review') ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    !(
      value.submittedAt === null ||
      (typeof value.submittedAt === 'string' && validTimestamp(value.submittedAt))
    )
  ) {
    return undefined;
  }
  return {
    applicationId: value.applicationId,
    applicationNumber: value.applicationNumber,
    status: value.status,
    version: value.version,
    submittedAt: value.submittedAt,
  };
}

function financeCandidate(value: unknown): FinanceReconciliationCandidate | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.bankStatementLineId !== 'string' ||
    !UUID_PATTERN.test(value.bankStatementLineId) ||
    typeof value.bookingDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value.bookingDate) ||
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
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.items) ||
    value.items.length > 25
  ) {
    return undefined;
  }
  if (value.role === 'admissions') {
    const items = value.items.map(admissionsCandidate);
    if (items.some((item) => item === undefined)) return undefined;
    return {
      state: 'ready',
      role: 'admissions',
      items: items as AdmissionsReviewCandidate[],
    };
  }
  if (value.role === 'finance') {
    const items = value.items.map(financeCandidate);
    if (items.some((item) => item === undefined)) return undefined;
    return {
      state: 'ready',
      role: 'finance',
      items: items as FinanceReconciliationCandidate[],
    };
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
    return {
      state: 'unavailable',
      message: 'The work queue could not be reached.',
    };
  }
}
