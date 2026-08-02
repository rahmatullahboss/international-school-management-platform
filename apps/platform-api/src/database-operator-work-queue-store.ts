import type { HttpDatabase } from '@school/database';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;
const ADMISSIONS_STATUSES = new Set(['submitted', 'under-review']);

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

export type DatabaseOperatorWorkQueue =
  | {
      readonly schemaVersion: 1;
      readonly role: 'admissions';
      readonly items: readonly AdmissionsReviewCandidate[];
    }
  | {
      readonly schemaVersion: 1;
      readonly role: 'finance';
      readonly items: readonly FinanceReconciliationCandidate[];
    };

interface WorkQueueRow extends Record<string, unknown> {
  readonly queue: unknown;
}

function requireUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error('sessionId must be a UUID.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validateAdmissionsCandidate(value: unknown): AdmissionsReviewCandidate {
  if (!isRecord(value)) throw new Error('Operator work queue returned an invalid candidate.');
  const { applicationId, applicationNumber, status, version, submittedAt } = value;
  if (
    typeof applicationId !== 'string' ||
    !UUID_PATTERN.test(applicationId) ||
    typeof applicationNumber !== 'string' ||
    applicationNumber.length < 1 ||
    applicationNumber.length > 128 ||
    applicationNumber.trim() !== applicationNumber ||
    typeof status !== 'string' ||
    !ADMISSIONS_STATUSES.has(status) ||
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !(submittedAt === null || (typeof submittedAt === 'string' && validIsoTimestamp(submittedAt)))
  ) {
    throw new Error('Operator work queue returned an invalid admissions candidate.');
  }
  return {
    applicationId,
    applicationNumber,
    status: status as AdmissionsReviewCandidate['status'],
    version,
    submittedAt: submittedAt as string | null,
  };
}

function validateFinanceCandidate(value: unknown): FinanceReconciliationCandidate {
  if (!isRecord(value)) throw new Error('Operator work queue returned an invalid candidate.');
  const { bankStatementLineId, bookingDate, amountMinor, currency, paymentId, paymentReceivedAt } =
    value;
  if (
    typeof bankStatementLineId !== 'string' ||
    !UUID_PATTERN.test(bankStatementLineId) ||
    typeof bookingDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(bookingDate) ||
    typeof amountMinor !== 'string' ||
    !POSITIVE_INTEGER_PATTERN.test(amountMinor) ||
    typeof currency !== 'string' ||
    !/^[A-Z]{3}$/u.test(currency) ||
    typeof paymentId !== 'string' ||
    !UUID_PATTERN.test(paymentId) ||
    typeof paymentReceivedAt !== 'string' ||
    !validIsoTimestamp(paymentReceivedAt)
  ) {
    throw new Error('Operator work queue returned an invalid finance candidate.');
  }
  return {
    bankStatementLineId,
    bookingDate,
    amountMinor,
    currency,
    paymentId,
    paymentReceivedAt,
  };
}

function validateQueue(value: unknown): DatabaseOperatorWorkQueue {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.items)) {
    throw new Error('Operator work queue returned an invalid database response.');
  }
  if (value.items.length > 25) {
    throw new Error('Operator work queue exceeded the bounded candidate limit.');
  }
  if (value.role === 'admissions') {
    return {
      schemaVersion: 1,
      role: 'admissions',
      items: value.items.map(validateAdmissionsCandidate),
    };
  }
  if (value.role === 'finance') {
    return {
      schemaVersion: 1,
      role: 'finance',
      items: value.items.map(validateFinanceCandidate),
    };
  }
  throw new Error('Operator work queue returned an unsupported role.');
}

export class DatabaseOperatorWorkQueueStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async resolve(sessionId: string): Promise<DatabaseOperatorWorkQueue | undefined> {
    requireUuid(sessionId);
    const rows = await this.#database.query<WorkQueueRow>(
      `SELECT platform.resolve_operator_work_queue($1::uuid) AS queue`,
      [sessionId],
    );
    if (rows.length !== 1 || rows[0] === undefined) {
      throw new Error('Operator work queue returned an invalid database response.');
    }
    if (rows[0].queue === null) return undefined;
    return validateQueue(rows[0].queue);
  }
}
