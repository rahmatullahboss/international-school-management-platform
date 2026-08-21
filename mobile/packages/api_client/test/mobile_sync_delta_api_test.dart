import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:school_api_client/mobile_sync_delta_api.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:test/test.dart';

void main() {
  test('pulls a data-free delta with exact active scope and cursor', () async {
    late http.Request captured;
    final client = _clientFor((request) {
      captured = request;
      return <String, Object?>{
        'cursor': '40000000-0000-4000-8000-000000000002',
        'changed': true,
        'serverTime': '2026-08-22T00:00:00.000Z',
      };
    });
    final api = MobileSyncDeltaApi(
      client,
      correlationIdFactory: () => 'sync-1',
    );

    final delta = await api.pull(
      session: _teacherSession(),
      cursor: '40000000-0000-4000-8000-000000000001',
    );

    expect(captured.url.path, '/v1/mobile/sync/delta');
    expect(
      captured.url.queryParameters['cursor'],
      '40000000-0000-4000-8000-000000000001',
    );
    expect(captured.headers['x-tenant-id'], 'tenant-1');
    expect(captured.headers['x-campus-id'], 'campus-1');
    expect(captured.headers['x-persona'], 'teacher');
    expect(delta.changed, isTrue);
    expect(delta.cursor, '40000000-0000-4000-8000-000000000002');
    expect(delta.serverTime, DateTime.parse('2026-08-22T00:00:00Z'));
    client.close();
  });

  test('rejects unexpected persistence fields in a delta response', () async {
    final client = _clientFor(
      (_) => <String, Object?>{
        'cursor': '40000000-0000-4000-8000-000000000002',
        'changed': false,
        'serverTime': '2026-08-22T00:00:00.000Z',
        'revision': 42,
      },
    );
    final api = MobileSyncDeltaApi(
      client,
      correlationIdFactory: () => 'sync-2',
    );

    expect(
      () => api.pull(session: _teacherSession(), cursor: null),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_MOBILE_SYNC_RESPONSE',
        ),
      ),
    );
    client.close();
  });

  test('maps server cursor conflicts to the sync-engine reset signal', () async {
    final client = SchoolApiClient(
      baseUri: Uri.parse('https://school.example/'),
      accessTokenProvider: () async => 'token',
      client: MockClient(
        (_) async => http.Response(
          jsonEncode(<String, Object?>{
            'error': <String, Object?>{
              'code': 'mobile_sync_cursor_invalid',
              'message':
                  'The mobile synchronization cursor cannot be used for this scope.',
            },
          }),
          409,
          headers: const <String, String>{'content-type': 'application/json'},
        ),
      ),
    );
    final api = MobileSyncDeltaApi(
      client,
      correlationIdFactory: () => 'sync-reset',
    );

    expect(
      () => api.pull(
        session: _teacherSession(),
        cursor: '40000000-0000-4000-8000-000000000009',
      ),
      throwsA(isA<SyncDeltaCursorInvalidException>()),
    );
    client.close();
  });

  test('rejects a malformed local cursor before the request is sent', () async {
    var requests = 0;
    final client = _clientFor((_) {
      requests += 1;
      return <String, Object?>{};
    });
    final api = MobileSyncDeltaApi(
      client,
      correlationIdFactory: () => 'sync-3',
    );

    expect(
      () => api.pull(session: _teacherSession(), cursor: 'NOT-CANONICAL'),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'MOBILE_SYNC_CURSOR_INVALID',
        ),
      ),
    );
    expect(requests, 0);
    client.close();
  });
}

SchoolApiClient _clientFor(
  Map<String, Object?> Function(http.Request request) handler,
) => SchoolApiClient(
  baseUri: Uri.parse('https://school.example/'),
  accessTokenProvider: () async => 'token',
  client: MockClient((request) async {
    final body = handler(request);
    return http.Response(
      jsonEncode(body),
      200,
      headers: const <String, String>{'content-type': 'application/json'},
    );
  }),
);

SchoolSession _teacherSession() => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.teacher,
  availablePersonas: const <SchoolPersona>{SchoolPersona.teacher},
  campusId: 'campus-1',
  capabilities: const <String>{SchoolCapability.attendanceTake},
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);
