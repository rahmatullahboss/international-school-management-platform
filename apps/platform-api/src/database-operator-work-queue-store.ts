import type { HttpDatabase } from '@school/database';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

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

export type DatabaseOperatorWorkQueue =
  | {
      readonly schemaVersion: 2;
      readonly role: 'admissions';
      readonly items: readonly AdmissionsLifecycleCandidate[];
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

function validDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function boundedLabel(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length >= 1 && value.length <= 160 && value.trim() === value
  );
}

function validatePlacementOption(value: unknown): AdmissionsPlacementOption {
  if (!isRecord(value))
    throw new Error('Operator work queue returned an invalid placement option.');
  const {
    programId,
    programName,
    academicYearId,
    academicYearName,
    gradeLevelId,
    gradeLevelLabel,
  } = value;
  if (
    typeof programId !== 'string' ||
    !UUID_PATTERN.test(programId) ||
    !boundedLabel(programName) ||
    typeof academicYearId !== 'string' ||
    !UUID_PATTERN.test(academicYearId) ||
    !boundedLabel(academicYearName) ||
    typeof gradeLevelId !== 'string' ||
    !UUID_PATTERN.test(gradeLevelId) ||
    !boundedLabel(gradeLevelLabel)
  ) {
    throw new Error('Operator work queue returned an invalid placement option.');
  }
  return {
    programId,
    programName,
    academicYearId,
    academicYearName,
    gradeLevelId,
    gradeLevelLabel,
  };
}

function validateAdmissionsCandidate(value: unknown): AdmissionsLifecycleCandidate {
  if (!isRecord(value)) throw new Error('Operator work queue returned an invalid candidate.');
  const {
    applicationId,
    applicationNumber,
    status,
    version,
    submittedAt,
    action,
    placementOptions,
    offerExpiresAt,
    suggestedEffectiveFrom,
  } = value;
  if (
    typeof applicationId !== 'string' ||
    !UUID_PATTERN.test(applicationId) ||
    typeof applicationNumber !== 'string' ||
    applicationNumber.length < 1 ||
    applicationNumber.length > 128 ||
    applicationNumber.trim() !== applicationNumber ||
    !['submitted', 'under-review', 'offered', 'accepted'].includes(String(status)) ||
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !(
      submittedAt === null ||
      (typeof submittedAt === 'string' && validIsoTimestamp(submittedAt))
    ) ||
    !['review', 'issue-offer', 'accept-offer', 'convert-applicant'].includes(String(action)) ||
    !Array.isArray(placementOptions) ||
    placementOptions.length > 50 ||
    !(
      offerExpiresAt === null ||
      (typeof offerExpiresAt === 'string' && validIsoTimestamp(offerExpiresAt))
    ) ||
    !(
      suggestedEffectiveFrom === null ||
      (typeof suggestedEffectiveFrom === 'string' && validDateOnly(suggestedEffectiveFrom))
    )
  ) {
    throw new Error('Operator work queue returned an invalid admissions candidate.');
  }
  const options = placementOptions.map(validatePlacementOption);
  const validStage =
    (action === 'review' &&
      (status === 'submitted' || status === 'under-review') &&
      options.length === 0 &&
      offerExpiresAt === null &&
      suggestedEffectiveFrom === null) ||
    (action === 'issue-offer' &&
      status === 'under-review' &&
      options.length > 0 &&
      offerExpiresAt === null &&
      suggestedEffectiveFrom === null) ||
    (action === 'accept-offer' &&
      status === 'offered' &&
      options.length === 0 &&
      typeof offerExpiresAt === 'string' &&
      suggestedEffectiveFrom === null) ||
    (action === 'convert-applicant' &&
      status === 'accepted' &&
      options.length === 0 &&
      offerExpiresAt === null &&
      typeof suggestedEffectiveFrom === 'string');
  if (!validStage)
    throw new Error('Operator work queue returned an invalid admissions lifecycle stage.');
  return {
    applicationId,
    applicationNumber,
    status,
    version,
    submittedAt,
    action,
    placementOptions: options,
    offerExpiresAt,
    suggestedEffectiveFrom,
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
    !DATE_ONLY_PATTERN.test(bookingDate) ||
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

function validateAdmissionsQueue(value: unknown): DatabaseOperatorWorkQueue {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.role !== 'admissions' ||
    !Array.isArray(value.items)
  ) {
    throw new Error('Operator work queue returned an invalid Admissions database response.');
  }
  if (value.items.length > 25)
    throw new Error('Operator work queue exceeded the bounded candidate limit.');
  return {
    schemaVersion: 2,
    role: 'admissions',
    items: value.items.map(validateAdmissionsCandidate),
  };
}

function validateLegacyQueue(value: unknown): DatabaseOperatorWorkQueue {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.items)) {
    throw new Error('Operator work queue returned an invalid database response.');
  }
  if (value.items.length > 25)
    throw new Error('Operator work queue exceeded the bounded candidate limit.');
  if (value.role === 'finance') {
    return {
      schemaVersion: 1,
      role: 'finance',
      items: value.items.map(validateFinanceCandidate),
    };
  }
  throw new Error('Operator work queue returned an unsupported legacy role.');
}

export class DatabaseOperatorWorkQueueStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async resolveAdmissions(sessionId: string): Promise<DatabaseOperatorWorkQueue | undefined> {
    requireUuid(sessionId);
    const rows = await this.#database.query<WorkQueueRow>(
      `SELECT platform.resolve_admissions_lifecycle_work_queue($1::uuid) AS queue`,
      [sessionId],
    );
    if (rows.length !== 1 || rows[0] === undefined) {
      throw new Error('Operator work queue returned an invalid database response.');
    }
    if (rows[0].queue === null) return undefined;
    return validateAdmissionsQueue(rows[0].queue);
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
    return validateLegacyQueue(rows[0].queue);
  }
}
