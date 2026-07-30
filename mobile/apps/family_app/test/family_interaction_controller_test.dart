import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:school_family_app/main.dart';
import 'package:school_family_domain/family_interactions.dart';
import 'package:school_mobile_core/mobile_core.dart';

void main() {
  test('student switch discards stale document responses', () async {
    final first = Completer<FamilyDocumentPage>();
    final repository = _FamilyInteractionRepository(
      documents: (studentId) => studentId == 'student-1'
          ? first.future
          : Future<FamilyDocumentPage>.value(
              FamilyDocumentPage(
                documents: <FamilyDocumentSummary>[document('document-2')],
              ),
            ),
    );
    final controller = FamilyInteractionController(
      repository: repository,
      session: familySession(
        capabilities: const <String>{SchoolCapability.documentsRead},
      ),
    );

    final stale = controller.loadDocuments('student-1');
    await controller.loadDocuments('student-2');
    first.complete(
      FamilyDocumentPage(
        documents: <FamilyDocumentSummary>[document('document-1')],
      ),
    );
    await stale;

    expect(controller.studentId, 'student-2');
    expect(controller.documents.single.documentId, 'document-2');
  });

  test('form submission uses server-issued base version', () async {
    final repository = _FamilyInteractionRepository();
    final controller = FamilyInteractionController(
      clock: () => DateTime.utc(2026, 7, 30, 5),
      repository: repository,
      session: familySession(
        capabilities: const <String>{SchoolCapability.formsConsent},
      ),
    );
    controller.bindStudent('student-1');
    repository.form = FamilyFormDefinition(
      baseVersion: 9,
      fields: <FamilyFormFieldDefinition>[
        FamilyFormFieldDefinition(
          fieldId: 'transport.mode',
          label: 'Transport',
          options: const <String>['Bus', 'Private'],
          required: true,
          type: FamilyFormFieldType.singleChoice,
        ),
      ],
      formId: 'form-1',
      schemaVersion: 3,
      status: FamilyFormStatus.open,
      title: 'Transport form',
    );

    await controller.loadForm('form-1');
    await controller.submitActiveForm(const <String, Object?>{
      'transport.mode': 'Bus',
    });

    expect(repository.lastSubmission?.baseVersion, 9);
    expect(repository.lastSubmission?.schemaVersion, 3);
    expect(controller.formAcceptedRevision, 10);
  });

  test('student consent is blocked before repository transport', () async {
    final repository = _FamilyInteractionRepository();
    final controller = FamilyInteractionController(
      repository: repository,
      session: familySession(
        capabilities: const <String>{SchoolCapability.formsConsent},
        persona: SchoolPersona.student,
      ),
    );
    controller.bindStudent('student-1');
    final request = FamilyConsentRequest(
      consentId: 'consent-1',
      policyVersion: 'policy-1',
      status: FamilyConsentStatus.pending,
      studentId: 'student-1',
      title: 'Trip consent',
    );

    await controller.decideConsent(request, FamilyConsentDecision.grant);

    expect(repository.consentCalls, 0);
    expect(
      controller.consentsReasonCode,
      'FAMILY_GUARDIAN_CONSENT_CAPABILITY_REQUIRED',
    );
  });

  test(
    'conversation send requires capability and appends server message',
    () async {
      final repository = _FamilyInteractionRepository();
      final controller = FamilyInteractionController(
        repository: repository,
        session: familySession(
          capabilities: const <String>{
            SchoolCapability.messagesRead,
            SchoolCapability.messagesSend,
          },
        ),
      );
      controller.bindStudent('student-1');
      await controller.loadConversations('student-1');
      await controller.openConversation('conversation-1');
      await controller.sendMessage('Thank you');

      expect(repository.messageCalls, 1);
      expect(controller.messages.last.body, 'Thank you');
    },
  );
}

FamilyDocumentSummary document(String documentId) => FamilyDocumentSummary(
  cachePolicy: FamilyDocumentCachePolicy.encryptedTemporary,
  classification: FamilyDocumentClassification.personal,
  documentId: documentId,
  fileName: '$documentId.pdf',
  issuedAt: DateTime.utc(2026, 7, 30),
  sizeBytes: 100,
  title: documentId,
);

SchoolSession familySession({
  required Set<String> capabilities,
  SchoolPersona persona = SchoolPersona.guardian,
}) => SchoolSession(
  accountId: 'account-1',
  activePersona: persona,
  availablePersonas: <SchoolPersona>{persona},
  campusId: 'campus-1',
  capabilities: capabilities,
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);

final class _FamilyInteractionRepository
    implements FamilyInteractionRepository {
  _FamilyInteractionRepository({this.documents});

  final Future<FamilyDocumentPage> Function(String studentId)? documents;
  FamilyFormDefinition? form;
  FamilyFormSubmissionCommand? lastSubmission;
  int consentCalls = 0;
  int messageCalls = 0;

  @override
  Future<int> decideConsent({
    required String correlationId,
    required FamilyConsentDecisionCommand command,
    required SchoolSession session,
  }) async {
    consentCalls++;
    return 1;
  }

  @override
  Future<List<FamilyConsentRequest>> listConsents({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  }) async => const <FamilyConsentRequest>[];

  @override
  Future<FamilyConversationPage> listConversations({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  }) async => FamilyConversationPage(
    conversations: <FamilyConversationSummary>[
      FamilyConversationSummary(
        conversationId: 'conversation-1',
        latestMessageAt: DateTime.utc(2026, 7, 30),
        subject: 'Class update',
        unreadCount: 1,
      ),
    ],
  );

  @override
  Future<FamilyDocumentPage> listDocuments({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  }) =>
      documents?.call(studentId) ??
      Future<FamilyDocumentPage>.value(
        FamilyDocumentPage(documents: const <FamilyDocumentSummary>[]),
      );

  @override
  Future<List<FamilyFormSummary>> listForms({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  }) async => const <FamilyFormSummary>[];

  @override
  Future<FamilyConversationMessagePage> listMessages({
    required String correlationId,
    required String conversationId,
    required SchoolSession session,
    String? cursor,
    int limit = 50,
  }) async => FamilyConversationMessagePage(
    conversationId: conversationId,
    messages: const <FamilyConversationMessage>[],
  );

  @override
  Future<FamilyFormDefinition> loadForm({
    required String correlationId,
    required String formId,
    required SchoolSession session,
  }) async => form!;

  @override
  Future<FamilyDocumentDownloadGrant> requestDocumentDownload({
    required String correlationId,
    required String documentId,
    required String idempotencyKey,
    required SchoolSession session,
  }) async => FamilyDocumentDownloadGrant(
    documentId: documentId,
    expiresAt: DateTime.utc(2026, 7, 30, 6),
    grantId: 'grant-1',
    requiresStepUp: false,
    singleUse: true,
  );

  @override
  Future<FamilyConversationMessage> sendMessage({
    required String correlationId,
    required FamilySendMessageCommand command,
    required SchoolSession session,
  }) async {
    messageCalls++;
    return FamilyConversationMessage(
      authorLabel: 'Guardian',
      body: command.body,
      messageId: 'message-$messageCalls',
      sentAt: DateTime.utc(2026, 7, 30, 5),
    );
  }

  @override
  Future<int> submitForm({
    required String correlationId,
    required FamilyFormSubmissionCommand command,
    required SchoolSession session,
  }) async {
    lastSubmission = command;
    return command.baseVersion + 1;
  }
}
