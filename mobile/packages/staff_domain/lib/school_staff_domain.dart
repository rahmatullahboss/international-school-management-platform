/// Immutable contracts for teacher-first mobile workflows.
library;

import 'package:school_mobile_core/mobile_core.dart';

enum TeacherAttendanceStatus { notStarted, draft, submitted, locked }

enum TeacherAttendanceMark { present, absent, late, excused }

enum TeacherWriteStatus {
  accepted,
  duplicate,
  conflict,
  rejected,
  requiresReconciliation,
}

enum TeacherGradeEntryStatus { scored, missing, exempt }

enum TeacherAssessmentState { draft, published, closed }

enum TeacherGradebookLockState { open, locked }

final class TeacherMeetingSummary {
  factory TeacherMeetingSummary({
    required TeacherAttendanceStatus attendanceStatus,
    required SchoolAuthoritativeTimestamp endsAt,
    required String meetingId,
    required String roomLabel,
    required int rosterCount,
    required String sectionId,
    required String sectionLabel,
    required SchoolAuthoritativeTimestamp startsAt,
    required String subjectLabel,
    String? substitutionForTeacherLabel,
  }) {
    if (!endsAt.instantUtc.isAfter(startsAt.instantUtc)) {
      throw const TeacherDomainException('TEACHER_MEETING_TIME_INVALID');
    }
    if (rosterCount < 0) {
      throw const TeacherDomainException('TEACHER_ROSTER_COUNT_INVALID');
    }
    return TeacherMeetingSummary._(
      attendanceStatus: attendanceStatus,
      endsAt: endsAt,
      meetingId: _required(meetingId, 'meetingId'),
      roomLabel: _required(roomLabel, 'roomLabel'),
      rosterCount: rosterCount,
      sectionId: _required(sectionId, 'sectionId'),
      sectionLabel: _required(sectionLabel, 'sectionLabel'),
      startsAt: startsAt,
      subjectLabel: _required(subjectLabel, 'subjectLabel'),
      substitutionForTeacherLabel: _optional(substitutionForTeacherLabel),
    );
  }

  const TeacherMeetingSummary._({
    required this.attendanceStatus,
    required this.endsAt,
    required this.meetingId,
    required this.roomLabel,
    required this.rosterCount,
    required this.sectionId,
    required this.sectionLabel,
    required this.startsAt,
    required this.subjectLabel,
    required this.substitutionForTeacherLabel,
  });

  final String meetingId;
  final String sectionId;
  final String sectionLabel;
  final String subjectLabel;
  final String roomLabel;
  final SchoolAuthoritativeTimestamp startsAt;
  final SchoolAuthoritativeTimestamp endsAt;
  final int rosterCount;
  final TeacherAttendanceStatus attendanceStatus;
  final String? substitutionForTeacherLabel;

  bool get isSubstitution => substitutionForTeacherLabel != null;
}

final class TeacherTodayReadModel {
  factory TeacherTodayReadModel({
    required String campusId,
    required SchoolAuthoritativeTimestamp generatedAt,
    required Iterable<TeacherMeetingSummary> meetings,
    required String teacherDisplayName,
  }) {
    final normalizedMeetings = List<TeacherMeetingSummary>.unmodifiable(
      meetings,
    );
    _requireUnique(
      normalizedMeetings.map((meeting) => meeting.meetingId),
      'TEACHER_MEETING_DUPLICATE',
    );
    return TeacherTodayReadModel._(
      campusId: _required(campusId, 'campusId'),
      generatedAt: generatedAt,
      meetings: normalizedMeetings,
      teacherDisplayName: _required(teacherDisplayName, 'teacherDisplayName'),
    );
  }

  const TeacherTodayReadModel._({
    required this.campusId,
    required this.generatedAt,
    required this.meetings,
    required this.teacherDisplayName,
  });

  final String campusId;
  final String teacherDisplayName;
  final SchoolAuthoritativeTimestamp generatedAt;
  final List<TeacherMeetingSummary> meetings;
}

final class TeacherRosterStudent {
  factory TeacherRosterStudent({
    required String displayName,
    required String rollLabel,
    required String studentId,
  }) => TeacherRosterStudent._(
    displayName: _required(displayName, 'displayName'),
    rollLabel: _required(rollLabel, 'rollLabel'),
    studentId: _required(studentId, 'studentId'),
  );

  const TeacherRosterStudent._({
    required this.displayName,
    required this.rollLabel,
    required this.studentId,
  });

  final String studentId;
  final String displayName;
  final String rollLabel;
}

final class TeacherRosterReadModel {
  factory TeacherRosterReadModel({
    required String meetingId,
    required String sectionId,
    required Iterable<TeacherRosterStudent> students,
    required int version,
  }) {
    if (version < 0) {
      throw const TeacherDomainException('TEACHER_ROSTER_VERSION_INVALID');
    }
    final normalizedStudents = List<TeacherRosterStudent>.unmodifiable(
      students,
    );
    _requireUnique(
      normalizedStudents.map((student) => student.studentId),
      'TEACHER_ROSTER_STUDENT_DUPLICATE',
    );
    return TeacherRosterReadModel._(
      meetingId: _required(meetingId, 'meetingId'),
      sectionId: _required(sectionId, 'sectionId'),
      students: normalizedStudents,
      version: version,
    );
  }

  const TeacherRosterReadModel._({
    required this.meetingId,
    required this.sectionId,
    required this.students,
    required this.version,
  });

  final String meetingId;
  final String sectionId;
  final int version;
  final List<TeacherRosterStudent> students;
}

final class TeacherAttendanceLine {
  factory TeacherAttendanceLine({
    required TeacherAttendanceMark mark,
    required String studentId,
  }) => TeacherAttendanceLine._(
    mark: mark,
    studentId: _required(studentId, 'studentId'),
  );

  const TeacherAttendanceLine._({required this.mark, required this.studentId});

  final String studentId;
  final TeacherAttendanceMark mark;
}

final class TeacherAttendanceBatchCommand {
  factory TeacherAttendanceBatchCommand({
    required int baseVersion,
    required DateTime clientCreatedAt,
    required String idempotencyKey,
    required Iterable<TeacherAttendanceLine> lines,
    required String meetingId,
    required String operationId,
  }) {
    if (baseVersion < 0) {
      throw const TeacherDomainException('TEACHER_ATTENDANCE_VERSION_INVALID');
    }
    final normalizedLines = List<TeacherAttendanceLine>.unmodifiable(lines);
    if (normalizedLines.isEmpty) {
      throw const TeacherDomainException('TEACHER_ATTENDANCE_LINES_REQUIRED');
    }
    _requireUnique(
      normalizedLines.map((line) => line.studentId),
      'TEACHER_ATTENDANCE_STUDENT_DUPLICATE',
    );
    return TeacherAttendanceBatchCommand._(
      baseVersion: baseVersion,
      clientCreatedAt: clientCreatedAt,
      idempotencyKey: _required(idempotencyKey, 'idempotencyKey'),
      lines: normalizedLines,
      meetingId: _required(meetingId, 'meetingId'),
      operationId: _required(operationId, 'operationId'),
    );
  }

  const TeacherAttendanceBatchCommand._({
    required this.baseVersion,
    required this.clientCreatedAt,
    required this.idempotencyKey,
    required this.lines,
    required this.meetingId,
    required this.operationId,
  });

  final String operationId;
  final String idempotencyKey;
  final String meetingId;
  final int baseVersion;
  final DateTime clientCreatedAt;
  final List<TeacherAttendanceLine> lines;

  void validateSession(SchoolSession session) {
    _requireTeacherCapability(session, SchoolCapability.attendanceTake);
  }
}

final class TeacherGradeDraftEntry {
  factory TeacherGradeDraftEntry({
    required TeacherGradeEntryStatus status,
    required String studentId,
    int? scoreUnits,
  }) {
    if (status == TeacherGradeEntryStatus.scored) {
      if (scoreUnits == null || scoreUnits < 0) {
        throw const TeacherDomainException('TEACHER_GRADE_SCORE_REQUIRED');
      }
    } else if (scoreUnits != null) {
      throw const TeacherDomainException('TEACHER_GRADE_SCORE_NOT_ALLOWED');
    }
    return TeacherGradeDraftEntry._(
      scoreUnits: scoreUnits,
      status: status,
      studentId: _required(studentId, 'studentId'),
    );
  }

  const TeacherGradeDraftEntry._({
    required this.scoreUnits,
    required this.status,
    required this.studentId,
  });

  final String studentId;
  final TeacherGradeEntryStatus status;
  final int? scoreUnits;
}

final class TeacherGradeDraftCommand {
  factory TeacherGradeDraftCommand({
    required String assessmentId,
    required int baseVersion,
    required Iterable<TeacherGradeDraftEntry> entries,
    required String idempotencyKey,
    required int maximumScoreUnits,
    required String operationId,
    required int scoreScale,
  }) {
    if (baseVersion < 0) {
      throw const TeacherDomainException('TEACHER_GRADE_VERSION_INVALID');
    }
    if (scoreScale < 1 || maximumScoreUnits < 1) {
      throw const TeacherDomainException('TEACHER_GRADE_SCALE_INVALID');
    }
    final normalizedEntries = List<TeacherGradeDraftEntry>.unmodifiable(
      entries,
    );
    if (normalizedEntries.isEmpty) {
      throw const TeacherDomainException('TEACHER_GRADE_ENTRIES_REQUIRED');
    }
    _requireUnique(
      normalizedEntries.map((entry) => entry.studentId),
      'TEACHER_GRADE_STUDENT_DUPLICATE',
    );
    if (normalizedEntries.any(
      (entry) =>
          entry.status == TeacherGradeEntryStatus.scored &&
          entry.scoreUnits! > maximumScoreUnits,
    )) {
      throw const TeacherDomainException('TEACHER_GRADE_SCORE_EXCEEDS_MAXIMUM');
    }
    return TeacherGradeDraftCommand._(
      assessmentId: _required(assessmentId, 'assessmentId'),
      baseVersion: baseVersion,
      entries: normalizedEntries,
      idempotencyKey: _required(idempotencyKey, 'idempotencyKey'),
      maximumScoreUnits: maximumScoreUnits,
      operationId: _required(operationId, 'operationId'),
      scoreScale: scoreScale,
    );
  }

  const TeacherGradeDraftCommand._({
    required this.assessmentId,
    required this.baseVersion,
    required this.entries,
    required this.idempotencyKey,
    required this.maximumScoreUnits,
    required this.operationId,
    required this.scoreScale,
  });

  final String operationId;
  final String idempotencyKey;
  final String assessmentId;
  final int baseVersion;
  final int scoreScale;
  final int maximumScoreUnits;
  final List<TeacherGradeDraftEntry> entries;

  void validateSession(SchoolSession session) {
    _requireTeacherCapability(session, SchoolCapability.gradesWrite);
  }
}

final class TeacherWriteReceipt {
  factory TeacherWriteReceipt({
    required int acceptedRevision,
    required String operationId,
    required TeacherWriteStatus status,
    String? reasonCode,
  }) {
    if (acceptedRevision < 0) {
      throw const TeacherDomainException('TEACHER_RECEIPT_REVISION_INVALID');
    }
    return TeacherWriteReceipt._(
      acceptedRevision: acceptedRevision,
      operationId: _required(operationId, 'operationId'),
      reasonCode: _optional(reasonCode),
      status: status,
    );
  }

  const TeacherWriteReceipt._({
    required this.acceptedRevision,
    required this.operationId,
    required this.reasonCode,
    required this.status,
  });

  final String operationId;
  final int acceptedRevision;
  final TeacherWriteStatus status;
  final String? reasonCode;
}

final class TeacherAssessmentSummary {
  factory TeacherAssessmentSummary({
    required String assessmentId,
    required String assessmentTitle,
    required String categoryLabel,
    required SchoolAuthoritativeTimestamp dueAt,
    required int enteredCount,
    required TeacherGradebookLockState lockState,
    required int maximumScoreUnits,
    required int rosterCount,
    required int scoreScale,
    required String sectionId,
    required String sectionLabel,
    required TeacherAssessmentState state,
    required String subjectLabel,
    required int version,
  }) {
    if (enteredCount < 0 || rosterCount < 0 || enteredCount > rosterCount) {
      throw const TeacherDomainException('TEACHER_ASSESSMENT_COUNTS_INVALID');
    }
    if (scoreScale < 1 || maximumScoreUnits < 1 || version < 1) {
      throw const TeacherDomainException('TEACHER_ASSESSMENT_SCALE_INVALID');
    }
    return TeacherAssessmentSummary._(
      assessmentId: _required(assessmentId, 'assessmentId'),
      assessmentTitle: _required(assessmentTitle, 'assessmentTitle'),
      categoryLabel: _required(categoryLabel, 'categoryLabel'),
      dueAt: dueAt,
      enteredCount: enteredCount,
      lockState: lockState,
      maximumScoreUnits: maximumScoreUnits,
      rosterCount: rosterCount,
      scoreScale: scoreScale,
      sectionId: _required(sectionId, 'sectionId'),
      sectionLabel: _required(sectionLabel, 'sectionLabel'),
      state: state,
      subjectLabel: _required(subjectLabel, 'subjectLabel'),
      version: version,
    );
  }

  const TeacherAssessmentSummary._({
    required this.assessmentId,
    required this.assessmentTitle,
    required this.categoryLabel,
    required this.dueAt,
    required this.enteredCount,
    required this.lockState,
    required this.maximumScoreUnits,
    required this.rosterCount,
    required this.scoreScale,
    required this.sectionId,
    required this.sectionLabel,
    required this.state,
    required this.subjectLabel,
    required this.version,
  });

  final String assessmentId;
  final String sectionId;
  final String sectionLabel;
  final String subjectLabel;
  final String assessmentTitle;
  final String categoryLabel;
  final SchoolAuthoritativeTimestamp dueAt;
  final TeacherAssessmentState state;
  final TeacherGradebookLockState lockState;
  final int version;
  final int scoreScale;
  final int maximumScoreUnits;
  final int rosterCount;
  final int enteredCount;

  bool get isReadOnly =>
      state == TeacherAssessmentState.closed ||
      lockState == TeacherGradebookLockState.locked;
}

final class TeacherAssessmentListReadModel {
  factory TeacherAssessmentListReadModel({
    required Iterable<TeacherAssessmentSummary> assessments,
    required SchoolAuthoritativeTimestamp generatedAt,
    required bool hasMore,
  }) {
    final normalized = List<TeacherAssessmentSummary>.unmodifiable(assessments);
    _requireUnique(
      normalized.map((assessment) => assessment.assessmentId),
      'TEACHER_ASSESSMENT_DUPLICATE',
    );
    return TeacherAssessmentListReadModel._(
      assessments: normalized,
      generatedAt: generatedAt,
      hasMore: hasMore,
    );
  }

  const TeacherAssessmentListReadModel._({
    required this.assessments,
    required this.generatedAt,
    required this.hasMore,
  });

  final List<TeacherAssessmentSummary> assessments;
  final SchoolAuthoritativeTimestamp generatedAt;
  final bool hasMore;
}

final class TeacherConversationSummary {
  factory TeacherConversationSummary({
    required bool canReply,
    required String conversationId,
    required SchoolAuthoritativeTimestamp latestMessageAt,
    required String studentDisplayName,
    required String studentId,
    required String subject,
  }) => TeacherConversationSummary._(
    canReply: canReply,
    conversationId: _required(conversationId, 'conversationId'),
    latestMessageAt: latestMessageAt,
    studentDisplayName: _required(studentDisplayName, 'studentDisplayName'),
    studentId: _required(studentId, 'studentId'),
    subject: _required(subject, 'subject'),
  );

  const TeacherConversationSummary._({
    required this.canReply,
    required this.conversationId,
    required this.latestMessageAt,
    required this.studentDisplayName,
    required this.studentId,
    required this.subject,
  });

  final String conversationId;
  final String studentId;
  final String studentDisplayName;
  final String subject;
  final SchoolAuthoritativeTimestamp latestMessageAt;
  final bool canReply;
}

final class TeacherConversationListReadModel {
  factory TeacherConversationListReadModel({
    required Iterable<TeacherConversationSummary> conversations,
    required SchoolAuthoritativeTimestamp generatedAt,
    required bool hasMore,
  }) {
    final normalized = List<TeacherConversationSummary>.unmodifiable(
      conversations,
    );
    _requireUnique(
      normalized.map((conversation) => conversation.conversationId),
      'TEACHER_CONVERSATION_DUPLICATE',
    );
    return TeacherConversationListReadModel._(
      conversations: normalized,
      generatedAt: generatedAt,
      hasMore: hasMore,
    );
  }

  const TeacherConversationListReadModel._({
    required this.conversations,
    required this.generatedAt,
    required this.hasMore,
  });

  final List<TeacherConversationSummary> conversations;
  final SchoolAuthoritativeTimestamp generatedAt;
  final bool hasMore;
}

final class TeacherConversationMessage {
  factory TeacherConversationMessage({
    required String authorLabel,
    required bool authoredByViewer,
    required String body,
    required String messageId,
    required SchoolAuthoritativeTimestamp sentAt,
  }) => TeacherConversationMessage._(
    authorLabel: _required(authorLabel, 'authorLabel'),
    authoredByViewer: authoredByViewer,
    body: _required(body, 'body'),
    messageId: _required(messageId, 'messageId'),
    sentAt: sentAt,
  );

  const TeacherConversationMessage._({
    required this.authorLabel,
    required this.authoredByViewer,
    required this.body,
    required this.messageId,
    required this.sentAt,
  });

  final String messageId;
  final String authorLabel;
  final String body;
  final SchoolAuthoritativeTimestamp sentAt;
  final bool authoredByViewer;
}

final class TeacherConversationMessagesReadModel {
  factory TeacherConversationMessagesReadModel({
    required String conversationId,
    required Iterable<TeacherConversationMessage> messages,
    required String studentDisplayName,
    required String subject,
    required bool hasMore,
  }) {
    final normalized = List<TeacherConversationMessage>.unmodifiable(messages);
    _requireUnique(
      normalized.map((message) => message.messageId),
      'TEACHER_CONVERSATION_MESSAGE_DUPLICATE',
    );
    return TeacherConversationMessagesReadModel._(
      conversationId: _required(conversationId, 'conversationId'),
      hasMore: hasMore,
      messages: normalized,
      studentDisplayName: _required(studentDisplayName, 'studentDisplayName'),
      subject: _required(subject, 'subject'),
    );
  }

  const TeacherConversationMessagesReadModel._({
    required this.conversationId,
    required this.hasMore,
    required this.messages,
    required this.studentDisplayName,
    required this.subject,
  });

  final String conversationId;
  final String studentDisplayName;
  final String subject;
  final List<TeacherConversationMessage> messages;
  final bool hasMore;
}

final class TeacherConversationSendCommand {
  factory TeacherConversationSendCommand({
    required String body,
    required String conversationId,
    required String idempotencyKey,
  }) {
    final normalizedBody = body.trim();
    if (normalizedBody.isEmpty || normalizedBody.length > 4000) {
      throw const TeacherDomainException(
        'TEACHER_CONVERSATION_MESSAGE_INVALID',
      );
    }
    return TeacherConversationSendCommand._(
      body: normalizedBody,
      conversationId: _required(conversationId, 'conversationId'),
      idempotencyKey: _required(idempotencyKey, 'idempotencyKey'),
    );
  }

  const TeacherConversationSendCommand._({
    required this.body,
    required this.conversationId,
    required this.idempotencyKey,
  });

  final String body;
  final String conversationId;
  final String idempotencyKey;

  void validateSession(SchoolSession session) {
    _requireTeacherCapability(session, SchoolCapability.messagesSend);
  }
}

final class TeacherConversationReadCommand {
  factory TeacherConversationReadCommand({
    required String conversationId,
    required String idempotencyKey,
    required String messageId,
  }) => TeacherConversationReadCommand._(
    conversationId: _required(conversationId, 'conversationId'),
    idempotencyKey: _required(idempotencyKey, 'idempotencyKey'),
    messageId: _required(messageId, 'messageId'),
  );

  const TeacherConversationReadCommand._({
    required this.conversationId,
    required this.idempotencyKey,
    required this.messageId,
  });

  final String conversationId;
  final String idempotencyKey;
  final String messageId;

  void validateSession(SchoolSession session) {
    _requireTeacherCapability(session, SchoolCapability.messagesRead);
  }
}

abstract interface class TeacherExtendedReadRepository {
  Future<TeacherAssessmentListReadModel> loadAssessments(
    SchoolSession session, {
    String correlationId = 'teacher-assessments',
  });

  Future<TeacherConversationListReadModel> loadConversations(
    SchoolSession session, {
    String correlationId = 'teacher-conversations',
  });

  Future<TeacherConversationMessagesReadModel> loadConversationMessages({
    required String conversationId,
    required SchoolSession session,
    String correlationId = 'teacher-conversation-messages',
  });

  Future<TeacherConversationMessage> sendConversationMessage({
    required TeacherConversationSendCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-conversation-send',
  });

  Future<int> markConversationRead({
    required TeacherConversationReadCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-conversation-read',
  });
}

abstract interface class TeacherJourneyRepository {
  Future<TeacherTodayReadModel> loadToday(
    SchoolSession session, {
    String correlationId = 'teacher-today',
  });

  Future<TeacherRosterReadModel> loadRoster({
    required String meetingId,
    required SchoolSession session,
    String correlationId = 'teacher-roster',
  });

  Future<TeacherWriteReceipt> submitAttendance({
    required TeacherAttendanceBatchCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-attendance-batch',
  });

  Future<TeacherWriteReceipt> saveGradeDraft({
    required TeacherGradeDraftCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-grade-draft',
  });
}

final class TeacherDomainException implements Exception {
  const TeacherDomainException(this.code);

  final String code;

  @override
  String toString() => 'TeacherDomainException($code)';
}

void _requireTeacherCapability(SchoolSession session, String capability) {
  if (session.activePersona != SchoolPersona.teacher) {
    throw const TeacherDomainException('TEACHER_PERSONA_REQUIRED');
  }
  if (!session.can(capability)) {
    throw TeacherDomainException('TEACHER_CAPABILITY_REQUIRED:$capability');
  }
}

String _required(String value, String field) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw TeacherDomainException('TEACHER_FIELD_REQUIRED:$field');
  }
  return normalized;
}

String? _optional(String? value) {
  final normalized = value?.trim();
  return normalized == null || normalized.isEmpty ? null : normalized;
}

void _requireUnique(Iterable<String> values, String code) {
  final seen = <String>{};
  for (final value in values) {
    if (!seen.add(value)) {
      throw TeacherDomainException(code);
    }
  }
}
