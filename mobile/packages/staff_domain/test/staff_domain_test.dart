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

  test(
    'assessment list rejects duplicate assessment identities and invalid counts',
    () {
      final assessment = TeacherAssessmentSummary(
        assessmentId: 'assessment-1',
        assessmentTitle: 'Fractions quiz',
        categoryLabel: 'Quiz',
        dueAt: DateTime.parse('2026-08-22T09:00:00Z'),
        enteredCount: 12,
        lockState: TeacherGradebookLockState.open,
        maximumScoreUnits: 2000,
        rosterCount: 24,
        scoreScale: 100,
        sectionId: 'section-1',
        sectionLabel: 'Grade 5A',
        state: TeacherAssessmentState.published,
        subjectLabel: 'Mathematics',
        version: 3,
      );

      expect(assessment.isReadOnly, isFalse);
      expect(
        () => TeacherAssessmentListReadModel(
          assessments: [assessment, assessment],
          generatedAt: DateTime.parse('2026-08-22T09:00:00Z'),
          hasMore: false,
        ),
        throwsA(
          isA<TeacherDomainException>().having(
            (error) => error.code,
            'code',
            'TEACHER_ASSESSMENT_DUPLICATE',
          ),
        ),
      );
      expect(
        () => TeacherAssessmentSummary(
          assessmentId: 'assessment-2',
          assessmentTitle: 'Invalid counts',
          categoryLabel: 'Quiz',
          dueAt: DateTime.parse('2026-08-22T09:00:00Z'),
          enteredCount: 25,
          lockState: TeacherGradebookLockState.open,
          maximumScoreUnits: 2000,
          rosterCount: 24,
          scoreScale: 100,
          sectionId: 'section-1',
          sectionLabel: 'Grade 5A',
          state: TeacherAssessmentState.draft,
          subjectLabel: 'Mathematics',
          version: 1,
        ),
        throwsA(isA<TeacherDomainException>()),
      );
    },
  );

  test('conversation models keep thread and message identities unique', () {
    final summary = TeacherConversationSummary(
      canReply: true,
      conversationId: 'conversation-1',
      latestMessageAt: DateTime.parse('2026-08-22T09:00:00Z'),
      studentDisplayName: 'Student One',
      studentId: 'student-1',
      subject: 'Homework support',
    );
    expect(
      () => TeacherConversationListReadModel(
        conversations: [summary, summary],
        generatedAt: DateTime.parse('2026-08-22T09:00:00Z'),
        hasMore: false,
      ),
      throwsA(isA<TeacherDomainException>()),
    );

    final message = TeacherConversationMessage(
      authorLabel: 'Teacher One',
      authoredByViewer: true,
      body: 'Please review question 4.',
      messageId: 'message-1',
      sentAt: DateTime.parse('2026-08-22T09:00:00Z'),
    );
    expect(
      () => TeacherConversationMessagesReadModel(
        conversationId: 'conversation-1',
        hasMore: false,
        messages: [message, message],
        studentDisplayName: 'Student One',
        subject: 'Homework support',
      ),
      throwsA(isA<TeacherDomainException>()),
    );
  });

  test(
    'conversation commands enforce message bounds and separate capabilities',
    () {
      final session = SchoolSession(
        accountId: 'account-1',
        activePersona: SchoolPersona.teacher,
        availablePersonas: const {SchoolPersona.teacher},
        campusId: 'campus-1',
        capabilities: const {
          SchoolCapability.messagesRead,
          SchoolCapability.messagesSend,
        },
        locale: 'en-BD',
        tenantId: 'tenant-1',
        timeZone: 'Asia/Dhaka',
      );
      final send = TeacherConversationSendCommand(
        body: 'Please review this update.',
        conversationId: 'conversation-1',
        idempotencyKey: 'teacher-message-idempotency-0001',
      );
      final read = TeacherConversationReadCommand(
        conversationId: 'conversation-1',
        idempotencyKey: 'teacher-read-idempotency-0001',
        messageId: 'message-1',
      );

      expect(() => send.validateSession(session), returnsNormally);
      expect(() => read.validateSession(session), returnsNormally);
      final normalized = TeacherConversationSendCommand(
        body: ' padded ',
        conversationId: 'conversation-1',
        idempotencyKey: 'teacher-message-idempotency-0002',
      );
      expect(normalized.body, 'padded');
      expect(
        () => send.validateSession(teacherSession()),
        throwsA(
          isA<TeacherDomainException>().having(
            (error) => error.code,
            'code',
            'TEACHER_CAPABILITY_REQUIRED:${SchoolCapability.messagesSend}',
          ),
        ),
      );
    },
  );
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
