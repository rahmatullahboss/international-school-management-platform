import 'package:flutter_test/flutter_test.dart';
import 'package:school_family_app/main.dart';
import 'package:school_family_domain/family_interactions.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_secure_documents/school_secure_documents.dart';

void main() {
  test(
    'prepared grant is consumed through secure exchange and cleared',
    () async {
      final document = FamilyDocumentSummary(
        cachePolicy: FamilyDocumentCachePolicy.noStore,
        classification: FamilyDocumentClassification.restricted,
        documentId: 'document-1',
        fileName: 'report.pdf',
        issuedAt: DateTime.utc(2026, 7, 1),
        sizeBytes: 128,
        title: 'Student report',
      );
      final repository = _Repository(document);
      final exchange = _SecureExchange();
      final controller = FamilyInteractionController(
        clock: () => DateTime.utc(2026, 7, 30, 9),
        repository: repository,
        secureDocumentExchange: exchange,
        session: session(),
      );

      await controller.loadDocuments('student-1');
      await controller.prepareDocumentDownload(document);
      expect(controller.downloadGrant, isNotNull);

      await controller.openPreparedDocument();

      expect(exchange.calls, 1);
      expect(controller.downloadGrant, isNull);
      expect(controller.documentReceipt?.documentId, 'document-1');
      expect(controller.documentsReasonCode, isNull);
    },
  );
}

SchoolSession session() => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.guardian,
  availablePersonas: const <SchoolPersona>{SchoolPersona.guardian},
  campusId: 'campus-1',
  capabilities: const <String>{SchoolCapability.documentsRead},
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);

final class _SecureExchange implements FamilySecureDocumentExchange {
  int calls = 0;

  @override
  Future<SecureDocumentExchangeReceipt> exchangeAndPresent({
    required FamilyDocumentSummary document,
    required FamilyDocumentDownloadGrant grant,
    required SchoolSession session,
  }) async {
    calls++;
    return SecureDocumentExchangeReceipt(
      byteLength: document.sizeBytes,
      completedAt: DateTime.utc(2026, 7, 30, 9),
      documentId: document.documentId,
      sha256Hex: List<String>.filled(64, 'a').join(),
      stepUpUsed: grant.requiresStepUp,
    );
  }
}

final class _Repository implements FamilyInteractionRepository {
  _Repository(this.document);

  final FamilyDocumentSummary document;

  @override
  Future<FamilyDocumentPage> listDocuments({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  }) async => FamilyDocumentPage(documents: <FamilyDocumentSummary>[document]);

  @override
  Future<FamilyDocumentDownloadGrant> requestDocumentDownload({
    required String correlationId,
    required String documentId,
    required String idempotencyKey,
    required SchoolSession session,
  }) async => FamilyDocumentDownloadGrant(
    documentId: documentId,
    expiresAt: DateTime.utc(2026, 7, 30, 9, 10),
    grantId: 'grant-1',
    requiresStepUp: true,
    singleUse: true,
  );

  @override
  Future<int> decideConsent({
    required String correlationId,
    required FamilyConsentDecisionCommand command,
    required SchoolSession session,
  }) => throw UnimplementedError();

  @override
  Future<List<FamilyConsentRequest>> listConsents({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  }) => throw UnimplementedError();

  @override
  Future<FamilyConversationPage> listConversations({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  }) => throw UnimplementedError();

  @override
  Future<List<FamilyFormSummary>> listForms({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  }) => throw UnimplementedError();

  @override
  Future<FamilyConversationMessagePage> listMessages({
    required String correlationId,
    required String conversationId,
    required SchoolSession session,
    String? cursor,
    int limit = 50,
  }) => throw UnimplementedError();

  @override
  Future<FamilyFormDefinition> loadForm({
    required String correlationId,
    required String formId,
    required SchoolSession session,
  }) => throw UnimplementedError();

  @override
  Future<FamilyConversationMessage> sendMessage({
    required String correlationId,
    required FamilySendMessageCommand command,
    required SchoolSession session,
  }) => throw UnimplementedError();

  @override
  Future<int> submitForm({
    required String correlationId,
    required FamilyFormSubmissionCommand command,
    required SchoolSession session,
  }) => throw UnimplementedError();
}
