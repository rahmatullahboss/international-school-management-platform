import type { ApplicationStatus } from '../../admissions/src/contracts.js';
import type { EnrollmentStatus } from './contracts.js';

export interface AdmissionsReportRow {
  tenantId: string;
  applicationId: string;
  status: ApplicationStatus;
  cycleId: string;
  campusId?: string;
  programId?: string;
  submittedAt?: string;
  decisionAt?: string;
  convertedAt?: string;
}

export interface EnrollmentReportRow {
  tenantId: string;
  enrollmentId: string;
  studentProfileId: string;
  campusId: string;
  programId: string;
  academicYearId: string;
  gradeLevelId?: string;
  status: EnrollmentStatus;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface MovementReportRow {
  tenantId: string;
  movementId: string;
  studentProfileId: string;
  enrollmentId: string;
  movementType: 'transfer' | 'withdrawal' | 'promotion' | 're-enrollment' | 'alumni';
  effectiveAt: string;
  sourceCampusId?: string;
  destinationCampusId?: string;
  reasonCode?: string;
}

export interface GuardianQualityRow {
  tenantId: string;
  studentPersonId: string;
  guardianPersonId?: string;
  verified: boolean;
  portalAccess: boolean;
  communicationAuthority: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface AdmissionsFunnelReport {
  total: number;
  byStatus: Readonly<Record<ApplicationStatus, number>>;
  conversionRate: number;
  offerAcceptanceRate: number;
  medianDecisionDays?: number;
}

export interface EnrollmentSummaryReport {
  total: number;
  byStatus: Readonly<Record<EnrollmentStatus, number>>;
  byCampus: Readonly<Record<string, number>>;
  byProgram: Readonly<Record<string, number>>;
  byAcademicYear: Readonly<Record<string, number>>;
  current: number;
}

export interface MovementSummaryReport {
  total: number;
  byType: Readonly<Record<MovementReportRow['movementType'], number>>;
  byMonth: Readonly<Record<string, number>>;
}

export interface GuardianDataQualityReport {
  totalRelationships: number;
  studentsWithoutGuardian: number;
  unverifiedAuthorities: number;
  portalAccessWithoutVerification: number;
  communicationGaps: number;
}

export interface ReconciliationInput {
  tenantId: string;
  applications: readonly {
    applicationId: string;
    status: ApplicationStatus;
    applicantPersonId: string;
    studentProfileId?: string;
    enrollmentId?: string;
  }[];
  profiles: readonly {
    studentProfileId: string;
    personId: string;
    status: string;
  }[];
  enrollments: readonly {
    enrollmentId: string;
    studentProfileId: string;
    status: EnrollmentStatus;
  }[];
  guardianAuthorities: readonly {
    authorityId: string;
    studentPersonId: string;
    guardianPersonId: string;
    verified: boolean;
    portalAccess: boolean;
  }[];
}

export interface ReconciliationIssue {
  tenantId: string;
  issueId: string;
  issueType:
    | 'converted-application-missing-profile'
    | 'converted-application-missing-enrollment'
    | 'profile-missing-enrollment'
    | 'enrollment-missing-profile'
    | 'student-missing-guardian'
    | 'portal-authority-unverified';
  severity: 'warning' | 'error' | 'critical';
  entityReference: string;
  summary: string;
  detectedAt: string;
}

export interface ReportSnapshot<T> {
  tenantId: string;
  reportSnapshotId: string;
  reportKey: string;
  parameters: Readonly<Record<string, unknown>>;
  data: Readonly<T>;
  generatedAt: string;
  generatedByAccountId: string;
}

export class ReportingDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReportingDomainError';
  }
}

function emptyApplicationCounts(): Record<ApplicationStatus, number> {
  return {
    draft: 0,
    submitted: 0,
    'under-review': 0,
    waitlisted: 0,
    offered: 0,
    accepted: 0,
    declined: 0,
    withdrawn: 0,
    converted: 0,
  };
}

function emptyEnrollmentCounts(): Record<EnrollmentStatus, number> {
  return {
    pending: 0,
    active: 0,
    transferred: 0,
    withdrawn: 0,
    completed: 0,
    cancelled: 0,
  };
}

function emptyMovementCounts(): Record<MovementReportRow['movementType'], number> {
  return {
    transfer: 0,
    withdrawal: 0,
    promotion: 0,
    're-enrollment': 0,
    alumni: 0,
  };
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  const middle = sorted[midpoint];
  if (middle === undefined) return undefined;
  if (sorted.length % 2 === 1) return middle;
  const previous = sorted[midpoint - 1];
  return previous === undefined ? middle : (previous + middle) / 2;
}

function daysBetween(start: string, end: string): number | undefined {
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime)
    return undefined;
  return (endTime - startTime) / 86_400_000;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (nested !== null && typeof nested === 'object' && !Object.isFrozen(nested)) {
        deepFreeze(nested);
      }
    }
  }
  return value;
}

export function buildAdmissionsFunnel(
  tenantId: string,
  rows: readonly AdmissionsReportRow[],
): AdmissionsFunnelReport {
  const scoped = rows.filter((row) => row.tenantId === tenantId);
  const byStatus = emptyApplicationCounts();
  const decisionDays: number[] = [];
  for (const row of scoped) {
    byStatus[row.status] += 1;
    if (row.submittedAt !== undefined && row.decisionAt !== undefined) {
      const days = daysBetween(row.submittedAt, row.decisionAt);
      if (days !== undefined) decisionDays.push(days);
    }
  }
  const offeredOrBeyond = byStatus.offered + byStatus.accepted + byStatus.converted;
  const acceptedOrBeyond = byStatus.accepted + byStatus.converted;
  const submittedOrBeyond = scoped.filter((row) => row.status !== 'draft').length;
  const medianDecisionDays = median(decisionDays);
  return deepFreeze({
    total: scoped.length,
    byStatus,
    conversionRate: submittedOrBeyond === 0 ? 0 : byStatus.converted / submittedOrBeyond,
    offerAcceptanceRate: offeredOrBeyond === 0 ? 0 : acceptedOrBeyond / offeredOrBeyond,
    ...(medianDecisionDays === undefined ? {} : { medianDecisionDays }),
  });
}

export function buildEnrollmentSummary(
  tenantId: string,
  rows: readonly EnrollmentReportRow[],
  at: string,
): EnrollmentSummaryReport {
  const scoped = rows.filter((row) => row.tenantId === tenantId);
  const byStatus = emptyEnrollmentCounts();
  const byCampus: Record<string, number> = {};
  const byProgram: Record<string, number> = {};
  const byAcademicYear: Record<string, number> = {};
  let current = 0;
  for (const row of scoped) {
    byStatus[row.status] += 1;
    increment(byCampus, row.campusId);
    increment(byProgram, row.programId);
    increment(byAcademicYear, row.academicYearId);
    if (
      row.effectiveFrom <= at &&
      (row.effectiveTo === undefined || row.effectiveTo >= at) &&
      ['pending', 'active'].includes(row.status)
    ) {
      current += 1;
    }
  }
  return deepFreeze({
    total: scoped.length,
    byStatus,
    byCampus,
    byProgram,
    byAcademicYear,
    current,
  });
}

export function buildMovementSummary(
  tenantId: string,
  rows: readonly MovementReportRow[],
): MovementSummaryReport {
  const scoped = rows.filter((row) => row.tenantId === tenantId);
  const byType = emptyMovementCounts();
  const byMonth: Record<string, number> = {};
  for (const row of scoped) {
    byType[row.movementType] += 1;
    increment(byMonth, row.effectiveAt.slice(0, 7));
  }
  return deepFreeze({ total: scoped.length, byType, byMonth });
}

export function buildGuardianDataQuality(
  tenantId: string,
  knownStudentPersonIds: readonly string[],
  rows: readonly GuardianQualityRow[],
): GuardianDataQualityReport {
  const scoped = rows.filter((row) => row.tenantId === tenantId);
  const coveredStudents = new Set(
    scoped.filter((row) => row.guardianPersonId !== undefined).map((row) => row.studentPersonId),
  );
  return deepFreeze({
    totalRelationships: scoped.length,
    studentsWithoutGuardian: knownStudentPersonIds.filter(
      (studentId) => !coveredStudents.has(studentId),
    ).length,
    unverifiedAuthorities: scoped.filter((row) => !row.verified).length,
    portalAccessWithoutVerification: scoped.filter((row) => row.portalAccess && !row.verified)
      .length,
    communicationGaps: scoped.filter((row) => row.verified && !row.communicationAuthority).length,
  });
}

export function reconcileSis(input: ReconciliationInput): readonly ReconciliationIssue[] {
  const profileById = new Map(input.profiles.map((profile) => [profile.studentProfileId, profile]));
  const enrollmentById = new Map(
    input.enrollments.map((enrollment) => [enrollment.enrollmentId, enrollment]),
  );
  const enrollmentProfileIds = new Set(
    input.enrollments.map((enrollment) => enrollment.studentProfileId),
  );
  const guardianStudentIds = new Set(
    input.guardianAuthorities.map((authority) => authority.studentPersonId),
  );
  const detectedAt = new Date().toISOString();
  const issues: ReconciliationIssue[] = [];
  const push = (
    issueType: ReconciliationIssue['issueType'],
    severity: ReconciliationIssue['severity'],
    entityReference: string,
    summary: string,
  ): void => {
    issues.push({
      tenantId: input.tenantId,
      issueId: crypto.randomUUID(),
      issueType,
      severity,
      entityReference,
      summary,
      detectedAt,
    });
  };

  for (const application of input.applications) {
    if (application.status !== 'converted') continue;
    if (
      application.studentProfileId === undefined ||
      !profileById.has(application.studentProfileId)
    ) {
      push(
        'converted-application-missing-profile',
        'critical',
        application.applicationId,
        'Converted application does not reconcile to a student profile',
      );
    }
    if (application.enrollmentId === undefined || !enrollmentById.has(application.enrollmentId)) {
      push(
        'converted-application-missing-enrollment',
        'critical',
        application.applicationId,
        'Converted application does not reconcile to an enrollment',
      );
    }
  }

  for (const profile of input.profiles) {
    if (
      ['active', 'leave'].includes(profile.status) &&
      !enrollmentProfileIds.has(profile.studentProfileId)
    ) {
      push(
        'profile-missing-enrollment',
        'error',
        profile.studentProfileId,
        'Active student profile has no enrollment',
      );
    }
    if (!guardianStudentIds.has(profile.personId)) {
      push(
        'student-missing-guardian',
        'warning',
        profile.studentProfileId,
        'Student profile has no guardian authority record',
      );
    }
  }

  for (const enrollment of input.enrollments) {
    if (!profileById.has(enrollment.studentProfileId)) {
      push(
        'enrollment-missing-profile',
        'critical',
        enrollment.enrollmentId,
        'Enrollment references a missing student profile',
      );
    }
  }

  for (const authority of input.guardianAuthorities) {
    if (authority.portalAccess && !authority.verified) {
      push(
        'portal-authority-unverified',
        'critical',
        authority.authorityId,
        'Portal access is present on an unverified guardian authority',
      );
    }
  }

  return deepFreeze(issues);
}

export class SisReportRegistry {
  readonly #snapshots = new Map<string, ReportSnapshot<unknown>>();

  createSnapshot<T>(input: {
    tenantId: string;
    reportKey: string;
    parameters: Readonly<Record<string, unknown>>;
    data: T;
    generatedByAccountId: string;
  }): ReportSnapshot<T> {
    if (!input.reportKey.trim()) {
      throw new ReportingDomainError('SIS_REPORT_KEY_REQUIRED', 'Report key is required');
    }
    if (!input.generatedByAccountId.trim()) {
      throw new ReportingDomainError('SIS_REPORT_ACTOR_REQUIRED', 'Report actor is required');
    }
    const snapshot: ReportSnapshot<T> = deepFreeze({
      tenantId: input.tenantId,
      reportSnapshotId: crypto.randomUUID(),
      reportKey: input.reportKey,
      parameters: { ...input.parameters },
      data: input.data,
      generatedAt: new Date().toISOString(),
      generatedByAccountId: input.generatedByAccountId,
    });
    this.#snapshots.set(snapshot.reportSnapshotId, snapshot);
    return snapshot;
  }

  getSnapshot<T>(tenantId: string, reportSnapshotId: string): ReportSnapshot<T> {
    const snapshot = this.#snapshots.get(reportSnapshotId);
    if (!snapshot || snapshot.tenantId !== tenantId) {
      throw new ReportingDomainError(
        'SIS_REPORT_SNAPSHOT_NOT_FOUND',
        'Report snapshot was not found',
      );
    }
    return snapshot as ReportSnapshot<T>;
  }
}
