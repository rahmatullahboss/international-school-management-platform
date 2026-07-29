import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:school_api_client/family_read_api.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_family_domain/school_family_domain.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:test/test.dart';

void main() {
  test('loads guardian profiles with selected school scope headers', () async {
    late http.Request capturedRequest;
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode(<String, Object?>{
            'accountId': 'account-1',
            'activeStudentId': 'student-1',
            'students': <Object?>[
              <String, Object?>{
                'studentId': 'student-1',
                'campusId': 'campus-1',
                'displayName': 'Student One',
                'gradeLabel': 'Grade 7',
                'relationshipLabel': 'Child',
              },
              <String, Object?>{
                'studentId': 'student-2',
                'campusId': 'campus-1',
                'displayName': 'Student Two',
                'gradeLabel': 'Grade 4',
                'relationshipLabel': 'Child',
              },
            ],
          }),
          200,
        );
      }),
    );

    final directory = await FamilyReadApi(client).loadProfiles(
      guardianSession(),
      correlationId: 'family-profile-correlation',
    );

    expect(capturedRequest.url.path, FamilyReadApi.profilesPath);
    expect(capturedRequest.headers['x-tenant-id'], 'tenant-1');
    expect(capturedRequest.headers['x-campus-id'], 'campus-1');
    expect(capturedRequest.headers['x-persona'], 'guardian');
    expect(directory.students, hasLength(2));
    expect(directory.activeStudent.studentId, 'student-1');

    client.close();
  });

  test('decodes authoritative dashboard values without recalculation', () async {
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient(
        (request) async => http.Response(
          jsonEncode(dashboardFixture()),
          200,
        ),
      ),
    );

    final dashboard = await FamilyReadApi(client).loadDashboard(
      correlationId: 'family-dashboard-correlation',
      session: guardianSession(),
      studentId: 'student-1',
    );

    expect(dashboard.attendance?.summaryLabel, 'Published attendance · 96%');
    expect(dashboard.fees?.outstanding.minorUnits, 450000);
    expect(dashboard.fees?.outstanding.currencyCode, 'BDT');
    expect(dashboard.publishedResults.single.gradeLabel, 'A');
    expect(dashboard.messages?.unreadCount, 2);

    client.close();
  });

  test('rejects optional sections not granted by the active capability set', () async {
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient(
        (request) async => http.Response(
          jsonEncode(dashboardFixture()),
          200,
        ),
      ),
    );
    final session = SchoolSession(
      accountId: 'account-1',
      activePersona: SchoolPersona.student,
      availablePersonas: const {SchoolPersona.student},
      campusId: 'campus-1',
      capabilities: const {SchoolCapability.attendanceRead},
      locale: 'en-BD',
      tenantId: 'tenant-1',
      timeZone: 'Asia/Dhaka',
    );

    expect(
      () => FamilyReadApi(client).loadDashboard(
        session: session,
        studentId: 'student-1',
      ),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_FAMILY_RESPONSE',
        ),
      ),
    );

    client.close();
  });

  test('rejects cross-campus profile responses', () async {
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient(
        (request) async => http.Response(
          jsonEncode(<String, Object?>{
            'accountId': 'account-1',
            'activeStudentId': 'student-1',
            'students': <Object?>[
              <String, Object?>{
                'studentId': 'student-1',
                'campusId': 'campus-other',
                'displayName': 'Student One',
                'gradeLabel': 'Grade 7',
                'relationshipLabel': 'Child',
              },
            ],
          }),
          200,
        ),
      ),
    );

    expect(
      () => FamilyReadApi(client).loadProfiles(guardianSession()),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_FAMILY_RESPONSE',
        ),
      ),
    );

    client.close();
  });

  test('rejects non-family personas before transport', () async {
    var transportCalled = false;
    final client = SchoolApiClient(
      accessTokenProvider: () async => 'access-token',
      baseUri: Uri.parse('https://api.school.example/'),
      client: MockClient((request) async {
        transportCalled = true;
        return http.Response('{}', 200);
      }),
    );
    final teacher = SchoolSession(
      accountId: 'account-1',
      activePersona: SchoolPersona.teacher,
      availablePersonas: const {SchoolPersona.teacher},
      campusId: 'campus-1',
      capabilities: const {SchoolCapability.attendanceTake},
      locale: 'en-BD',
      tenantId: 'tenant-1',
      timeZone: 'Asia/Dhaka',
    );

    expect(
      () => FamilyReadApi(client).loadProfiles(teacher),
      throwsA(
        isA<FamilyDomainException>().having(
          (error) => error.code,
          'code',
          'FAMILY_PERSONA_REQUIRED',
        ),
      ),
    );
    expect(transportCalled, isFalse);

    client.close();
  });
}

SchoolSession guardianSession() => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.guardian,
  availablePersonas: const {SchoolPersona.guardian},
  campusId: 'campus-1',
  capabilities: const {
    SchoolCapability.attendanceRead,
    SchoolCapability.billingRead,
    SchoolCapability.gradesReadPublished,
    SchoolCapability.messagesRead,
  },
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);

Map<String, Object?> dashboardFixture() => <String, Object?>{
  'generatedAt': '2026-07-30T01:30:00+06:00',
  'student': <String, Object?>{
    'studentId': 'student-1',
    'campusId': 'campus-1',
    'displayName': 'Student One',
    'gradeLabel': 'Grade 7',
    'relationshipLabel': 'Child',
  },
  'timetable': <Object?>[
    <String, Object?>{
      'itemId': 'class-1',
      'subjectLabel': 'Mathematics',
      'locationLabel': 'Room 203',
      'startsAt': '2026-07-30T08:00:00+06:00',
      'endsAt': '2026-07-30T09:00:00+06:00',
    },
  ],
  'attendance': <String, Object?>{
    'presentSessions': 48,
    'absentSessions': 1,
    'lateSessions': 1,
    'totalSessions': 50,
    'summaryLabel': 'Published attendance · 96%',
  },
  'publishedResults': <Object?>[
    <String, Object?>{
      'resultId': 'result-1',
      'assessmentLabel': 'Term 1',
      'subjectLabel': 'Science',
      'gradeLabel': 'A',
      'publishedAt': '2026-07-29T12:00:00+06:00',
    },
  ],
  'fees': <String, Object?>{
    'invoiceReference': 'INV-2026-0719',
    'outstanding': <String, Object?>{
      'currencyCode': 'BDT',
      'minorUnits': 450000,
    },
    'lastReceiptReference': 'RCPT-1042',
    'lastReceipt': <String, Object?>{
      'currencyCode': 'BDT',
      'minorUnits': 450000,
    },
  },
  'messages': <String, Object?>{
    'unreadCount': 2,
    'latestMessageAt': '2026-07-29T18:00:00+06:00',
  },
};
