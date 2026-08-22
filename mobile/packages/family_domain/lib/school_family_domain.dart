library;

import 'package:school_mobile_core/mobile_core.dart';

final class FamilyStudentProfile {
  FamilyStudentProfile({
    required String campusId,
    required String displayName,
    required String gradeLabel,
    required String relationshipLabel,
    required String studentId,
  }) : campusId = _required(campusId, 'campusId'),
       displayName = _required(displayName, 'displayName'),
       gradeLabel = _required(gradeLabel, 'gradeLabel'),
       relationshipLabel = _required(relationshipLabel, 'relationshipLabel'),
       studentId = _required(studentId, 'studentId');

  final String studentId;
  final String campusId;
  final String displayName;
  final String gradeLabel;
  final String relationshipLabel;
}

final class FamilyProfileDirectory {
  FamilyProfileDirectory({
    required String accountId,
    required String activeStudentId,
    required Iterable<FamilyStudentProfile> students,
  }) : accountId = _required(accountId, 'accountId'),
       students = List<FamilyStudentProfile>.unmodifiable(students),
       activeStudentId = _required(activeStudentId, 'activeStudentId') {
    if (this.students.isEmpty) {
      throw const FamilyDomainException('FAMILY_PROFILE_DIRECTORY_EMPTY');
    }
    final ids = this.students.map((student) => student.studentId).toSet();
    if (ids.length != this.students.length) {
      throw const FamilyDomainException('FAMILY_PROFILE_DUPLICATE');
    }
    if (!ids.contains(this.activeStudentId)) {
      throw const FamilyDomainException('FAMILY_ACTIVE_PROFILE_UNAVAILABLE');
    }
  }

  final String accountId;
  final List<FamilyStudentProfile> students;
  final String activeStudentId;

  FamilyStudentProfile get activeStudent =>
      students.singleWhere((student) => student.studentId == activeStudentId);

  FamilyProfileDirectory select(String studentId) {
    final normalized = _required(studentId, 'studentId');
    if (!students.any((student) => student.studentId == normalized)) {
      throw const FamilyDomainException('FAMILY_PROFILE_UNAVAILABLE');
    }
    return FamilyProfileDirectory(
      accountId: accountId,
      activeStudentId: normalized,
      students: students,
    );
  }
}

final class FamilyTimetableItem {
  FamilyTimetableItem({
    required this.endsAt,
    required String itemId,
    required String locationLabel,
    required this.startsAt,
    required String subjectLabel,
  }) : itemId = _required(itemId, 'itemId'),
       locationLabel = _required(locationLabel, 'locationLabel'),
       subjectLabel = _required(subjectLabel, 'subjectLabel') {
    if (!endsAt.instantUtc.isAfter(startsAt.instantUtc)) {
      throw const FamilyDomainException('FAMILY_TIMETABLE_RANGE_INVALID');
    }
  }

  final String itemId;
  final String subjectLabel;
  final String locationLabel;
  final SchoolAuthoritativeTimestamp startsAt;
  final SchoolAuthoritativeTimestamp endsAt;
}

final class FamilyAttendanceReadModel {
  FamilyAttendanceReadModel({
    required int absentSessions,
    required int lateSessions,
    required int presentSessions,
    required String summaryLabel,
    required int totalSessions,
  }) : absentSessions = _nonNegative(absentSessions, 'absentSessions'),
       lateSessions = _nonNegative(lateSessions, 'lateSessions'),
       presentSessions = _nonNegative(presentSessions, 'presentSessions'),
       summaryLabel = _required(summaryLabel, 'summaryLabel'),
       totalSessions = _nonNegative(totalSessions, 'totalSessions') {
    if (this.presentSessions + this.absentSessions + this.lateSessions >
        this.totalSessions) {
      throw const FamilyDomainException('FAMILY_ATTENDANCE_COUNTS_INVALID');
    }
  }

  final int presentSessions;
  final int absentSessions;
  final int lateSessions;
  final int totalSessions;

  /// Display value supplied by the authoritative attendance read model.
  /// The mobile client does not recalculate attendance percentages.
  final String summaryLabel;
}

final class FamilyPublishedResult {
  FamilyPublishedResult({
    required String assessmentLabel,
    required String gradeLabel,
    required this.publishedAt,
    required String resultId,
    required String subjectLabel,
  }) : assessmentLabel = _required(assessmentLabel, 'assessmentLabel'),
       gradeLabel = _required(gradeLabel, 'gradeLabel'),
       resultId = _required(resultId, 'resultId'),
       subjectLabel = _required(subjectLabel, 'subjectLabel');

  final String resultId;
  final String assessmentLabel;
  final String subjectLabel;
  final String gradeLabel;
  final SchoolAuthoritativeTimestamp publishedAt;
}

final class FamilyMoneyAmount {
  FamilyMoneyAmount({
    required String currencyCode,
    required int fractionDigits,
    required int minorUnits,
  }) : currencyCode = _currency(currencyCode),
       fractionDigits = fractionDigits,
       minorUnits = minorUnits {
    if (minorUnits < 0) {
      throw const FamilyDomainException('FAMILY_MONEY_NEGATIVE');
    }
    if (fractionDigits < 0 || fractionDigits > 6) {
      throw const FamilyDomainException('FAMILY_MONEY_FRACTION_DIGITS_INVALID');
    }
  }

  final String currencyCode;
  final int fractionDigits;
  final int minorUnits;
}

final class FamilyFeeReadModel {
  FamilyFeeReadModel({
    required String invoiceReference,
    required this.outstanding,
    this.lastReceipt,
    String? lastReceiptReference,
  }) : invoiceReference = _required(invoiceReference, 'invoiceReference'),
       lastReceiptReference = lastReceiptReference == null
           ? null
           : _required(lastReceiptReference, 'lastReceiptReference') {
    if ((lastReceipt == null) != (this.lastReceiptReference == null)) {
      throw const FamilyDomainException('FAMILY_RECEIPT_PAIR_REQUIRED');
    }
    if (lastReceipt != null &&
        lastReceipt!.currencyCode != outstanding.currencyCode) {
      throw const FamilyDomainException('FAMILY_RECEIPT_CURRENCY_MISMATCH');
    }
    if (lastReceipt != null &&
        lastReceipt!.fractionDigits != outstanding.fractionDigits) {
      throw const FamilyDomainException(
        'FAMILY_RECEIPT_FRACTION_DIGITS_MISMATCH',
      );
    }
  }

  final String invoiceReference;
  final FamilyMoneyAmount outstanding;
  final String? lastReceiptReference;
  final FamilyMoneyAmount? lastReceipt;
}

final class FamilyMessageReadModel {
  FamilyMessageReadModel({this.latestMessageAt, required int unreadCount})
    : unreadCount = _nonNegative(unreadCount, 'unreadCount');

  final int unreadCount;
  final SchoolAuthoritativeTimestamp? latestMessageAt;
}

final class FamilyDashboardReadModel {
  FamilyDashboardReadModel({
    required this.attendance,
    required this.fees,
    required this.generatedAt,
    required this.messages,
    required this.student,
    required Iterable<FamilyPublishedResult> publishedResults,
    required Iterable<FamilyTimetableItem> timetable,
  }) : publishedResults = List<FamilyPublishedResult>.unmodifiable(
         publishedResults,
       ),
       timetable = List<FamilyTimetableItem>.unmodifiable(timetable);

  final FamilyStudentProfile student;
  final SchoolAuthoritativeTimestamp generatedAt;
  final List<FamilyTimetableItem> timetable;
  final FamilyAttendanceReadModel? attendance;
  final List<FamilyPublishedResult> publishedResults;
  final FamilyFeeReadModel? fees;
  final FamilyMessageReadModel? messages;
}

abstract interface class FamilyReadRepository {
  Future<FamilyProfileDirectory> loadProfiles(SchoolSession session);

  Future<FamilyDashboardReadModel> loadDashboard({
    required SchoolSession session,
    required String studentId,
  });
}

final class FamilyDomainException implements Exception {
  const FamilyDomainException(this.code);

  final String code;

  @override
  String toString() => 'FamilyDomainException($code)';
}

String _required(String value, String field) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw FamilyDomainException('FAMILY_FIELD_REQUIRED:$field');
  }
  return normalized;
}

int _nonNegative(int value, String field) {
  if (value < 0) {
    throw FamilyDomainException('FAMILY_FIELD_NEGATIVE:$field');
  }
  return value;
}

String _currency(String value) {
  final normalized = value.trim().toUpperCase();
  if (!RegExp(r'^[A-Z]{3}$').hasMatch(normalized)) {
    throw const FamilyDomainException('FAMILY_CURRENCY_INVALID');
  }
  return normalized;
}
