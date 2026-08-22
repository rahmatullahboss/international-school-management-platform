import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_api_client/teacher_mobile_api.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_staff_domain/school_staff_domain.dart';
import 'package:test/test.dart';

void main() {
  test('loads teacher day with selected school scope headers', () async {
    late http.Request capturedRequest;
    final client = apiClient((request) async {
      capturedRequest = request;
      return http.Response(jsonEncode(todayFixture()), 200);
    });

    final today = await TeacherMobileApi(
      client,
    ).loadToday(teacherSession(), correlationId: 'teacher-today-correlation');

    expect(capturedRequest.url.path, TeacherMobileApi.todayPath);
    expect(capturedRequest.headers['x-tenant-id'], 'tenant-1');
    expect(capturedRequest.headers['x-campus-id'], 'campus-1');
    expect(capturedRequest.headers['x-persona'], 'teacher');
    expect(
      capturedRequest.headers['x-correlation-id'],
      'teacher-today-correlation',
    );
    expect(today.meetings.single.rosterCount, 24);
    expect(today.meetings.single.isSubstitution, isFalse);

    client.close();
  });

  test('rejects cross-campus teacher day responses', () async {
    final fixture = todayFixture()..['campusId'] = 'campus-other';
    final client = apiClient(
      (request) async => http.Response(jsonEncode(fixture), 200),
    );

    expect(
      () => TeacherMobileApi(client).loadToday(teacherSession()),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_TEACHER_RESPONSE',
        ),
      ),
    );

    client.close();
  });

  test('rejects teacher timestamps from a different school timezone', () async {
    final fixture = todayFixture()..['timeZoneId'] = 'America/New_York';
    final client = apiClient(
      (request) async => http.Response(jsonEncode(fixture), 200),
    );

    expect(
      () => TeacherMobileApi(client).loadToday(teacherSession()),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_TEACHER_RESPONSE',
        ),
      ),
    );

    client.close();
  });

  test('loads a versioned roster for the requested meeting', () async {
    late http.Request capturedRequest;
    final client = apiClient((request) async {
      capturedRequest = request;
      return http.Response(
        jsonEncode(<String, Object?>{
          'meetingId': 'meeting-1',
          'sectionId': 'section-1',
          'version': 3,
          'students': <Object?>[
            <String, Object?>{
              'studentId': 'student-1',
              'displayName': 'Student One',
              'rollLabel': 'Roll 01',
            },
          ],
        }),
        200,
      );
    });

    final roster = await TeacherMobileApi(
      client,
    ).loadRoster(meetingId: 'meeting-1', session: teacherSession());

    expect(
      capturedRequest.url.path,
      '/v1/mobile/teacher/meetings/meeting-1/roster',
    );
    expect(roster.version, 3);
    expect(roster.students.single.studentId, 'student-1');

    client.close();
  });

  test(
    'rejects teacher requests without capability before transport',
    () async {
      var transportCalled = false;
      final client = apiClient((request) async {
        transportCalled = true;
        return http.Response('{}', 200);
      });
      final session = SchoolSession(
        accountId: 'account-1',
        activePersona: SchoolPersona.teacher,
        availablePersonas: const {SchoolPersona.teacher},
        campusId: 'campus-1',
        capabilities: const {SchoolCapability.timetableRead},
        locale: 'en-BD',
        tenantId: 'tenant-1',
        timeZone: 'Asia/Dhaka',
      );

      expect(
        () => TeacherMobileApi(
          client,
        ).loadRoster(meetingId: 'meeting-1', session: session),
        throwsA(
          isA<TeacherDomainException>().having(
            (error) => error.code,
            'code',
            'TEACHER_CAPABILITY_REQUIRED:${SchoolCapability.attendanceTake}',
          ),
        ),
      );
      expect(transportCalled, isFalse);

      client.close();
    },
  );

  test(
    'loads authoritative assessment summaries with exact score scale',
    () async {
      late http.Request capturedRequest;
      final client = apiClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode(<String, Object?>{
            'generatedAt': '2026-08-22T09:00:00.000+06:00',
            'hasMore': false,
            'timeZoneId': 'Asia/Dhaka',
            'assessments': <Object?>[
              <String, Object?>{
                'assessmentId': '40000000-0000-4000-8000-000000000701',
                'sectionId': '40000000-0000-4000-8000-000000000064',
                'sectionLabel': 'Grade 5A',
                'subjectLabel': 'Mathematics',
                'assessmentTitle': 'Fractions quiz',
                'categoryLabel': 'Quiz',
                'dueAt': '2026-08-23T09:00:00.000+06:00',
                'state': 'published',
                'lockState': 'open',
                'version': 3,
                'scoreScale': 100,
                'maximumScoreUnits': 2000,
                'rosterCount': 24,
                'enteredCount': 12,
              },
            ],
          }),
          200,
        );
      });

      final result = await TeacherMobileApi(
        client,
      ).loadAssessments(teacherSession());

      expect(capturedRequest.url.path, TeacherMobileApi.assessmentsPath);
      expect(result.assessments.single.scoreScale, 100);
      expect(result.assessments.single.maximumScoreUnits, 2000);
      expect(result.assessments.single.enteredCount, 12);
      client.close();
    },
  );

  test(
    'loads teacher conversation summaries and messages without hidden fields',
    () async {
      var requestCount = 0;
      final client = apiClient((request) async {
        requestCount += 1;
        if (request.url.path == TeacherMobileApi.conversationsPath) {
          return http.Response(
            jsonEncode(<String, Object?>{
              'generatedAt': '2026-08-22T09:00:00.000+06:00',
              'hasMore': false,
              'timeZoneId': 'Asia/Dhaka',
              'conversations': <Object?>[
                <String, Object?>{
                  'conversationId': '40000000-0000-4000-8000-000000000810',
                  'studentId': '40000000-0000-4000-8000-000000000013',
                  'studentDisplayName': 'Student One',
                  'subject': 'Homework support',
                  'latestMessageAt': '2026-08-22T08:55:00.000+06:00',
                  'canReply': true,
                },
              ],
            }),
            200,
          );
        }
        return http.Response(
          jsonEncode(<String, Object?>{
            'conversationId': '40000000-0000-4000-8000-000000000810',
            'studentDisplayName': 'Student One',
            'subject': 'Homework support',
            'hasMore': false,
            'timeZoneId': 'Asia/Dhaka',
            'messages': <Object?>[
              <String, Object?>{
                'messageId': '40000000-0000-4000-8000-000000000811',
                'authorLabel': 'Teacher One',
                'body': 'Please review question 4.',
                'sentAt': '2026-08-22T08:55:00.000+06:00',
                'authoredByViewer': true,
              },
            ],
          }),
          200,
        );
      });

      final api = TeacherMobileApi(client);
      final conversations = await api.loadConversations(teacherSession());
      final messages = await api.loadConversationMessages(
        conversationId: conversations.conversations.single.conversationId,
        session: teacherSession(),
      );

      expect(requestCount, 2);
      expect(
        conversations.conversations.single.studentDisplayName,
        'Student One',
      );
      expect(messages.messages.single.authoredByViewer, isTrue);
      client.close();
    },
  );

  test('sends teacher conversation messages with explicit idempotency', () async {
    late http.Request capturedRequest;
    final client = apiClient((request) async {
      capturedRequest = request;
      return http.Response(
        jsonEncode(<String, Object?>{
          'messageId': '40000000-0000-4000-8000-000000000812',
          'authorLabel': 'Teacher One',
          'body': 'Please review the update.',
          'sentAt': '2026-08-22T10:00:00.000+06:00',
          'timeZoneId': 'Asia/Dhaka',
        }),
        200,
      );
    });

    final message = await TeacherMobileApi(client).sendConversationMessage(
      command: TeacherConversationSendCommand(
        body: 'Please review the update.',
        conversationId: '40000000-0000-4000-8000-000000000810',
        idempotencyKey: 'teacher-message-idempotency-0001',
      ),
      session: teacherSession(),
    );

    expect(
      capturedRequest.url.path,
      '/v1/mobile/teacher/conversations/40000000-0000-4000-8000-000000000810/messages',
    );
    expect(
      capturedRequest.headers['idempotency-key'],
      'teacher-message-idempotency-0001',
    );
    expect(message.messageId, '40000000-0000-4000-8000-000000000812');
    client.close();
  });

  test('records explicit teacher conversation read receipts', () async {
    late http.Request capturedRequest;
    final client = apiClient((request) async {
      capturedRequest = request;
      return http.Response(
        jsonEncode(<String, Object?>{'acceptedRevision': 5}),
        200,
      );
    });

    final revision = await TeacherMobileApi(client).markConversationRead(
      command: TeacherConversationReadCommand(
        conversationId: '40000000-0000-4000-8000-000000000810',
        idempotencyKey: 'teacher-read-idempotency-0001',
        messageId: '40000000-0000-4000-8000-000000000811',
      ),
      session: teacherSession(),
    );

    expect(
      capturedRequest.url.path,
      '/v1/mobile/teacher/conversations/40000000-0000-4000-8000-000000000810/read-receipts',
    );
    expect(revision, 5);
    client.close();
  });

  test('rejects hidden fields in teacher message mutation responses', () async {
    final client = apiClient(
      (request) async => http.Response(
        jsonEncode(<String, Object?>{
          'messageId': '40000000-0000-4000-8000-000000000812',
          'authorLabel': 'Teacher One',
          'body': 'Please review the update.',
          'sentAt': '2026-08-22T10:00:00.000+06:00',
          'timeZoneId': 'Asia/Dhaka',
          'internalPersonId': 'secret',
        }),
        200,
      ),
    );

    expect(
      () => TeacherMobileApi(client).sendConversationMessage(
        command: TeacherConversationSendCommand(
          body: 'Please review the update.',
          conversationId: '40000000-0000-4000-8000-000000000810',
          idempotencyKey: 'teacher-message-idempotency-0001',
        ),
        session: teacherSession(),
      ),
      throwsA(isA<SchoolApiException>()),
    );
    client.close();
  });

  test('rejects unexpected assessment response fields', () async {
    final client = apiClient(
      (request) async => http.Response(
        jsonEncode(<String, Object?>{
          'generatedAt': '2026-08-22T09:00:00.000+06:00',
          'hasMore': false,
          'timeZoneId': 'Asia/Dhaka',
          'assessments': <Object?>[],
          'internalRevision': 99,
        }),
        200,
      ),
    );

    expect(
      () => TeacherMobileApi(client).loadAssessments(teacherSession()),
      throwsA(isA<SchoolApiException>()),
    );
    client.close();
  });

  test(
    'submits idempotent attendance batches without client finalization',
    () async {
      late http.Request capturedRequest;
      late Map<String, Object?> capturedBody;
      final client = apiClient((request) async {
        capturedRequest = request;
        capturedBody = jsonDecode(request.body) as Map<String, Object?>;
        return http.Response(
          jsonEncode(<String, Object?>{
            'operationId': 'attendance-operation-1',
            'acceptedRevision': 5,
            'status': 'accepted',
          }),
          200,
        );
      });
      final command = TeacherAttendanceBatchCommand(
        baseVersion: 4,
        clientCreatedAt: DateTime.parse('2026-07-30T08:20:00+06:00'),
        idempotencyKey: 'attendance-idempotency-1',
        lines: [
          TeacherAttendanceLine(
            mark: TeacherAttendanceMark.present,
            studentId: 'student-1',
          ),
        ],
        meetingId: 'meeting-1',
        operationId: 'attendance-operation-1',
      );

      final receipt = await TeacherMobileApi(
        client,
      ).submitAttendance(command: command, session: teacherSession());

      expect(capturedRequest.url.path, TeacherMobileApi.attendanceBatchPath);
      expect(
        capturedRequest.headers['idempotency-key'],
        'attendance-idempotency-1',
      );
      expect(capturedBody['baseVersion'], 4);
      expect(capturedBody.containsKey('finalize'), isFalse);
      expect(capturedBody.containsKey('publish'), isFalse);
      expect(receipt.status, TeacherWriteStatus.accepted);
      expect(receipt.acceptedRevision, 5);

      client.close();
    },
  );

  test(
    'saves exact integer grade drafts without publication authority',
    () async {
      late Map<String, Object?> capturedBody;
      final client = apiClient((request) async {
        capturedBody = jsonDecode(request.body) as Map<String, Object?>;
        return http.Response(
          jsonEncode(<String, Object?>{
            'operationId': 'grade-operation-1',
            'acceptedRevision': 8,
            'status': 'duplicate',
          }),
          200,
        );
      });
      final command = TeacherGradeDraftCommand(
        assessmentId: 'assessment-1',
        baseVersion: 7,
        entries: [
          TeacherGradeDraftEntry(
            scoreUnits: 8750,
            status: TeacherGradeEntryStatus.scored,
            studentId: 'student-1',
          ),
          TeacherGradeDraftEntry(
            status: TeacherGradeEntryStatus.missing,
            studentId: 'student-2',
          ),
        ],
        idempotencyKey: 'grade-idempotency-1',
        maximumScoreUnits: 10000,
        operationId: 'grade-operation-1',
        scoreScale: 100,
      );

      final receipt = await TeacherMobileApi(
        client,
      ).saveGradeDraft(command: command, session: teacherSession());

      expect(capturedBody['scoreScale'], 100);
      expect(capturedBody['maximumScoreUnits'], 10000);
      final entries = capturedBody['entries'] as List<Object?>;
      expect((entries.first as Map<String, Object?>)['scoreUnits'], 8750);
      expect(
        (entries.last as Map<String, Object?>).containsKey('scoreUnits'),
        isFalse,
      );
      expect(capturedBody.containsKey('publish'), isFalse);
      expect(receipt.status, TeacherWriteStatus.duplicate);

      client.close();
    },
  );

  test('rejects write receipts for a different operation', () async {
    final client = apiClient(
      (request) async => http.Response(
        jsonEncode(<String, Object?>{
          'operationId': 'other-operation',
          'acceptedRevision': 1,
          'status': 'accepted',
        }),
        200,
      ),
    );
    final command = TeacherAttendanceBatchCommand(
      baseVersion: 0,
      clientCreatedAt: DateTime.parse('2026-07-30T08:20:00+06:00'),
      idempotencyKey: 'attendance-idempotency-1',
      lines: [
        TeacherAttendanceLine(
          mark: TeacherAttendanceMark.present,
          studentId: 'student-1',
        ),
      ],
      meetingId: 'meeting-1',
      operationId: 'attendance-operation-1',
    );

    expect(
      () => TeacherMobileApi(
        client,
      ).submitAttendance(command: command, session: teacherSession()),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_TEACHER_RESPONSE',
        ),
      ),
    );

    client.close();
  });
}

SchoolApiClient apiClient(
  Future<http.Response> Function(http.Request request) handler,
) => SchoolApiClient(
  accessTokenProvider: () async => 'access-token',
  baseUri: Uri.parse('https://api.school.example/'),
  client: MockClient(handler),
);

SchoolSession teacherSession() => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.teacher,
  availablePersonas: const {SchoolPersona.teacher},
  campusId: 'campus-1',
  capabilities: const {
    SchoolCapability.attendanceTake,
    SchoolCapability.gradesWrite,
    SchoolCapability.messagesRead,
    SchoolCapability.messagesSend,
    SchoolCapability.timetableRead,
  },
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);

Map<String, Object?> todayFixture() => <String, Object?>{
  'campusId': 'campus-1',
  'teacherDisplayName': 'Teacher One',
  'generatedAt': '2026-07-30T08:00:00.000+06:00',
  'timeZoneId': 'Asia/Dhaka',
  'meetings': <Object?>[
    <String, Object?>{
      'meetingId': 'meeting-1',
      'sectionId': 'section-1',
      'sectionLabel': 'Grade 5A',
      'subjectLabel': 'Mathematics',
      'roomLabel': 'Room 204',
      'startsAt': '2026-07-30T09:00:00.000+06:00',
      'endsAt': '2026-07-30T10:00:00.000+06:00',
      'rosterCount': 24,
      'attendanceStatus': 'notStarted',
      'substitutionForTeacherLabel': null,
    },
  ],
};
