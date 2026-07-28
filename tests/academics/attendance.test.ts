import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AttendanceDomainError,
  AttendanceRegistry,
  type AttendanceCode,
} from '../../packages/modules/attendance/src/index.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

function createPolicy(registry: AttendanceRegistry) {
  const policy = registry.createPolicy({
    tenantId: tenantA,
    policyKey: 'default-attendance',
    versionLabel: '2026.1',
    minimumPresentMinutes: 35,
    lateAfterMinutes: 10,
    chronicAbsenceThresholdPercent: 20,
    correlationId: 'corr-policy',
  }).value;
  const codes: Record<'present' | 'absent' | 'late' | 'excused', AttendanceCode> = {
    present: registry.addCode({
      tenantId: tenantA,
      policyVersionId: policy.policyVersionId,
      code: 'P',
      label: 'Present',
      meaning: 'present',
      countsAsPresent: true,
      correlationId: 'corr-code-p',
    }).value,
    absent: registry.addCode({
      tenantId: tenantA,
      policyVersionId: policy.policyVersionId,
      code: 'A',
      label: 'Absent',
      meaning: 'absent',
      countsAsPresent: false,
      requiresReason: true,
      correlationId: 'corr-code-a',
    }).value,
    late: registry.addCode({
      tenantId: tenantA,
      policyVersionId: policy.policyVersionId,
      code: 'L',
      label: 'Late',
      meaning: 'late',
      countsAsPresent: true,
      correlationId: 'corr-code-l',
    }).value,
    excused: registry.addCode({
      tenantId: tenantA,
      policyVersionId: policy.policyVersionId,
      code: 'E',
      label: 'Excused absence',
      meaning: 'excused',
      countsAsPresent: false,
      requiresReason: true,
      correlationId: 'corr-code-e',
    }).value,
  };
  registry.publishPolicy({
    tenantId: tenantA,
    policyVersionId: policy.policyVersionId,
    correlationId: 'corr-publish-policy',
  });
  return { policy, codes };
}

function openSession(
  registry: AttendanceRegistry,
  scheduledMeetingId = 'meeting-1',
  localDate = '2026-08-03',
) {
  return registry.openSession({
    tenantId: tenantA,
    scheduledMeetingId,
    sectionId: 'section-math',
    campusId: 'campus-main',
    localDate,
    startsAt: '08:00',
    endsAt: '09:00',
    timezone: 'Asia/Dhaka',
    rosterStudentIds: ['student-a', 'student-b'],
    correlationId: `corr-session-${scheduledMeetingId}`,
  }).value;
}

describe('ACAD-01 attendance', () => {
  it('publishes a versioned policy only with present and absent codes', () => {
    const registry = new AttendanceRegistry();
    const { policy } = createPolicy(registry);

    expect(() =>
      registry.addCode({
        tenantId: tenantA,
        policyVersionId: policy.policyVersionId,
        code: 'R',
        label: 'Remote',
        meaning: 'remote',
        countsAsPresent: true,
        correlationId: 'corr-after-publish',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ATTENDANCE_POLICY_PUBLISHED_IMMUTABLE' }));
  });

  it('accepts offline batches idempotently and rejects invalid rows without duplicating results', () => {
    const registry = new AttendanceRegistry();
    const { codes } = createPolicy(registry);
    const session = openSession(registry);
    const entries = [
      {
        clientRecordId: 'device-1-record-a',
        sessionId: session.sessionId,
        studentProfileId: 'student-a',
        attendanceCodeId: codes.present.attendanceCodeId,
        source: 'teacher' as const,
        recordedBy: 'teacher-a',
      },
      {
        clientRecordId: 'device-1-record-b',
        sessionId: session.sessionId,
        studentProfileId: 'student-b',
        attendanceCodeId: codes.absent.attendanceCodeId,
        source: 'teacher' as const,
        recordedBy: 'teacher-a',
      },
    ];
    const first = registry.sync({
      tenantId: tenantA,
      clientBatchId: 'batch-1',
      deviceId: 'tablet-1',
      entries,
      correlationId: 'corr-sync',
    });
    const replay = registry.sync({
      tenantId: tenantA,
      clientBatchId: 'batch-1',
      deviceId: 'tablet-1',
      entries,
      correlationId: 'corr-sync-retry',
    });

    expect(first.value).toMatchObject({ accepted: 1, replayed: 0, rejected: 1 });
    expect(replay.value.syncBatchId).toBe(first.value.syncBatchId);
    expect(replay.events).toHaveLength(0);
    expect(registry.sessionRecords(tenantA, session.sessionId)).toHaveLength(1);
    expect(registry.missingStudents(tenantA, session.sessionId)).toEqual(['student-b']);

    expect(() =>
      registry.sync({
        tenantId: tenantA,
        clientBatchId: 'batch-1',
        deviceId: 'tablet-1',
        entries: [{ ...entries[0]!, attendanceCodeId: codes.late.attendanceCodeId }],
        correlationId: 'corr-conflict',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ATTENDANCE_BATCH_ID_CONFLICT' }));
  });

  it('requires a complete roster before finalization and approval for later amendments', () => {
    const registry = new AttendanceRegistry();
    const { codes } = createPolicy(registry);
    const session = openSession(registry);
    registry.sync({
      tenantId: tenantA,
      clientBatchId: 'batch-complete',
      deviceId: 'tablet-1',
      entries: [
        {
          clientRecordId: 'record-a',
          sessionId: session.sessionId,
          studentProfileId: 'student-a',
          attendanceCodeId: codes.present.attendanceCodeId,
          source: 'teacher',
          recordedBy: 'teacher-a',
        },
        {
          clientRecordId: 'record-b',
          sessionId: session.sessionId,
          studentProfileId: 'student-b',
          attendanceCodeId: codes.absent.attendanceCodeId,
          reason: 'Illness',
          source: 'teacher',
          recordedBy: 'teacher-a',
        },
      ],
      correlationId: 'corr-complete',
    });
    registry.finalize({
      tenantId: tenantA,
      sessionId: session.sessionId,
      finalizedBy: 'office-a',
      correlationId: 'corr-finalize',
    });

    expect(() =>
      registry.amend({
        tenantId: tenantA,
        sessionId: session.sessionId,
        studentProfileId: 'student-b',
        replacementAttendanceCodeId: codes.excused.attendanceCodeId,
        reason: 'Medical evidence received',
        amendedBy: 'office-a',
        correlationId: 'corr-amend-denied',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ATTENDANCE_FINALIZED_AMENDMENT_FORBIDDEN' }));

    const amended = registry.amend({
      tenantId: tenantA,
      sessionId: session.sessionId,
      studentProfileId: 'student-b',
      replacementAttendanceCodeId: codes.excused.attendanceCodeId,
      reason: 'Medical evidence received',
      amendedBy: 'office-a',
      approvedBy: 'attendance-manager',
      canAmendFinalized: true,
      correlationId: 'corr-amend-approved',
    }).value;
    expect(amended.version).toBe(2);
    expect(registry.amendments(tenantA, amended.attendanceRecordId)[0]).toMatchObject({
      previousAttendanceCodeId: codes.absent.attendanceCodeId,
      replacementAttendanceCodeId: codes.excused.attendanceCodeId,
      previousVersion: 1,
      replacementVersion: 2,
      approvedBy: 'attendance-manager',
    });
  });

  it('produces explainable attendance summaries and chronic absence alerts', () => {
    const registry = new AttendanceRegistry();
    const { policy, codes } = createPolicy(registry);
    const firstSession = openSession(registry, 'meeting-1', '2026-08-03');
    const secondSession = openSession(registry, 'meeting-2', '2026-08-04');
    registry.sync({
      tenantId: tenantA,
      clientBatchId: 'summary-batch-1',
      deviceId: 'tablet-1',
      entries: [
        {
          clientRecordId: 'summary-a-1',
          sessionId: firstSession.sessionId,
          studentProfileId: 'student-a',
          attendanceCodeId: codes.present.attendanceCodeId,
          source: 'teacher',
          recordedBy: 'teacher-a',
        },
      ],
      correlationId: 'corr-summary-1',
    });
    registry.sync({
      tenantId: tenantA,
      clientBatchId: 'summary-batch-2',
      deviceId: 'tablet-1',
      entries: [
        {
          clientRecordId: 'summary-a-2',
          sessionId: secondSession.sessionId,
          studentProfileId: 'student-a',
          attendanceCodeId: codes.absent.attendanceCodeId,
          reason: 'Unwell',
          source: 'teacher',
          recordedBy: 'teacher-a',
        },
      ],
      correlationId: 'corr-summary-2',
    });

    expect(
      registry.summary({
        tenantId: tenantA,
        policyVersionId: policy.policyVersionId,
        studentProfileId: 'student-a',
      }),
    ).toEqual({
      studentProfileId: 'student-a',
      sessions: 2,
      present: 1,
      absent: 1,
      late: 0,
      excused: 0,
      remote: 0,
      attendancePercent: 50,
      chronicAbsenceAlert: true,
    });
  });

  it('keeps tenant boundaries and declares forced-RLS append-only migration evidence', () => {
    const registry = new AttendanceRegistry();
    const session = openSession(registry);
    expect(() => registry.missingStudents(tenantB, session.sessionId)).toThrow(
      AttendanceDomainError,
    );

    const migration = readFileSync(
      new URL(
        '../../packages/modules/attendance/migrations/202607280203_ACAD-01_attendance.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS attendance');
    expect(migration).toContain('UNIQUE (tenant_id, session_id, student_profile_id)');
    expect(migration).toContain('attendance evidence is append-only');
    expect(migration).toContain('ALTER TABLE attendance.%I FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("'202607280203_ACAD-01_attendance'");
    expect(migration).not.toContain('REFERENCES scheduling.');
    expect(migration).not.toContain('REFERENCES student_lifecycle.');
  });
});
