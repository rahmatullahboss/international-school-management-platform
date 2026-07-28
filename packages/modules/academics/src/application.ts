import type { AttendanceRegistry, AttendanceSyncEntry } from '../../attendance/src/index.js';
import type { GradebookRegistry } from '../../gradebook/src/index.js';
import type { AcademicRecordsRegistry } from '../../records/src/index.js';
import type { TimetableRegistry } from '../../scheduling/src/index.js';
import type { AcademicRegistry } from './index.js';

export type AcademicPermission =
  | 'academics.structure.read'
  | 'academics.structure.manage'
  | 'academics.structure.publish'
  | 'academics.roster.read'
  | 'academics.roster.manage'
  | 'academics.schedule.read'
  | 'academics.schedule.manage'
  | 'academics.schedule.publish'
  | 'academics.attendance.read'
  | 'academics.attendance.capture'
  | 'academics.attendance.finalize'
  | 'academics.attendance.amend'
  | 'academics.attendance.report'
  | 'academics.gradebook.read'
  | 'academics.gradebook.write'
  | 'academics.gradebook.moderate'
  | 'academics.gradebook.lock'
  | 'academics.gradebook.publish'
  | 'academics.gradebook.change'
  | 'academics.records.read'
  | 'academics.records.issue'
  | 'academics.records.amend'
  | 'academics.reports.read'
  | 'academics.import.stage'
  | 'academics.export'
  | 'academics.audit.read'
  | 'academics.scope.all';

export interface AcademicActorContext {
  tenantId: string;
  actorId: string;
  permissions: ReadonlySet<AcademicPermission>;
  sectionIds?: ReadonlySet<string>;
  studentIds?: ReadonlySet<string>;
  campusIds?: ReadonlySet<string>;
  locale: string;
  timezone: string;
}

export interface AcademicExternalContracts {
  validateCampus(tenantId: string, campusId: string): boolean;
  validateStudent(tenantId: string, studentProfileId: string): boolean;
  validateStaff(tenantId: string, staffProfileId: string): boolean;
  validateEnrollment(tenantId: string, enrollmentId: string, studentProfileId: string): boolean;
  validateCountryPack(tenantId: string, countryPackRef: string): boolean;
}

export interface AcademicServiceDependencies {
  academics: AcademicRegistry;
  scheduling: TimetableRegistry;
  attendance: AttendanceRegistry;
  gradebook: GradebookRegistry;
  records: AcademicRecordsRegistry;
  external: AcademicExternalContracts;
}

export interface AttendanceReportRow {
  studentProfileId: string;
  sessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  remote: number;
  attendancePercent: number;
  chronicAbsenceAlert: boolean;
}

export interface AcademicImportRow {
  rowNumber: number;
  values: Readonly<Record<string, string>>;
}

export interface AcademicImportStagingResult {
  entity: 'course' | 'section-roster' | 'calendar-day';
  acceptedRows: readonly AcademicImportRow[];
  rejectedRows: readonly {
    rowNumber: number;
    code: string;
    message: string;
  }[];
  duplicateRows: number;
  canApply: boolean;
}

export class AcademicApplicationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AcademicApplicationError';
  }
}

const importHeaders: Readonly<Record<AcademicImportStagingResult['entity'], readonly string[]>> = {
  course: ['courseKey', 'versionLabel', 'curriculumVersionId', 'code', 'title', 'credits'],
  'section-roster': ['sectionId', 'studentProfileId', 'enrollmentId', 'joinedOn'],
  'calendar-day': ['calendarId', 'date', 'instructional', 'cycleDay', 'label'],
};

function assertPermission(actor: AcademicActorContext, permission: AcademicPermission): void {
  if (!actor.permissions.has(permission)) {
    throw new AcademicApplicationError(
      'ACADEMIC_PERMISSION_DENIED',
      `Permission ${permission} is required`,
    );
  }
}

function assertScoped(
  actor: AcademicActorContext,
  scope: 'section' | 'student' | 'campus',
  id: string,
): void {
  if (actor.permissions.has('academics.scope.all')) return;
  const allowed =
    scope === 'section'
      ? actor.sectionIds
      : scope === 'student'
        ? actor.studentIds
        : actor.campusIds;
  if (!allowed?.has(id)) {
    throw new AcademicApplicationError(
      'ACADEMIC_SCOPE_DENIED',
      `Actor is not assigned to ${scope} ${id}`,
    );
  }
}

function assertExternal(valid: boolean, code: string, label: string): void {
  if (!valid)
    throw new AcademicApplicationError(code, `${label} was not found in its owning service`);
}

function escapeCsvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ''
      : typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint'
          ? String(value)
          : value instanceof Date
            ? value.toISOString()
            : JSON.stringify(value);
  const formulaSafe = /^[=+\-@]/u.test(text.trimStart()) ? `'${text}` : text;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

function parseBoolean(value: string): boolean | undefined {
  if (/^(true|1|yes)$/iu.test(value)) return true;
  if (/^(false|0|no)$/iu.test(value)) return false;
  return undefined;
}

export class AcademicApplicationService {
  readonly #dependencies: AcademicServiceDependencies;
  readonly #attendanceSessionScopes = new Map<string, { tenantId: string; sectionId: string }>();

  constructor(dependencies: AcademicServiceDependencies) {
    this.#dependencies = dependencies;
  }

  createAcademicYear(
    actor: AcademicActorContext,
    input: {
      idempotencyKey: string;
      code: string;
      name: string;
      startsOn: string;
      endsOn: string;
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.structure.manage');
    return this.#dependencies.academics.createAcademicYear({
      tenantId: actor.tenantId,
      ...input,
    });
  }

  createCurriculumVersion(
    actor: AcademicActorContext,
    input: {
      curriculumKey: string;
      versionLabel: string;
      name: string;
      countryPackRef?: string;
      effectiveFrom: string;
      effectiveTo?: string;
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.structure.manage');
    if (input.countryPackRef !== undefined) {
      assertExternal(
        this.#dependencies.external.validateCountryPack(actor.tenantId, input.countryPackRef),
        'ACADEMIC_COUNTRY_PACK_NOT_FOUND',
        'Country pack',
      );
    }
    return this.#dependencies.academics.createCurriculumVersion({
      tenantId: actor.tenantId,
      ...input,
    });
  }

  publishStructure(
    actor: AcademicActorContext,
    input: {
      aggregateType:
        | 'academic-year'
        | 'calendar'
        | 'bell-schedule'
        | 'curriculum'
        | 'program'
        | 'course'
        | 'section';
      aggregateId: string;
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.structure.publish');
    return this.#dependencies.academics.publish({ tenantId: actor.tenantId, ...input });
  }

  getSectionRoster(actor: AcademicActorContext, sectionId: string) {
    assertPermission(actor, 'academics.roster.read');
    assertScoped(actor, 'section', sectionId);
    return this.#dependencies.academics.sectionRoster(actor.tenantId, sectionId);
  }

  enrolStudent(
    actor: AcademicActorContext,
    input: {
      sectionId: string;
      studentProfileId: string;
      enrollmentId: string;
      joinedOn: string;
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.roster.manage');
    assertScoped(actor, 'section', input.sectionId);
    assertExternal(
      this.#dependencies.external.validateStudent(actor.tenantId, input.studentProfileId),
      'ACADEMIC_STUDENT_NOT_FOUND',
      'Student',
    );
    assertExternal(
      this.#dependencies.external.validateEnrollment(
        actor.tenantId,
        input.enrollmentId,
        input.studentProfileId,
      ),
      'ACADEMIC_ENROLLMENT_NOT_FOUND',
      'Enrollment',
    );
    return this.#dependencies.academics.enrollStudent({ tenantId: actor.tenantId, ...input });
  }

  assignTeacher(
    actor: AcademicActorContext,
    input: {
      sectionId: string;
      staffProfileId: string;
      role: 'teacher' | 'co-teacher' | 'assistant';
      effectiveFrom: string;
      effectiveTo?: string;
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.roster.manage');
    assertScoped(actor, 'section', input.sectionId);
    assertExternal(
      this.#dependencies.external.validateStaff(actor.tenantId, input.staffProfileId),
      'ACADEMIC_STAFF_NOT_FOUND',
      'Staff profile',
    );
    return this.#dependencies.academics.assignStaff({ tenantId: actor.tenantId, ...input });
  }

  getTeacherSchedule(actor: AcademicActorContext, timetableVersionId: string, teacherId: string) {
    assertPermission(actor, 'academics.schedule.read');
    if (teacherId !== actor.actorId) assertPermission(actor, 'academics.scope.all');
    return this.#dependencies.scheduling.scheduleForTeacher(
      actor.tenantId,
      timetableVersionId,
      teacherId,
    );
  }

  getStudentSchedule(
    actor: AcademicActorContext,
    timetableVersionId: string,
    studentProfileId: string,
  ) {
    assertPermission(actor, 'academics.schedule.read');
    assertScoped(actor, 'student', studentProfileId);
    assertExternal(
      this.#dependencies.external.validateStudent(actor.tenantId, studentProfileId),
      'ACADEMIC_STUDENT_NOT_FOUND',
      'Student',
    );
    return this.#dependencies.scheduling.scheduleForStudent(
      actor.tenantId,
      timetableVersionId,
      studentProfileId,
    );
  }

  openAttendanceSession(
    actor: AcademicActorContext,
    input: {
      scheduledMeetingId: string;
      sectionId: string;
      campusId: string;
      localDate: string;
      startsAt: string;
      endsAt: string;
      timezone: string;
      rosterStudentIds: readonly string[];
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.attendance.capture');
    assertScoped(actor, 'section', input.sectionId);
    assertScoped(actor, 'campus', input.campusId);
    assertExternal(
      this.#dependencies.external.validateCampus(actor.tenantId, input.campusId),
      'ACADEMIC_CAMPUS_NOT_FOUND',
      'Campus',
    );
    for (const studentProfileId of input.rosterStudentIds) {
      assertExternal(
        this.#dependencies.external.validateStudent(actor.tenantId, studentProfileId),
        'ACADEMIC_STUDENT_NOT_FOUND',
        'Student',
      );
    }
    const result = this.#dependencies.attendance.openSession({
      tenantId: actor.tenantId,
      ...input,
    });
    this.#attendanceSessionScopes.set(result.value.sessionId, {
      tenantId: actor.tenantId,
      sectionId: input.sectionId,
    });
    return result;
  }

  syncAttendance(
    actor: AcademicActorContext,
    input: {
      clientBatchId: string;
      deviceId: string;
      entries: readonly AttendanceSyncEntry[];
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.attendance.capture');
    for (const entry of input.entries) {
      const scope = this.#attendanceSessionScopes.get(entry.sessionId);
      if (!scope || scope.tenantId !== actor.tenantId) {
        throw new AcademicApplicationError(
          'ACADEMIC_ATTENDANCE_SESSION_SCOPE_UNKNOWN',
          'Attendance session is not registered in this application service',
        );
      }
      assertScoped(actor, 'section', scope.sectionId);
    }
    return this.#dependencies.attendance.sync({ tenantId: actor.tenantId, ...input });
  }

  finalizeAttendance(
    actor: AcademicActorContext,
    input: {
      sessionId: string;
      allowIncomplete?: boolean;
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.attendance.finalize');
    const scope = this.#attendanceSessionScopes.get(input.sessionId);
    if (!scope || scope.tenantId !== actor.tenantId) {
      throw new AcademicApplicationError(
        'ACADEMIC_ATTENDANCE_SESSION_SCOPE_UNKNOWN',
        'Attendance session is not registered in this application service',
      );
    }
    assertScoped(actor, 'section', scope.sectionId);
    return this.#dependencies.attendance.finalize({
      tenantId: actor.tenantId,
      sessionId: input.sessionId,
      finalizedBy: actor.actorId,
      ...(input.allowIncomplete === undefined ? {} : { allowIncomplete: input.allowIncomplete }),
      correlationId: input.correlationId,
    });
  }

  calculateStudentGrade(
    actor: AcademicActorContext,
    input: {
      sectionId: string;
      reportingPeriodId: string;
      studentProfileId: string;
      policyVersionId: string;
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.gradebook.write');
    assertScoped(actor, 'section', input.sectionId);
    assertScoped(actor, 'student', input.studentProfileId);
    return this.#dependencies.gradebook.calculate({ tenantId: actor.tenantId, ...input });
  }

  issueTranscript(
    actor: AcademicActorContext,
    input: {
      idempotencyKey: string;
      transcriptNumber: string;
      studentProfileId: string;
      locale: string;
      schoolName: string;
      studentDisplayName: string;
      gpaSnapshotId: string;
      correlationId: string;
    },
  ) {
    assertPermission(actor, 'academics.records.issue');
    assertScoped(actor, 'student', input.studentProfileId);
    assertExternal(
      this.#dependencies.external.validateStudent(actor.tenantId, input.studentProfileId),
      'ACADEMIC_STUDENT_NOT_FOUND',
      'Student',
    );
    return this.#dependencies.records.issueTranscript({
      tenantId: actor.tenantId,
      ...input,
      issuedBy: actor.actorId,
    });
  }

  attendanceReport(
    actor: AcademicActorContext,
    policyVersionId: string,
    studentProfileIds: readonly string[],
  ): readonly AttendanceReportRow[] {
    assertPermission(actor, 'academics.attendance.report');
    return studentProfileIds.map((studentProfileId) => {
      assertScoped(actor, 'student', studentProfileId);
      return this.#dependencies.attendance.summary({
        tenantId: actor.tenantId,
        policyVersionId,
        studentProfileId,
      });
    });
  }

  exportCsv(
    actor: AcademicActorContext,
    columns: readonly string[],
    rows: readonly Readonly<Record<string, unknown>>[],
  ): string {
    assertPermission(actor, 'academics.export');
    if (columns.length === 0 || new Set(columns).size !== columns.length) {
      throw new AcademicApplicationError(
        'ACADEMIC_EXPORT_COLUMNS_INVALID',
        'Export columns must be unique and non-empty',
      );
    }
    return [
      columns.map(escapeCsvCell).join(','),
      ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(',')),
    ].join('\r\n');
  }

  stageImport(
    actor: AcademicActorContext,
    input: {
      entity: AcademicImportStagingResult['entity'];
      headers: readonly string[];
      rows: readonly Readonly<Record<string, string>>[];
    },
  ): AcademicImportStagingResult {
    assertPermission(actor, 'academics.import.stage');
    const requiredHeaders = importHeaders[input.entity];
    const missingHeaders = requiredHeaders.filter((header) => !input.headers.includes(header));
    const extraHeaders = input.headers.filter((header) => !requiredHeaders.includes(header));
    if (missingHeaders.length > 0 || extraHeaders.length > 0) {
      throw new AcademicApplicationError(
        'ACADEMIC_IMPORT_HEADERS_INVALID',
        `Missing headers: ${missingHeaders.join(', ') || 'none'}; unexpected headers: ${extraHeaders.join(', ') || 'none'}`,
      );
    }
    const seen = new Set<string>();
    const acceptedRows: AcademicImportRow[] = [];
    const rejectedRows: AcademicImportStagingResult['rejectedRows'][number][] = [];
    let duplicateRows = 0;
    input.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const key = requiredHeaders.map((header) => row[header]?.trim() ?? '').join('\u001f');
      if (seen.has(key)) {
        duplicateRows += 1;
        return;
      }
      seen.add(key);
      const missingValue = requiredHeaders.find((header) => {
        if (input.entity === 'calendar-day' && (header === 'cycleDay' || header === 'label')) {
          return false;
        }
        return !row[header]?.trim();
      });
      if (missingValue) {
        rejectedRows.push({
          rowNumber,
          code: 'REQUIRED_VALUE_MISSING',
          message: `${missingValue} is required`,
        });
        return;
      }
      if (input.entity === 'course') {
        const credits = Number(row.credits);
        if (!Number.isFinite(credits) || credits < 0) {
          rejectedRows.push({
            rowNumber,
            code: 'CREDITS_INVALID',
            message: 'credits must be a non-negative number',
          });
          return;
        }
      }
      if (input.entity === 'calendar-day' && parseBoolean(row.instructional ?? '') === undefined) {
        rejectedRows.push({
          rowNumber,
          code: 'INSTRUCTIONAL_INVALID',
          message: 'instructional must be true/false, 1/0 or yes/no',
        });
        return;
      }
      acceptedRows.push({ rowNumber, values: { ...row } });
    });
    return {
      entity: input.entity,
      acceptedRows,
      rejectedRows,
      duplicateRows,
      canApply: acceptedRows.length > 0 && rejectedRows.length === 0,
    };
  }
}
