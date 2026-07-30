import 'dart:async';
import 'dart:collection';

import 'mobile_core.dart';

enum MobileNotificationApplication { family, staff }

enum MobileNotificationKind {
  familyHome,
  familyAttendance,
  familyResults,
  familyFees,
  familyDocuments,
  familyForms,
  familyConsent,
  familyMessages,
  familyConversation,
  staffToday,
  staffAttendance,
  staffGradebook,
  staffMessages,
}

enum MobileNotificationRouteStatus {
  allowed,
  expired,
  notYetValid,
  wrongApplication,
  wrongSchoolScope,
  wrongPersona,
  missingCapability,
  invalidResource,
  routeUnavailable,
}

final class MobileNotificationPresentation {
  const MobileNotificationPresentation({
    required this.body,
    required this.title,
  });

  final String title;
  final String body;
}

/// Strict data-only payload accepted from a platform notification/deep-link bridge.
///
/// Display text, student names, amounts, document names, message bodies, URLs and
/// credentials are intentionally not accepted. Native adapters must extract only
/// this allow-listed map from provider payloads before constructing the envelope.
final class MobileNotificationEnvelope {
  factory MobileNotificationEnvelope.fromData(Map<String, Object?> data) {
    final unknownKeys = data.keys.where((key) => !_allowedKeys.contains(key));
    if (unknownKeys.isNotEmpty) {
      throw const MobileNotificationContractException(
        'MOBILE_NOTIFICATION_FIELDS_FORBIDDEN',
      );
    }

    final application = _enumValue(
      MobileNotificationApplication.values,
      _requiredString(data, 'application'),
      'MOBILE_NOTIFICATION_APPLICATION_INVALID',
    );
    final kind = _enumValue(
      MobileNotificationKind.values,
      _requiredString(data, 'kind'),
      'MOBILE_NOTIFICATION_KIND_INVALID',
    );
    if (_applicationFor(kind) != application) {
      throw const MobileNotificationContractException(
        'MOBILE_NOTIFICATION_KIND_APPLICATION_MISMATCH',
      );
    }

    final persona = _enumValue(
      SchoolPersona.values,
      _requiredString(data, 'persona'),
      'MOBILE_NOTIFICATION_PERSONA_INVALID',
    );
    if (!_applicationPersonas(application).contains(persona)) {
      throw const MobileNotificationContractException(
        'MOBILE_NOTIFICATION_PERSONA_APPLICATION_MISMATCH',
      );
    }

    final issuedAt = _dateTime(data, 'issuedAt');
    final expiresAt = _dateTime(data, 'expiresAt');
    final lifetime = expiresAt.difference(issuedAt);
    if (!expiresAt.isAfter(issuedAt) || lifetime > const Duration(hours: 24)) {
      throw const MobileNotificationContractException(
        'MOBILE_NOTIFICATION_LIFETIME_INVALID',
      );
    }

    final resourceId = _optionalIdentifier(data, 'resourceId');
    if (resourceId != null && !_resourceKinds.contains(kind)) {
      throw const MobileNotificationContractException(
        'MOBILE_NOTIFICATION_RESOURCE_FORBIDDEN',
      );
    }

    return MobileNotificationEnvelope._(
      application: application,
      campusId: _identifier(data, 'campusId'),
      expiresAt: expiresAt,
      issuedAt: issuedAt,
      kind: kind,
      notificationId: _identifier(data, 'notificationId'),
      persona: persona,
      resourceId: resourceId,
      tenantId: _identifier(data, 'tenantId'),
    );
  }

  const MobileNotificationEnvelope._({
    required this.application,
    required this.campusId,
    required this.expiresAt,
    required this.issuedAt,
    required this.kind,
    required this.notificationId,
    required this.persona,
    required this.resourceId,
    required this.tenantId,
  });

  static const Set<String> _allowedKeys = {
    'application',
    'campusId',
    'expiresAt',
    'issuedAt',
    'kind',
    'notificationId',
    'persona',
    'resourceId',
    'tenantId',
  };

  static const Set<MobileNotificationKind> _resourceKinds = {
    MobileNotificationKind.familyForms,
    MobileNotificationKind.familyConversation,
  };

  final String notificationId;
  final MobileNotificationApplication application;
  final String tenantId;
  final String campusId;
  final SchoolPersona persona;
  final MobileNotificationKind kind;
  final String? resourceId;
  final DateTime issuedAt;
  final DateTime expiresAt;

  MobileNotificationPresentation get presentation => switch (application) {
    MobileNotificationApplication.family =>
      const MobileNotificationPresentation(
        title: 'School Family update',
        body: 'Open School Family to review an authorized school update.',
      ),
    MobileNotificationApplication.staff => const MobileNotificationPresentation(
      title: 'School Staff update',
      body: 'Open School Staff to review an authorized work update.',
    ),
  };

  @override
  String toString() =>
      'MobileNotificationEnvelope(application: ${application.name}, '
      'kind: ${kind.name}, scope: [REDACTED], resource: [REDACTED])';
}

final class MobileNotificationRouteDecision {
  const MobileNotificationRouteDecision.allowed(this.location)
    : reasonCode = null,
      status = MobileNotificationRouteStatus.allowed;

  const MobileNotificationRouteDecision.blocked(this.status, this.reasonCode)
    : assert(status != MobileNotificationRouteStatus.allowed),
      location = null;

  final MobileNotificationRouteStatus status;
  final String? reasonCode;
  final String? location;

  bool get isAllowed => status == MobileNotificationRouteStatus.allowed;
}

final class MobileNotificationRouteResolver {
  const MobileNotificationRouteResolver();

  MobileNotificationRouteDecision resolve({
    required MobileNotificationApplication application,
    required MobileNotificationEnvelope envelope,
    required SchoolSession session,
    DateTime? now,
  }) {
    if (envelope.application != application) {
      return const MobileNotificationRouteDecision.blocked(
        MobileNotificationRouteStatus.wrongApplication,
        'MOBILE_NOTIFICATION_APPLICATION_MISMATCH',
      );
    }

    final effectiveNow = (now ?? DateTime.now()).toUtc();
    if (effectiveNow.isBefore(
      envelope.issuedAt.subtract(const Duration(minutes: 5)),
    )) {
      return const MobileNotificationRouteDecision.blocked(
        MobileNotificationRouteStatus.notYetValid,
        'MOBILE_NOTIFICATION_NOT_YET_VALID',
      );
    }
    if (!effectiveNow.isBefore(envelope.expiresAt)) {
      return const MobileNotificationRouteDecision.blocked(
        MobileNotificationRouteStatus.expired,
        'MOBILE_NOTIFICATION_EXPIRED',
      );
    }

    if (session.tenantId != envelope.tenantId ||
        session.campusId != envelope.campusId) {
      return const MobileNotificationRouteDecision.blocked(
        MobileNotificationRouteStatus.wrongSchoolScope,
        'MOBILE_NOTIFICATION_SCHOOL_SCOPE_MISMATCH',
      );
    }
    if (session.activePersona != envelope.persona ||
        !_personasFor(envelope.kind).contains(session.activePersona)) {
      return const MobileNotificationRouteDecision.blocked(
        MobileNotificationRouteStatus.wrongPersona,
        'MOBILE_NOTIFICATION_PERSONA_MISMATCH',
      );
    }

    final requiredAll = _requiredAllCapabilities(envelope.kind);
    if (requiredAll.any((capability) => !session.can(capability))) {
      return const MobileNotificationRouteDecision.blocked(
        MobileNotificationRouteStatus.missingCapability,
        'MOBILE_NOTIFICATION_CAPABILITY_REQUIRED',
      );
    }
    final requiredAny = _requiredAnyCapabilities(envelope.kind);
    if (requiredAny.isNotEmpty &&
        !requiredAny.any((capability) => session.can(capability))) {
      return const MobileNotificationRouteDecision.blocked(
        MobileNotificationRouteStatus.missingCapability,
        'MOBILE_NOTIFICATION_CAPABILITY_REQUIRED',
      );
    }

    final location = _locationFor(envelope.kind, envelope.resourceId);
    if (location == null) {
      return const MobileNotificationRouteDecision.blocked(
        MobileNotificationRouteStatus.invalidResource,
        'MOBILE_NOTIFICATION_RESOURCE_REQUIRED',
      );
    }
    return MobileNotificationRouteDecision.allowed(location);
  }
}

abstract interface class MobileNotificationSource {
  Stream<MobileNotificationEnvelope> get openedNotifications;

  MobileNotificationEnvelope? takeInitial();
}

/// Provider-neutral bridge used by native Firebase/APNs and app-link adapters.
///
/// It stores at most one launch intent and exposes notification taps as a stream.
/// Provider SDK setup and credentials remain outside this shared contract.
final class MobileNotificationInbox implements MobileNotificationSource {
  MobileNotificationInbox({MobileNotificationEnvelope? initial})
    : _initial = initial;

  MobileNotificationEnvelope? _initial;
  final StreamController<MobileNotificationEnvelope> _controller =
      StreamController<MobileNotificationEnvelope>.broadcast(sync: true);

  @override
  Stream<MobileNotificationEnvelope> get openedNotifications =>
      _controller.stream;

  @override
  MobileNotificationEnvelope? takeInitial() {
    final initial = _initial;
    _initial = null;
    return initial;
  }

  void addOpened(MobileNotificationEnvelope envelope) {
    if (_controller.isClosed) {
      throw const MobileNotificationContractException(
        'MOBILE_NOTIFICATION_INBOX_CLOSED',
      );
    }
    _controller.add(envelope);
  }

  Future<void> close() => _controller.close();
}

/// Bounded in-memory duplicate guard for repeated provider tap callbacks.
final class MobileNotificationOpenTracker {
  MobileNotificationOpenTracker({this.maximumTracked = 128}) {
    if (maximumTracked < 1 || maximumTracked > 2048) {
      throw const MobileNotificationContractException(
        'MOBILE_NOTIFICATION_TRACKER_LIMIT_INVALID',
      );
    }
  }

  final int maximumTracked;
  final Queue<String> _order = Queue<String>();
  final Set<String> _claimed = <String>{};

  bool claim(String notificationId) {
    final normalized = _validateIdentifier(
      notificationId,
      'MOBILE_NOTIFICATION_ID_INVALID',
    );
    if (!_claimed.add(normalized)) return false;
    _order.addLast(normalized);
    while (_order.length > maximumTracked) {
      _claimed.remove(_order.removeFirst());
    }
    return true;
  }

  void clear() {
    _order.clear();
    _claimed.clear();
  }
}

final class MobileNotificationContractException implements Exception {
  const MobileNotificationContractException(this.code);

  final String code;

  @override
  String toString() => 'MobileNotificationContractException($code)';
}

MobileNotificationApplication _applicationFor(MobileNotificationKind kind) =>
    switch (kind) {
      MobileNotificationKind.familyHome ||
      MobileNotificationKind.familyAttendance ||
      MobileNotificationKind.familyResults ||
      MobileNotificationKind.familyFees ||
      MobileNotificationKind.familyDocuments ||
      MobileNotificationKind.familyForms ||
      MobileNotificationKind.familyConsent ||
      MobileNotificationKind.familyMessages ||
      MobileNotificationKind.familyConversation =>
        MobileNotificationApplication.family,
      MobileNotificationKind.staffToday ||
      MobileNotificationKind.staffAttendance ||
      MobileNotificationKind.staffGradebook ||
      MobileNotificationKind.staffMessages =>
        MobileNotificationApplication.staff,
    };

Set<SchoolPersona> _applicationPersonas(
  MobileNotificationApplication application,
) => switch (application) {
  MobileNotificationApplication.family => const {
    SchoolPersona.guardian,
    SchoolPersona.student,
  },
  MobileNotificationApplication.staff => const {SchoolPersona.teacher},
};

Set<SchoolPersona> _personasFor(MobileNotificationKind kind) => switch (kind) {
  MobileNotificationKind.familyFees ||
  MobileNotificationKind.familyConsent => const {SchoolPersona.guardian},
  MobileNotificationKind.familyHome ||
  MobileNotificationKind.familyAttendance ||
  MobileNotificationKind.familyResults ||
  MobileNotificationKind.familyDocuments ||
  MobileNotificationKind.familyForms ||
  MobileNotificationKind.familyMessages ||
  MobileNotificationKind.familyConversation => const {
    SchoolPersona.guardian,
    SchoolPersona.student,
  },
  MobileNotificationKind.staffToday ||
  MobileNotificationKind.staffAttendance ||
  MobileNotificationKind.staffGradebook ||
  MobileNotificationKind.staffMessages => const {SchoolPersona.teacher},
};

Set<String> _requiredAllCapabilities(
  MobileNotificationKind kind,
) => switch (kind) {
  MobileNotificationKind.familyAttendance => const {
    SchoolCapability.attendanceRead,
  },
  MobileNotificationKind.familyResults => const {
    SchoolCapability.gradesReadPublished,
  },
  MobileNotificationKind.familyFees => const {SchoolCapability.billingRead},
  MobileNotificationKind.familyDocuments => const {
    SchoolCapability.documentsRead,
  },
  MobileNotificationKind.familyForms ||
  MobileNotificationKind.familyConsent => const {SchoolCapability.formsConsent},
  MobileNotificationKind.familyMessages ||
  MobileNotificationKind.familyConversation => const {
    SchoolCapability.messagesRead,
  },
  MobileNotificationKind.staffAttendance => const {
    SchoolCapability.attendanceTake,
  },
  MobileNotificationKind.staffGradebook => const {SchoolCapability.gradesWrite},
  MobileNotificationKind.familyHome ||
  MobileNotificationKind.staffToday => const <String>{},
  MobileNotificationKind.staffMessages => const <String>{},
};

Set<String> _requiredAnyCapabilities(MobileNotificationKind kind) =>
    kind == MobileNotificationKind.staffMessages
    ? const {SchoolCapability.messagesRead, SchoolCapability.messagesSend}
    : const <String>{};

String? _locationFor(
  MobileNotificationKind kind,
  String? resourceId,
) => switch (kind) {
  MobileNotificationKind.familyHome || MobileNotificationKind.staffToday => '/',
  MobileNotificationKind.familyAttendance ||
  MobileNotificationKind.staffAttendance => '/attendance',
  MobileNotificationKind.familyResults => '/results',
  MobileNotificationKind.familyFees => '/fees',
  MobileNotificationKind.familyDocuments => '/documents',
  MobileNotificationKind.familyForms =>
    resourceId == null ? '/forms' : '/forms/${Uri.encodeComponent(resourceId)}',
  MobileNotificationKind.familyConsent => '/consents',
  MobileNotificationKind.familyMessages ||
  MobileNotificationKind.staffMessages => '/messages',
  MobileNotificationKind.familyConversation =>
    resourceId == null
        ? '/conversations'
        : '/conversations/${Uri.encodeComponent(resourceId)}',
  MobileNotificationKind.staffGradebook => '/gradebook',
};

T _enumValue<T extends Enum>(Iterable<T> values, String value, String code) {
  for (final candidate in values) {
    if (candidate.name == value) return candidate;
  }
  throw MobileNotificationContractException(code);
}

String _requiredString(Map<String, Object?> data, String key) {
  final value = data[key];
  if (value is! String || value.trim().isEmpty) {
    throw MobileNotificationContractException(
      'MOBILE_NOTIFICATION_FIELD_REQUIRED:$key',
    );
  }
  return value.trim();
}

String _identifier(Map<String, Object?> data, String key) =>
    _validateIdentifier(
      _requiredString(data, key),
      'MOBILE_NOTIFICATION_IDENTIFIER_INVALID:$key',
    );

String? _optionalIdentifier(Map<String, Object?> data, String key) {
  final value = data[key];
  if (value == null) return null;
  if (value is! String || value.trim().isEmpty) {
    throw MobileNotificationContractException(
      'MOBILE_NOTIFICATION_IDENTIFIER_INVALID:$key',
    );
  }
  return _validateIdentifier(
    value.trim(),
    'MOBILE_NOTIFICATION_IDENTIFIER_INVALID:$key',
  );
}

String _validateIdentifier(String value, String code) {
  if (!RegExp(r'^[A-Za-z0-9_.:-]{1,256}$').hasMatch(value) ||
      value.contains('://')) {
    throw MobileNotificationContractException(code);
  }
  return value;
}

DateTime _dateTime(Map<String, Object?> data, String key) {
  final value = _requiredString(data, key);
  if (!RegExp(r'(?:Z|[+-]\d{2}:\d{2})$').hasMatch(value)) {
    throw MobileNotificationContractException(
      'MOBILE_NOTIFICATION_DATETIME_OFFSET_REQUIRED:$key',
    );
  }
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    throw MobileNotificationContractException(
      'MOBILE_NOTIFICATION_DATETIME_INVALID:$key',
    );
  }
  return parsed.toUtc();
}
