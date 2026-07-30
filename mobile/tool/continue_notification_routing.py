#!/usr/bin/env python3
"""Add privacy-minimised notification envelopes and capability-safe routing."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    source = target.read_text(encoding="utf-8")
    if source.count(old) != 1:
        raise SystemExit(f"Expected one anchor in {path}: {old[:80]!r}")
    target.write_text(source.replace(old, new, 1), encoding="utf-8")


write(
    "mobile/packages/mobile_core/lib/notification_routing.dart",
    r'''import 'dart:async';
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
    MobileNotificationApplication.family => const MobileNotificationPresentation(
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

Set<String> _requiredAllCapabilities(MobileNotificationKind kind) =>
    switch (kind) {
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
      MobileNotificationKind.familyConsent => const {
        SchoolCapability.formsConsent,
      },
      MobileNotificationKind.familyMessages ||
      MobileNotificationKind.familyConversation => const {
        SchoolCapability.messagesRead,
      },
      MobileNotificationKind.staffAttendance => const {
        SchoolCapability.attendanceTake,
      },
      MobileNotificationKind.staffGradebook => const {
        SchoolCapability.gradesWrite,
      },
      MobileNotificationKind.familyHome || MobileNotificationKind.staffToday =>
        const <String>{},
      MobileNotificationKind.staffMessages => const <String>{},
    };

Set<String> _requiredAnyCapabilities(MobileNotificationKind kind) =>
    kind == MobileNotificationKind.staffMessages
    ? const {SchoolCapability.messagesRead, SchoolCapability.messagesSend}
    : const <String>{};

String? _locationFor(MobileNotificationKind kind, String? resourceId) =>
    switch (kind) {
      MobileNotificationKind.familyHome || MobileNotificationKind.staffToday =>
        '/',
      MobileNotificationKind.familyAttendance ||
      MobileNotificationKind.staffAttendance =>
        '/attendance',
      MobileNotificationKind.familyResults => '/results',
      MobileNotificationKind.familyFees => '/fees',
      MobileNotificationKind.familyDocuments => '/documents',
      MobileNotificationKind.familyForms => resourceId == null
          ? '/forms'
          : '/forms/${Uri.encodeComponent(resourceId)}',
      MobileNotificationKind.familyConsent => '/consents',
      MobileNotificationKind.familyMessages ||
      MobileNotificationKind.staffMessages =>
        '/messages',
      MobileNotificationKind.familyConversation => resourceId == null
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
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    throw MobileNotificationContractException(
      'MOBILE_NOTIFICATION_DATETIME_INVALID:$key',
    );
  }
  return parsed.toUtc();
}
''',
)

write(
    "mobile/packages/mobile_core/test/notification_routing_test.dart",
    r'''import 'dart:async';

import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_mobile_core/notification_routing.dart';
import 'package:test/test.dart';

void main() {
  test('accepts only privacy-minimised notification fields', () {
    final envelope = MobileNotificationEnvelope.fromData(
      familyData(kind: MobileNotificationKind.familyDocuments),
    );

    expect(envelope.presentation.title, 'School Family update');
    expect(envelope.presentation.body, isNot(contains('student')));
    expect(envelope.toString(), contains('[REDACTED]'));
    expect(envelope.toString(), isNot(contains('tenant-1')));

    expect(
      () => MobileNotificationEnvelope.fromData({
        ...familyData(kind: MobileNotificationKind.familyDocuments),
        'title': 'Amina report is ready',
      }),
      throwsA(
        isA<MobileNotificationContractException>().having(
          (error) => error.code,
          'code',
          'MOBILE_NOTIFICATION_FIELDS_FORBIDDEN',
        ),
      ),
    );
  });

  test('routes Family forms only inside exact authorized scope', () {
    final envelope = MobileNotificationEnvelope.fromData(
      familyData(
        kind: MobileNotificationKind.familyForms,
        resourceId: 'form:transport.2026',
      ),
    );
    const resolver = MobileNotificationRouteResolver();
    final allowed = resolver.resolve(
      application: MobileNotificationApplication.family,
      envelope: envelope,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: familySession(
        capabilities: const {SchoolCapability.formsConsent},
      ),
    );

    expect(allowed.isAllowed, isTrue);
    expect(allowed.location, '/forms/form%3Atransport.2026');

    final wrongCampus = resolver.resolve(
      application: MobileNotificationApplication.family,
      envelope: envelope,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: familySession(
        campusId: 'campus-2',
        capabilities: const {SchoolCapability.formsConsent},
      ),
    );
    expect(
      wrongCampus.status,
      MobileNotificationRouteStatus.wrongSchoolScope,
    );
    expect(wrongCampus.location, isNull);
  });

  test('never switches persona or bypasses capabilities', () {
    final consent = MobileNotificationEnvelope.fromData(
      familyData(kind: MobileNotificationKind.familyConsent),
    );
    const resolver = MobileNotificationRouteResolver();

    final student = resolver.resolve(
      application: MobileNotificationApplication.family,
      envelope: consent,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: familySession(
        capabilities: const {SchoolCapability.formsConsent},
        persona: SchoolPersona.student,
      ),
    );
    expect(student.status, MobileNotificationRouteStatus.wrongPersona);

    final noCapability = resolver.resolve(
      application: MobileNotificationApplication.family,
      envelope: MobileNotificationEnvelope.fromData(
        familyData(kind: MobileNotificationKind.familyDocuments),
      ),
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: familySession(capabilities: const <String>{}),
    );
    expect(
      noCapability.status,
      MobileNotificationRouteStatus.missingCapability,
    );
  });

  test('blocks expired, future and wrong-application intents', () {
    final envelope = MobileNotificationEnvelope.fromData(
      familyData(kind: MobileNotificationKind.familyHome),
    );
    const resolver = MobileNotificationRouteResolver();
    final session = familySession(capabilities: const <String>{});

    expect(
      resolver
          .resolve(
            application: MobileNotificationApplication.family,
            envelope: envelope,
            now: DateTime.utc(2026, 7, 30, 7),
            session: session,
          )
          .status,
      MobileNotificationRouteStatus.expired,
    );
    expect(
      resolver
          .resolve(
            application: MobileNotificationApplication.family,
            envelope: envelope,
            now: DateTime.utc(2026, 7, 30, 5, 50),
            session: session,
          )
          .status,
      MobileNotificationRouteStatus.notYetValid,
    );
    expect(
      resolver
          .resolve(
            application: MobileNotificationApplication.staff,
            envelope: envelope,
            now: DateTime.utc(2026, 7, 30, 6, 5),
            session: session,
          )
          .status,
      MobileNotificationRouteStatus.wrongApplication,
    );
  });

  test('routes Staff intents using any-of message capability rules', () {
    final envelope = MobileNotificationEnvelope.fromData(
      staffData(kind: MobileNotificationKind.staffMessages),
    );
    const resolver = MobileNotificationRouteResolver();

    final allowed = resolver.resolve(
      application: MobileNotificationApplication.staff,
      envelope: envelope,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: staffSession(
        capabilities: const {SchoolCapability.messagesSend},
      ),
    );
    expect(allowed.location, '/messages');

    final blocked = resolver.resolve(
      application: MobileNotificationApplication.staff,
      envelope: envelope,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: staffSession(capabilities: const <String>{}),
    );
    expect(blocked.status, MobileNotificationRouteStatus.missingCapability);
  });

  test('inbox consumes launch intent once and tracker bounds duplicates', () async {
    final first = MobileNotificationEnvelope.fromData(
      familyData(kind: MobileNotificationKind.familyHome),
    );
    final second = MobileNotificationEnvelope.fromData(
      familyData(
        kind: MobileNotificationKind.familyMessages,
        notificationId: 'notification-2',
      ),
    );
    final inbox = MobileNotificationInbox(initial: first);

    expect(inbox.takeInitial(), same(first));
    expect(inbox.takeInitial(), isNull);

    final opened = <MobileNotificationEnvelope>[];
    final subscription = inbox.openedNotifications.listen(opened.add);
    inbox.addOpened(second);
    await Future<void>.delayed(Duration.zero);
    expect(opened, [second]);

    final tracker = MobileNotificationOpenTracker(maximumTracked: 1);
    expect(tracker.claim(first.notificationId), isTrue);
    expect(tracker.claim(first.notificationId), isFalse);
    expect(tracker.claim(second.notificationId), isTrue);
    expect(tracker.claim(first.notificationId), isTrue);

    await subscription.cancel();
    await inbox.close();
  });

  test('rejects resources on routes that never need record identifiers', () {
    expect(
      () => MobileNotificationEnvelope.fromData(
        familyData(
          kind: MobileNotificationKind.familyDocuments,
          resourceId: 'document-1',
        ),
      ),
      throwsA(
        isA<MobileNotificationContractException>().having(
          (error) => error.code,
          'code',
          'MOBILE_NOTIFICATION_RESOURCE_FORBIDDEN',
        ),
      ),
    );
  });
}

Map<String, Object?> familyData({
  required MobileNotificationKind kind,
  String notificationId = 'notification-1',
  String? resourceId,
}) => <String, Object?>{
  'notificationId': notificationId,
  'application': MobileNotificationApplication.family.name,
  'tenantId': 'tenant-1',
  'campusId': 'campus-1',
  'persona': SchoolPersona.guardian.name,
  'kind': kind.name,
  if (resourceId != null) 'resourceId': resourceId,
  'issuedAt': '2026-07-30T06:00:00Z',
  'expiresAt': '2026-07-30T06:30:00Z',
};

Map<String, Object?> staffData({required MobileNotificationKind kind}) =>
    <String, Object?>{
      'notificationId': 'staff-notification-1',
      'application': MobileNotificationApplication.staff.name,
      'tenantId': 'tenant-1',
      'campusId': 'campus-1',
      'persona': SchoolPersona.teacher.name,
      'kind': kind.name,
      'issuedAt': '2026-07-30T06:00:00Z',
      'expiresAt': '2026-07-30T06:30:00Z',
    };

SchoolSession familySession({
  required Set<String> capabilities,
  String campusId = 'campus-1',
  SchoolPersona persona = SchoolPersona.guardian,
}) => SchoolSession(
  accountId: 'account-1',
  activePersona: persona,
  availablePersonas: {persona},
  campusId: campusId,
  capabilities: capabilities,
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);

SchoolSession staffSession({required Set<String> capabilities}) => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.teacher,
  availablePersonas: const {SchoolPersona.teacher},
  campusId: 'campus-1',
  capabilities: capabilities,
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);
''',
)

for path in (
    "mobile/apps/family_app/lib/main.dart",
    "mobile/apps/staff_app/lib/main.dart",
):
    replace_once(
        path,
        "import 'package:school_mobile_core/mobile_core.dart';\n",
        "import 'package:school_mobile_core/mobile_core.dart';\n"
        "import 'package:school_mobile_core/notification_routing.dart';\n",
    )

family_path = "mobile/apps/family_app/lib/production_app.dart"
replace_once(
    family_path,
    """    this.interactionRepository,\n    this.repository,\n    super.key,\n""",
    """    this.interactionRepository,\n    this.notificationSource,\n    this.onNotificationDecision,\n    this.repository,\n    super.key,\n""",
)
replace_once(
    family_path,
    """  final FamilyInteractionRepository? interactionRepository;\n  final FamilyReadRepository? repository;\n""",
    """  final FamilyInteractionRepository? interactionRepository;\n  final MobileNotificationSource? notificationSource;\n  final ValueChanged<MobileNotificationRouteDecision>? onNotificationDecision;\n  final FamilyReadRepository? repository;\n""",
)
replace_once(
    family_path,
    """            interactionRepository: interactionRepository,\n            repository: repository,\n            session: session,\n""",
    """            interactionRepository: interactionRepository,\n            notificationSource: widget.notificationSource,\n            onNotificationDecision: widget.onNotificationDecision,\n            repository: repository,\n            session: session,\n""",
)
replace_once(
    family_path,
    """    required this.repository,\n    this.interactionRepository,\n    required this.session,\n""",
    """    required this.repository,\n    this.interactionRepository,\n    this.notificationSource,\n    this.onNotificationDecision,\n    required this.session,\n""",
)
replace_once(
    family_path,
    """  final FamilyInteractionRepository? interactionRepository;\n  final FamilyReadRepository repository;\n  final SchoolSession session;\n""",
    """  final FamilyInteractionRepository? interactionRepository;\n  final MobileNotificationSource? notificationSource;\n  final ValueChanged<MobileNotificationRouteDecision>? onNotificationDecision;\n  final FamilyReadRepository repository;\n  final SchoolSession session;\n""",
)
replace_once(
    family_path,
    """class _AuthorizedFamilyAppState extends State<_AuthorizedFamilyApp> {\n  FamilyInteractionController? _interactions;\n  late FamilyJourneyController _journey;\n  late GoRouter _router;\n""",
    """class _AuthorizedFamilyAppState extends State<_AuthorizedFamilyApp> {\n  FamilyInteractionController? _interactions;\n  late FamilyJourneyController _journey;\n  final MobileNotificationOpenTracker _notificationTracker =\n      MobileNotificationOpenTracker();\n  StreamSubscription<MobileNotificationEnvelope>? _notificationSubscription;\n  late GoRouter _router;\n""",
)
replace_once(
    family_path,
    """    _router = _createRouter();\n    unawaited(_journey.initialize());\n""",
    """    _router = _createRouter();\n    _bindNotifications();\n    unawaited(_journey.initialize());\n""",
)
replace_once(
    family_path,
    """    final interactionChanged =\n        oldWidget.interactionRepository != widget.interactionRepository;\n""",
    """    final interactionChanged =\n        oldWidget.interactionRepository != widget.interactionRepository;\n    final notificationSourceChanged =\n        oldWidget.notificationSource != widget.notificationSource;\n""",
)
replace_once(
    family_path,
    """    if (scopeChanged || interactionChanged) {\n      _router.dispose();\n      _router = _createRouter();\n    }\n  }\n\n  bool _sameSession""",
    """    if (scopeChanged || interactionChanged) {\n      _router.dispose();\n      _router = _createRouter();\n    }\n    if (scopeChanged) {\n      _notificationTracker.clear();\n    }\n    if (notificationSourceChanged) {\n      final subscription = _notificationSubscription;\n      if (subscription != null) unawaited(subscription.cancel());\n      _notificationSubscription = null;\n      _notificationTracker.clear();\n      _bindNotifications();\n    }\n  }\n\n  void _bindNotifications() {\n    final source = widget.notificationSource;\n    if (source == null) return;\n    _notificationSubscription = source.openedNotifications.listen(\n      _handleNotification,\n    );\n    final initial = source.takeInitial();\n    if (initial != null) {\n      WidgetsBinding.instance.addPostFrameCallback((_) {\n        if (mounted) _handleNotification(initial);\n      });\n    }\n  }\n\n  void _handleNotification(MobileNotificationEnvelope envelope) {\n    if (!_notificationTracker.claim(envelope.notificationId)) return;\n    var decision = const MobileNotificationRouteResolver().resolve(\n      application: MobileNotificationApplication.family,\n      envelope: envelope,\n      session: widget.session,\n    );\n    if (decision.isAllowed &&\n        _requiresFamilyInteractions(envelope.kind) &&\n        widget.interactionRepository == null) {\n      decision = const MobileNotificationRouteDecision.blocked(\n        MobileNotificationRouteStatus.routeUnavailable,\n        'MOBILE_NOTIFICATION_INTERACTION_ROUTE_UNAVAILABLE',\n      );\n    }\n    widget.onNotificationDecision?.call(decision);\n    final location = decision.location;\n    if (mounted && location != null) _router.go(location);\n  }\n\n  bool _requiresFamilyInteractions(MobileNotificationKind kind) =>\n      switch (kind) {\n        MobileNotificationKind.familyDocuments ||\n        MobileNotificationKind.familyForms ||\n        MobileNotificationKind.familyConsent ||\n        MobileNotificationKind.familyConversation =>\n          true,\n        _ => false,\n      };\n\n  bool _sameSession""",
)
replace_once(
    family_path,
    """  void dispose() {\n    _router.dispose();\n    _journey.dispose();\n    super.dispose();\n  }\n}\n\nclass _AuthorizedFamilyShell""",
    """  void dispose() {\n    final subscription = _notificationSubscription;\n    if (subscription != null) unawaited(subscription.cancel());\n    _router.dispose();\n    _journey.dispose();\n    super.dispose();\n  }\n}\n\nclass _AuthorizedFamilyShell""",
)

staff_path = "mobile/apps/staff_app/lib/production_app.dart"
replace_once(
    staff_path,
    """    this.initializeCoordinator = true,\n    this.repository,\n    this.syncRuntimeLoader,\n""",
    """    this.initializeCoordinator = true,\n    this.notificationSource,\n    this.onNotificationDecision,\n    this.repository,\n    this.syncRuntimeLoader,\n""",
)
replace_once(
    staff_path,
    """  final bool initializeCoordinator;\n  final TeacherJourneyRepository? repository;\n""",
    """  final bool initializeCoordinator;\n  final MobileNotificationSource? notificationSource;\n  final ValueChanged<MobileNotificationRouteDecision>? onNotificationDecision;\n  final TeacherJourneyRepository? repository;\n""",
)
replace_once(
    staff_path,
    """            coordinator: coordinator,\n            repository: repository,\n            session: session,\n""",
    """            coordinator: coordinator,\n            notificationSource: widget.notificationSource,\n            onNotificationDecision: widget.onNotificationDecision,\n            repository: repository,\n            session: session,\n""",
)
replace_once(
    staff_path,
    """    required this.coordinator,\n    required this.repository,\n    required this.session,\n    this.syncRuntimeLoader,\n""",
    """    required this.coordinator,\n    this.notificationSource,\n    this.onNotificationDecision,\n    required this.repository,\n    required this.session,\n    this.syncRuntimeLoader,\n""",
)
replace_once(
    staff_path,
    """  final MobileAppCoordinator coordinator;\n  final TeacherJourneyRepository repository;\n""",
    """  final MobileAppCoordinator coordinator;\n  final MobileNotificationSource? notificationSource;\n  final ValueChanged<MobileNotificationRouteDecision>? onNotificationDecision;\n  final TeacherJourneyRepository repository;\n""",
)
replace_once(
    staff_path,
    """class _AuthorizedStaffAppState extends State<_AuthorizedStaffApp> {\n  late StaffJourneyController _journey;\n  late GoRouter _router;\n  late StaffAttendanceSyncController _sync;\n""",
    """class _AuthorizedStaffAppState extends State<_AuthorizedStaffApp> {\n  late StaffJourneyController _journey;\n  final MobileNotificationOpenTracker _notificationTracker =\n      MobileNotificationOpenTracker();\n  StreamSubscription<MobileNotificationEnvelope>? _notificationSubscription;\n  late GoRouter _router;\n  late StaffAttendanceSyncController _sync;\n""",
)
replace_once(
    staff_path,
    """    _router = _createRouter();\n    unawaited(_journey.initialize());\n""",
    """    _router = _createRouter();\n    _bindNotifications();\n    unawaited(_journey.initialize());\n""",
)
replace_once(
    staff_path,
    """    final repositoryChanged = oldWidget.repository != widget.repository;\n""",
    """    final repositoryChanged = oldWidget.repository != widget.repository;\n    final notificationSourceChanged =\n        oldWidget.notificationSource != widget.notificationSource;\n""",
)
replace_once(
    staff_path,
    """      _router.dispose();\n      _router = _createRouter();\n    }\n  }\n\n  GoRouter _createRouter()""",
    """      _router.dispose();\n      _router = _createRouter();\n    }\n    if (scopeChanged) {\n      _notificationTracker.clear();\n    }\n    if (notificationSourceChanged) {\n      final subscription = _notificationSubscription;\n      if (subscription != null) unawaited(subscription.cancel());\n      _notificationSubscription = null;\n      _notificationTracker.clear();\n      _bindNotifications();\n    }\n  }\n\n  void _bindNotifications() {\n    final source = widget.notificationSource;\n    if (source == null) return;\n    _notificationSubscription = source.openedNotifications.listen(\n      _handleNotification,\n    );\n    final initial = source.takeInitial();\n    if (initial != null) {\n      WidgetsBinding.instance.addPostFrameCallback((_) {\n        if (mounted) _handleNotification(initial);\n      });\n    }\n  }\n\n  void _handleNotification(MobileNotificationEnvelope envelope) {\n    if (!_notificationTracker.claim(envelope.notificationId)) return;\n    final decision = const MobileNotificationRouteResolver().resolve(\n      application: MobileNotificationApplication.staff,\n      envelope: envelope,\n      session: widget.session,\n    );\n    widget.onNotificationDecision?.call(decision);\n    final location = decision.location;\n    if (mounted && location != null) _router.go(location);\n  }\n\n  GoRouter _createRouter()""",
)
replace_once(
    staff_path,
    """  void dispose() {\n    _router.dispose();\n    _journey.dispose();\n    _sync.dispose();\n""",
    """  void dispose() {\n    final subscription = _notificationSubscription;\n    if (subscription != null) unawaited(subscription.cancel());\n    _router.dispose();\n    _journey.dispose();\n    _sync.dispose();\n""",
)

print("Staged privacy-minimised notification and capability-safe routing checkpoint.")
