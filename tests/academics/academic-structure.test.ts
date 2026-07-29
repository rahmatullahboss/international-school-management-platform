import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AcademicDomainError,
  AcademicRegistry,
} from '../../packages/modules/academics/src/index.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

function buildAcademicStructure(registry: AcademicRegistry, tenantId = tenantA, capacity = 2) {
  const year = registry.createAcademicYear({
    tenantId,
    idempotencyKey: 'year-2026',
    code: '2026-27',
    name: 'Academic Year 2026/27',
    startsOn: '2026-08-01',
    endsOn: '2027-06-30',
    correlationId: 'corr-year',
  }).value;
  const term = registry.addTerm({
    tenantId,
    academicYearId: year.academicYearId,
    code: 'T1',
    name: 'Term 1',
    startsOn: '2026-08-01',
    endsOn: '2026-12-18',
    sequence: 1,
    correlationId: 'corr-term',
  }).value;
  const curriculum = registry.createCurriculumVersion({
    tenantId,
    curriculumKey: 'ib-pyp',
    versionLabel: '2026.1',
    name: 'IB Primary Years Programme',
    countryPackRef: 'bd-school-v1',
    effectiveFrom: '2026-08-01',
    correlationId: 'corr-curriculum',
  }).value;
  const program = registry.createProgramVersion({
    tenantId,
    programKey: 'primary',
    versionLabel: '2026.1',
    curriculumVersionId: curriculum.curriculumVersionId,
    name: 'Primary School',
    gradeLevels: ['G1', 'G2', 'G3', 'G4', 'G5'],
    correlationId: 'corr-program',
  }).value;
  const course = registry.createCourseVersion({
    tenantId,
    courseKey: 'mathematics-g5',
    versionLabel: '2026.1',
    curriculumVersionId: curriculum.curriculumVersionId,
    code: 'MATH-G5',
    title: 'Mathematics Grade 5',
    credits: 1,
    correlationId: 'corr-course',
  }).value;
  const section = registry.createSection({
    tenantId,
    courseVersionId: course.courseVersionId,
    academicYearId: year.academicYearId,
    termId: term.termId,
    campusId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    code: 'MATH-G5-A',
    title: 'Mathematics Grade 5 — A',
    capacity,
    correlationId: 'corr-section',
  }).value;
  return { year, term, curriculum, program, course, section };
}

describe('ACAD-01 academic structure', () => {
  it('creates an idempotent year and emits tenant-scoped audit/event evidence', () => {
    const registry = new AcademicRegistry();
    const first = registry.createAcademicYear({
      tenantId: tenantA,
      idempotencyKey: 'year-2026',
      code: '2026-27',
      name: 'Academic Year 2026/27',
      startsOn: '2026-08-01',
      endsOn: '2027-06-30',
      correlationId: 'corr-year',
    });
    const replay = registry.createAcademicYear({
      tenantId: tenantA,
      idempotencyKey: 'year-2026',
      code: '2026-27',
      name: 'Academic Year 2026/27',
      startsOn: '2026-08-01',
      endsOn: '2027-06-30',
      correlationId: 'corr-retry',
    });

    expect(replay.value.academicYearId).toBe(first.value.academicYearId);
    expect(replay.events).toHaveLength(0);
    expect(first.events[0]).toMatchObject({
      eventType: 'academic.year.created.v1',
      tenantId: tenantA,
      aggregateId: first.value.academicYearId,
      correlationId: 'corr-year',
    });
    expect(registry.auditLog.entries()).toHaveLength(1);
  });

  it('validates term/calendar/bell schedule periods before publication', () => {
    const registry = new AcademicRegistry();
    const { year } = buildAcademicStructure(registry);

    expect(() =>
      registry.addTerm({
        tenantId: tenantA,
        academicYearId: year.academicYearId,
        code: 'T2',
        name: 'Overlapping Term',
        startsOn: '2026-12-01',
        endsOn: '2027-02-10',
        sequence: 2,
        correlationId: 'corr-overlap',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACAD_TERM_CONFLICT' }));

    const calendar = registry.defineCalendar({
      tenantId: tenantA,
      academicYearId: year.academicYearId,
      campusId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      timezone: 'Asia/Dhaka',
      days: [
        { date: '2026-08-01', instructional: false, label: 'Orientation' },
        { date: '2026-08-02', instructional: true, cycleDay: 'A' },
      ],
      correlationId: 'corr-calendar',
    }).value;
    expect(calendar.days).toHaveLength(2);

    expect(() =>
      registry.defineBellSchedule({
        tenantId: tenantA,
        campusId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Invalid schedule',
        timezone: 'Asia/Dhaka',
        effectiveFrom: '2026-08-01',
        periods: [
          { code: 'P1', startsAt: '08:00', endsAt: '09:00', attendanceRequired: true },
          { code: 'P2', startsAt: '08:45', endsAt: '09:45', attendanceRequired: true },
        ],
        correlationId: 'corr-bell',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACAD_BELL_PERIOD_OVERLAP' }));
  });

  it('freezes published versions and keeps course history stable', () => {
    const registry = new AcademicRegistry();
    const { year, course } = buildAcademicStructure(registry);
    registry.publish({
      tenantId: tenantA,
      aggregateType: 'academic-year',
      aggregateId: year.academicYearId,
      correlationId: 'corr-publish-year',
    });
    registry.publish({
      tenantId: tenantA,
      aggregateType: 'course',
      aggregateId: course.courseVersionId,
      correlationId: 'corr-publish-course',
    });

    expect(() =>
      registry.addTerm({
        tenantId: tenantA,
        academicYearId: year.academicYearId,
        code: 'T2',
        name: 'Term 2',
        startsOn: '2027-01-05',
        endsOn: '2027-06-30',
        sequence: 2,
        correlationId: 'corr-late-change',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACAD_PUBLISHED_IMMUTABLE' }));

    expect(registry.getCourseVersion(tenantA, course.courseVersionId)).toMatchObject({
      title: 'Mathematics Grade 5',
      credits: 1,
      state: 'published',
      version: 2,
    });
  });

  it('enforces section capacity, deduplicates roster entry and scopes reads by tenant', () => {
    const registry = new AcademicRegistry();
    const tenantAStructure = buildAcademicStructure(registry, tenantA, 1);
    const tenantBStructure = buildAcademicStructure(registry, tenantB, 2);

    const first = registry.enrollStudent({
      tenantId: tenantA,
      sectionId: tenantAStructure.section.sectionId,
      studentProfileId: 'student-a',
      enrollmentId: 'enrollment-a',
      joinedOn: '2026-08-01',
      correlationId: 'corr-roster-a',
    });
    const replay = registry.enrollStudent({
      tenantId: tenantA,
      sectionId: tenantAStructure.section.sectionId,
      studentProfileId: 'student-a',
      enrollmentId: 'enrollment-a',
      joinedOn: '2026-08-01',
      correlationId: 'corr-roster-a-retry',
    });
    expect(replay.value.rosterEntryId).toBe(first.value.rosterEntryId);
    expect(replay.events).toHaveLength(0);

    expect(() =>
      registry.enrollStudent({
        tenantId: tenantA,
        sectionId: tenantAStructure.section.sectionId,
        studentProfileId: 'student-b',
        enrollmentId: 'enrollment-b',
        joinedOn: '2026-08-01',
        correlationId: 'corr-capacity',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACAD_SECTION_CAPACITY_REACHED' }));

    expect(registry.listSections(tenantA)).toHaveLength(1);
    expect(registry.listSections(tenantB)[0]?.sectionId).toBe(tenantBStructure.section.sectionId);
    expect(() => registry.sectionRoster(tenantB, tenantAStructure.section.sectionId)).toThrow(
      AcademicDomainError,
    );
  });

  it('declares tenant RLS, stable opaque SIS references and migration evidence', () => {
    const migration = readFileSync(
      new URL(
        '../../packages/modules/academics/migrations/202607280201_ACAD-01_academic_structure.sql',
        import.meta.url,
      ),
      'utf8',
    );

    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS academics');
    expect(migration).toContain('ALTER TABLE academics.%I FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("current_setting(''app.tenant_id'', true)");
    expect(migration).toContain('published academic versions are immutable');
    expect(migration).toContain("'202607280201_ACAD-01_academic_structure'");
    expect(migration).not.toContain('REFERENCES student_lifecycle');
    expect(migration).not.toContain('REFERENCES people.');
    expect(migration).not.toContain('REFERENCES billing.');
  });
});
