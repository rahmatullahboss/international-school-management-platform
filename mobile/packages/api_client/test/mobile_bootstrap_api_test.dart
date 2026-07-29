import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:school_api_client/mobile_bootstrap_api.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:test/test.dart';

void main() {
  test('loads account access without inventing tenant scope headers', () async {
    late http.Request capturedRequest;
    final transport = MockClient((request) async {
      capturedRequest = request;
      return http.Response(
        jsonEncode(<String, Object?>{
          'accountId': 'account-1',
          'locale': 'en-BD',
          'timeZone': 'Asia/Dhaka',
          'syncCursor': 'cursor-1',
          'schools': <Object?>[
            <String, Object?>{
              'tenantId': 'tenant-1',
              'tenantName': 'Example School',
              'campuses': <Object?>[
                <String, Object?>{
                  'campusId': 'campus-1',
                  'campusName': 'Primary Campus',
                  'personas': <Object?>[
                    <String, Object?>{
                      'persona': 'guardian',
                      'capabilities': <Object?>[
                        SchoolCapability.attendanceRead,
                        SchoolCapability.billingRead,
                      ],
                    },
                    <String, Object?>{
                      'persona': 'student',
                      'capabilities': <Object?>[
                        SchoolCapability.attendanceRead,
                        SchoolCapability.gradesReadPublished,
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
        200,
        headers: const {'content-type': 'application/json'},
      );
    });
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: transport,
    );

    final bootstrap = await MobileBootstrapApi(
      client,
    ).load(correlationId: 'correlation-1');
    final session = bootstrap.activate(
      campusId: 'campus-1',
      persona: SchoolPersona.student,
      tenantId: 'tenant-1',
    );

    expect(capturedRequest.url.path, MobileBootstrapApi.path);
    expect(capturedRequest.headers['authorization'], 'Bearer access-token');
    expect(capturedRequest.headers['x-correlation-id'], 'correlation-1');
    expect(capturedRequest.headers, isNot(contains('x-tenant-id')));
    expect(capturedRequest.headers, isNot(contains('x-campus-id')));
    expect(capturedRequest.headers, isNot(contains('x-persona')));
    expect(session.can(SchoolCapability.gradesReadPublished), isTrue);
    expect(session.can(SchoolCapability.billingRead), isFalse);
    expect(bootstrap.syncCursor, 'cursor-1');

    client.close();
  });

  test('rejects unknown persona values from the server', () async {
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient(
        (request) async => http.Response(
          jsonEncode(<String, Object?>{
            'accountId': 'account-1',
            'locale': 'en-BD',
            'timeZone': 'Asia/Dhaka',
            'schools': <Object?>[
              <String, Object?>{
                'tenantId': 'tenant-1',
                'tenantName': 'Example School',
                'campuses': <Object?>[
                  <String, Object?>{
                    'campusId': 'campus-1',
                    'campusName': 'Primary Campus',
                    'personas': <Object?>[
                      <String, Object?>{
                        'persona': 'administrator',
                        'capabilities': <Object?>[],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
          200,
        ),
      ),
    );

    expect(
      () => MobileBootstrapApi(
        client,
      ).load(correlationId: 'correlation-2'),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_BOOTSTRAP_RESPONSE',
        ),
      ),
    );

    client.close();
  });

  test('scoped requests include selected tenant campus and persona', () async {
    late http.Request capturedRequest;
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient((request) async {
        capturedRequest = request;
        return http.Response('{}', 200);
      }),
    );
    final session = SchoolSession(
      accountId: 'account-1',
      activePersona: SchoolPersona.teacher,
      availablePersonas: const {SchoolPersona.teacher},
      campusId: 'campus-1',
      capabilities: const {SchoolCapability.attendanceTake},
      locale: 'en-BD',
      tenantId: 'tenant-1',
      timeZone: 'Asia/Dhaka',
    );

    await client.getJson(
      '/v1/teacher/today',
      context: ApiRequestContext(
        correlationId: 'correlation-3',
        session: session,
      ),
    );

    expect(capturedRequest.headers['x-tenant-id'], 'tenant-1');
    expect(capturedRequest.headers['x-campus-id'], 'campus-1');
    expect(capturedRequest.headers['x-persona'], 'teacher');

    client.close();
  });
}
