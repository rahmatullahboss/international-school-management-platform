from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MOBILE = ROOT / "mobile"
PACKAGE = MOBILE / "packages" / "native_notifications"

FILES = {
    PACKAGE / "pubspec.yaml": """name: school_native_notifications
description: Secret-free Firebase and APNs notification adapters for School mobile apps.
version: 0.1.0
publish_to: none
resolution: workspace

environment:
  sdk: ^3.10.0
  flutter: '>=3.44.0'

dependencies:
  firebase_core: ^4.12.1
  firebase_messaging: ^16.4.3
  flutter:
    sdk: flutter
  school_api_client: ^0.1.0
  school_mobile_core: ^0.1.0

dev_dependencies:
  flutter_lints: ^6.0.0
  flutter_test:
    sdk: flutter
""",
    PACKAGE / "lib" / "school_native_notifications.dart": r"""import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:school_api_client/device_session_api.dart';
import 'package:school_mobile_core/notification_routing.dart';

enum NativeNotificationPermission { notDetermined, denied, provisional, authorized }

enum NativeNotificationActivationStatus {
  denied,
  awaitingProviderToken,
  provisional,
  authorized,
}

final class NativePushCredential {
  NativePushCredential({required this.provider, required String token})
    : token = SchoolPushToken(token);

  final SchoolPushProvider provider;
  final SchoolPushToken token;

  bool hasSameValue(NativePushCredential other) =>
      provider == other.provider && token.value == other.token.value;

  @override
  String toString() =>
      'NativePushCredential(provider: ${provider.name}, token: [REDACTED])';
}

abstract interface class NativePushGateway {
  Stream<NativePushCredential> get credentialRefreshes;

  Stream<Map<String, Object?>> get openedData;

  Future<NativePushCredential?> currentCredential();

  Future<void> deleteProviderToken();

  Future<void> dispose();

  Future<NativeNotificationPermission> requestPermission();

  Future<Map<String, Object?>?> takeInitialData();
}

final class FirebaseNativePushGateway implements NativePushGateway {
  FirebaseNativePushGateway._(this._messaging);

  static Future<FirebaseNativePushGateway> create({
    FirebaseMessaging? messaging,
  }) async {
    if (Firebase.apps.isEmpty) {
      throw const NativeNotificationException(
        'NATIVE_NOTIFICATION_FIREBASE_NOT_INITIALIZED',
      );
    }
    return FirebaseNativePushGateway._(messaging ?? FirebaseMessaging.instance);
  }

  final FirebaseMessaging _messaging;

  bool get _isApple =>
      defaultTargetPlatform == TargetPlatform.iOS ||
      defaultTargetPlatform == TargetPlatform.macOS;

  @override
  Stream<NativePushCredential> get credentialRefreshes =>
      _messaging.onTokenRefresh.asyncExpand((_) async* {
        final credential = await currentCredential();
        if (credential != null) yield credential;
      });

  @override
  Stream<Map<String, Object?>> get openedData =>
      FirebaseMessaging.onMessageOpenedApp.map(_messageData);

  @override
  Future<NativePushCredential?> currentCredential() async {
    if (_isApple) {
      final token = await _messaging.getAPNSToken();
      if (token == null || token.trim().isEmpty) return null;
      return NativePushCredential(
        provider: SchoolPushProvider.apns,
        token: token,
      );
    }

    final token = await _messaging.getToken();
    if (token == null || token.trim().isEmpty) return null;
    return NativePushCredential(
      provider: SchoolPushProvider.firebase,
      token: token,
    );
  }

  @override
  Future<void> deleteProviderToken() => _messaging.deleteToken();

  @override
  Future<void> dispose() async {}

  @override
  Future<NativeNotificationPermission> requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );
    return switch (settings.authorizationStatus) {
      AuthorizationStatus.authorized => NativeNotificationPermission.authorized,
      AuthorizationStatus.provisional => NativeNotificationPermission.provisional,
      AuthorizationStatus.denied => NativeNotificationPermission.denied,
      AuthorizationStatus.notDetermined =>
        NativeNotificationPermission.notDetermined,
    };
  }

  @override
  Future<Map<String, Object?>?> takeInitialData() async {
    final message = await _messaging.getInitialMessage();
    return message == null ? null : _messageData(message);
  }

  Map<String, Object?> _messageData(RemoteMessage message) =>
      Map<String, Object?>.unmodifiable(message.data);
}

final class NativeNotificationTimestampNormalizer {
  const NativeNotificationTimestampNormalizer();

  Map<String, Object?> normalize(Map<String, Object?> data) {
    final normalized = Map<String, Object?>.from(data);
    normalized['issuedAt'] = _normalizeTimestamp(data, 'issuedAt');
    normalized['expiresAt'] = _normalizeTimestamp(data, 'expiresAt');
    return Map<String, Object?>.unmodifiable(normalized);
  }

  String _normalizeTimestamp(Map<String, Object?> data, String key) {
    final value = data[key];
    if (value is! String || value.trim().isEmpty) {
      throw NativeNotificationException(
        'NATIVE_NOTIFICATION_TIMESTAMP_REQUIRED:$key',
      );
    }
    final input = value.trim();
    if (!RegExp(r'(?:Z|[+-]\d{2}:\d{2})$').hasMatch(input)) {
      throw NativeNotificationException(
        'NATIVE_NOTIFICATION_TIMESTAMP_OFFSET_REQUIRED:$key',
      );
    }
    final parsed = DateTime.tryParse(input);
    if (parsed == null) {
      throw NativeNotificationException(
        'NATIVE_NOTIFICATION_TIMESTAMP_INVALID:$key',
      );
    }
    return parsed.toUtc().toIso8601String();
  }
}

typedef NativeNotificationRejectionHandler =
    void Function(Object error, StackTrace stackTrace);

final class NativeNotificationBridge implements MobileNotificationSource {
  NativeNotificationBridge._({
    required MobileNotificationInbox inbox,
    required NativePushGateway gateway,
    required StreamSubscription<Map<String, Object?>> subscription,
  }) : _gateway = gateway,
       _inbox = inbox,
       _subscription = subscription;

  static Future<NativeNotificationBridge> create({
    required NativePushGateway gateway,
    NativeNotificationRejectionHandler? onRejected,
  }) async {
    const normalizer = NativeNotificationTimestampNormalizer();
    MobileNotificationEnvelope? initial;
    final initialData = await gateway.takeInitialData();
    if (initialData != null) {
      initial = _decode(initialData, normalizer, onRejected);
    }
    final inbox = MobileNotificationInbox(initial: initial);
    final subscription = gateway.openedData.listen(
      (data) {
        final envelope = _decode(data, normalizer, onRejected);
        if (envelope != null) inbox.addOpened(envelope);
      },
      onError: (Object error, StackTrace stackTrace) {
        onRejected?.call(error, stackTrace);
      },
    );
    return NativeNotificationBridge._(
      gateway: gateway,
      inbox: inbox,
      subscription: subscription,
    );
  }

  static MobileNotificationEnvelope? _decode(
    Map<String, Object?> data,
    NativeNotificationTimestampNormalizer normalizer,
    NativeNotificationRejectionHandler? onRejected,
  ) {
    try {
      return MobileNotificationEnvelope.fromData(normalizer.normalize(data));
    } on Object catch (error, stackTrace) {
      onRejected?.call(error, stackTrace);
      return null;
    }
  }

  final NativePushGateway _gateway;
  final MobileNotificationInbox _inbox;
  final StreamSubscription<Map<String, Object?>> _subscription;

  @override
  Stream<MobileNotificationEnvelope> get openedNotifications =>
      _inbox.openedNotifications;

  @override
  MobileNotificationEnvelope? takeInitial() => _inbox.takeInitial();

  Future<void> dispose() async {
    await _subscription.cancel();
    await _inbox.close();
    await _gateway.dispose();
  }
}

abstract interface class NativeDeviceSessionRegistrar {
  Future<RegisteredDeviceSession> register({
    required String correlationId,
    required String idempotencyKey,
    required DeviceSessionRegistration registration,
  });

  Future<void> revoke({
    required String correlationId,
    required String deviceSessionId,
    required String idempotencyKey,
  });
}

final class ApiNativeDeviceSessionRegistrar
    implements NativeDeviceSessionRegistrar {
  const ApiNativeDeviceSessionRegistrar(this._api);

  final DeviceSessionApi _api;

  @override
  Future<RegisteredDeviceSession> register({
    required String correlationId,
    required String idempotencyKey,
    required DeviceSessionRegistration registration,
  }) => _api.register(
    correlationId: correlationId,
    idempotencyKey: idempotencyKey,
    registration: registration,
  );

  @override
  Future<void> revoke({
    required String correlationId,
    required String deviceSessionId,
    required String idempotencyKey,
  }) => _api.revoke(
    correlationId: correlationId,
    deviceSessionId: deviceSessionId,
    idempotencyKey: idempotencyKey,
  );
}

final class NativeNotificationRegistrationContext {
  const NativeNotificationRegistrationContext({
    required this.appVersion,
    required this.application,
    required this.environment,
    required this.installationId,
    required this.platform,
  });

  final String installationId;
  final SchoolMobileApplication application;
  final SchoolMobilePlatform platform;
  final String appVersion;
  final SchoolPushEnvironment environment;
}

final class NativeNotificationActivation {
  const NativeNotificationActivation({
    required this.permission,
    required this.status,
  });

  final NativeNotificationPermission permission;
  final NativeNotificationActivationStatus status;
}

typedef NativeNotificationKeyFactory = String Function(String operation);
typedef NativeNotificationCorrelationFactory = String Function();

final class NativeNotificationLifecycle {
  NativeNotificationLifecycle({
    required NativeNotificationCorrelationFactory correlationIdFactory,
    required NativePushGateway gateway,
    required NativeNotificationKeyFactory idempotencyKeyFactory,
    required NativeNotificationRegistrationContext registrationContext,
    required NativeDeviceSessionRegistrar registrar,
    NativeNotificationRejectionHandler? onError,
  }) : _correlationIdFactory = correlationIdFactory,
       _gateway = gateway,
       _idempotencyKeyFactory = idempotencyKeyFactory,
       _onError = onError,
       _registrar = registrar,
       _registrationContext = registrationContext;

  final NativeNotificationCorrelationFactory _correlationIdFactory;
  final NativePushGateway _gateway;
  final NativeNotificationKeyFactory _idempotencyKeyFactory;
  final NativeNotificationRejectionHandler? _onError;
  final NativeDeviceSessionRegistrar _registrar;
  final NativeNotificationRegistrationContext _registrationContext;

  StreamSubscription<NativePushCredential>? _refreshSubscription;
  RegisteredDeviceSession? _registeredSession;
  NativePushCredential? _registeredCredential;
  bool _closed = false;
  Future<void> _refreshTail = Future<void>.value();

  RegisteredDeviceSession? get registeredSession => _registeredSession;

  Future<NativeNotificationActivation> activate() async {
    _ensureOpen();
    final permission = await _gateway.requestPermission();
    if (permission == NativeNotificationPermission.denied ||
        permission == NativeNotificationPermission.notDetermined) {
      return NativeNotificationActivation(
        permission: permission,
        status: NativeNotificationActivationStatus.denied,
      );
    }

    _refreshSubscription ??= _gateway.credentialRefreshes.listen(
      _enqueueRefresh,
      onError: (Object error, StackTrace stackTrace) {
        _onError?.call(error, stackTrace);
      },
    );

    final credential = await _gateway.currentCredential();
    if (credential == null) {
      return NativeNotificationActivation(
        permission: permission,
        status: NativeNotificationActivationStatus.awaitingProviderToken,
      );
    }
    await _replaceRegistration(credential);
    return NativeNotificationActivation(
      permission: permission,
      status: permission == NativeNotificationPermission.provisional
          ? NativeNotificationActivationStatus.provisional
          : NativeNotificationActivationStatus.authorized,
    );
  }

  void _enqueueRefresh(NativePushCredential credential) {
    _refreshTail = _refreshTail.then((_) => _replaceRegistration(credential));
    _refreshTail = _refreshTail.catchError((Object error, StackTrace stackTrace) {
      _onError?.call(error, stackTrace);
    });
  }

  Future<void> _replaceRegistration(NativePushCredential credential) async {
    final currentCredential = _registeredCredential;
    if (currentCredential != null &&
        currentCredential.hasSameValue(credential)) {
      return;
    }

    final next = await _registrar.register(
      correlationId: _correlationIdFactory(),
      idempotencyKey: _idempotencyKeyFactory('register'),
      registration: DeviceSessionRegistration(
        appVersion: _registrationContext.appVersion,
        application: _registrationContext.application,
        installationId: _registrationContext.installationId,
        notificationEnvironment: _registrationContext.environment,
        platform: _registrationContext.platform,
        pushProvider: credential.provider,
        pushToken: credential.token,
      ),
    );
    final previous = _registeredSession;
    _registeredCredential = credential;
    _registeredSession = next;

    if (previous != null && previous.deviceSessionId != next.deviceSessionId) {
      await _registrar.revoke(
        correlationId: _correlationIdFactory(),
        deviceSessionId: previous.deviceSessionId,
        idempotencyKey: _idempotencyKeyFactory('revoke-rotated'),
      );
    }
  }

  Future<void> revoke() async {
    _ensureOpen();
    await _refreshSubscription?.cancel();
    _refreshSubscription = null;
    await _refreshTail;
    final current = _registeredSession;
    if (current != null) {
      await _registrar.revoke(
        correlationId: _correlationIdFactory(),
        deviceSessionId: current.deviceSessionId,
        idempotencyKey: _idempotencyKeyFactory('revoke-current'),
      );
    }
    await _gateway.deleteProviderToken();
    _registeredCredential = null;
    _registeredSession = null;
  }

  Future<void> dispose() async {
    if (_closed) return;
    _closed = true;
    await _refreshSubscription?.cancel();
    await _refreshTail;
    await _gateway.dispose();
  }

  void _ensureOpen() {
    if (_closed) {
      throw const NativeNotificationException(
        'NATIVE_NOTIFICATION_LIFECYCLE_CLOSED',
      );
    }
  }
}

final class NativeNotificationException implements Exception {
  const NativeNotificationException(this.code);

  final String code;

  @override
  String toString() => 'NativeNotificationException($code)';
}
""",
    PACKAGE / "test" / "native_notifications_test.dart": r"""import 'dart:async';

import 'package:school_api_client/device_session_api.dart';
import 'package:school_mobile_core/notification_routing.dart';
import 'package:school_native_notifications/school_native_notifications.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('normalizes only timestamps with explicit offsets', () {
    const normalizer = NativeNotificationTimestampNormalizer();
    final normalized = normalizer.normalize(notificationData(
      issuedAt: '2026-07-30T12:00:00+06:00',
      expiresAt: '2026-07-30T12:30:00+06:00',
    ));

    expect(normalized['issuedAt'], '2026-07-30T06:00:00.000Z');
    expect(
      () => normalizer.normalize(notificationData(
        issuedAt: '2026-07-30T12:00:00',
        expiresAt: '2026-07-30T12:30:00+06:00',
      )),
      throwsA(
        isA<NativeNotificationException>().having(
          (error) => error.code,
          'code',
          'NATIVE_NOTIFICATION_TIMESTAMP_OFFSET_REQUIRED:issuedAt',
        ),
      ),
    );
  });

  test('bridge exposes valid launch data and rejects provider display fields', () async {
    final gateway = FakeGateway(
      initialData: notificationData(
        issuedAt: '2026-07-30T12:00:00+06:00',
        expiresAt: '2026-07-30T12:30:00+06:00',
      ),
    );
    final rejected = <Object>[];
    final bridge = await NativeNotificationBridge.create(
      gateway: gateway,
      onRejected: (error, _) => rejected.add(error),
    );

    expect(bridge.takeInitial()?.kind, MobileNotificationKind.familyHome);
    gateway.open({
      ...notificationData(
        issuedAt: '2026-07-30T12:00:00+06:00',
        expiresAt: '2026-07-30T12:30:00+06:00',
      ),
      'title': 'Sensitive student update',
    });
    await Future<void>.delayed(Duration.zero);
    expect(rejected, hasLength(1));

    await bridge.dispose();
  });

  test('denied permission never registers a device session', () async {
    final gateway = FakeGateway(permission: NativeNotificationPermission.denied);
    final registrar = FakeRegistrar();
    final lifecycle = lifecycleFor(gateway: gateway, registrar: registrar);

    final activation = await lifecycle.activate();

    expect(activation.status, NativeNotificationActivationStatus.denied);
    expect(registrar.registrations, isEmpty);
    await lifecycle.dispose();
  });

  test('registers APNs credential and rotates server sessions after refresh', () async {
    final gateway = FakeGateway(
      credential: NativePushCredential(
        provider: SchoolPushProvider.apns,
        token: 'apns-token-one',
      ),
    );
    final registrar = FakeRegistrar();
    final lifecycle = lifecycleFor(gateway: gateway, registrar: registrar);

    final activation = await lifecycle.activate();
    expect(activation.status, NativeNotificationActivationStatus.authorized);
    expect(registrar.registrations.single.pushProvider, SchoolPushProvider.apns);

    gateway.refresh(
      NativePushCredential(
        provider: SchoolPushProvider.apns,
        token: 'apns-token-two',
      ),
    );
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(registrar.registrations, hasLength(2));
    expect(registrar.revokedIds, ['device-session-1']);
    expect(lifecycle.registeredSession?.deviceSessionId, 'device-session-2');

    await lifecycle.revoke();
    expect(registrar.revokedIds, ['device-session-1', 'device-session-2']);
    expect(gateway.deleted, isTrue);
    await lifecycle.dispose();
  });
}

NativeNotificationLifecycle lifecycleFor({
  required FakeGateway gateway,
  required FakeRegistrar registrar,
}) {
  var sequence = 0;
  return NativeNotificationLifecycle(
    correlationIdFactory: () => 'correlation-${++sequence}',
    gateway: gateway,
    idempotencyKeyFactory: (operation) => '$operation-${++sequence}',
    registrationContext: const NativeNotificationRegistrationContext(
      appVersion: '0.1.0+1',
      application: SchoolMobileApplication.family,
      environment: SchoolPushEnvironment.development,
      installationId: 'installation_1234567890',
      platform: SchoolMobilePlatform.ios,
    ),
    registrar: registrar,
  );
}

Map<String, Object?> notificationData({
  required String expiresAt,
  required String issuedAt,
}) => <String, Object?>{
  'notificationId': 'notification-1',
  'application': MobileNotificationApplication.family.name,
  'tenantId': 'tenant-1',
  'campusId': 'campus-1',
  'persona': 'guardian',
  'kind': MobileNotificationKind.familyHome.name,
  'issuedAt': issuedAt,
  'expiresAt': expiresAt,
};

final class FakeGateway implements NativePushGateway {
  FakeGateway({
    this.credential,
    this.initialData,
    this.permission = NativeNotificationPermission.authorized,
  });

  NativePushCredential? credential;
  final Map<String, Object?>? initialData;
  final NativeNotificationPermission permission;
  bool deleted = false;
  final _opened = StreamController<Map<String, Object?>>.broadcast(sync: true);
  final _refreshes = StreamController<NativePushCredential>.broadcast(sync: true);

  @override
  Stream<NativePushCredential> get credentialRefreshes => _refreshes.stream;

  @override
  Stream<Map<String, Object?>> get openedData => _opened.stream;

  @override
  Future<NativePushCredential?> currentCredential() async => credential;

  @override
  Future<void> deleteProviderToken() async {
    deleted = true;
  }

  @override
  Future<void> dispose() async {
    await _opened.close();
    await _refreshes.close();
  }

  void open(Map<String, Object?> data) => _opened.add(data);

  void refresh(NativePushCredential next) {
    credential = next;
    _refreshes.add(next);
  }

  @override
  Future<NativeNotificationPermission> requestPermission() async => permission;

  @override
  Future<Map<String, Object?>?> takeInitialData() async => initialData;
}

final class FakeRegistrar implements NativeDeviceSessionRegistrar {
  final registrations = <DeviceSessionRegistration>[];
  final revokedIds = <String>[];

  @override
  Future<RegisteredDeviceSession> register({
    required String correlationId,
    required String idempotencyKey,
    required DeviceSessionRegistration registration,
  }) async {
    registrations.add(registration);
    final index = registrations.length;
    return RegisteredDeviceSession(
      deviceSessionId: 'device-session-$index',
      installationId: registration.installationId,
      registeredAt: DateTime.utc(2026, 7, 30, 6, index),
      revision: index,
    );
  }

  @override
  Future<void> revoke({
    required String correlationId,
    required String deviceSessionId,
    required String idempotencyKey,
  }) async {
    revokedIds.add(deviceSessionId);
  }
}
""",
}

for path, content in FILES.items():
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

workspace = MOBILE / "pubspec.yaml"
text = workspace.read_text(encoding="utf-8")
anchor = "  - packages/mobile_core\n"
if "  - packages/native_notifications\n" not in text:
    text = text.replace(anchor, anchor + "  - packages/native_notifications\n")
workspace.write_text(text, encoding="utf-8")

for relative in ["apps/family_app/pubspec.yaml", "apps/staff_app/pubspec.yaml"]:
    path = MOBILE / relative
    text = path.read_text(encoding="utf-8")
    anchor = "  school_mobile_core: ^0.1.0\n"
    if "  school_native_notifications: ^0.1.0\n" not in text:
        text = text.replace(anchor, anchor + "  school_native_notifications: ^0.1.0\n")
    path.write_text(text, encoding="utf-8")

routing = MOBILE / "packages" / "mobile_core" / "lib" / "notification_routing.dart"
text = routing.read_text(encoding="utf-8")
old = """  final parsed = DateTime.tryParse(value);\n  if (parsed == null) {\n"""
new = """  if (!RegExp(r'(?:Z|[+-]\\d{2}:\\d{2})$').hasMatch(value)) {\n    throw MobileNotificationContractException(\n      'MOBILE_NOTIFICATION_DATETIME_OFFSET_REQUIRED:$key',\n    );\n  }\n  final parsed = DateTime.tryParse(value);\n  if (parsed == null) {\n"""
if old not in text and "MOBILE_NOTIFICATION_DATETIME_OFFSET_REQUIRED" not in text:
    raise SystemExit("notification datetime anchor missing")
text = text.replace(old, new)
routing.write_text(text, encoding="utf-8")

routing_test = MOBILE / "packages" / "mobile_core" / "test" / "notification_routing_test.dart"
text = routing_test.read_text(encoding="utf-8")
anchor = "  test('routes Family forms only inside exact authorized scope', () {\n"
addition = """  test('requires explicit offsets for notification timestamps', () {\n    expect(\n      () => MobileNotificationEnvelope.fromData({\n        ...familyData(kind: MobileNotificationKind.familyHome),\n        'issuedAt': '2026-07-30T06:00:00',\n      }),\n      throwsA(\n        isA<MobileNotificationContractException>().having(\n          (error) => error.code,\n          'code',\n          'MOBILE_NOTIFICATION_DATETIME_OFFSET_REQUIRED:issuedAt',\n        ),\n      ),\n    );\n  });\n\n"""
if "requires explicit offsets for notification timestamps" not in text:
    if anchor not in text:
        raise SystemExit("notification test anchor missing")
    text = text.replace(anchor, addition + anchor)
routing_test.write_text(text, encoding="utf-8")
