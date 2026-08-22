import 'package:school_api_client/school_api_client.dart';
import 'package:school_family_domain/school_family_domain.dart';
import 'package:school_mobile_core/mobile_core.dart';

final class FamilyReadApi implements FamilyReadRepository {
  const FamilyReadApi(this._client);

  static const profilesPath = '/v1/mobile/family/profiles';

  final SchoolApiClient _client;

  @override
  Future<FamilyProfileDirectory> loadProfiles(
    SchoolSession session, {
    String correlationId = 'family-profiles',
  }) async {
    _requireFamilyPersona(session);
    final response = await _client.getJson(
      profilesPath,
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      final students = _objectList(
        response,
        'students',
      ).map(_student).toList(growable: false);
      if (students.any((student) => student.campusId != session.campusId)) {
        throw const FamilyDomainException('FAMILY_PROFILE_CAMPUS_MISMATCH');
      }
      return FamilyProfileDirectory(
        accountId: _requiredString(response, 'accountId'),
        activeStudentId: _requiredString(response, 'activeStudentId'),
        students: students,
      );
    } on FamilyDomainException catch (error) {
      throw _invalidResponse(error.code);
    } on FormatException catch (error) {
      throw _invalidResponse(error.message);
    }
  }

  @override
  Future<FamilyDashboardReadModel> loadDashboard({
    required SchoolSession session,
    required String studentId,
    String correlationId = 'family-dashboard',
  }) async {
    _requireFamilyPersona(session);
    final normalizedStudentId = studentId.trim();
    if (normalizedStudentId.isEmpty) {
      throw const FamilyDomainException('FAMILY_STUDENT_ID_REQUIRED');
    }
    final response = await _client.getJson(
      '/v1/mobile/family/students/${Uri.encodeComponent(normalizedStudentId)}/dashboard',
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      final timeZoneId = _responseTimeZone(response, session);
      final student = _student(_requiredObject(response, 'student'));
      if (student.studentId != normalizedStudentId ||
          student.campusId != session.campusId) {
        throw const FamilyDomainException('FAMILY_DASHBOARD_SCOPE_MISMATCH');
      }
      final timetable = _objectList(
        response,
        'timetable',
      ).map((item) => _timetable(item, timeZoneId));
      final attendance = _optionalObject(response, 'attendance');
      final publishedResults = _objectList(response, 'publishedResults')
          .map((item) => _publishedResult(item, timeZoneId))
          .toList(growable: false);
      final fees = _optionalObject(response, 'fees');
      final messages = _optionalObject(response, 'messages');

      if (attendance != null && !session.can(SchoolCapability.attendanceRead)) {
        throw const FamilyDomainException(
          'FAMILY_RESPONSE_CAPABILITY_VIOLATION',
        );
      }
      if (publishedResults.isNotEmpty &&
          !session.can(SchoolCapability.gradesReadPublished)) {
        throw const FamilyDomainException(
          'FAMILY_RESPONSE_CAPABILITY_VIOLATION',
        );
      }
      if (fees != null && !session.can(SchoolCapability.billingRead)) {
        throw const FamilyDomainException(
          'FAMILY_RESPONSE_CAPABILITY_VIOLATION',
        );
      }
      if (messages != null && !session.can(SchoolCapability.messagesRead)) {
        throw const FamilyDomainException(
          'FAMILY_RESPONSE_CAPABILITY_VIOLATION',
        );
      }

      return FamilyDashboardReadModel(
        attendance: attendance == null ? null : _attendance(attendance),
        fees: fees == null ? null : _fees(fees),
        generatedAt: _timestamp(response, 'generatedAt', timeZoneId),
        messages: messages == null ? null : _messages(messages, timeZoneId),
        publishedResults: publishedResults,
        student: student,
        timetable: timetable,
      );
    } on FamilyDomainException catch (error) {
      throw _invalidResponse(error.code);
    } on FormatException catch (error) {
      throw _invalidResponse(error.message);
    }
  }

  FamilyStudentProfile _student(Map<String, Object?> json) =>
      FamilyStudentProfile(
        campusId: _requiredString(json, 'campusId'),
        displayName: _requiredString(json, 'displayName'),
        gradeLabel: _requiredString(json, 'gradeLabel'),
        relationshipLabel: _requiredString(json, 'relationshipLabel'),
        studentId: _requiredString(json, 'studentId'),
      );

  FamilyTimetableItem _timetable(
    Map<String, Object?> json,
    String timeZoneId,
  ) => FamilyTimetableItem(
    endsAt: _timestamp(json, 'endsAt', timeZoneId),
    itemId: _requiredString(json, 'itemId'),
    locationLabel: _requiredString(json, 'locationLabel'),
    startsAt: _timestamp(json, 'startsAt', timeZoneId),
    subjectLabel: _requiredString(json, 'subjectLabel'),
  );

  FamilyAttendanceReadModel _attendance(Map<String, Object?> json) =>
      FamilyAttendanceReadModel(
        absentSessions: _requiredInt(json, 'absentSessions'),
        lateSessions: _requiredInt(json, 'lateSessions'),
        presentSessions: _requiredInt(json, 'presentSessions'),
        summaryLabel: _requiredString(json, 'summaryLabel'),
        totalSessions: _requiredInt(json, 'totalSessions'),
      );

  FamilyPublishedResult _publishedResult(
    Map<String, Object?> json,
    String timeZoneId,
  ) => FamilyPublishedResult(
    assessmentLabel: _requiredString(json, 'assessmentLabel'),
    gradeLabel: _requiredString(json, 'gradeLabel'),
    publishedAt: _timestamp(json, 'publishedAt', timeZoneId),
    resultId: _requiredString(json, 'resultId'),
    subjectLabel: _requiredString(json, 'subjectLabel'),
  );

  FamilyFeeReadModel _fees(Map<String, Object?> json) {
    final lastReceipt = _optionalObject(json, 'lastReceipt');
    return FamilyFeeReadModel(
      invoiceReference: _requiredString(json, 'invoiceReference'),
      lastReceipt: lastReceipt == null ? null : _money(lastReceipt),
      lastReceiptReference: _optionalString(json, 'lastReceiptReference'),
      outstanding: _money(_requiredObject(json, 'outstanding')),
    );
  }

  FamilyMoneyAmount _money(Map<String, Object?> json) => FamilyMoneyAmount(
    currencyCode: _requiredString(json, 'currencyCode'),
    fractionDigits: _requiredInt(json, 'fractionDigits'),
    minorUnits: _requiredInt(json, 'minorUnits'),
  );

  FamilyMessageReadModel _messages(
    Map<String, Object?> json,
    String timeZoneId,
  ) => FamilyMessageReadModel(
    latestMessageAt: _optionalTimestamp(json, 'latestMessageAt', timeZoneId),
    unreadCount: _requiredInt(json, 'unreadCount'),
  );

  void _requireFamilyPersona(SchoolSession session) {
    if (session.activePersona != SchoolPersona.guardian &&
        session.activePersona != SchoolPersona.student) {
      throw const FamilyDomainException('FAMILY_PERSONA_REQUIRED');
    }
  }

  SchoolApiException _invalidResponse(String reasonCode) => SchoolApiException(
    code: 'INVALID_FAMILY_RESPONSE',
    message: 'The Family read response failed validation: $reasonCode',
  );
}

Map<String, Object?> _requiredObject(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! Map<String, Object?>) {
    throw FormatException('FAMILY_OBJECT_REQUIRED:$key');
  }
  return value;
}

Map<String, Object?>? _optionalObject(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  if (value is! Map<String, Object?>) {
    throw FormatException('FAMILY_OBJECT_INVALID:$key');
  }
  return value;
}

List<Map<String, Object?>> _objectList(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! List<Object?>) {
    throw FormatException('FAMILY_LIST_REQUIRED:$key');
  }
  return value
      .map((item) {
        if (item is! Map<String, Object?>) {
          throw FormatException('FAMILY_LIST_OBJECT_REQUIRED:$key');
        }
        return item;
      })
      .toList(growable: false);
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('FAMILY_STRING_REQUIRED:$key');
  }
  return value.trim();
}

String? _optionalString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('FAMILY_STRING_INVALID:$key');
  }
  return value.trim();
}

int _requiredInt(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! int) {
    throw FormatException('FAMILY_INTEGER_REQUIRED:$key');
  }
  return value;
}

String _responseTimeZone(Map<String, Object?> json, SchoolSession session) {
  final timeZoneId = _requiredString(json, 'timeZoneId');
  if (timeZoneId != session.timeZone) {
    throw const FormatException('FAMILY_TIME_ZONE_SCOPE_MISMATCH');
  }
  return timeZoneId;
}

SchoolAuthoritativeTimestamp _timestamp(
  Map<String, Object?> json,
  String key,
  String timeZoneId,
) => SchoolAuthoritativeTimestamp.parse(
  timestamp: _requiredString(json, key),
  timeZoneId: timeZoneId,
);

SchoolAuthoritativeTimestamp? _optionalTimestamp(
  Map<String, Object?> json,
  String key,
  String timeZoneId,
) {
  final value = _optionalString(json, key);
  return value == null
      ? null
      : SchoolAuthoritativeTimestamp.parse(
          timestamp: value,
          timeZoneId: timeZoneId,
        );
}
