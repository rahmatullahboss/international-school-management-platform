import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:school_api_client/device_session_api.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:test/test.dart';

void main() {
  test('registers an account-scoped installation with idempotency', () async {
    late http.Request capturedRequest;
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode(<String, Object?>{
            'deviceSessionId': 'device-session-1',
            'installationId': 'install_0123456789abcdef',
            'registeredAt': '2026-07-30T01:30:00+06:00',
            'revision': 1,
          }),
          201,
        );
      }),
    );
    final registration = DeviceSessionRegistration(
      appVersion: '0.1.0+1',
      application: SchoolMobileApplication.family,
      installationId: 'install_0123456789abcdef',
      notificationEnvironment: SchoolPushEnvironment.development,
      platform: SchoolMobilePlatform.android,
      pushProvider: SchoolPushProvider.firebase,
      pushToken: SchoolPushToken('push-token-secret'),
    );

    final registered = await DeviceSessionApi(client).register(
      correlationId: 'correlation-device-1',
      idempotencyKey: 'register-install_0123456789abcdef-v1',
      registration: registration,
    );

    final body = jsonDecode(capturedRequest.body) as Map<String, Object?>;
    expect(capturedRequest.url.path, DeviceSessionApi.registrationPath);
    expect(capturedRequest.headers['authorization'], 'Bearer access-token');
    expect(
      capturedRequest.headers['idempotency-key'],
      'register-install_0123456789abcdef-v1',
    );
    expect(capturedRequest.headers, isNot(contains('x-tenant-id')));
    expect(capturedRequest.headers, isNot(contains('x-campus-id')));
    expect(capturedRequest.headers, isNot(contains('x-persona')));
    expect(body['installationId'], 'install_0123456789abcdef');
    expect(body['application'], 'family');
    expect(body['platform'], 'android');
    expect(body['pushToken'], 'push-token-secret');
    expect(body, isNot(contains('deviceName')));
    expect(body, isNot(contains('hardwareId')));
    expect(body, isNot(contains('advertisingId')));
    expect(registered.deviceSessionId, 'device-session-1');
    expect(registered.registeredAt, DateTime.utc(2026, 7, 29, 19, 30));

    client.close();
  });

  test('redacts push credentials from diagnostic strings', () {
    final token = SchoolPushToken('push-token-secret');
    final registration = DeviceSessionRegistration(
      appVersion: '0.1.0+1',
      application: SchoolMobileApplication.staff,
      installationId: 'install_0123456789abcdef',
      notificationEnvironment: SchoolPushEnvironment.production,
      platform: SchoolMobilePlatform.ios,
      pushProvider: SchoolPushProvider.apns,
      pushToken: token,
    );

    expect(token.toString(), isNot(contains('push-token-secret')));
    expect(registration.toString(), isNot(contains('push-token-secret')));
    expect(registration.toString(), contains('[REDACTED]'));
  });

  test('rejects identifiers that could not be app-generated opaque ids', () {
    expect(
      () => DeviceSessionRegistration(
        appVersion: '0.1.0+1',
        application: SchoolMobileApplication.family,
        installationId: 'short',
        notificationEnvironment: SchoolPushEnvironment.development,
        platform: SchoolMobilePlatform.android,
        pushProvider: SchoolPushProvider.firebase,
        pushToken: SchoolPushToken('push-token-secret'),
      ),
      throwsA(
        isA<DeviceSessionContractException>().having(
          (error) => error.code,
          'code',
          'DEVICE_INSTALLATION_ID_INVALID',
        ),
      ),
    );
  });

  test(
    'revokes a device session using an encoded path and idempotency',
    () async {
      late http.Request capturedRequest;
      final client = SchoolApiClient(
        accessTokenProvider: () async => 'access-token',
        baseUri: Uri.parse('https://api.school.example/'),
        client: MockClient((request) async {
          capturedRequest = request;
          return http.Response('{}', 200);
        }),
      );

      await DeviceSessionApi(client).revoke(
        correlationId: 'correlation-device-2',
        deviceSessionId: 'device/session 1',
        idempotencyKey: 'revoke-device-session-1',
      );

      expect(
        capturedRequest.url.path,
        '${DeviceSessionApi.registrationPath}/device%2Fsession%201/revoke',
      );
      expect(
        capturedRequest.headers['idempotency-key'],
        'revoke-device-session-1',
      );
      expect(capturedRequest.headers, isNot(contains('x-tenant-id')));

      client.close();
    },
  );

  test('rejects malformed registration responses', () async {
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient(
        (request) async => http.Response(
          jsonEncode(<String, Object?>{
            'deviceSessionId': 'device-session-1',
            'installationId': 'install_0123456789abcdef',
            'registeredAt': 'not-a-time',
            'revision': 0,
          }),
          200,
        ),
      ),
    );

    expect(
      () => DeviceSessionApi(client).register(
        correlationId: 'correlation-device-3',
        idempotencyKey: 'registration-malformed-response',
        registration: DeviceSessionRegistration(
          appVersion: '0.1.0+1',
          application: SchoolMobileApplication.family,
          installationId: 'install_0123456789abcdef',
          notificationEnvironment: SchoolPushEnvironment.development,
          platform: SchoolMobilePlatform.android,
          pushProvider: SchoolPushProvider.firebase,
          pushToken: SchoolPushToken('push-token-secret'),
        ),
      ),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_DEVICE_SESSION_RESPONSE',
        ),
      ),
    );

    client.close();
  });

  test('rejects empty idempotency keys before transport', () async {
    var transportCalled = false;
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient((request) async {
        transportCalled = true;
        return http.Response('{}', 200);
      }),
    );

    expect(
      () => client.postJson(
        '/v1/mobile/device-sessions',
        body: const <String, Object?>{},
        context: const ApiRequestContext.accountScoped(
          correlationId: 'correlation-device-4',
        ),
        idempotencyKey: '   ',
      ),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'IDEMPOTENCY_KEY_REQUIRED',
        ),
      ),
    );
    expect(transportCalled, isFalse);

    client.close();
  });
}
