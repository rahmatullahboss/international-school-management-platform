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

final class TeacherMeetingSummary {
  factory TeacherMeetingSummary({
    required TeacherAttendanceStatus attendanceStatus,
    required DateTime endsAt,
    required String meetingId,
    required String roomLabel,
    required int rosterCount,
    required String sectionId,
    required String sectionLabel,
    required DateTime startsAt,
    required String subjectLabel,
    String? substitutionForTeacherLabel,
  }) {
    if (!endsAt.isAfter(startsAt)) {
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
  final DateTime startsAt;
  final DateTime endsAt;
  final int rosterCount;
  final TeacherAttendanceStatus attendanceStatus;
  final String? substitutionForTeacherLabel;

  bool get isSubstitution => substitutionForTeacherLabel != null;
}

final class TeacherTodayReadModel {
  factory TeacherTodayReadModel({
    required String campusId,
    required DateTime generatedAt,
    required Iterable<TeacherMeetingSummary> meetings,
    required String teacherDisplayName,
  }) {
    final normalizedMeetings = List<TeacherMeetingSummary>.unmodifiable(meetings);
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
  final DateTime generatedAt;
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
    final normalizedStudents = List<TeacherRosterStudent>.unmodifiable(students);
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
    final normalizedEntries = List<TeacherGradeDraftEntry>.unmodifiable(entries);
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

abstract interface class TeacherJourneyRepository {
  Future<TeacherTodayReadModel> loadToday(
    SchoolSession session, {
    String? correlationId,
  });

  Future<TeacherRosterReadModel> loadRoster({
    required String meetingId,
    required SchoolSession session,
    String? correlationId,
  });

  Future<TeacherWriteReceipt> submitAttendance({
    required TeacherAttendanceBatchCommand command,
    required SchoolSession session,
    String? correlationId,
  });

  Future<TeacherWriteReceipt> saveGradeDraft({
    required TeacherGradeDraftCommand command,
    required SchoolSession session,
    String? correlationId,
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
