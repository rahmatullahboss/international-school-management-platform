import 'dart:async';

import 'package:school_api_client/device_session_api.dart';
import 'package:school_mobile_core/notification_routing.dart';
import 'package:school_native_notifications/school_native_notifications.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('normalizes only timestamps with explicit offsets', () {
    const normalizer = NativeNotificationTimestampNormalizer();
    final normalized = normalizer.normalize(
      notificationData(
        issuedAt: '2026-07-30T12:00:00+06:00',
        expiresAt: '2026-07-30T12:30:00+06:00',
      ),
    );

    expect(normalized['issuedAt'], '2026-07-30T06:00:00.000Z');
    expect(
      () => normalizer.normalize(
        notificationData(
          issuedAt: '2026-07-30T12:00:00',
          expiresAt: '2026-07-30T12:30:00+06:00',
        ),
      ),
      throwsA(
        isA<NativeNotificationException>().having(
          (error) => error.code,
          'code',
          'NATIVE_NOTIFICATION_TIMESTAMP_OFFSET_REQUIRED:issuedAt',
        ),
      ),
    );
  });

  test(
    'bridge exposes valid launch data and rejects provider display fields',
    () async {
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
    },
  );

  test('denied permission never registers a device session', () async {
    final gateway = FakeGateway(
      permission: NativeNotificationPermission.denied,
    );
    final registrar = FakeRegistrar();
    final lifecycle = lifecycleFor(gateway: gateway, registrar: registrar);

    final activation = await lifecycle.activate();

    expect(activation.status, NativeNotificationActivationStatus.denied);
    expect(registrar.registrations, isEmpty);
    await lifecycle.dispose();
  });

  test(
    'registers APNs credential and rotates server sessions after refresh',
    () async {
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
      expect(
        registrar.registrations.single.pushProvider,
        SchoolPushProvider.apns,
      );

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
    },
  );
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
  final _refreshes = StreamController<NativePushCredential>.broadcast(
    sync: true,
  );

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
