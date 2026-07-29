import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:school_api_client/family_interaction_api.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_family_domain/family_interactions.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:test/test.dart';

void main() {
  test('loads paginated document metadata with active school scope', () async {
    late http.Request captured;
    final client = clientFor((request) {
      captured = request;
      return <String, Object?>{
        'documents': <Object?>[
          <String, Object?>{
            'documentId': 'document-1',
            'title': 'Published report',
            'fileName': 'report.pdf',
            'sizeBytes': 1024,
            'issuedAt': '2026-07-30T01:00:00+06:00',
            'classification': 'personal',
            'cachePolicy': 'encryptedTemporary',
          },
        ],
        'nextCursor': 'cursor-2',
      };
    });

    final page = await FamilyInteractionApi(client).listDocuments(
      correlationId: 'documents-1',
      cursor: 'cursor-1',
      limit: 20,
      session: familySession(
        capabilities: const {SchoolCapability.documentsRead},
      ),
      studentId: 'student-1',
    );

    expect(captured.url.path, '/v1/mobile/family/students/student-1/documents');
    expect(captured.url.queryParameters['cursor'], 'cursor-1');
    expect(captured.url.queryParameters['limit'], '20');
    expect(captured.headers['x-tenant-id'], 'tenant-1');
    expect(captured.headers['x-campus-id'], 'campus-1');
    expect(page.documents.single.documentId, 'document-1');
    expect(page.nextCursor, 'cursor-2');
    client.close();
  });

  test('rejects download responses containing raw credentials', () async {
    final client = clientFor(
      (request) => <String, Object?>{
        'documentId': 'document-1',
        'grantId': 'grant-1',
        'expiresAt': '2026-07-30T02:00:00+06:00',
        'requiresStepUp': true,
        'singleUse': true,
        'downloadUrl': 'https://storage.example/secret',
      },
    );

    expect(
      () => FamilyInteractionApi(client).requestDocumentDownload(
        correlationId: 'documents-2',
        documentId: 'document-1',
        idempotencyKey: 'document-1-download-1',
        session: familySession(
          capabilities: const {SchoolCapability.documentsRead},
        ),
      ),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_FAMILY_INTERACTION_RESPONSE',
        ),
      ),
    );
    client.close();
  });

  test('submits a versioned form with idempotency and exact answers', () async {
    late http.Request captured;
    final client = clientFor((request) {
      captured = request;
      return <String, Object?>{'acceptedRevision': 4};
    });
    final command = FamilyFormSubmissionCommand(
      answers: const <String, Object?>{
        'transport.mode': 'School bus',
        'medical.confirmed': true,
      },
      baseVersion: 3,
      formId: 'form-1',
      idempotencyKey: 'form-1-student-1-v3',
      schemaVersion: 2,
      studentId: 'student-1',
    );

    final revision = await FamilyInteractionApi(client).submitForm(
      command: command,
      correlationId: 'forms-1',
      session: familySession(
        capabilities: const {SchoolCapability.formsConsent},
      ),
    );

    final body = jsonDecode(captured.body) as Map<String, Object?>;
    expect(captured.url.path, '/v1/mobile/family/forms/form-1/submit');
    expect(captured.headers['idempotency-key'], command.idempotencyKey);
    expect(body['studentId'], 'student-1');
    expect(body['schemaVersion'], 2);
    expect(body['baseVersion'], 3);
    expect(
      (body['answers'] as Map<String, Object?>)['transport.mode'],
      'School bus',
    );
    expect(revision, 4);
    client.close();
  });

  test('blocks student consent decisions before transport', () async {
    var called = false;
    final client = clientFor((request) {
      called = true;
      return <String, Object?>{'acceptedRevision': 1};
    });
    final command = FamilyConsentDecisionCommand(
      consentId: 'consent-1',
      decision: FamilyConsentDecision.grant,
      idempotencyKey: 'consent-1-policy-2-grant',
      policyVersion: 'policy-2',
      studentId: 'student-1',
    );

    expect(
      () => FamilyInteractionApi(client).decideConsent(
        command: command,
        correlationId: 'consent-1',
        session: familySession(
          capabilities: const {SchoolCapability.formsConsent},
          persona: SchoolPersona.student,
        ),
      ),
      throwsA(
        isA<FamilyInteractionException>().having(
          (error) => error.code,
          'code',
          'FAMILY_GUARDIAN_CONSENT_CAPABILITY_REQUIRED',
        ),
      ),
    );
    expect(called, isFalse);
    client.close();
  });

  test('lists conversation messages and validates response scope', () async {
    final client = clientFor(
      (request) => <String, Object?>{
        'conversationId': 'conversation-other',
        'messages': <Object?>[],
        'nextCursor': null,
      },
    );

    expect(
      () => FamilyInteractionApi(client).listMessages(
        correlationId: 'messages-1',
        conversationId: 'conversation-1',
        session: familySession(
          capabilities: const {SchoolCapability.messagesRead},
        ),
      ),
      throwsA(
        isA<SchoolApiException>().having(
          (error) => error.code,
          'code',
          'INVALID_FAMILY_INTERACTION_RESPONSE',
        ),
      ),
    );
    client.close();
  });

  test('sends messages only with send capability and idempotency', () async {
    late http.Request captured;
    final client = clientFor((request) {
      captured = request;
      return <String, Object?>{
        'messageId': 'message-1',
        'authorLabel': 'Guardian',
        'body': 'Thank you',
        'sentAt': '2026-07-30T01:00:00+06:00',
      };
    });
    final command = FamilySendMessageCommand(
      body: 'Thank you',
      conversationId: 'conversation-1',
      idempotencyKey: 'conversation-1-message-1',
    );

    final message = await FamilyInteractionApi(client).sendMessage(
      command: command,
      correlationId: 'messages-2',
      session: familySession(
        capabilities: const {SchoolCapability.messagesSend},
      ),
    );

    expect(
      captured.url.path,
      '/v1/mobile/family/conversations/conversation-1/messages',
    );
    expect(captured.headers['idempotency-key'], command.idempotencyKey);
    expect(message.messageId, 'message-1');
    client.close();
  });

  test(
    'rejects missing capabilities and invalid page limits before transport',
    () async {
      var called = false;
      final client = clientFor((request) {
        called = true;
        return const <String, Object?>{};
      });

      expect(
        () => FamilyInteractionApi(client).listDocuments(
          correlationId: 'documents-3',
          limit: 0,
          session: familySession(capabilities: const <String>{}),
          studentId: 'student-1',
        ),
        throwsA(isA<FamilyInteractionException>()),
      );
      expect(called, isFalse);
      client.close();
    },
  );
}

SchoolApiClient clientFor(
  Map<String, Object?> Function(http.Request request) response,
) => SchoolApiClient(
  accessTokenProvider: () async => 'access-token',
  baseUri: Uri.parse('https://api.school.example/'),
  client: MockClient(
    (request) async => http.Response(jsonEncode(response(request)), 200),
  ),
);

SchoolSession familySession({
  required Set<String> capabilities,
  SchoolPersona persona = SchoolPersona.guardian,
}) => SchoolSession(
  accountId: 'account-1',
  activePersona: persona,
  availablePersonas: {persona},
  campusId: 'campus-1',
  capabilities: capabilities,
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);
