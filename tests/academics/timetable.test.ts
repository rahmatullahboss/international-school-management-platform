import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  SchedulingDomainError,
  TimetableRegistry,
} from '../../packages/modules/scheduling/src/index.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

function createTimetable(registry: TimetableRegistry, tenantId = tenantA) {
  return registry.createTimetable({
    tenantId,
    idempotencyKey: 'term-1-primary',
    academicYearId: 'academic-year-2026',
    termId: 'term-1',
    campusId: 'campus-main',
    name: 'Primary Term 1',
    effectiveFrom: '2026-08-01',
    effectiveTo: '2026-12-18',
    correlationId: 'corr-timetable',
  }).value;
}

function addMondayPattern(
  registry: TimetableRegistry,
  timetableVersionId: string,
  overrides: Partial<{
    sectionId: string;
    startsAt: string;
    endsAt: string;
    roomId: string;
    teacherIds: readonly string[];
    studentIds: readonly string[];
  }> = {},
) {
  return registry.addMeetingPattern({
    tenantId: tenantA,
    timetableVersionId,
    sectionId: overrides.sectionId ?? 'section-math',
    weekday: 1,
    startsAt: overrides.startsAt ?? '08:00',
    endsAt: overrides.endsAt ?? '09:00',
    timezone: 'Asia/Dhaka',
    roomId: overrides.roomId ?? 'room-101',
    teacherIds: overrides.teacherIds ?? ['teacher-a'],
    studentIds: overrides.studentIds ?? ['student-a', 'student-b'],
    validFrom: '2026-08-01',
    validTo: '2026-12-18',
    correlationId: 'corr-pattern',
  }).value;
}

describe('ACAD-01 timetable', () => {
  it('creates timetable versions idempotently with stable events', () => {
    const registry = new TimetableRegistry();
    const first = createTimetable(registry);
    const replay = createTimetable(registry);

    expect(replay.timetableVersionId).toBe(first.timetableVersionId);
    expect(registry.auditLog.entries()).toHaveLength(1);
  });

  it('materializes a local-time meeting once and exposes student/teacher views', () => {
    const registry = new TimetableRegistry();
    const timetable = createTimetable(registry);
    const pattern = addMondayPattern(registry, timetable.timetableVersionId);
    const first = registry.materializeMeeting({
      tenantId: tenantA,
      meetingPatternId: pattern.meetingPatternId,
      localDate: '2026-08-03',
      correlationId: 'corr-meeting',
    });
    const replay = registry.materializeMeeting({
      tenantId: tenantA,
      meetingPatternId: pattern.meetingPatternId,
      localDate: '2026-08-03',
      correlationId: 'corr-meeting-retry',
    });

    expect(replay.value.scheduledMeetingId).toBe(first.value.scheduledMeetingId);
    expect(replay.events).toHaveLength(0);
    expect(
      registry.scheduleForTeacher(tenantA, timetable.timetableVersionId, 'teacher-a'),
    ).toHaveLength(1);
    expect(
      registry.scheduleForStudent(tenantA, timetable.timetableVersionId, 'student-b'),
    ).toHaveLength(1);
  });

  it('detects teacher, room and student collisions and blocks publication', () => {
    const registry = new TimetableRegistry();
    const timetable = createTimetable(registry);
    const first = addMondayPattern(registry, timetable.timetableVersionId);
    const second = addMondayPattern(registry, timetable.timetableVersionId, {
      sectionId: 'section-science',
      startsAt: '08:30',
      endsAt: '09:30',
      roomId: 'room-101',
      teacherIds: ['teacher-a'],
      studentIds: ['student-b', 'student-c'],
    });
    registry.materializeMeeting({
      tenantId: tenantA,
      meetingPatternId: first.meetingPatternId,
      localDate: '2026-08-03',
      correlationId: 'corr-first',
    });
    registry.materializeMeeting({
      tenantId: tenantA,
      meetingPatternId: second.meetingPatternId,
      localDate: '2026-08-03',
      correlationId: 'corr-second',
    });

    expect(
      registry
        .conflicts(tenantA, timetable.timetableVersionId)
        .map((conflict) => conflict.resourceType)
        .sort(),
    ).toEqual(['room', 'student', 'teacher']);
    expect(() =>
      registry.publish({
        tenantId: tenantA,
        timetableVersionId: timetable.timetableVersionId,
        correlationId: 'corr-publish',
      }),
    ).toThrowError(expect.objectContaining({ code: 'SCHEDULE_CONFLICTS_BLOCK_PUBLICATION' }));
  });

  it('publishes immutable schedules and resolves dated substitutions', () => {
    const registry = new TimetableRegistry();
    const timetable = createTimetable(registry);
    const pattern = addMondayPattern(registry, timetable.timetableVersionId);
    const meeting = registry.materializeMeeting({
      tenantId: tenantA,
      meetingPatternId: pattern.meetingPatternId,
      localDate: '2026-08-03',
      correlationId: 'corr-meeting',
    }).value;
    registry.publish({
      tenantId: tenantA,
      timetableVersionId: timetable.timetableVersionId,
      correlationId: 'corr-publish',
    });

    expect(() =>
      addMondayPattern(registry, timetable.timetableVersionId, {
        sectionId: 'section-art',
        startsAt: '10:00',
        endsAt: '11:00',
      }),
    ).toThrowError(expect.objectContaining({ code: 'SCHEDULE_PUBLISHED_IMMUTABLE' }));

    registry.substitute({
      tenantId: tenantA,
      scheduledMeetingId: meeting.scheduledMeetingId,
      substituteTeacherId: 'teacher-cover',
      temporaryRoomId: 'room-202',
      reasonCode: 'teacher-absence',
      effectiveDate: '2026-08-03',
      createdBy: 'scheduler-user',
      correlationId: 'corr-substitution',
    });
    const resolved = registry.resolveMeeting(tenantA, meeting.scheduledMeetingId);
    expect(resolved.baseTeacherIds).toEqual(['teacher-a']);
    expect(resolved.teacherIds).toEqual(['teacher-cover']);
    expect(resolved.baseRoomId).toBe('room-101');
    expect(resolved.roomId).toBe('room-202');
    expect(
      registry.scheduleForTeacher(tenantA, timetable.timetableVersionId, 'teacher-cover'),
    ).toHaveLength(1);
    expect(
      registry.scheduleForTeacher(tenantA, timetable.timetableVersionId, 'teacher-a'),
    ).toHaveLength(0);
  });

  it('enforces tenant boundaries and declares migration safeguards', () => {
    const registry = new TimetableRegistry();
    const timetable = createTimetable(registry);
    expect(() => registry.conflicts(tenantB, timetable.timetableVersionId)).toThrow(
      SchedulingDomainError,
    );

    const migration = readFileSync(
      new URL(
        '../../packages/modules/scheduling/migrations/202607280202_ACAD-01_timetable.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS scheduling');
    expect(migration).toContain('published timetable versions are immutable');
    expect(migration).toContain('ALTER TABLE scheduling.%I FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("'202607280202_ACAD-01_timetable'");
    expect(migration).not.toContain('REFERENCES student_lifecycle');
    expect(migration).not.toContain('REFERENCES academics.');
  });
});
