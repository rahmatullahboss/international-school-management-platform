import 'package:school_api_client/school_api_client.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_staff_domain/school_staff_domain.dart';

final class TeacherMobileApi
    implements TeacherJourneyRepository, TeacherExtendedReadRepository {
  const TeacherMobileApi(this._client);

  static const todayPath = '/v1/mobile/teacher/today';
  static const attendanceBatchPath = '/v1/mobile/teacher/attendance-batches';
  static const assessmentsPath = '/v1/mobile/teacher/assessments';
  static const conversationsPath = '/v1/mobile/teacher/conversations';

  final SchoolApiClient _client;

  @override
  Future<TeacherTodayReadModel> loadToday(
    SchoolSession session, {
    String correlationId = 'teacher-today',
  }) async {
    _requireTeacherCapability(session, SchoolCapability.timetableRead);
    final response = await _client.getJson(
      todayPath,
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      final today = TeacherTodayReadModel(
        campusId: _requiredString(response, 'campusId'),
        generatedAt: _dateTime(response, 'generatedAt'),
        meetings: _objectList(response, 'meetings').map(_meeting),
        teacherDisplayName: _requiredString(response, 'teacherDisplayName'),
      );
      if (today.campusId != session.campusId) {
        throw const TeacherDomainException('TEACHER_TODAY_CAMPUS_MISMATCH');
      }
      return today;
    } on TeacherDomainException catch (error) {
      throw _invalidResponse(error.code);
    } on FormatException catch (error) {
      throw _invalidResponse(error.message);
    }
  }

  @override
  Future<TeacherRosterReadModel> loadRoster({
    required String meetingId,
    required SchoolSession session,
    String correlationId = 'teacher-roster',
  }) async {
    _requireTeacherCapability(session, SchoolCapability.attendanceTake);
    final normalizedMeetingId = _requiredValue(meetingId, 'meetingId');
    final response = await _client.getJson(
      '/v1/mobile/teacher/meetings/${Uri.encodeComponent(normalizedMeetingId)}/roster',
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      final roster = TeacherRosterReadModel(
        meetingId: _requiredString(response, 'meetingId'),
        sectionId: _requiredString(response, 'sectionId'),
        students: _objectList(response, 'students').map(_rosterStudent),
        version: _requiredInt(response, 'version'),
      );
      if (roster.meetingId != normalizedMeetingId) {
        throw const TeacherDomainException('TEACHER_ROSTER_SCOPE_MISMATCH');
      }
      return roster;
    } on TeacherDomainException catch (error) {
      throw _invalidResponse(error.code);
    } on FormatException catch (error) {
      throw _invalidResponse(error.message);
    }
  }

  @override
  Future<TeacherAssessmentListReadModel> loadAssessments(
    SchoolSession session, {
    String correlationId = 'teacher-assessments',
  }) async {
    _requireTeacherCapability(session, SchoolCapability.gradesWrite);
    final response = await _client.getJson(
      assessmentsPath,
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      _requireExactKeys(response, const {
        'assessments',
        'generatedAt',
        'hasMore',
      }, 'assessments');
      final assessments = _objectList(response, 'assessments');
      if (assessments.length > 64) {
        throw const FormatException('TEACHER_ASSESSMENT_LIMIT');
      }
      return TeacherAssessmentListReadModel(
        assessments: assessments.map(_assessment),
        generatedAt: _dateTime(response, 'generatedAt'),
        hasMore: _requiredBool(response, 'hasMore'),
      );
    } on TeacherDomainException catch (error) {
      throw _invalidResponse(error.code);
    } on FormatException catch (error) {
      throw _invalidResponse(error.message);
    }
  }

  @override
  Future<TeacherConversationListReadModel> loadConversations(
    SchoolSession session, {
    String correlationId = 'teacher-conversations',
  }) async {
    _requireTeacherCapability(session, SchoolCapability.messagesRead);
    final response = await _client.getJson(
      conversationsPath,
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      _requireExactKeys(response, const {
        'conversations',
        'generatedAt',
        'hasMore',
      }, 'conversations');
      final conversations = _objectList(response, 'conversations');
      if (conversations.length > 50) {
        throw const FormatException('TEACHER_CONVERSATION_LIMIT');
      }
      return TeacherConversationListReadModel(
        conversations: conversations.map(_conversation),
        generatedAt: _dateTime(response, 'generatedAt'),
        hasMore: _requiredBool(response, 'hasMore'),
      );
    } on TeacherDomainException catch (error) {
      throw _invalidResponse(error.code);
    } on FormatException catch (error) {
      throw _invalidResponse(error.message);
    }
  }

  @override
  Future<TeacherConversationMessagesReadModel> loadConversationMessages({
    required String conversationId,
    required SchoolSession session,
    String correlationId = 'teacher-conversation-messages',
  }) async {
    _requireTeacherCapability(session, SchoolCapability.messagesRead);
    final normalizedConversationId = _requiredValue(
      conversationId,
      'conversationId',
    );
    final response = await _client.getJson(
      '$conversationsPath/${Uri.encodeComponent(normalizedConversationId)}/messages',
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      _requireExactKeys(response, const {
        'conversationId',
        'studentDisplayName',
        'subject',
        'messages',
        'hasMore',
      }, 'conversation-messages');
      if (_requiredString(response, 'conversationId') !=
          normalizedConversationId) {
        throw const FormatException('TEACHER_CONVERSATION_SCOPE_MISMATCH');
      }
      final messages = _objectList(response, 'messages');
      if (messages.length > 100) {
        throw const FormatException('TEACHER_MESSAGE_LIMIT');
      }
      return TeacherConversationMessagesReadModel(
        conversationId: normalizedConversationId,
        hasMore: _requiredBool(response, 'hasMore'),
        messages: messages.map(_conversationMessage),
        studentDisplayName: _requiredString(response, 'studentDisplayName'),
        subject: _requiredString(response, 'subject'),
      );
    } on TeacherDomainException catch (error) {
      throw _invalidResponse(error.code);
    } on FormatException catch (error) {
      throw _invalidResponse(error.message);
    }
  }

  @override
  Future<TeacherWriteReceipt> submitAttendance({
    required TeacherAttendanceBatchCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-attendance-batch',
  }) async {
    command.validateSession(session);
    final response = await _client.postJson(
      attendanceBatchPath,
      body: <String, Object?>{
        'operationId': command.operationId,
        'meetingId': command.meetingId,
        'baseVersion': command.baseVersion,
        'clientCreatedAt': command.clientCreatedAt.toIso8601String(),
        'lines': command.lines
            .map(
              (line) => <String, Object?>{
                'studentId': line.studentId,
                'mark': line.mark.name,
              },
            )
            .toList(growable: false),
      },
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
      idempotencyKey: command.idempotencyKey,
    );
    return _receipt(response, command.operationId, 'attendance-batch');
  }

  @override
  Future<TeacherWriteReceipt> saveGradeDraft({
    required TeacherGradeDraftCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-grade-draft',
  }) async {
    command.validateSession(session);
    final response = await _client.postJson(
      '/v1/mobile/teacher/assessments/${Uri.encodeComponent(command.assessmentId)}/grade-drafts',
      body: <String, Object?>{
        'operationId': command.operationId,
        'baseVersion': command.baseVersion,
        'scoreScale': command.scoreScale,
        'maximumScoreUnits': command.maximumScoreUnits,
        'entries': command.entries
            .map(
              (entry) => <String, Object?>{
                'studentId': entry.studentId,
                'status': entry.status.name,
                if (entry.scoreUnits != null) 'scoreUnits': entry.scoreUnits,
              },
            )
            .toList(growable: false),
      },
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
      idempotencyKey: command.idempotencyKey,
    );
    return _receipt(response, command.operationId, 'grade-draft');
  }

  TeacherAssessmentSummary _assessment(Map<String, Object?> json) {
    _requireExactKeys(json, const {
      'assessmentId',
      'sectionId',
      'sectionLabel',
      'subjectLabel',
      'assessmentTitle',
      'categoryLabel',
      'dueAt',
      'state',
      'lockState',
      'version',
      'scoreScale',
      'maximumScoreUnits',
      'rosterCount',
      'enteredCount',
    }, 'assessment');
    return TeacherAssessmentSummary(
      assessmentId: _requiredString(json, 'assessmentId'),
      assessmentTitle: _requiredString(json, 'assessmentTitle'),
      categoryLabel: _requiredString(json, 'categoryLabel'),
      dueAt: _dateTime(json, 'dueAt'),
      enteredCount: _requiredInt(json, 'enteredCount'),
      lockState: switch (_requiredString(json, 'lockState')) {
        'open' => TeacherGradebookLockState.open,
        'locked' => TeacherGradebookLockState.locked,
        _ => throw const FormatException(
          'TEACHER_GRADEBOOK_LOCK_STATE_UNKNOWN',
        ),
      },
      maximumScoreUnits: _requiredInt(json, 'maximumScoreUnits'),
      rosterCount: _requiredInt(json, 'rosterCount'),
      scoreScale: _requiredInt(json, 'scoreScale'),
      sectionId: _requiredString(json, 'sectionId'),
      sectionLabel: _requiredString(json, 'sectionLabel'),
      state: switch (_requiredString(json, 'state')) {
        'draft' => TeacherAssessmentState.draft,
        'published' => TeacherAssessmentState.published,
        'closed' => TeacherAssessmentState.closed,
        _ => throw const FormatException('TEACHER_ASSESSMENT_STATE_UNKNOWN'),
      },
      subjectLabel: _requiredString(json, 'subjectLabel'),
      version: _requiredInt(json, 'version'),
    );
  }

  TeacherConversationSummary _conversation(Map<String, Object?> json) {
    _requireExactKeys(json, const {
      'conversationId',
      'studentId',
      'studentDisplayName',
      'subject',
      'latestMessageAt',
      'canReply',
    }, 'conversation');
    return TeacherConversationSummary(
      canReply: _requiredBool(json, 'canReply'),
      conversationId: _requiredString(json, 'conversationId'),
      latestMessageAt: _dateTime(json, 'latestMessageAt'),
      studentDisplayName: _requiredString(json, 'studentDisplayName'),
      studentId: _requiredString(json, 'studentId'),
      subject: _requiredString(json, 'subject'),
    );
  }

  TeacherConversationMessage _conversationMessage(Map<String, Object?> json) {
    _requireExactKeys(json, const {
      'messageId',
      'authorLabel',
      'body',
      'sentAt',
      'authoredByViewer',
    }, 'conversation-message');
    return TeacherConversationMessage(
      authorLabel: _requiredString(json, 'authorLabel'),
      authoredByViewer: _requiredBool(json, 'authoredByViewer'),
      body: _requiredString(json, 'body'),
      messageId: _requiredString(json, 'messageId'),
      sentAt: _dateTime(json, 'sentAt'),
    );
  }

  TeacherMeetingSummary _meeting(Map<String, Object?> json) =>
      TeacherMeetingSummary(
        attendanceStatus: _attendanceStatus(
          _requiredString(json, 'attendanceStatus'),
        ),
        endsAt: _dateTime(json, 'endsAt'),
        meetingId: _requiredString(json, 'meetingId'),
        roomLabel: _requiredString(json, 'roomLabel'),
        rosterCount: _requiredInt(json, 'rosterCount'),
        sectionId: _requiredString(json, 'sectionId'),
        sectionLabel: _requiredString(json, 'sectionLabel'),
        startsAt: _dateTime(json, 'startsAt'),
        subjectLabel: _requiredString(json, 'subjectLabel'),
        substitutionForTeacherLabel: _optionalString(
          json,
          'substitutionForTeacherLabel',
        ),
      );

  TeacherRosterStudent _rosterStudent(Map<String, Object?> json) =>
      TeacherRosterStudent(
        displayName: _requiredString(json, 'displayName'),
        rollLabel: _requiredString(json, 'rollLabel'),
        studentId: _requiredString(json, 'studentId'),
      );

  TeacherWriteReceipt _receipt(
    Map<String, Object?> response,
    String expectedOperationId,
    String workflow,
  ) {
    try {
      final receipt = TeacherWriteReceipt(
        acceptedRevision: _requiredInt(response, 'acceptedRevision'),
        operationId: _requiredString(response, 'operationId'),
        reasonCode: _optionalString(response, 'reasonCode'),
        status: _writeStatus(_requiredString(response, 'status')),
      );
      if (receipt.operationId != expectedOperationId) {
        throw const TeacherDomainException('TEACHER_RECEIPT_SCOPE_MISMATCH');
      }
      return receipt;
    } on TeacherDomainException catch (error) {
      throw _invalidResponse('$workflow:${error.code}');
    } on FormatException catch (error) {
      throw _invalidResponse('$workflow:${error.message}');
    }
  }

  TeacherAttendanceStatus _attendanceStatus(String value) => switch (value) {
    'notStarted' => TeacherAttendanceStatus.notStarted,
    'draft' => TeacherAttendanceStatus.draft,
    'submitted' => TeacherAttendanceStatus.submitted,
    'locked' => TeacherAttendanceStatus.locked,
    _ => throw const FormatException('TEACHER_ATTENDANCE_STATUS_UNKNOWN'),
  };

  TeacherWriteStatus _writeStatus(String value) => switch (value) {
    'accepted' => TeacherWriteStatus.accepted,
    'duplicate' => TeacherWriteStatus.duplicate,
    'conflict' => TeacherWriteStatus.conflict,
    'rejected' => TeacherWriteStatus.rejected,
    'requiresReconciliation' => TeacherWriteStatus.requiresReconciliation,
    _ => throw const FormatException('TEACHER_WRITE_STATUS_UNKNOWN'),
  };

  void _requireTeacherCapability(SchoolSession session, String capability) {
    if (session.activePersona != SchoolPersona.teacher) {
      throw const TeacherDomainException('TEACHER_PERSONA_REQUIRED');
    }
    if (!session.can(capability)) {
      throw TeacherDomainException('TEACHER_CAPABILITY_REQUIRED:$capability');
    }
  }

  SchoolApiException _invalidResponse(String reason) => SchoolApiException(
    code: 'INVALID_TEACHER_RESPONSE',
    message: 'The teacher response failed validation: $reason',
  );
}

List<Map<String, Object?>> _objectList(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! List<Object?>) {
    throw FormatException('TEACHER_LIST_REQUIRED:$key');
  }
  return value
      .map((item) {
        if (item is! Map<String, Object?>) {
          throw FormatException('TEACHER_LIST_OBJECT_REQUIRED:$key');
        }
        return item;
      })
      .toList(growable: false);
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('TEACHER_STRING_REQUIRED:$key');
  }
  return value.trim();
}

String _requiredValue(String value, String field) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw TeacherDomainException('TEACHER_FIELD_REQUIRED:$field');
  }
  return normalized;
}

String? _optionalString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  if (value is! String) {
    throw FormatException('TEACHER_OPTIONAL_STRING_INVALID:$key');
  }
  final normalized = value.trim();
  return normalized.isEmpty ? null : normalized;
}

int _requiredInt(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! int || value < 0) {
    throw FormatException('TEACHER_INT_REQUIRED:$key');
  }
  return value;
}

bool _requiredBool(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! bool) {
    throw FormatException('TEACHER_BOOL_REQUIRED:$key');
  }
  return value;
}

void _requireExactKeys(
  Map<String, Object?> json,
  Set<String> keys,
  String operation,
) {
  if (json.length != keys.length ||
      json.keys.any((key) => !keys.contains(key))) {
    throw FormatException('TEACHER_FIELDS_INVALID:$operation');
  }
}

DateTime _dateTime(Map<String, Object?> json, String key) {
  final value = _requiredString(json, key);
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    throw FormatException('TEACHER_DATETIME_INVALID:$key');
  }
  return parsed;
}
