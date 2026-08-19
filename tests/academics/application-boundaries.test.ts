import { describe, expect, it, vi } from 'vitest';

import {
  AcademicApplicationError,
  AcademicApplicationService,
  type AcademicActorContext,
  type AcademicPermission,
  type AcademicServiceDependencies,
} from '../../packages/modules/academics/src/application.js';

const tenantId = '11111111-1111-4111-8111-111111111111';

function actor(
  permissions: readonly AcademicPermission[],
  overrides: Partial<AcademicActorContext> = {},
): AcademicActorContext {
  return {
    tenantId,
    actorId: 'teacher-a',
    permissions: new Set(permissions),
    sectionIds: new Set(['section-a']),
    studentIds: new Set(['student-a', 'student-b']),
    campusIds: new Set(['campus-a']),
    locale: 'en-GB',
    timezone: 'Asia/Dhaka',
    ...overrides,
  };
}

function fixture() {
  const academics = {
    publish: vi.fn(() => ({ value: { aggregateId: 'aggregate-a' } })),
    sectionRoster: vi.fn(() => [{ studentProfileId: 'student-a' }]),
    enrollStudent: vi.fn(() => ({
      value: { sectionId: 'section-a', studentProfileId: 'student-a' },
    })),
    assignStaff: vi.fn(() => ({ value: { sectionId: 'section-a', staffProfileId: 'staff-a' } })),
  };
  const scheduling = {
    scheduleForTeacher: vi.fn(() => [{ scheduledMeetingId: 'meeting-teacher' }]),
    scheduleForStudent: vi.fn(() => [{ scheduledMeetingId: 'meeting-student' }]),
  };
  const attendance = {
    openSession: vi.fn(() => ({ value: { sessionId: 'session-a' } })),
    sync: vi.fn(() => ({ value: { accepted: 1 } })),
    finalize: vi.fn(() => ({ value: { sessionId: 'session-a', status: 'finalized' } })),
    summary: vi.fn(() => ({
      studentProfileId: 'student-a',
      sessions: 10,
      present: 8,
      absent: 1,
      late: 1,
      excused: 0,
      remote: 0,
      attendancePercent: 80,
      chronicAbsenceAlert: false,
    })),
  };
  const gradebook = {
    calculate: vi.fn(() => ({ value: { studentProfileId: 'student-a', finalValue: 87 } })),
  };
  const records = {
    issueTranscript: vi.fn(() => ({ value: { transcriptNumber: 'TR-001' } })),
  };
  const external = {
    validateCampus: vi.fn(() => true),
    validateStudent: vi.fn(() => true),
    validateStaff: vi.fn(() => true),
    validateEnrollment: vi.fn(() => true),
    validateCountryPack: vi.fn(() => true),
  };

  const application = new AcademicApplicationService({
    academics,
    scheduling,
    attendance,
    gradebook,
    records,
    external,
  } as unknown as AcademicServiceDependencies);

  return { application, academics, scheduling, attendance, gradebook, records, external };
}

function openAttendance(
  application: AcademicApplicationService,
  context: AcademicActorContext,
): void {
  application.openAttendanceSession(context, {
    scheduledMeetingId: 'meeting-a',
    sectionId: 'section-a',
    campusId: 'campus-a',
    localDate: '2026-08-03',
    startsAt: '08:00',
    endsAt: '09:00',
    timezone: 'Asia/Dhaka',
    rosterStudentIds: ['student-a'],
    correlationId: 'corr-open',
  });
}

describe('ACAD-01 application boundary coverage', () => {
  it('publishes structure and keeps roster reads/writes inside permission, scope and external contracts', () => {
    const { application, academics, external } = fixture();

    application.publishStructure(actor(['academics.structure.publish']), {
      aggregateType: 'section',
      aggregateId: 'section-a',
      correlationId: 'corr-publish',
    });
    expect(academics.publish).toHaveBeenCalledWith({
      tenantId,
      aggregateType: 'section',
      aggregateId: 'section-a',
      correlationId: 'corr-publish',
    });

    expect(application.getSectionRoster(actor(['academics.roster.read']), 'section-a')).toEqual([
      { studentProfileId: 'student-a' },
    ]);
    expect(academics.sectionRoster).toHaveBeenCalledWith(tenantId, 'section-a');

    application.enrolStudent(actor(['academics.roster.manage']), {
      sectionId: 'section-a',
      studentProfileId: 'student-a',
      enrollmentId: 'enrollment-a',
      joinedOn: '2026-08-01',
      correlationId: 'corr-enrol',
    });
    expect(external.validateStudent).toHaveBeenCalledWith(tenantId, 'student-a');
    expect(external.validateEnrollment).toHaveBeenCalledWith(tenantId, 'enrollment-a', 'student-a');
    expect(academics.enrollStudent).toHaveBeenCalledWith({
      tenantId,
      sectionId: 'section-a',
      studentProfileId: 'student-a',
      enrollmentId: 'enrollment-a',
      joinedOn: '2026-08-01',
      correlationId: 'corr-enrol',
    });

    application.assignTeacher(actor(['academics.roster.manage']), {
      sectionId: 'section-a',
      staffProfileId: 'staff-a',
      role: 'teacher',
      effectiveFrom: '2026-08-01',
      correlationId: 'corr-assign',
    });
    expect(external.validateStaff).toHaveBeenCalledWith(tenantId, 'staff-a');
    expect(academics.assignStaff).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, sectionId: 'section-a', staffProfileId: 'staff-a' }),
    );
  });

  it('fails closed when roster references or section scope are not owned by the actor', () => {
    const { application, external, academics } = fixture();
    external.validateEnrollment.mockReturnValue(false);

    expect(() =>
      application.enrolStudent(actor(['academics.roster.manage']), {
        sectionId: 'section-a',
        studentProfileId: 'student-a',
        enrollmentId: 'missing-enrollment',
        joinedOn: '2026-08-01',
        correlationId: 'corr-invalid-enrollment',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACADEMIC_ENROLLMENT_NOT_FOUND' }));
    expect(academics.enrollStudent).not.toHaveBeenCalled();

    expect(() =>
      application.assignTeacher(
        actor(['academics.roster.manage'], { sectionIds: new Set(['section-other']) }),
        {
          sectionId: 'section-a',
          staffProfileId: 'staff-a',
          role: 'teacher',
          effectiveFrom: '2026-08-01',
          correlationId: 'corr-scope-denied',
        },
      ),
    ).toThrowError(expect.objectContaining({ code: 'ACADEMIC_SCOPE_DENIED' }));
  });

  it('enforces self-or-global teacher schedule access and scoped student schedule validation', () => {
    const { application, scheduling, external } = fixture();

    application.getTeacherSchedule(actor(['academics.schedule.read']), 'timetable-a', 'teacher-a');
    expect(scheduling.scheduleForTeacher).toHaveBeenCalledWith(
      tenantId,
      'timetable-a',
      'teacher-a',
    );

    expect(() =>
      application.getTeacherSchedule(
        actor(['academics.schedule.read']),
        'timetable-a',
        'teacher-b',
      ),
    ).toThrowError(expect.objectContaining({ code: 'ACADEMIC_PERMISSION_DENIED' }));

    application.getTeacherSchedule(
      actor(['academics.schedule.read', 'academics.scope.all']),
      'timetable-a',
      'teacher-b',
    );
    expect(scheduling.scheduleForTeacher).toHaveBeenCalledWith(
      tenantId,
      'timetable-a',
      'teacher-b',
    );

    application.getStudentSchedule(actor(['academics.schedule.read']), 'timetable-a', 'student-a');
    expect(external.validateStudent).toHaveBeenCalledWith(tenantId, 'student-a');
    expect(scheduling.scheduleForStudent).toHaveBeenCalledWith(
      tenantId,
      'timetable-a',
      'student-a',
    );
  });

  it('binds attendance sync and finalization to an application-registered section scope', () => {
    const { application, attendance } = fixture();
    const captureActor = actor(['academics.attendance.capture']);
    openAttendance(application, captureActor);

    application.syncAttendance(captureActor, {
      clientBatchId: 'batch-a',
      deviceId: 'device-a',
      entries: [
        {
          sessionId: 'session-a',
          studentProfileId: 'student-a',
          status: 'present',
          clientRecordedAt: '2026-08-03T08:05:00+06:00',
        },
      ],
      correlationId: 'corr-sync',
    });
    expect(attendance.sync).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, clientBatchId: 'batch-a', deviceId: 'device-a' }),
    );

    application.finalizeAttendance(actor(['academics.attendance.finalize']), {
      sessionId: 'session-a',
      allowIncomplete: true,
      correlationId: 'corr-finalize',
    });
    expect(attendance.finalize).toHaveBeenCalledWith({
      tenantId,
      sessionId: 'session-a',
      finalizedBy: 'teacher-a',
      allowIncomplete: true,
      correlationId: 'corr-finalize',
    });

    expect(() =>
      application.syncAttendance(captureActor, {
        clientBatchId: 'batch-unknown',
        deviceId: 'device-a',
        entries: [
          {
            sessionId: 'unknown-session',
            studentProfileId: 'student-a',
            status: 'present',
            clientRecordedAt: '2026-08-03T08:10:00+06:00',
          },
        ],
        correlationId: 'corr-unknown',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACADEMIC_ATTENDANCE_SESSION_SCOPE_UNKNOWN' }));
  });

  it('scopes grade calculation, transcript issuance and attendance reporting to permitted students', () => {
    const { application, gradebook, records, attendance, external } = fixture();

    application.calculateStudentGrade(actor(['academics.gradebook.write']), {
      sectionId: 'section-a',
      reportingPeriodId: 'period-a',
      studentProfileId: 'student-a',
      policyVersionId: 'policy-a',
      correlationId: 'corr-grade',
    });
    expect(gradebook.calculate).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, sectionId: 'section-a', studentProfileId: 'student-a' }),
    );

    application.issueTranscript(actor(['academics.records.issue']), {
      idempotencyKey: 'transcript-a',
      transcriptNumber: 'TR-001',
      studentProfileId: 'student-a',
      locale: 'en-GB',
      schoolName: 'International Community School',
      studentDisplayName: 'Student A',
      gpaSnapshotId: 'gpa-a',
      correlationId: 'corr-transcript',
    });
    expect(external.validateStudent).toHaveBeenCalledWith(tenantId, 'student-a');
    expect(records.issueTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, studentProfileId: 'student-a', issuedBy: 'teacher-a' }),
    );

    const rows = application.attendanceReport(
      actor(['academics.attendance.report']),
      'attendance-policy-a',
      ['student-a', 'student-b'],
    );
    expect(rows).toHaveLength(2);
    expect(attendance.summary).toHaveBeenNthCalledWith(1, {
      tenantId,
      policyVersionId: 'attendance-policy-a',
      studentProfileId: 'student-a',
    });
    expect(attendance.summary).toHaveBeenNthCalledWith(2, {
      tenantId,
      policyVersionId: 'attendance-policy-a',
      studentProfileId: 'student-b',
    });
  });

  it('parses accepted calendar-day boolean forms and rejects invalid instructional values', () => {
    const { application } = fixture();
    const importActor = actor(['academics.import.stage']);
    const headers = ['calendarId', 'date', 'instructional', 'cycleDay', 'label'];

    const accepted = application.stageImport(importActor, {
      entity: 'calendar-day',
      headers,
      rows: [
        {
          calendarId: 'calendar-a',
          date: '2026-08-03',
          instructional: 'yes',
          cycleDay: '',
          label: '',
        },
        {
          calendarId: 'calendar-a',
          date: '2026-08-04',
          instructional: '0',
          cycleDay: 'B',
          label: 'Holiday',
        },
      ],
    });
    expect(accepted.acceptedRows).toHaveLength(2);
    expect(accepted.rejectedRows).toEqual([]);
    expect(accepted.canApply).toBe(true);

    const rejected = application.stageImport(importActor, {
      entity: 'calendar-day',
      headers,
      rows: [
        {
          calendarId: 'calendar-a',
          date: '2026-08-05',
          instructional: 'sometimes',
          cycleDay: '',
          label: '',
        },
      ],
    });
    expect(rejected.rejectedRows).toEqual([
      {
        rowNumber: 2,
        code: 'INSTRUCTIONAL_INVALID',
        message: 'instructional must be true/false, 1/0 or yes/no',
      },
    ]);
    expect(rejected.canApply).toBe(false);
  });

  it('keeps unknown finalized sessions fail-closed instead of delegating them', () => {
    const { application, attendance } = fixture();

    expect(() =>
      application.finalizeAttendance(actor(['academics.attendance.finalize']), {
        sessionId: 'missing-session',
        correlationId: 'corr-missing-finalize',
      }),
    ).toThrowError(AcademicApplicationError);
    expect(attendance.finalize).not.toHaveBeenCalled();
  });
});
