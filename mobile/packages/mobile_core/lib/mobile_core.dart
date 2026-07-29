/// Shared, platform-neutral contracts used by both Flutter applications.
library;

enum SchoolPersona {
  guardian,
  student,
  teacher;

  String get label => switch (this) {
    SchoolPersona.guardian => 'Guardian',
    SchoolPersona.student => 'Student',
    SchoolPersona.teacher => 'Teacher',
  };
}

abstract final class SchoolCapability {
  static const attendanceRead = 'attendance.read';
  static const attendanceTake = 'attendance.take';
  static const billingRead = 'billing.read';
  static const documentsRead = 'documents.read';
  static const formsConsent = 'forms.consent';
  static const gradesReadPublished = 'grades.read.published';
  static const gradesWrite = 'grades.write';
  static const messagesRead = 'messages.read';
  static const messagesSend = 'messages.send';
  static const timetableRead = 'timetable.read';
}

final class SchoolSession {
  SchoolSession({
    required this.accountId,
    required this.activePersona,
    required this.availablePersonas,
    required this.campusId,
    required this.capabilities,
    required this.locale,
    required this.tenantId,
    required this.timeZone,
  }) : assert(availablePersonas.contains(activePersona));

  final String accountId;
  final String tenantId;
  final String campusId;
  final SchoolPersona activePersona;
  final Set<SchoolPersona> availablePersonas;
  final Set<String> capabilities;
  final String locale;
  final String timeZone;

  bool can(String capability) => capabilities.contains(capability);

  SchoolSession copyWith({
    SchoolPersona? activePersona,
    Set<String>? capabilities,
  }) {
    final nextPersona = activePersona ?? this.activePersona;
    if (!availablePersonas.contains(nextPersona)) {
      throw ArgumentError.value(
        nextPersona,
        'activePersona',
        'The persona is not available for this account.',
      );
    }

    return SchoolSession(
      accountId: accountId,
      activePersona: nextPersona,
      availablePersonas: availablePersonas,
      campusId: campusId,
      capabilities: capabilities ?? this.capabilities,
      locale: locale,
      tenantId: tenantId,
      timeZone: timeZone,
    );
  }
}

enum MobileSyncStatus {
  savedOnDevice,
  waitingForNetwork,
  syncing,
  synced,
  conflict,
  rejected,
  requiresReview;

  String get label => switch (this) {
    MobileSyncStatus.savedOnDevice => 'Saved on device',
    MobileSyncStatus.waitingForNetwork => 'Waiting for network',
    MobileSyncStatus.syncing => 'Syncing',
    MobileSyncStatus.synced => 'Synced',
    MobileSyncStatus.conflict => 'Conflict',
    MobileSyncStatus.rejected => 'Rejected',
    MobileSyncStatus.requiresReview => 'Needs review',
  };
}

final class PendingOperation<T extends Object> {
  const PendingOperation({
    required this.baseVersion,
    required this.campusId,
    required this.clientCreatedAt,
    required this.idempotencyKey,
    required this.operationId,
    required this.payload,
    required this.persona,
    required this.status,
    required this.tenantId,
  });

  final String operationId;
  final String idempotencyKey;
  final String tenantId;
  final String campusId;
  final SchoolPersona persona;
  final DateTime clientCreatedAt;
  final int baseVersion;
  final T payload;
  final MobileSyncStatus status;

  PendingOperation<T> copyWith({MobileSyncStatus? status}) =>
      PendingOperation<T>(
        baseVersion: baseVersion,
        campusId: campusId,
        clientCreatedAt: clientCreatedAt,
        idempotencyKey: idempotencyKey,
        operationId: operationId,
        payload: payload,
        persona: persona,
        status: status ?? this.status,
        tenantId: tenantId,
      );
}
