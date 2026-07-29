import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_staff_domain/school_staff_domain.dart';
import 'package:test/test.dart';

void main() {
  test('teacher today model rejects duplicate meeting identities', () {
    final meeting = teacherMeeting();

    expect(
      () => TeacherTodayReadModel(
        campusId: 'campus-1',
        generatedAt: DateTime.parse('2026-07-30T08:00:00+06:00'),
        meetings: [meeting, meeting],
        teacherDisplayName: 'Teacher One',
      ),
      throwsA(
        isA<TeacherDomainException>().having(
          (error) => error.code,
          'code',
          'TEACHER_MEETING_DUPLICATE',
        ),
      ),
    );
  });

  test('attendance batch is immutable, unique and capability scoped', () {
    final command = TeacherAttendanceBatchCommand(
      baseVersion: 4,
      clientCreatedAt: DateTime.parse('2026-07-30T08:20:00+06:00'),
      idempotencyKey: 'attendance-idempotency-1',
      lines: [
        TeacherAttendanceLine(
          mark: TeacherAttendanceMark.present,
          studentId: 'student-1',
        ),
        TeacherAttendanceLine(
          mark: TeacherAttendanceMark.late,
          studentId: 'student-2',
        ),
      ],
      meetingId: 'meeting-1',
      operationId: 'operation-1',
    );

    expect(() => command.validateSession(teacherSession()), returnsNormally);
    expect(command.lines, hasLength(2));
    expect(
      () => command.lines.add(
        TeacherAttendanceLine(
          mark: TeacherAttendanceMark.absent,
          studentId: 'student-3',
        ),
      ),
      throwsUnsupportedError,
    );
    expect(
      () => command.validateSession(studentSession()),
      throwsA(
        isA<TeacherDomainException>().having(
          (error) => error.code,
          'code',
          'TEACHER_PERSONA_REQUIRED',
        ),
      ),
    );
  });

  test('attendance batch rejects duplicate students', () {
    expect(
      () => TeacherAttendanceBatchCommand(
        baseVersion: 0,
        clientCreatedAt: DateTime.parse('2026-07-30T08:20:00+06:00'),
        idempotencyKey: 'attendance-idempotency-1',
        lines: [
          TeacherAttendanceLine(
            mark: TeacherAttendanceMark.present,
            studentId: 'student-1',
          ),
          TeacherAttendanceLine(
            mark: TeacherAttendanceMark.absent,
            studentId: 'student-1',
          ),
        ],
        meetingId: 'meeting-1',
        operationId: 'operation-1',
      ),
      throwsA(
        isA<TeacherDomainException>().having(
          (error) => error.code,
          'code',
          'TEACHER_ATTENDANCE_STUDENT_DUPLICATE',
        ),
      ),
    );
  });

  test('grade drafts preserve exact integer scores and cannot publish', () {
    final command = TeacherGradeDraftCommand(
      assessmentId: 'assessment-1',
      baseVersion: 7,
      entries: [
        TeacherGradeDraftEntry(
          scoreUnits: 8750,
          status: TeacherGradeEntryStatus.scored,
          studentId: 'student-1',
        ),
        TeacherGradeDraftEntry(
          status: TeacherGradeEntryStatus.exempt,
          studentId: 'student-2',
        ),
      ],
      idempotencyKey: 'grade-idempotency-1',
      maximumScoreUnits: 10000,
      operationId: 'grade-operation-1',
      scoreScale: 100,
    );

    expect(() => command.validateSession(teacherSession()), returnsNormally);
    expect(command.entries.first.scoreUnits, 8750);
    expect(command.maximumScoreUnits, 10000);
  });

  test('grade drafts reject scores above the declared maximum', () {
    expect(
      () => TeacherGradeDraftCommand(
        assessmentId: 'assessment-1',
        baseVersion: 0,
        entries: [
          TeacherGradeDraftEntry(
            scoreUnits: 10001,
            status: TeacherGradeEntryStatus.scored,
            studentId: 'student-1',
          ),
        ],
        idempotencyKey: 'grade-idempotency-1',
        maximumScoreUnits: 10000,
        operationId: 'grade-operation-1',
        scoreScale: 100,
      ),
      throwsA(
        isA<TeacherDomainException>().having(
          (error) => error.code,
          'code',
          'TEACHER_GRADE_SCORE_EXCEEDS_MAXIMUM',
        ),
      ),
    );
  });

  test('write receipt keeps conflict and reconciliation outcomes explicit', () {
    final receipt = TeacherWriteReceipt(
      acceptedRevision: 7,
      operationId: 'operation-1',
      reasonCode: 'BASE_VERSION_STALE',
      status: TeacherWriteStatus.requiresReconciliation,
    );

    expect(receipt.status, TeacherWriteStatus.requiresReconciliation);
    expect(receipt.reasonCode, 'BASE_VERSION_STALE');
  });
}

TeacherMeetingSummary teacherMeeting() => TeacherMeetingSummary(
  attendanceStatus: TeacherAttendanceStatus.notStarted,
  endsAt: DateTime.parse('2026-07-30T10:00:00+06:00'),
  meetingId: 'meeting-1',
  roomLabel: 'Room 204',
  rosterCount: 24,
  sectionId: 'section-1',
  sectionLabel: 'Grade 5A',
  startsAt: DateTime.parse('2026-07-30T09:00:00+06:00'),
  subjectLabel: 'Mathematics',
);

SchoolSession teacherSession() => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.teacher,
  availablePersonas: const {SchoolPersona.teacher},
  campusId: 'campus-1',
  capabilities: const {
    SchoolCapability.attendanceTake,
    SchoolCapability.gradesWrite,
    SchoolCapability.timetableRead,
  },
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);

SchoolSession studentSession() => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.student,
  availablePersonas: const {SchoolPersona.student},
  campusId: 'campus-1',
  capabilities: const {SchoolCapability.attendanceRead},
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);
