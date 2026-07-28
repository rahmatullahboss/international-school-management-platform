import { AppendOnlyAuditLog, createDomainEvent, type DomainEvent } from '@school/events';

import type { EnrollmentStatus } from './contracts.js';

export interface EnrollmentRecord {
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
  sourceApplicationId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentStatusEntry {
  statusHistoryId: string;
  enrollmentId: string;
  status: EnrollmentStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  reasonCode: string;
  recordedAt: string;
}

export interface TransferRecord {
  transferId: string;
  sourceEnrollmentId: string;
  destinationEnrollmentId: string;
  destinationCampusId: string;
  destinationProgramId: string;
  transferDate: string;
  reasonCode: string;
  createdAt: string;
}

export interface WithdrawalRecord {
  withdrawalId: string;
  enrollmentId: string;
  withdrawalDate: string;
  reasonCode: string;
  destinationSchool?: string;
  destinationCountryCode?: string;
  notes?: string;
  createdAt: string;
}

export interface PreviousSchoolRecord {
  previousSchoolId: string;
  studentProfileId: string;
  schoolName: string;
  countryCode: string;
  programName?: string;
  gradeLevel?: string;
  attendedFrom?: string;
  attendedTo?: string;
  transcriptDocumentId?: string;
}

export interface AdmissionHistoryRecord {
  admissionHistoryId: string;
  studentProfileId: string;
  applicationId?: string;
  admittedAt: string;
  admissionType: 'new' | 'transfer-in' | 're-enrollment';
  notes?: string;
}

export interface PlacementHistoryRecord {
  placementHistoryId: string;
  enrollmentId: string;
  campusId: string;
  programId: string;
  academicYearId: string;
  gradeLevelId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  reasonCode: string;
}

export interface PromotionRecord {
  promotionId: string;
  sourceEnrollmentId: string;
  destinationEnrollmentId: string;
  promotedAt: string;
  outcome: 'promoted' | 'retained' | 'advanced-with-support';
}

export interface ReEnrollmentRecord {
  reEnrollmentId: string;
  priorEnrollmentId: string;
  newEnrollmentId: string;
  reasonCode: string;
  createdAt: string;
}

export interface AlumniTransitionRecord {
  alumniTransitionId: string;
  studentProfileId: string;
  finalEnrollmentId: string;
  transitionDate: string;
  outcome: 'graduated' | 'withdrawn' | 'completed-program';
  alumniAccess: 'enabled' | 'disabled';
}

interface MutableEnrollment extends EnrollmentRecord {
  statusHistory: EnrollmentStatusEntry[];
}

export interface EnrollmentCommandResult<T> {
  value: T;
  events: readonly DomainEvent<unknown>[];
}

export class EnrollmentDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EnrollmentDomainError';
  }
}

function validPeriod(from: string, to?: string): boolean {
  return to === undefined || to >= from;
}

function periodsOverlap(
  leftFrom: string,
  leftTo: string | undefined,
  rightFrom: string,
  rightTo?: string,
): boolean {
  const leftEnd = leftTo ?? '9999-12-31';
  const rightEnd = rightTo ?? '9999-12-31';
  return leftFrom <= rightEnd && rightFrom <= leftEnd;
}

function cloneEnrollment(enrollment: MutableEnrollment): EnrollmentRecord {
  return {
    tenantId: enrollment.tenantId,
    enrollmentId: enrollment.enrollmentId,
    studentProfileId: enrollment.studentProfileId,
    campusId: enrollment.campusId,
    programId: enrollment.programId,
    academicYearId: enrollment.academicYearId,
    ...(enrollment.gradeLevelId === undefined ? {} : { gradeLevelId: enrollment.gradeLevelId }),
    status: enrollment.status,
    effectiveFrom: enrollment.effectiveFrom,
    ...(enrollment.effectiveTo === undefined ? {} : { effectiveTo: enrollment.effectiveTo }),
    ...(enrollment.sourceApplicationId === undefined
      ? {}
      : { sourceApplicationId: enrollment.sourceApplicationId }),
    version: enrollment.version,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
  };
}

function closeCurrentStatus(
  enrollment: MutableEnrollment,
  nextStatus: EnrollmentStatus,
  effectiveFrom: string,
  reasonCode: string,
): void {
  const current = enrollment.statusHistory.find((entry) => entry.effectiveTo === undefined);
  if (current) {
    if (effectiveFrom < current.effectiveFrom) {
      throw new EnrollmentDomainError(
        'SIS_ENROLLMENT_STATUS_DATE_INVALID',
        'Status change cannot predate the current status',
      );
    }
    current.effectiveTo = effectiveFrom;
  }
  enrollment.statusHistory.push({
    statusHistoryId: crypto.randomUUID(),
    enrollmentId: enrollment.enrollmentId,
    status: nextStatus,
    effectiveFrom,
    reasonCode,
    recordedAt: new Date().toISOString(),
  });
  enrollment.status = nextStatus;
  enrollment.version += 1;
  enrollment.updatedAt = new Date().toISOString();
}

export class EnrollmentRegistry {
  readonly #enrollments = new Map<string, MutableEnrollment>();
  readonly #enrollmentIdempotency = new Map<string, string>();
  readonly #transfers = new Map<string, TransferRecord>();
  readonly #transferIdempotency = new Map<string, string>();
  readonly #withdrawals = new Map<string, WithdrawalRecord>();
  readonly #previousSchools: PreviousSchoolRecord[] = [];
  readonly #admissionHistory: AdmissionHistoryRecord[] = [];
  readonly #placementHistory: PlacementHistoryRecord[] = [];
  readonly #promotions: PromotionRecord[] = [];
  readonly #reEnrollments: ReEnrollmentRecord[] = [];
  readonly #alumniTransitions: AlumniTransitionRecord[] = [];
  readonly #audit = new AppendOnlyAuditLog();

  get auditLog(): AppendOnlyAuditLog {
    return this.#audit;
  }

  createEnrollment(input: {
    tenantId: string;
    idempotencyKey: string;
    studentProfileId: string;
    campusId: string;
    programId: string;
    academicYearId: string;
    gradeLevelId?: string;
    effectiveFrom: string;
    effectiveTo?: string;
    sourceApplicationId?: string;
    status?: Extract<EnrollmentStatus, 'pending' | 'active'>;
    correlationId: string;
  }): EnrollmentCommandResult<EnrollmentRecord> {
    if (!validPeriod(input.effectiveFrom, input.effectiveTo)) {
      throw new EnrollmentDomainError(
        'SIS_ENROLLMENT_PERIOD_INVALID',
        'Enrollment period is invalid',
      );
    }
    const retryKey = `${input.tenantId}:${input.idempotencyKey}`;
    const replayId = this.#enrollmentIdempotency.get(retryKey);
    if (replayId) {
      const replay = this.#requireEnrollment(input.tenantId, replayId);
      if (
        replay.studentProfileId !== input.studentProfileId ||
        replay.campusId !== input.campusId ||
        replay.programId !== input.programId ||
        replay.academicYearId !== input.academicYearId ||
        replay.gradeLevelId !== input.gradeLevelId ||
        replay.effectiveFrom !== input.effectiveFrom ||
        replay.effectiveTo !== input.effectiveTo ||
        replay.sourceApplicationId !== input.sourceApplicationId ||
        replay.status !== (input.status ?? 'active')
      ) {
        throw new EnrollmentDomainError(
          'SIS_ENROLLMENT_IDEMPOTENCY_CONFLICT',
          'Enrollment idempotency key is already bound to another request',
        );
      }
      return { value: cloneEnrollment(replay), events: [] };
    }

    const conflict = [...this.#enrollments.values()].find(
      (enrollment) =>
        enrollment.tenantId === input.tenantId &&
        enrollment.studentProfileId === input.studentProfileId &&
        enrollment.programId === input.programId &&
        enrollment.academicYearId === input.academicYearId &&
        !['withdrawn', 'cancelled', 'completed', 'transferred'].includes(enrollment.status) &&
        periodsOverlap(
          enrollment.effectiveFrom,
          enrollment.effectiveTo,
          input.effectiveFrom,
          input.effectiveTo,
        ),
    );
    if (conflict) {
      throw new EnrollmentDomainError(
        'SIS_ENROLLMENT_OVERLAP',
        'An overlapping enrollment already exists',
      );
    }

    const now = new Date().toISOString();
    const status = input.status ?? 'active';
    const enrollment: MutableEnrollment = {
      tenantId: input.tenantId,
      enrollmentId: crypto.randomUUID(),
      studentProfileId: input.studentProfileId,
      campusId: input.campusId,
      programId: input.programId,
      academicYearId: input.academicYearId,
      ...(input.gradeLevelId === undefined ? {} : { gradeLevelId: input.gradeLevelId }),
      status,
      effectiveFrom: input.effectiveFrom,
      ...(input.effectiveTo === undefined ? {} : { effectiveTo: input.effectiveTo }),
      ...(input.sourceApplicationId === undefined
        ? {}
        : { sourceApplicationId: input.sourceApplicationId }),
      version: 1,
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        {
          statusHistoryId: crypto.randomUUID(),
          enrollmentId: '',
          status,
          effectiveFrom: input.effectiveFrom,
          reasonCode: input.sourceApplicationId ? 'admissions-conversion' : 'direct-enrollment',
          recordedAt: now,
        },
      ],
    };
    enrollment.statusHistory[0]!.enrollmentId = enrollment.enrollmentId;
    this.#enrollments.set(enrollment.enrollmentId, enrollment);
    this.#enrollmentIdempotency.set(retryKey, enrollment.enrollmentId);
    this.#placementHistory.push({
      placementHistoryId: crypto.randomUUID(),
      enrollmentId: enrollment.enrollmentId,
      campusId: enrollment.campusId,
      programId: enrollment.programId,
      academicYearId: enrollment.academicYearId,
      ...(enrollment.gradeLevelId === undefined ? {} : { gradeLevelId: enrollment.gradeLevelId }),
      effectiveFrom: enrollment.effectiveFrom,
      ...(enrollment.effectiveTo === undefined ? {} : { effectiveTo: enrollment.effectiveTo }),
      reasonCode: 'enrollment-created',
    });
    this.#admissionHistory.push({
      admissionHistoryId: crypto.randomUUID(),
      studentProfileId: input.studentProfileId,
      ...(input.sourceApplicationId === undefined
        ? {}
        : { applicationId: input.sourceApplicationId }),
      admittedAt: input.effectiveFrom,
      admissionType: input.sourceApplicationId ? 'new' : 'transfer-in',
    });
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.lifecycle.enrollment-created',
      subjectId: enrollment.enrollmentId,
    });

    return {
      value: cloneEnrollment(enrollment),
      events: [
        createDomainEvent({
          eventType: 'sis.lifecycle.enrollment-created.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'enrollment',
          aggregateId: enrollment.enrollmentId,
          aggregateVersion: enrollment.version,
          correlationId: input.correlationId,
          payload: {
            enrollmentId: enrollment.enrollmentId,
            studentProfileId: enrollment.studentProfileId,
            campusId: enrollment.campusId,
            programId: enrollment.programId,
          },
        }),
      ],
    };
  }

  transferEnrollment(input: {
    tenantId: string;
    sourceEnrollmentId: string;
    idempotencyKey: string;
    destinationCampusId: string;
    destinationProgramId?: string;
    destinationAcademicYearId?: string;
    destinationGradeLevelId?: string;
    transferDate: string;
    reasonCode: string;
    correlationId: string;
  }): EnrollmentCommandResult<TransferRecord> {
    const retryKey = `${input.tenantId}:${input.idempotencyKey}`;
    const replayId = this.#transferIdempotency.get(retryKey);
    if (replayId) {
      const replay = this.#transfers.get(replayId);
      if (!replay)
        throw new EnrollmentDomainError(
          'SIS_TRANSFER_REPLAY_MISSING',
          'Transfer replay was missing',
        );
      const source = this.#requireEnrollment(input.tenantId, input.sourceEnrollmentId);
      const destination = this.#requireEnrollment(input.tenantId, replay.destinationEnrollmentId);
      if (
        replay.sourceEnrollmentId !== input.sourceEnrollmentId ||
        replay.destinationCampusId !== input.destinationCampusId ||
        replay.destinationProgramId !== (input.destinationProgramId ?? source.programId) ||
        destination.academicYearId !== (input.destinationAcademicYearId ?? source.academicYearId) ||
        destination.gradeLevelId !== (input.destinationGradeLevelId ?? source.gradeLevelId) ||
        replay.transferDate !== input.transferDate ||
        replay.reasonCode !== input.reasonCode
      ) {
        throw new EnrollmentDomainError(
          'SIS_TRANSFER_IDEMPOTENCY_CONFLICT',
          'Transfer idempotency key is already bound to another request',
        );
      }
      return { value: { ...replay }, events: [] };
    }
    const source = this.#requireEnrollment(input.tenantId, input.sourceEnrollmentId);
    if (source.status !== 'active') {
      throw new EnrollmentDomainError(
        'SIS_TRANSFER_SOURCE_NOT_ACTIVE',
        'Only active enrollment can transfer',
      );
    }
    if (input.transferDate < source.effectiveFrom) {
      throw new EnrollmentDomainError(
        'SIS_TRANSFER_DATE_INVALID',
        'Transfer date predates enrollment',
      );
    }

    source.effectiveTo = input.transferDate;
    closeCurrentStatus(source, 'transferred', input.transferDate, input.reasonCode);
    const destination = this.createEnrollment({
      tenantId: input.tenantId,
      idempotencyKey: `${input.idempotencyKey}:destination`,
      studentProfileId: source.studentProfileId,
      campusId: input.destinationCampusId,
      programId: input.destinationProgramId ?? source.programId,
      academicYearId: input.destinationAcademicYearId ?? source.academicYearId,
      ...(input.destinationGradeLevelId === undefined
        ? source.gradeLevelId === undefined
          ? {}
          : { gradeLevelId: source.gradeLevelId }
        : { gradeLevelId: input.destinationGradeLevelId }),
      effectiveFrom: input.transferDate,
      status: 'active',
      correlationId: input.correlationId,
    }).value;
    const transfer: TransferRecord = {
      transferId: crypto.randomUUID(),
      sourceEnrollmentId: source.enrollmentId,
      destinationEnrollmentId: destination.enrollmentId,
      destinationCampusId: destination.campusId,
      destinationProgramId: destination.programId,
      transferDate: input.transferDate,
      reasonCode: input.reasonCode,
      createdAt: new Date().toISOString(),
    };
    this.#transfers.set(transfer.transferId, transfer);
    this.#transferIdempotency.set(retryKey, transfer.transferId);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.lifecycle.student-transferred',
      subjectId: transfer.transferId,
    });

    return {
      value: { ...transfer },
      events: [
        createDomainEvent({
          eventType: 'sis.lifecycle.student-transferred.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'enrollment',
          aggregateId: source.enrollmentId,
          aggregateVersion: source.version,
          correlationId: input.correlationId,
          payload: {
            enrollmentId: source.enrollmentId,
            destinationCampusId: input.destinationCampusId,
            newEnrollmentId: destination.enrollmentId,
          },
        }),
      ],
    };
  }

  withdrawEnrollment(input: {
    tenantId: string;
    enrollmentId: string;
    withdrawalDate: string;
    reasonCode: string;
    destinationSchool?: string;
    destinationCountryCode?: string;
    notes?: string;
    correlationId: string;
  }): EnrollmentCommandResult<WithdrawalRecord> {
    const existing = this.#withdrawals.get(input.enrollmentId);
    if (existing) return { value: { ...existing }, events: [] };
    const enrollment = this.#requireEnrollment(input.tenantId, input.enrollmentId);
    if (!['active', 'pending', 'leave'].includes(enrollment.status)) {
      throw new EnrollmentDomainError(
        'SIS_WITHDRAWAL_STATUS_INVALID',
        'Enrollment cannot be withdrawn',
      );
    }
    if (input.withdrawalDate < enrollment.effectiveFrom) {
      throw new EnrollmentDomainError(
        'SIS_WITHDRAWAL_DATE_INVALID',
        'Withdrawal date predates enrollment',
      );
    }
    enrollment.effectiveTo = input.withdrawalDate;
    closeCurrentStatus(enrollment, 'withdrawn', input.withdrawalDate, input.reasonCode);
    const withdrawal: WithdrawalRecord = {
      withdrawalId: crypto.randomUUID(),
      enrollmentId: enrollment.enrollmentId,
      withdrawalDate: input.withdrawalDate,
      reasonCode: input.reasonCode,
      ...(input.destinationSchool === undefined
        ? {}
        : { destinationSchool: input.destinationSchool }),
      ...(input.destinationCountryCode === undefined
        ? {}
        : { destinationCountryCode: input.destinationCountryCode }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      createdAt: new Date().toISOString(),
    };
    this.#withdrawals.set(enrollment.enrollmentId, withdrawal);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.lifecycle.student-withdrawn',
      subjectId: withdrawal.withdrawalId,
    });
    return {
      value: { ...withdrawal },
      events: [
        createDomainEvent({
          eventType: 'sis.lifecycle.student-withdrawn.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'enrollment',
          aggregateId: enrollment.enrollmentId,
          aggregateVersion: enrollment.version,
          correlationId: input.correlationId,
          payload: {
            enrollmentId: enrollment.enrollmentId,
            withdrawalDate: input.withdrawalDate,
            reasonCode: input.reasonCode,
          },
        }),
      ],
    };
  }

  promoteStudent(input: {
    tenantId: string;
    sourceEnrollmentId: string;
    newAcademicYearId: string;
    newGradeLevelId?: string;
    effectiveFrom: string;
    outcome: PromotionRecord['outcome'];
    correlationId: string;
  }): PromotionRecord {
    const source = this.#requireEnrollment(input.tenantId, input.sourceEnrollmentId);
    if (source.status !== 'active') {
      throw new EnrollmentDomainError(
        'SIS_PROMOTION_SOURCE_NOT_ACTIVE',
        'Promotion requires active enrollment',
      );
    }
    source.effectiveTo = input.effectiveFrom;
    closeCurrentStatus(source, 'completed', input.effectiveFrom, 'year-end-promotion');
    const destination = this.createEnrollment({
      tenantId: input.tenantId,
      idempotencyKey: `promotion:${source.enrollmentId}:${input.newAcademicYearId}`,
      studentProfileId: source.studentProfileId,
      campusId: source.campusId,
      programId: source.programId,
      academicYearId: input.newAcademicYearId,
      ...(input.newGradeLevelId === undefined
        ? source.gradeLevelId === undefined
          ? {}
          : { gradeLevelId: source.gradeLevelId }
        : { gradeLevelId: input.newGradeLevelId }),
      effectiveFrom: input.effectiveFrom,
      status: 'active',
      correlationId: input.correlationId,
    }).value;
    const promotion: PromotionRecord = {
      promotionId: crypto.randomUUID(),
      sourceEnrollmentId: source.enrollmentId,
      destinationEnrollmentId: destination.enrollmentId,
      promotedAt: input.effectiveFrom,
      outcome: input.outcome,
    };
    this.#promotions.push(promotion);
    return { ...promotion };
  }

  reEnrollStudent(input: {
    tenantId: string;
    priorEnrollmentId: string;
    academicYearId: string;
    campusId?: string;
    programId?: string;
    gradeLevelId?: string;
    effectiveFrom: string;
    reasonCode: string;
    correlationId: string;
  }): ReEnrollmentRecord {
    const prior = this.#requireEnrollment(input.tenantId, input.priorEnrollmentId);
    if (!['withdrawn', 'completed', 'cancelled', 'transferred'].includes(prior.status)) {
      throw new EnrollmentDomainError(
        'SIS_REENROLLMENT_PRIOR_OPEN',
        'Prior enrollment is still open',
      );
    }
    const next = this.createEnrollment({
      tenantId: input.tenantId,
      idempotencyKey: `reenroll:${prior.enrollmentId}:${input.academicYearId}`,
      studentProfileId: prior.studentProfileId,
      campusId: input.campusId ?? prior.campusId,
      programId: input.programId ?? prior.programId,
      academicYearId: input.academicYearId,
      ...(input.gradeLevelId === undefined
        ? prior.gradeLevelId === undefined
          ? {}
          : { gradeLevelId: prior.gradeLevelId }
        : { gradeLevelId: input.gradeLevelId }),
      effectiveFrom: input.effectiveFrom,
      status: 'active',
      correlationId: input.correlationId,
    }).value;
    const record: ReEnrollmentRecord = {
      reEnrollmentId: crypto.randomUUID(),
      priorEnrollmentId: prior.enrollmentId,
      newEnrollmentId: next.enrollmentId,
      reasonCode: input.reasonCode,
      createdAt: new Date().toISOString(),
    };
    this.#reEnrollments.push(record);
    this.#admissionHistory.push({
      admissionHistoryId: crypto.randomUUID(),
      studentProfileId: prior.studentProfileId,
      admittedAt: input.effectiveFrom,
      admissionType: 're-enrollment',
      notes: input.reasonCode,
    });
    return { ...record };
  }

  recordPreviousSchool(
    input: Omit<PreviousSchoolRecord, 'previousSchoolId'> & { tenantId: string },
  ): PreviousSchoolRecord {
    if (input.attendedFrom !== undefined && !validPeriod(input.attendedFrom, input.attendedTo)) {
      throw new EnrollmentDomainError(
        'SIS_PREVIOUS_SCHOOL_PERIOD_INVALID',
        'Previous school period is invalid',
      );
    }
    const record: PreviousSchoolRecord = {
      previousSchoolId: crypto.randomUUID(),
      studentProfileId: input.studentProfileId,
      schoolName: input.schoolName,
      countryCode: input.countryCode,
      ...(input.programName === undefined ? {} : { programName: input.programName }),
      ...(input.gradeLevel === undefined ? {} : { gradeLevel: input.gradeLevel }),
      ...(input.attendedFrom === undefined ? {} : { attendedFrom: input.attendedFrom }),
      ...(input.attendedTo === undefined ? {} : { attendedTo: input.attendedTo }),
      ...(input.transcriptDocumentId === undefined
        ? {}
        : { transcriptDocumentId: input.transcriptDocumentId }),
    };
    this.#previousSchools.push(record);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.lifecycle.previous-school-recorded',
      subjectId: record.previousSchoolId,
    });
    return { ...record };
  }

  transitionToAlumni(input: {
    tenantId: string;
    finalEnrollmentId: string;
    transitionDate: string;
    outcome: AlumniTransitionRecord['outcome'];
    alumniAccess: AlumniTransitionRecord['alumniAccess'];
  }): AlumniTransitionRecord {
    const enrollment = this.#requireEnrollment(input.tenantId, input.finalEnrollmentId);
    if (!['completed', 'withdrawn'].includes(enrollment.status)) {
      throw new EnrollmentDomainError(
        'SIS_ALUMNI_FINAL_ENROLLMENT_OPEN',
        'Final enrollment must be closed',
      );
    }
    const existing = this.#alumniTransitions.find(
      (record) => record.studentProfileId === enrollment.studentProfileId,
    );
    if (existing) return { ...existing };
    const record: AlumniTransitionRecord = {
      alumniTransitionId: crypto.randomUUID(),
      studentProfileId: enrollment.studentProfileId,
      finalEnrollmentId: enrollment.enrollmentId,
      transitionDate: input.transitionDate,
      outcome: input.outcome,
      alumniAccess: input.alumniAccess,
    };
    this.#alumniTransitions.push(record);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.lifecycle.alumni-transitioned',
      subjectId: record.alumniTransitionId,
    });
    return { ...record };
  }

  getEnrollment(tenantId: string, enrollmentId: string): EnrollmentRecord {
    return cloneEnrollment(this.#requireEnrollment(tenantId, enrollmentId));
  }

  getEnrollmentHistory(tenantId: string, studentProfileId: string): readonly EnrollmentRecord[] {
    return [...this.#enrollments.values()]
      .filter(
        (enrollment) =>
          enrollment.tenantId === tenantId && enrollment.studentProfileId === studentProfileId,
      )
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
      .map(cloneEnrollment);
  }

  currentEnrollments(tenantId: string, at: string): readonly EnrollmentRecord[] {
    return [...this.#enrollments.values()]
      .filter(
        (enrollment) =>
          enrollment.tenantId === tenantId &&
          enrollment.effectiveFrom <= at &&
          (enrollment.effectiveTo === undefined || enrollment.effectiveTo >= at) &&
          ['active', 'leave', 'pending'].includes(enrollment.status),
      )
      .map(cloneEnrollment);
  }

  #requireEnrollment(tenantId: string, enrollmentId: string): MutableEnrollment {
    const enrollment = this.#enrollments.get(enrollmentId);
    if (!enrollment || enrollment.tenantId !== tenantId) {
      throw new EnrollmentDomainError('SIS_ENROLLMENT_NOT_FOUND', 'Enrollment was not found');
    }
    return enrollment;
  }
}
