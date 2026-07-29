import { describe, expect, it } from 'vitest';

import {
  AcademicApplicationError,
  AcademicApplicationService,
  type AcademicActorContext,
  type AcademicPermission,
} from '../../packages/modules/academics/src/application.js';
import { AcademicRegistry } from '../../packages/modules/academics/src/index.js';
import { AttendanceRegistry } from '../../packages/modules/attendance/src/index.js';
import { GradebookRegistry } from '../../packages/modules/gradebook/src/index.js';
import { AcademicRecordsRegistry } from '../../packages/modules/records/src/index.js';
import { TimetableRegistry } from '../../packages/modules/scheduling/src/index.js';

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

function service(
  externalOverrides: Partial<{
    campus: boolean;
    student: boolean;
    staff: boolean;
    enrollment: boolean;
    countryPack: boolean;
  }> = {},
) {
  return new AcademicApplicationService({
    academics: new AcademicRegistry(),
    scheduling: new TimetableRegistry(),
    attendance: new AttendanceRegistry(),
    gradebook: new GradebookRegistry(),
    records: new AcademicRecordsRegistry(),
    external: {
      validateCampus: () => externalOverrides.campus ?? true,
      validateStudent: () => externalOverrides.student ?? true,
      validateStaff: () => externalOverrides.staff ?? true,
      validateEnrollment: () => externalOverrides.enrollment ?? true,
      validateCountryPack: () => externalOverrides.countryPack ?? true,
    },
  });
}

describe('ACAD-01 application service', () => {
  it('denies every operation by default and permits only the declared capability', () => {
    const application = service();
    expect(() =>
      application.createAcademicYear(actor([]), {
        idempotencyKey: 'year-2026',
        code: '2026-27',
        name: 'Academic Year 2026/27',
        startsOn: '2026-08-01',
        endsOn: '2027-06-30',
        correlationId: 'corr-denied',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACADEMIC_PERMISSION_DENIED' }));

    const result = application.createAcademicYear(actor(['academics.structure.manage']), {
      idempotencyKey: 'year-2026',
      code: '2026-27',
      name: 'Academic Year 2026/27',
      startsOn: '2026-08-01',
      endsOn: '2027-06-30',
      correlationId: 'corr-allowed',
    });
    expect(result.value).toMatchObject({ code: '2026-27', tenantId });
  });

  it('validates cross-module references only through public external contracts', () => {
    const application = service({ countryPack: false });
    expect(() =>
      application.createCurriculumVersion(actor(['academics.structure.manage']), {
        curriculumKey: 'national',
        versionLabel: '2026.1',
        name: 'National Curriculum',
        countryPackRef: 'bd-national-v1',
        effectiveFrom: '2026-08-01',
        correlationId: 'corr-country-pack',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACADEMIC_COUNTRY_PACK_NOT_FOUND' }));
  });

  it('enforces campus and section scope for low-latency attendance capture', () => {
    const application = service();
    const captureActor = actor(['academics.attendance.capture']);
    const session = application.openAttendanceSession(captureActor, {
      scheduledMeetingId: 'meeting-a',
      sectionId: 'section-a',
      campusId: 'campus-a',
      localDate: '2026-08-03',
      startsAt: '08:00',
      endsAt: '09:00',
      timezone: 'Asia/Dhaka',
      rosterStudentIds: ['student-a', 'student-b'],
      correlationId: 'corr-open-attendance',
    }).value;
    expect(session.rosterStudentIds).toEqual(['student-a', 'student-b']);

    expect(() =>
      application.openAttendanceSession(
        actor(['academics.attendance.capture'], { sectionIds: new Set(['section-other']) }),
        {
          scheduledMeetingId: 'meeting-b',
          sectionId: 'section-a',
          campusId: 'campus-a',
          localDate: '2026-08-03',
          startsAt: '10:00',
          endsAt: '11:00',
          timezone: 'Asia/Dhaka',
          rosterStudentIds: ['student-a'],
          correlationId: 'corr-scope-denied',
        },
      ),
    ).toThrowError(expect.objectContaining({ code: 'ACADEMIC_SCOPE_DENIED' }));
  });

  it('exports formula-safe CSV and rejects malformed import headers', () => {
    const application = service();
    const exportActor = actor(['academics.export']);
    const csv = application.exportCsv(
      exportActor,
      ['student', 'comment'],
      [{ student: 'Student A', comment: '=HYPERLINK("https://example.test")' }],
    );
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');

    expect(() =>
      application.stageImport(actor(['academics.import.stage']), {
        entity: 'course',
        headers: ['code', 'title'],
        rows: [],
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACADEMIC_IMPORT_HEADERS_INVALID' }));
  });

  it('stages imports with row-level errors, duplicate counts and no silent apply', () => {
    const application = service();
    const importActor = actor(['academics.import.stage']);
    const headers = [
      'courseKey',
      'versionLabel',
      'curriculumVersionId',
      'code',
      'title',
      'credits',
    ];
    const result = application.stageImport(importActor, {
      entity: 'course',
      headers,
      rows: [
        {
          courseKey: 'math-g5',
          versionLabel: '2026.1',
          curriculumVersionId: 'curriculum-v1',
          code: 'MATH-G5',
          title: 'Mathematics Grade 5',
          credits: '1',
        },
        {
          courseKey: 'math-g5',
          versionLabel: '2026.1',
          curriculumVersionId: 'curriculum-v1',
          code: 'MATH-G5',
          title: 'Mathematics Grade 5',
          credits: '1',
        },
        {
          courseKey: 'science-g5',
          versionLabel: '2026.1',
          curriculumVersionId: 'curriculum-v1',
          code: 'SCI-G5',
          title: 'Science Grade 5',
          credits: '-1',
        },
      ],
    });

    expect(result.acceptedRows).toHaveLength(1);
    expect(result.duplicateRows).toBe(1);
    expect(result.rejectedRows).toEqual([
      {
        rowNumber: 4,
        code: 'CREDITS_INVALID',
        message: 'credits must be a non-negative number',
      },
    ]);
    expect(result.canApply).toBe(false);
  });

  it('does not allow application errors to masquerade as domain records', () => {
    expect(new AcademicApplicationError('TEST', 'test')).toBeInstanceOf(Error);
  });
});
