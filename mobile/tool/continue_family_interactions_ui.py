#!/usr/bin/env python3
"""Add capability-scoped Family interaction production journeys and tests."""

from pathlib import Path

root = Path(__file__).resolve().parents[1]

main_path = root / 'apps/family_app/lib/main.dart'
main = main_path.read_text(encoding='utf-8')
if "import 'package:school_api_client/family_interaction_api.dart';" not in main:
    main = main.replace(
        "import 'package:go_router/go_router.dart';\n",
        "import 'package:go_router/go_router.dart';\n"
        "import 'package:school_api_client/family_interaction_api.dart';\n",
        1,
    )
if "import 'package:school_family_domain/family_interactions.dart';" not in main:
    main = main.replace(
        "import 'package:school_design_system/school_design_system.dart';\n",
        "import 'package:school_design_system/school_design_system.dart';\n"
        "import 'package:school_family_domain/family_interactions.dart';\n",
        1,
    )
if "part 'family_interaction_controller.dart';" not in main:
    main = main.replace(
        "part 'family_journey_controller.dart';\n",
        "part 'family_interaction_controller.dart';\n"
        "part 'family_interaction_screens.dart';\n"
        "part 'family_journey_controller.dart';\n",
        1,
    )
main_path.write_text(main, encoding='utf-8')

domain_path = root / 'packages/family_domain/lib/family_interactions.dart'
domain = domain_path.read_text(encoding='utf-8')
if 'required int baseVersion,' not in domain.split('final class FamilyFormDefinition', 1)[1].split('final class FamilyFormSubmissionCommand', 1)[0]:
    domain = domain.replace(
        "  FamilyFormDefinition({\n    required Iterable<FamilyFormFieldDefinition> fields,\n",
        "  FamilyFormDefinition({\n"
        "    required int baseVersion,\n"
        "    required Iterable<FamilyFormFieldDefinition> fields,\n",
        1,
    )
    domain = domain.replace(
        "  }) : dueAt = dueAt?.toUtc(),\n       fields = List<FamilyFormFieldDefinition>.unmodifiable(fields),\n",
        "  }) : baseVersion = _nonNegativeInteraction(baseVersion, 'baseVersion'),\n"
        "       dueAt = dueAt?.toUtc(),\n"
        "       fields = List<FamilyFormFieldDefinition>.unmodifiable(fields),\n",
        1,
    )
    domain = domain.replace(
        "  final String formId;\n  final String title;\n  final FamilyFormStatus status;\n",
        "  final String formId;\n"
        "  final String title;\n"
        "  final FamilyFormStatus status;\n"
        "  final int baseVersion;\n",
        1,
    )
domain_path.write_text(domain, encoding='utf-8')

api_path = root / 'packages/api_client/lib/family_interaction_api.dart'
api = api_path.read_text(encoding='utf-8')
form_anchor = "      final definition = FamilyFormDefinition(\n        dueAt: _optionalDateTime(response, 'dueAt'),\n"
if form_anchor in api and "baseVersion: _requiredInt(response, 'baseVersion')" not in api:
    api = api.replace(
        form_anchor,
        "      final definition = FamilyFormDefinition(\n"
        "        baseVersion: _requiredInt(response, 'baseVersion'),\n"
        "        dueAt: _optionalDateTime(response, 'dueAt'),\n",
        1,
    )
api_path.write_text(api, encoding='utf-8')

domain_test_path = root / 'packages/family_domain/test/family_interactions_test.dart'
domain_test = domain_test_path.read_text(encoding='utf-8')
if "final definition = FamilyFormDefinition(\n      baseVersion:" not in domain_test:
    domain_test = domain_test.replace(
        "    final definition = FamilyFormDefinition(\n      fields: [\n",
        "    final definition = FamilyFormDefinition(\n"
        "      baseVersion: 2,\n"
        "      fields: [\n",
        1,
    )
    domain_test = domain_test.replace(
        "    expect(definition.schemaVersion, 3);\n",
        "    expect(definition.baseVersion, 2);\n"
        "    expect(definition.schemaVersion, 3);\n",
        1,
    )
domain_test_path.write_text(domain_test, encoding='utf-8')

api_test_path = root / 'packages/api_client/test/family_interaction_api_test.dart'
api_test = api_test_path.read_text(encoding='utf-8')
load_form_test = r'''
  test('loads server-versioned form definitions without inventing authority', () async {
    final client = clientFor(
      (request) => <String, Object?>{
        'formId': 'form-1',
        'title': 'Transport form',
        'status': 'open',
        'baseVersion': 7,
        'schemaVersion': 3,
        'dueAt': null,
        'fields': <Object?>[
          <String, Object?>{
            'fieldId': 'transport.mode',
            'label': 'Preferred transport',
            'type': 'singleChoice',
            'required': true,
            'options': <Object?>['School bus', 'Private'],
          },
        ],
      },
    );

    final definition = await FamilyInteractionApi(client).loadForm(
      correlationId: 'forms-load-1',
      formId: 'form-1',
      session: familySession(
        capabilities: const {SchoolCapability.formsConsent},
      ),
    );

    expect(definition.baseVersion, 7);
    expect(definition.schemaVersion, 3);
    expect(definition.fields.single.fieldId, 'transport.mode');
    client.close();
  });

'''
if "loads server-versioned form definitions" not in api_test:
    api_test = api_test.replace(
        "  test('submits a versioned form with idempotency and exact answers', () async {\n",
        load_form_test
        + "  test('submits a versioned form with idempotency and exact answers', () async {\n",
        1,
    )
api_test_path.write_text(api_test, encoding='utf-8')

controller = r'''part of 'main.dart';

abstract interface class FamilyInteractionRepository {
  Future<FamilyDocumentPage> listDocuments({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  });

  Future<FamilyDocumentDownloadGrant> requestDocumentDownload({
    required String correlationId,
    required String documentId,
    required String idempotencyKey,
    required SchoolSession session,
  });

  Future<List<FamilyFormSummary>> listForms({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  });

  Future<FamilyFormDefinition> loadForm({
    required String correlationId,
    required String formId,
    required SchoolSession session,
  });

  Future<int> submitForm({
    required String correlationId,
    required FamilyFormSubmissionCommand command,
    required SchoolSession session,
  });

  Future<List<FamilyConsentRequest>> listConsents({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  });

  Future<int> decideConsent({
    required String correlationId,
    required FamilyConsentDecisionCommand command,
    required SchoolSession session,
  });

  Future<FamilyConversationPage> listConversations({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  });

  Future<FamilyConversationMessagePage> listMessages({
    required String correlationId,
    required String conversationId,
    required SchoolSession session,
    String? cursor,
    int limit = 50,
  });

  Future<FamilyConversationMessage> sendMessage({
    required String correlationId,
    required FamilySendMessageCommand command,
    required SchoolSession session,
  });
}

final class FamilyInteractionApiRepository
    implements FamilyInteractionRepository {
  const FamilyInteractionApiRepository(this._api);

  final FamilyInteractionApi _api;

  @override
  Future<int> decideConsent({
    required String correlationId,
    required FamilyConsentDecisionCommand command,
    required SchoolSession session,
  }) => _api.decideConsent(
    correlationId: correlationId,
    command: command,
    session: session,
  );

  @override
  Future<FamilyDocumentPage> listDocuments({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  }) => _api.listDocuments(
    correlationId: correlationId,
    session: session,
    studentId: studentId,
    cursor: cursor,
    limit: limit,
  );

  @override
  Future<List<FamilyFormSummary>> listForms({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  }) => _api.listForms(
    correlationId: correlationId,
    session: session,
    studentId: studentId,
  );

  @override
  Future<List<FamilyConsentRequest>> listConsents({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  }) => _api.listConsents(
    correlationId: correlationId,
    session: session,
    studentId: studentId,
  );

  @override
  Future<FamilyConversationPage> listConversations({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  }) => _api.listConversations(
    correlationId: correlationId,
    session: session,
    studentId: studentId,
    cursor: cursor,
    limit: limit,
  );

  @override
  Future<FamilyConversationMessagePage> listMessages({
    required String correlationId,
    required String conversationId,
    required SchoolSession session,
    String? cursor,
    int limit = 50,
  }) => _api.listMessages(
    correlationId: correlationId,
    conversationId: conversationId,
    session: session,
    cursor: cursor,
    limit: limit,
  );

  @override
  Future<FamilyFormDefinition> loadForm({
    required String correlationId,
    required String formId,
    required SchoolSession session,
  }) => _api.loadForm(
    correlationId: correlationId,
    formId: formId,
    session: session,
  );

  @override
  Future<FamilyDocumentDownloadGrant> requestDocumentDownload({
    required String correlationId,
    required String documentId,
    required String idempotencyKey,
    required SchoolSession session,
  }) => _api.requestDocumentDownload(
    correlationId: correlationId,
    documentId: documentId,
    idempotencyKey: idempotencyKey,
    session: session,
  );

  @override
  Future<FamilyConversationMessage> sendMessage({
    required String correlationId,
    required FamilySendMessageCommand command,
    required SchoolSession session,
  }) => _api.sendMessage(
    correlationId: correlationId,
    command: command,
    session: session,
  );

  @override
  Future<int> submitForm({
    required String correlationId,
    required FamilyFormSubmissionCommand command,
    required SchoolSession session,
  }) => _api.submitForm(
    correlationId: correlationId,
    command: command,
    session: session,
  );
}

enum FamilyInteractionPhase { idle, loading, ready, failed }

final class FamilyInteractionController extends ChangeNotifier {
  FamilyInteractionController({
    required FamilyInteractionRepository repository,
    required SchoolSession session,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now,
       _repository = repository,
       _session = session;

  FamilyInteractionRepository _repository;
  SchoolSession _session;
  final DateTime Function() _clock;
  int _scopeRevision = 0;
  int _operationCounter = 0;
  bool _disposed = false;

  String? studentId;

  FamilyInteractionPhase documentsPhase = FamilyInteractionPhase.idle;
  List<FamilyDocumentSummary> documents = const <FamilyDocumentSummary>[];
  String? documentsNextCursor;
  String? documentsReasonCode;
  String? pendingDocumentId;
  FamilyDocumentDownloadGrant? downloadGrant;

  FamilyInteractionPhase formsPhase = FamilyInteractionPhase.idle;
  List<FamilyFormSummary> forms = const <FamilyFormSummary>[];
  String? formsReasonCode;
  FamilyInteractionPhase formPhase = FamilyInteractionPhase.idle;
  FamilyFormDefinition? activeForm;
  String? formReasonCode;
  bool formSubmitting = false;
  int? formAcceptedRevision;

  FamilyInteractionPhase consentsPhase = FamilyInteractionPhase.idle;
  List<FamilyConsentRequest> consents = const <FamilyConsentRequest>[];
  String? consentsReasonCode;
  String? pendingConsentId;
  int? consentAcceptedRevision;

  FamilyInteractionPhase conversationsPhase = FamilyInteractionPhase.idle;
  List<FamilyConversationSummary> conversations =
      const <FamilyConversationSummary>[];
  String? conversationsNextCursor;
  String? conversationsReasonCode;
  FamilyConversationSummary? activeConversation;
  FamilyInteractionPhase messagesPhase = FamilyInteractionPhase.idle;
  List<FamilyConversationMessage> messages =
      const <FamilyConversationMessage>[];
  String? messagesNextCursor;
  String? messagesReasonCode;
  bool messageSending = false;

  SchoolSession get session => _session;

  void bindStudent(String value) {
    final normalized = value.trim();
    if (normalized.isEmpty) {
      throw const FamilyInteractionException('FAMILY_STUDENT_REQUIRED');
    }
    if (studentId == normalized) return;
    studentId = normalized;
    _scopeRevision++;
    _resetFeatures();
    _safeNotify();
  }

  void updateScope({
    required FamilyInteractionRepository repository,
    required SchoolSession session,
  }) {
    if (identical(repository, _repository) &&
        _sameInteractionSession(session, _session)) {
      return;
    }
    _repository = repository;
    _session = session;
    studentId = null;
    _scopeRevision++;
    _resetFeatures();
    _safeNotify();
  }

  Future<void> loadDocuments(String value, {bool append = false}) async {
    bindStudent(value);
    if (append && documentsNextCursor == null) return;
    if (!append && documentsPhase == FamilyInteractionPhase.loading) return;
    final selectedStudent = studentId!;
    final revision = _scopeRevision;
    documentsPhase = FamilyInteractionPhase.loading;
    documentsReasonCode = null;
    _safeNotify();
    try {
      final page = await _repository.listDocuments(
        correlationId: _nextIdentity('family-documents-read'),
        cursor: append ? documentsNextCursor : null,
        session: _session,
        studentId: selectedStudent,
      );
      if (!_isCurrent(revision, selectedStudent)) return;
      documents = append
          ? _mergeByIdentity(
              documents,
              page.documents,
              (document) => document.documentId,
            )
          : page.documents;
      documentsNextCursor = page.nextCursor;
      documentsPhase = FamilyInteractionPhase.ready;
    } on Object catch (error) {
      if (!_isCurrent(revision, selectedStudent)) return;
      documentsReasonCode = _familyInteractionReason(error);
      documentsPhase = FamilyInteractionPhase.failed;
    }
    _safeNotify();
  }

  Future<void> prepareDocumentDownload(FamilyDocumentSummary document) async {
    if (!documents.any((item) => item.documentId == document.documentId)) {
      documentsReasonCode = 'FAMILY_DOCUMENT_NOT_IN_ACTIVE_DIRECTORY';
      documentsPhase = FamilyInteractionPhase.failed;
      _safeNotify();
      return;
    }
    final revision = _scopeRevision;
    pendingDocumentId = document.documentId;
    downloadGrant = null;
    documentsReasonCode = null;
    _safeNotify();
    try {
      final grant = await _repository.requestDocumentDownload(
        correlationId: _nextIdentity('family-document-grant'),
        documentId: document.documentId,
        idempotencyKey: _nextIdentity('family-document-download'),
        session: _session,
      );
      if (revision != _scopeRevision) return;
      downloadGrant = grant;
    } on Object catch (error) {
      if (revision != _scopeRevision) return;
      documentsReasonCode = _familyInteractionReason(error);
    }
    if (revision == _scopeRevision) {
      pendingDocumentId = null;
      _safeNotify();
    }
  }

  Future<void> loadForms(String value) async {
    bindStudent(value);
    if (formsPhase == FamilyInteractionPhase.loading) return;
    final selectedStudent = studentId!;
    final revision = _scopeRevision;
    formsPhase = FamilyInteractionPhase.loading;
    formsReasonCode = null;
    _safeNotify();
    try {
      forms = await _repository.listForms(
        correlationId: _nextIdentity('family-forms-read'),
        session: _session,
        studentId: selectedStudent,
      );
      if (!_isCurrent(revision, selectedStudent)) return;
      formsPhase = FamilyInteractionPhase.ready;
    } on Object catch (error) {
      if (!_isCurrent(revision, selectedStudent)) return;
      formsReasonCode = _familyInteractionReason(error);
      formsPhase = FamilyInteractionPhase.failed;
    }
    _safeNotify();
  }

  Future<void> loadForm(String formId) async {
    final normalized = formId.trim();
    if (normalized.isEmpty || studentId == null) return;
    if (formPhase == FamilyInteractionPhase.loading &&
        activeForm?.formId == normalized) {
      return;
    }
    final revision = _scopeRevision;
    formPhase = FamilyInteractionPhase.loading;
    formReasonCode = null;
    formAcceptedRevision = null;
    _safeNotify();
    try {
      final definition = await _repository.loadForm(
        correlationId: _nextIdentity('family-form-read'),
        formId: normalized,
        session: _session,
      );
      if (revision != _scopeRevision) return;
      activeForm = definition;
      formPhase = FamilyInteractionPhase.ready;
    } on Object catch (error) {
      if (revision != _scopeRevision) return;
      activeForm = null;
      formReasonCode = _familyInteractionReason(error);
      formPhase = FamilyInteractionPhase.failed;
    }
    _safeNotify();
  }

  Future<void> submitActiveForm(Map<String, Object?> answers) async {
    final definition = activeForm;
    final selectedStudent = studentId;
    if (definition == null || selectedStudent == null) return;
    try {
      _validateFormAnswers(definition, answers);
    } on Object catch (error) {
      formReasonCode = _familyInteractionReason(error);
      _safeNotify();
      return;
    }
    if (definition.status != FamilyFormStatus.open) {
      formReasonCode = 'FAMILY_FORM_NOT_OPEN';
      _safeNotify();
      return;
    }
    final revision = _scopeRevision;
    formSubmitting = true;
    formReasonCode = null;
    formAcceptedRevision = null;
    _safeNotify();
    try {
      formAcceptedRevision = await _repository.submitForm(
        correlationId: _nextIdentity('family-form-submit'),
        command: FamilyFormSubmissionCommand(
          answers: answers,
          baseVersion: definition.baseVersion,
          formId: definition.formId,
          idempotencyKey: _nextIdentity('family-form-operation'),
          schemaVersion: definition.schemaVersion,
          studentId: selectedStudent,
        ),
        session: _session,
      );
    } on Object catch (error) {
      if (revision != _scopeRevision) return;
      formReasonCode = _familyInteractionReason(error);
    }
    if (revision == _scopeRevision) {
      formSubmitting = false;
      _safeNotify();
    }
  }

  Future<void> loadConsents(String value) async {
    bindStudent(value);
    if (consentsPhase == FamilyInteractionPhase.loading) return;
    final selectedStudent = studentId!;
    final revision = _scopeRevision;
    consentsPhase = FamilyInteractionPhase.loading;
    consentsReasonCode = null;
    consentAcceptedRevision = null;
    _safeNotify();
    try {
      consents = await _repository.listConsents(
        correlationId: _nextIdentity('family-consents-read'),
        session: _session,
        studentId: selectedStudent,
      );
      if (!_isCurrent(revision, selectedStudent)) return;
      consentsPhase = FamilyInteractionPhase.ready;
    } on Object catch (error) {
      if (!_isCurrent(revision, selectedStudent)) return;
      consentsReasonCode = _familyInteractionReason(error);
      consentsPhase = FamilyInteractionPhase.failed;
    }
    _safeNotify();
  }

  Future<void> decideConsent(
    FamilyConsentRequest request,
    FamilyConsentDecision decision,
  ) async {
    if (studentId != request.studentId ||
        request.status != FamilyConsentStatus.pending) {
      consentsReasonCode = 'FAMILY_CONSENT_NOT_ACTIONABLE';
      _safeNotify();
      return;
    }
    final command = FamilyConsentDecisionCommand(
      consentId: request.consentId,
      decision: decision,
      idempotencyKey: _nextIdentity('family-consent-operation'),
      policyVersion: request.policyVersion,
      studentId: request.studentId,
    );
    try {
      command.validateSession(_session);
    } on Object catch (error) {
      consentsReasonCode = _familyInteractionReason(error);
      _safeNotify();
      return;
    }
    final revision = _scopeRevision;
    pendingConsentId = request.consentId;
    consentsReasonCode = null;
    consentAcceptedRevision = null;
    _safeNotify();
    try {
      consentAcceptedRevision = await _repository.decideConsent(
        correlationId: _nextIdentity('family-consent-decision'),
        command: command,
        session: _session,
      );
    } on Object catch (error) {
      if (revision != _scopeRevision) return;
      consentsReasonCode = _familyInteractionReason(error);
    }
    if (revision == _scopeRevision) {
      pendingConsentId = null;
      _safeNotify();
    }
  }

  Future<void> loadConversations(String value, {bool append = false}) async {
    bindStudent(value);
    if (append && conversationsNextCursor == null) return;
    if (!append && conversationsPhase == FamilyInteractionPhase.loading) return;
    final selectedStudent = studentId!;
    final revision = _scopeRevision;
    conversationsPhase = FamilyInteractionPhase.loading;
    conversationsReasonCode = null;
    _safeNotify();
    try {
      final page = await _repository.listConversations(
        correlationId: _nextIdentity('family-conversations-read'),
        cursor: append ? conversationsNextCursor : null,
        session: _session,
        studentId: selectedStudent,
      );
      if (!_isCurrent(revision, selectedStudent)) return;
      conversations = append
          ? _mergeByIdentity(
              conversations,
              page.conversations,
              (conversation) => conversation.conversationId,
            )
          : page.conversations;
      conversationsNextCursor = page.nextCursor;
      conversationsPhase = FamilyInteractionPhase.ready;
    } on Object catch (error) {
      if (!_isCurrent(revision, selectedStudent)) return;
      conversationsReasonCode = _familyInteractionReason(error);
      conversationsPhase = FamilyInteractionPhase.failed;
    }
    _safeNotify();
  }

  Future<void> openConversation(String conversationId) async {
    final normalized = conversationId.trim();
    final summary = conversations
        .where((conversation) => conversation.conversationId == normalized)
        .firstOrNull;
    if (summary == null) {
      messagesReasonCode = 'FAMILY_CONVERSATION_NOT_IN_ACTIVE_DIRECTORY';
      messagesPhase = FamilyInteractionPhase.failed;
      _safeNotify();
      return;
    }
    if (activeConversation?.conversationId != normalized) {
      activeConversation = summary;
      messages = const <FamilyConversationMessage>[];
      messagesNextCursor = null;
      messagesPhase = FamilyInteractionPhase.idle;
      messagesReasonCode = null;
      _safeNotify();
    }
    await loadMessages();
  }

  Future<void> loadMessages({bool append = false}) async {
    final conversation = activeConversation;
    if (conversation == null) return;
    if (append && messagesNextCursor == null) return;
    if (!append && messagesPhase == FamilyInteractionPhase.loading) return;
    final revision = _scopeRevision;
    final conversationId = conversation.conversationId;
    messagesPhase = FamilyInteractionPhase.loading;
    messagesReasonCode = null;
    _safeNotify();
    try {
      final page = await _repository.listMessages(
        correlationId: _nextIdentity('family-messages-read'),
        conversationId: conversationId,
        cursor: append ? messagesNextCursor : null,
        session: _session,
      );
      if (revision != _scopeRevision ||
          activeConversation?.conversationId != conversationId) {
        return;
      }
      messages = append
          ? _mergeByIdentity(messages, page.messages, (message) => message.messageId)
          : page.messages;
      messagesNextCursor = page.nextCursor;
      messagesPhase = FamilyInteractionPhase.ready;
    } on Object catch (error) {
      if (revision != _scopeRevision ||
          activeConversation?.conversationId != conversationId) {
        return;
      }
      messagesReasonCode = _familyInteractionReason(error);
      messagesPhase = FamilyInteractionPhase.failed;
    }
    _safeNotify();
  }

  Future<void> sendMessage(String body) async {
    final conversation = activeConversation;
    if (conversation == null) return;
    if (!_session.can(SchoolCapability.messagesSend)) {
      messagesReasonCode =
          'FAMILY_CAPABILITY_REQUIRED:${SchoolCapability.messagesSend}';
      _safeNotify();
      return;
    }
    final revision = _scopeRevision;
    messageSending = true;
    messagesReasonCode = null;
    _safeNotify();
    try {
      final message = await _repository.sendMessage(
        correlationId: _nextIdentity('family-message-send'),
        command: FamilySendMessageCommand(
          body: body,
          conversationId: conversation.conversationId,
          idempotencyKey: _nextIdentity('family-message-operation'),
        ),
        session: _session,
      );
      if (revision != _scopeRevision ||
          activeConversation?.conversationId != conversation.conversationId) {
        return;
      }
      messages = _mergeByIdentity(
        messages,
        <FamilyConversationMessage>[message],
        (item) => item.messageId,
      );
      messagesPhase = FamilyInteractionPhase.ready;
    } on Object catch (error) {
      if (revision != _scopeRevision) return;
      messagesReasonCode = _familyInteractionReason(error);
    }
    if (revision == _scopeRevision) {
      messageSending = false;
      _safeNotify();
    }
  }

  void _resetFeatures() {
    documentsPhase = FamilyInteractionPhase.idle;
    documents = const <FamilyDocumentSummary>[];
    documentsNextCursor = null;
    documentsReasonCode = null;
    pendingDocumentId = null;
    downloadGrant = null;
    formsPhase = FamilyInteractionPhase.idle;
    forms = const <FamilyFormSummary>[];
    formsReasonCode = null;
    formPhase = FamilyInteractionPhase.idle;
    activeForm = null;
    formReasonCode = null;
    formSubmitting = false;
    formAcceptedRevision = null;
    consentsPhase = FamilyInteractionPhase.idle;
    consents = const <FamilyConsentRequest>[];
    consentsReasonCode = null;
    pendingConsentId = null;
    consentAcceptedRevision = null;
    conversationsPhase = FamilyInteractionPhase.idle;
    conversations = const <FamilyConversationSummary>[];
    conversationsNextCursor = null;
    conversationsReasonCode = null;
    activeConversation = null;
    messagesPhase = FamilyInteractionPhase.idle;
    messages = const <FamilyConversationMessage>[];
    messagesNextCursor = null;
    messagesReasonCode = null;
    messageSending = false;
  }

  bool _isCurrent(int revision, String selectedStudent) =>
      revision == _scopeRevision && studentId == selectedStudent;

  String _nextIdentity(String prefix) {
    final sequence = _operationCounter++;
    return '$prefix-${_clock().toUtc().microsecondsSinceEpoch}-$sequence';
  }

  void _safeNotify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

bool _sameInteractionSession(SchoolSession first, SchoolSession second) =>
    first.accountId == second.accountId &&
    first.tenantId == second.tenantId &&
    first.campusId == second.campusId &&
    first.activePersona == second.activePersona &&
    setEquals(first.capabilities, second.capabilities);

String _familyInteractionReason(Object error) => switch (error) {
  SchoolApiException(:final code) => code,
  FamilyInteractionException(:final code) => code,
  _ => 'FAMILY_INTERACTION_UNAVAILABLE',
};

List<T> _mergeByIdentity<T>(
  Iterable<T> existing,
  Iterable<T> additions,
  String Function(T value) identity,
) {
  final byId = <String, T>{};
  for (final value in existing) {
    byId[identity(value)] = value;
  }
  for (final value in additions) {
    byId[identity(value)] = value;
  }
  return List<T>.unmodifiable(byId.values);
}

void _validateFormAnswers(
  FamilyFormDefinition definition,
  Map<String, Object?> answers,
) {
  final fields = <String, FamilyFormFieldDefinition>{
    for (final field in definition.fields) field.fieldId: field,
  };
  for (final key in answers.keys) {
    if (!fields.containsKey(key)) {
      throw FamilyInteractionException('FAMILY_FORM_FIELD_UNKNOWN:$key');
    }
  }
  for (final field in definition.fields) {
    final value = answers[field.fieldId];
    final missing = value == null || (value is String && value.trim().isEmpty);
    if (field.required && missing) {
      throw FamilyInteractionException(
        'FAMILY_FORM_REQUIRED_FIELD_MISSING:${field.fieldId}',
      );
    }
    if (missing) continue;
    final valid = switch (field.type) {
      FamilyFormFieldType.text => value is String,
      FamilyFormFieldType.boolean => value is bool,
      FamilyFormFieldType.singleChoice =>
        value is String && field.options.contains(value),
      FamilyFormFieldType.date =>
        value is String && DateTime.tryParse(value) != null,
    };
    if (!valid) {
      throw FamilyInteractionException(
        'FAMILY_FORM_FIELD_VALUE_INVALID:${field.fieldId}',
      );
    }
  }
}
'''
(root / 'apps/family_app/lib/family_interaction_controller.dart').write_text(
    controller,
    encoding='utf-8',
)

screens = r'''part of 'main.dart';

class _FamilyServicesScreen extends StatelessWidget {
  const _FamilyServicesScreen({
    required this.interactions,
    required this.journey,
    required this.session,
  });

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;
  final SchoolSession session;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final services = <Widget>[];
      void addService(
        IconData icon,
        String title,
        String subtitle,
        String path,
      ) {
        if (services.isNotEmpty) services.add(const Divider());
        services.add(
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(icon),
            onTap: () => context.go(path),
            subtitle: Text(subtitle),
            title: Text(title),
            trailing: const Icon(Icons.chevron_right),
          ),
        );
      }

      if (session.can(SchoolCapability.documentsRead)) {
        addService(
          Icons.description_outlined,
          'Documents',
          'Review metadata and prepare short-lived secure download grants.',
          '/documents',
        );
      }
      if (session.can(SchoolCapability.formsConsent)) {
        addService(
          Icons.assignment_outlined,
          'Forms',
          'Complete server-versioned forms without client-side authority.',
          '/forms',
        );
        if (session.activePersona == SchoolPersona.guardian) {
          addService(
            Icons.verified_user_outlined,
            'Guardian consent',
            'Review policy versions and submit explicit decisions.',
            '/consents',
          );
        }
      }

      return ListView(
        children: [
          SchoolPageSection(
            description:
                '${directory.activeStudent.displayName} · capability-scoped services',
            title: 'Documents and forms',
            child: SchoolPanel(
              child: services.isEmpty
                  ? const Text('No interaction services are authorized.')
                  : Column(children: services),
            ),
          ),
        ],
      );
    },
  );
}

class _FamilyDocumentsScreen extends StatelessWidget {
  const _FamilyDocumentsScreen({
    required this.interactions,
    required this.journey,
  });

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final studentId = directory.activeStudentId;
      if (interactions.documentsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(() => interactions.loadDocuments(studentId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.documentsPhase == FamilyInteractionPhase.loading &&
              interactions.documents.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.documentsPhase == FamilyInteractionPhase.failed &&
              interactions.documents.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadDocuments(studentId),
              reasonCode: interactions.documentsReasonCode,
              title: 'Documents unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Only metadata is shown. Restricted files remain no-store and raw download credentials are never exposed.',
                title: '${directory.activeStudent.displayName} documents',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.documentsReasonCode != null)
                        SchoolStatusBanner(
                          label: 'Document action failed',
                          message: interactions.documentsReasonCode!,
                          tone: SchoolStatusTone.error,
                        ),
                      if (interactions.downloadGrant != null) ...[
                        SchoolStatusBanner(
                          label: interactions.downloadGrant!.requiresStepUp
                              ? 'Additional verification required'
                              : 'Secure grant prepared',
                          message:
                              'The short-lived ${interactions.downloadGrant!.singleUse ? 'single-use ' : ''}grant expires ${_familyDateTimeLabel(context, interactions.downloadGrant!.expiresAt)}. No URL or credential is shown.',
                          tone: SchoolStatusTone.success,
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      if (interactions.documents.isEmpty)
                        const Text('No authorized document metadata is available.')
                      else
                        for (var index = 0;
                            index < interactions.documents.length;
                            index++) ...[
                          _FamilyDocumentTile(
                            document: interactions.documents[index],
                            loading:
                                interactions.pendingDocumentId ==
                                interactions.documents[index].documentId,
                            onPrepare: () => interactions.prepareDocumentDownload(
                              interactions.documents[index],
                            ),
                          ),
                          if (index != interactions.documents.length - 1)
                            const Divider(),
                        ],
                      if (interactions.documentsNextCursor != null) ...[
                        const SizedBox(height: SchoolSpacing.md),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.expand_more),
                          label: const Text('Load more documents'),
                          onPressed:
                              interactions.documentsPhase ==
                                  FamilyInteractionPhase.loading
                              ? null
                              : () => interactions.loadDocuments(
                                  studentId,
                                  append: true,
                                ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _FamilyDocumentTile extends StatelessWidget {
  const _FamilyDocumentTile({
    required this.document,
    required this.loading,
    required this.onPrepare,
  });

  final FamilyDocumentSummary document;
  final bool loading;
  final VoidCallback onPrepare;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(
      document.classification == FamilyDocumentClassification.restricted
          ? Icons.lock_outline
          : Icons.description_outlined,
    ),
    title: Text(document.title),
    subtitle: Text(
      '${document.fileName} · ${_fileSizeLabel(document.sizeBytes)} · issued ${_familyDateLabel(context, document.issuedAt)}\n${document.classification.name} · ${document.cachePolicy.name}',
    ),
    isThreeLine: true,
    trailing: loading
        ? const SizedBox.square(
            dimension: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : IconButton(
            icon: const Icon(Icons.download_for_offline_outlined),
            onPressed: onPrepare,
            tooltip: 'Prepare secure download',
          ),
  );
}

class _FamilyFormsScreen extends StatelessWidget {
  const _FamilyFormsScreen({
    required this.interactions,
    required this.journey,
  });

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final studentId = directory.activeStudentId;
      if (interactions.formsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(() => interactions.loadForms(studentId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.formsPhase == FamilyInteractionPhase.loading &&
              interactions.forms.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.formsPhase == FamilyInteractionPhase.failed &&
              interactions.forms.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadForms(studentId),
              reasonCode: interactions.formsReasonCode,
              title: 'Forms unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Submission uses the server-issued base and schema versions. The client does not infer a newer revision.',
                title: '${directory.activeStudent.displayName} forms',
                child: SchoolPanel(
                  child: interactions.forms.isEmpty
                      ? const Text('No forms are available for this profile.')
                      : Column(
                          children: [
                            for (var index = 0;
                                index < interactions.forms.length;
                                index++) ...[
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(
                                  interactions.forms[index].status ==
                                          FamilyFormStatus.open
                                      ? Icons.assignment_outlined
                                      : Icons.assignment_turned_in_outlined,
                                ),
                                onTap:
                                    interactions.forms[index].status ==
                                        FamilyFormStatus.open
                                    ? () => context.go(
                                        '/forms/${Uri.encodeComponent(interactions.forms[index].formId)}',
                                      )
                                    : null,
                                subtitle: Text(
                                  '${interactions.forms[index].status.name}${interactions.forms[index].dueAt == null ? '' : ' · due ${_familyDateLabel(context, interactions.forms[index].dueAt!)}'}',
                                ),
                                title: Text(interactions.forms[index].title),
                                trailing:
                                    interactions.forms[index].status ==
                                        FamilyFormStatus.open
                                    ? const Icon(Icons.chevron_right)
                                    : null,
                              ),
                              if (index != interactions.forms.length - 1)
                                const Divider(),
                            ],
                          ],
                        ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _FamilyFormScreen extends StatefulWidget {
  const _FamilyFormScreen({
    required this.formId,
    required this.interactions,
    required this.journey,
  });

  final String formId;
  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  State<_FamilyFormScreen> createState() => _FamilyFormScreenState();
}

class _FamilyFormScreenState extends State<_FamilyFormScreen> {
  String? _preparedDefinition;
  Map<String, Object?> _answers = <String, Object?>{};

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: widget.interactions,
    journey: widget.journey,
    builder: (context, directory) {
      final interactions = widget.interactions;
      final definition = interactions.activeForm;
      if ((definition == null || definition.formId != widget.formId) &&
          interactions.formPhase != FamilyInteractionPhase.loading) {
        _afterFrame(() => interactions.loadForm(widget.formId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          final active = interactions.activeForm;
          if (interactions.formPhase == FamilyInteractionPhase.loading ||
              active == null &&
                  interactions.formPhase == FamilyInteractionPhase.idle) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.formPhase == FamilyInteractionPhase.failed ||
              active == null ||
              active.formId != widget.formId) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadForm(widget.formId),
              reasonCode: interactions.formReasonCode,
              title: 'Form unavailable',
            );
          }
          final definitionKey =
              '${active.formId}:${active.baseVersion}:${active.schemaVersion}';
          if (_preparedDefinition != definitionKey) {
            _preparedDefinition = definitionKey;
            _answers = <String, Object?>{};
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Base version ${active.baseVersion} · schema ${active.schemaVersion} · ${directory.activeStudent.displayName}',
                title: active.title,
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.formReasonCode != null) ...[
                        SchoolStatusBanner(
                          label: 'Form not submitted',
                          message: interactions.formReasonCode!,
                          tone: SchoolStatusTone.error,
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      if (interactions.formAcceptedRevision != null) ...[
                        SchoolStatusBanner(
                          label: 'Submission accepted',
                          message:
                              'The server accepted revision ${interactions.formAcceptedRevision}.',
                          tone: SchoolStatusTone.success,
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      for (final field in active.fields) ...[
                        _FamilyFormField(
                          field: field,
                          value: _answers[field.fieldId],
                          onChanged: (value) {
                            setState(() {
                              if (value == null) {
                                _answers.remove(field.fieldId);
                              } else {
                                _answers[field.fieldId] = value;
                              }
                            });
                          },
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      FilledButton.icon(
                        icon: const Icon(Icons.send_outlined),
                        label: const Text('Submit form'),
                        onPressed:
                            interactions.formSubmitting ||
                                active.status != FamilyFormStatus.open
                            ? null
                            : () => interactions.submitActiveForm(_answers),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _FamilyFormField extends StatelessWidget {
  const _FamilyFormField({
    required this.field,
    required this.onChanged,
    required this.value,
  });

  final FamilyFormFieldDefinition field;
  final ValueChanged<Object?> onChanged;
  final Object? value;

  @override
  Widget build(BuildContext context) => switch (field.type) {
    FamilyFormFieldType.text => TextFormField(
      initialValue: value as String?,
      decoration: InputDecoration(
        labelText: '${field.label}${field.required ? ' *' : ''}',
      ),
      maxLength: 4000,
      onChanged: onChanged,
    ),
    FamilyFormFieldType.boolean => CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      title: Text('${field.label}${field.required ? ' *' : ''}'),
      value: value as bool? ?? false,
      onChanged: onChanged,
    ),
    FamilyFormFieldType.singleChoice => DropdownButtonFormField<String>(
      initialValue: value as String?,
      decoration: InputDecoration(
        labelText: '${field.label}${field.required ? ' *' : ''}',
      ),
      items: field.options
          .map(
            (option) => DropdownMenuItem(value: option, child: Text(option)),
          )
          .toList(growable: false),
      onChanged: onChanged,
    ),
    FamilyFormFieldType.date => _FamilyDateField(
      label: '${field.label}${field.required ? ' *' : ''}',
      onChanged: onChanged,
      value: value as String?,
    ),
  };
}

class _FamilyDateField extends StatelessWidget {
  const _FamilyDateField({
    required this.label,
    required this.onChanged,
    required this.value,
  });

  final String label;
  final ValueChanged<Object?> onChanged;
  final String? value;

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    icon: const Icon(Icons.calendar_today_outlined),
    label: Text(value == null ? label : '$label · $value'),
    onPressed: () async {
      final now = DateTime.now();
      final selected = await showDatePicker(
        context: context,
        firstDate: DateTime(now.year - 1),
        initialDate: DateTime.tryParse(value ?? '') ?? now,
        lastDate: DateTime(now.year + 5),
      );
      if (selected != null) {
        onChanged(
          '${selected.year.toString().padLeft(4, '0')}-${selected.month.toString().padLeft(2, '0')}-${selected.day.toString().padLeft(2, '0')}',
        );
      }
    },
  );
}

class _FamilyConsentsScreen extends StatelessWidget {
  const _FamilyConsentsScreen({
    required this.interactions,
    required this.journey,
  });

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final studentId = directory.activeStudentId;
      if (interactions.consentsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(() => interactions.loadConsents(studentId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.consentsPhase == FamilyInteractionPhase.loading &&
              interactions.consents.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.consentsPhase == FamilyInteractionPhase.failed &&
              interactions.consents.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadConsents(studentId),
              reasonCode: interactions.consentsReasonCode,
              title: 'Consent requests unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Only a guardian persona with the consent capability can submit a decision.',
                title: '${directory.activeStudent.displayName} consent requests',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.consentsReasonCode != null)
                        SchoolStatusBanner(
                          label: 'Consent decision not accepted',
                          message: interactions.consentsReasonCode!,
                          tone: SchoolStatusTone.error,
                        ),
                      if (interactions.consentAcceptedRevision != null)
                        SchoolStatusBanner(
                          label: 'Decision accepted',
                          message:
                              'The server accepted revision ${interactions.consentAcceptedRevision}. Refresh to verify the published status.',
                          tone: SchoolStatusTone.success,
                        ),
                      if (interactions.consents.isEmpty)
                        const Text('No consent requests are available.')
                      else
                        for (var index = 0;
                            index < interactions.consents.length;
                            index++) ...[
                          _FamilyConsentTile(
                            consent: interactions.consents[index],
                            loading:
                                interactions.pendingConsentId ==
                                interactions.consents[index].consentId,
                            onDecision: (decision) => interactions.decideConsent(
                              interactions.consents[index],
                              decision,
                            ),
                          ),
                          if (index != interactions.consents.length - 1)
                            const Divider(),
                        ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _FamilyConsentTile extends StatelessWidget {
  const _FamilyConsentTile({
    required this.consent,
    required this.loading,
    required this.onDecision,
  });

  final FamilyConsentRequest consent;
  final bool loading;
  final ValueChanged<FamilyConsentDecision> onDecision;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(Icons.verified_user_outlined),
        subtitle: Text(
          'Policy ${consent.policyVersion} · ${consent.status.name}${consent.dueAt == null ? '' : ' · due ${_familyDateLabel(context, consent.dueAt!)}'}',
        ),
        title: Text(consent.title),
      ),
      if (consent.status == FamilyConsentStatus.pending)
        Wrap(
          spacing: SchoolSpacing.sm,
          runSpacing: SchoolSpacing.sm,
          children: [
            FilledButton.icon(
              icon: const Icon(Icons.check),
              label: const Text('Grant consent'),
              onPressed: loading
                  ? null
                  : () => onDecision(FamilyConsentDecision.grant),
            ),
            OutlinedButton.icon(
              icon: const Icon(Icons.close),
              label: const Text('Decline'),
              onPressed: loading
                  ? null
                  : () => onDecision(FamilyConsentDecision.decline),
            ),
          ],
        ),
    ],
  );
}

class _FamilyConversationsScreen extends StatelessWidget {
  const _FamilyConversationsScreen({
    required this.interactions,
    required this.journey,
  });

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final studentId = directory.activeStudentId;
      if (interactions.conversationsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(() => interactions.loadConversations(studentId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.loading &&
              interactions.conversations.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.failed &&
              interactions.conversations.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadConversations(studentId),
              reasonCode: interactions.conversationsReasonCode,
              title: 'Conversations unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Conversation access follows the active school relationship and capability scope.',
                title: '${directory.activeStudent.displayName} conversations',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.conversations.isEmpty)
                        const Text('No conversations are available.')
                      else
                        for (var index = 0;
                            index < interactions.conversations.length;
                            index++) ...[
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.forum_outlined),
                            onTap: () => context.go(
                              '/conversations/${Uri.encodeComponent(interactions.conversations[index].conversationId)}',
                            ),
                            subtitle: Text(
                              '${interactions.conversations[index].unreadCount} unread · ${_familyDateTimeLabel(context, interactions.conversations[index].latestMessageAt)}',
                            ),
                            title: Text(interactions.conversations[index].subject),
                            trailing: const Icon(Icons.chevron_right),
                          ),
                          if (index != interactions.conversations.length - 1)
                            const Divider(),
                        ],
                      if (interactions.conversationsNextCursor != null) ...[
                        const SizedBox(height: SchoolSpacing.md),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.expand_more),
                          label: const Text('Load more conversations'),
                          onPressed:
                              interactions.conversationsPhase ==
                                  FamilyInteractionPhase.loading
                              ? null
                              : () => interactions.loadConversations(
                                  studentId,
                                  append: true,
                                ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _FamilyConversationScreen extends StatefulWidget {
  const _FamilyConversationScreen({
    required this.conversationId,
    required this.interactions,
    required this.journey,
    required this.session,
  });

  final String conversationId;
  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;
  final SchoolSession session;

  @override
  State<_FamilyConversationScreen> createState() =>
      _FamilyConversationScreenState();
}

class _FamilyConversationScreenState extends State<_FamilyConversationScreen> {
  final TextEditingController _message = TextEditingController();

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: widget.interactions,
    journey: widget.journey,
    builder: (context, directory) {
      final interactions = widget.interactions;
      if (interactions.conversationsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(
          () => interactions.loadConversations(directory.activeStudentId),
        );
      }
      if (interactions.conversationsPhase == FamilyInteractionPhase.ready &&
          interactions.activeConversation?.conversationId !=
              widget.conversationId) {
        _afterFrame(() => interactions.openConversation(widget.conversationId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.loading ||
              interactions.messagesPhase == FamilyInteractionPhase.loading &&
                  interactions.messages.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          final conversation = interactions.activeConversation;
          if (conversation == null ||
              conversation.conversationId != widget.conversationId ||
              interactions.messagesPhase == FamilyInteractionPhase.failed &&
                  interactions.messages.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () async {
                if (interactions.conversationsPhase !=
                    FamilyInteractionPhase.ready) {
                  await interactions.loadConversations(
                    directory.activeStudentId,
                  );
                }
                await interactions.openConversation(widget.conversationId);
              },
              reasonCode: interactions.messagesReasonCode,
              title: 'Conversation unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    '${directory.activeStudent.displayName} · authorized conversation',
                title: conversation.subject,
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.messagesReasonCode != null)
                        SchoolStatusBanner(
                          label: 'Message action failed',
                          message: interactions.messagesReasonCode!,
                          tone: SchoolStatusTone.error,
                        ),
                      if (interactions.messages.isEmpty)
                        const Text('No messages are available.')
                      else
                        for (final message in interactions.messages)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.account_circle_outlined),
                            subtitle: Text(
                              _familyDateTimeLabel(context, message.sentAt),
                            ),
                            title: Text(message.authorLabel),
                            trailing: const SizedBox.shrink(),
                            isThreeLine: true,
                            dense: false,
                            visualDensity: VisualDensity.standard,
                            contentPadding: EdgeInsets.zero,
                            titleAlignment: ListTileTitleAlignment.top,
                            subtitleTextStyle:
                                Theme.of(context).textTheme.bodySmall,
                            leadingAndTrailingTextStyle:
                                Theme.of(context).textTheme.bodySmall,
                          ),
                      if (interactions.messages.isNotEmpty)
                        for (final message in interactions.messages)
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: SchoolSpacing.md,
                            ),
                            child: Text(message.body),
                          ),
                      if (interactions.messagesNextCursor != null)
                        OutlinedButton.icon(
                          icon: const Icon(Icons.expand_more),
                          label: const Text('Load earlier messages'),
                          onPressed:
                              interactions.messagesPhase ==
                                  FamilyInteractionPhase.loading
                              ? null
                              : () => interactions.loadMessages(append: true),
                        ),
                      if (widget.session.can(SchoolCapability.messagesSend)) ...[
                        const Divider(height: SchoolSpacing.lg),
                        TextField(
                          controller: _message,
                          decoration: const InputDecoration(
                            labelText: 'Message',
                          ),
                          maxLength: 4000,
                          maxLines: 5,
                          minLines: 2,
                        ),
                        FilledButton.icon(
                          icon: const Icon(Icons.send_outlined),
                          label: const Text('Send message'),
                          onPressed: interactions.messageSending
                              ? null
                              : () async {
                                  final body = _message.text;
                                  await interactions.sendMessage(body);
                                  if (mounted &&
                                      interactions.messagesReasonCode == null) {
                                    _message.clear();
                                  }
                                },
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }
}

class _FamilyInteractionJourneyGate extends StatelessWidget {
  const _FamilyInteractionJourneyGate({
    required this.builder,
    required this.interactions,
    required this.journey,
  });

  final Widget Function(
    BuildContext context,
    FamilyProfileDirectory directory,
  )
  builder;
  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge(<Listenable>[journey, interactions]),
    builder: (context, _) {
      final state = journey.state;
      if (state.phase == FamilyJourneyPhase.loading) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.phase == FamilyJourneyPhase.failed || state.directory == null) {
        return const _FamilyInteractionFailure(
          reasonCode: 'FAMILY_PROFILE_DIRECTORY_UNAVAILABLE',
          title: 'Family profile unavailable',
        );
      }
      final directory = state.directory!;
      if (interactions.studentId != directory.activeStudentId) {
        _afterFrame(() => interactions.bindStudent(directory.activeStudentId));
        return const Center(child: CircularProgressIndicator());
      }
      return builder(context, directory);
    },
  );
}

class _FamilyInteractionFailure extends StatelessWidget {
  const _FamilyInteractionFailure({
    this.onRetry,
    this.reasonCode,
    required this.title,
  });

  final FutureOr<void> Function()? onRetry;
  final String? reasonCode;
  final String title;

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      SchoolPageSection(
        description:
            'No fixture or cached value is substituted when the authorized service cannot verify this interaction.',
        title: title,
        child: SchoolPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SchoolStatusBanner(
                label: 'Service unavailable',
                message: reasonCode ?? 'FAMILY_INTERACTION_UNAVAILABLE',
                tone: SchoolStatusTone.error,
              ),
              if (onRetry != null) ...[
                const SizedBox(height: SchoolSpacing.md),
                FilledButton.icon(
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try again'),
                  onPressed: () => onRetry!(),
                ),
              ],
            ],
          ),
        ),
      ),
    ],
  );
}

void _afterFrame(FutureOr<void> Function() callback) {
  WidgetsBinding.instance.addPostFrameCallback((_) => callback());
}

String _familyDateLabel(BuildContext context, DateTime value) =>
    MaterialLocalizations.of(context).formatMediumDate(value.toLocal());

String _familyDateTimeLabel(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final localizations = MaterialLocalizations.of(context);
  return '${localizations.formatMediumDate(local)} · ${localizations.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
}

String _fileSizeLabel(int bytes) {
  if (bytes < 1024) return '$bytes B';
  final kib = bytes / 1024;
  if (kib < 1024) return '${kib.toStringAsFixed(1)} KiB';
  return '${(kib / 1024).toStringAsFixed(1)} MiB';
}
'''
(root / 'apps/family_app/lib/family_interaction_screens.dart').write_text(
    screens,
    encoding='utf-8',
)

controller_test = r'''import 'dart:async';

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
                documents: <FamilyDocumentSummary>[
                  document('document-2'),
                ],
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
    await controller.submitActiveForm(
      const <String, Object?>{'transport.mode': 'Bus'},
    );

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

  test('conversation send requires capability and appends server message', () async {
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
  });
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
  }) => documents?.call(studentId) ??
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
'''
(root / 'apps/family_app/test/family_interaction_controller_test.dart').write_text(
    controller_test,
    encoding='utf-8',
)

production_path = root / 'apps/family_app/lib/production_app.dart'
production = production_path.read_text(encoding='utf-8')

if 'this.interactionRepository,' not in production.split('class _FamilyProductionAppState', 1)[0]:
    production = production.replace(
        "    this.initializeCoordinator = true,\n    this.repository,\n",
        "    this.initializeCoordinator = true,\n"
        "    this.interactionRepository,\n"
        "    this.repository,\n",
        1,
    )
    production = production.replace(
        "  final bool initializeCoordinator;\n  final FamilyReadRepository? repository;\n",
        "  final bool initializeCoordinator;\n"
        "  final FamilyInteractionRepository? interactionRepository;\n"
        "  final FamilyReadRepository? repository;\n",
        1,
    )

repository_block = """          final repository =
              widget.repository ??
              (coordinator.apiClient == null
                  ? null
                  : FamilyReadApi(coordinator.apiClient!));
"""
if repository_block in production and 'final interactionRepository =' not in production:
    production = production.replace(
        repository_block,
        """          final apiClient = coordinator.apiClient;
          final repository =
              widget.repository ??
              (apiClient == null ? null : FamilyReadApi(apiClient));
          final interactionRepository =
              widget.interactionRepository ??
              (apiClient == null
                  ? null
                  : FamilyInteractionApiRepository(
                      FamilyInteractionApi(apiClient),
                    ));
""",
        1,
    )
    production = production.replace(
        "          return _AuthorizedFamilyApp(\n            coordinator: coordinator,\n            repository: repository,\n",
        "          return _AuthorizedFamilyApp(\n"
        "            coordinator: coordinator,\n"
        "            interactionRepository: interactionRepository,\n"
        "            repository: repository,\n",
        1,
    )

if 'this.interactionRepository,' not in production.split('class _AuthorizedFamilyAppState', 1)[0].split('class _AuthorizedFamilyApp', 1)[1]:
    production = production.replace(
        "  const _AuthorizedFamilyApp({\n    required this.coordinator,\n    required this.repository,\n",
        "  const _AuthorizedFamilyApp({\n"
        "    required this.coordinator,\n"
        "    required this.repository,\n"
        "    this.interactionRepository,\n",
        1,
    )
    production = production.replace(
        "  final MobileAppCoordinator coordinator;\n  final FamilyReadRepository repository;\n",
        "  final MobileAppCoordinator coordinator;\n"
        "  final FamilyInteractionRepository? interactionRepository;\n"
        "  final FamilyReadRepository repository;\n",
        1,
    )

if 'FamilyInteractionController? _interactions;' not in production:
    production = production.replace(
        "class _AuthorizedFamilyAppState extends State<_AuthorizedFamilyApp> {\n  late FamilyJourneyController _journey;\n",
        "class _AuthorizedFamilyAppState extends State<_AuthorizedFamilyApp> {\n"
        "  FamilyInteractionController? _interactions;\n"
        "  late FamilyJourneyController _journey;\n",
        1,
    )
    production = production.replace(
        "    _journey = FamilyJourneyController(\n      repository: widget.repository,\n      session: widget.session,\n    );\n    _router = _createRouter();\n",
        "    _journey = FamilyJourneyController(\n"
        "      repository: widget.repository,\n"
        "      session: widget.session,\n"
        "    );\n"
        "    final interactionRepository = widget.interactionRepository;\n"
        "    if (interactionRepository != null) {\n"
        "      _interactions = FamilyInteractionController(\n"
        "        repository: interactionRepository,\n"
        "        session: widget.session,\n"
        "      );\n"
        "    }\n"
        "    _router = _createRouter();\n",
        1,
    )

old_update = """    final scopeChanged = !_sameSession(oldWidget.session, widget.session);
    if (oldWidget.repository != widget.repository) {
      _journey.dispose();
      _journey = FamilyJourneyController(
        repository: widget.repository,
        session: widget.session,
      );
      unawaited(_journey.initialize());
    } else if (scopeChanged) {
      unawaited(_journey.updateSession(widget.session));
    }
    if (scopeChanged) {
      _router.dispose();
      _router = _createRouter();
    }
"""
new_update = """    final scopeChanged = !_sameSession(oldWidget.session, widget.session);
    final interactionChanged =
        oldWidget.interactionRepository != widget.interactionRepository;
    if (oldWidget.repository != widget.repository) {
      _journey.dispose();
      _journey = FamilyJourneyController(
        repository: widget.repository,
        session: widget.session,
      );
      unawaited(_journey.initialize());
    } else if (scopeChanged) {
      unawaited(_journey.updateSession(widget.session));
    }
    if (interactionChanged) {
      _interactions?.dispose();
      final interactionRepository = widget.interactionRepository;
      _interactions = interactionRepository == null
          ? null
          : FamilyInteractionController(
              repository: interactionRepository,
              session: widget.session,
            );
    } else if (scopeChanged && widget.interactionRepository != null) {
      _interactions?.updateScope(
        repository: widget.interactionRepository!,
        session: widget.session,
      );
    }
    if (scopeChanged || interactionChanged) {
      _router.dispose();
      _router = _createRouter();
    }
"""
if old_update in production:
    production = production.replace(old_update, new_update, 1)

if 'final interactions = _interactions;' not in production:
    production = production.replace(
        "  GoRouter _createRouter() {\n    final session = widget.session;\n",
        "  GoRouter _createRouter() {\n"
        "    final interactions = _interactions;\n"
        "    final session = widget.session;\n",
        1,
    )
    production = production.replace(
        "            journey: _journey,\n            location: state.uri.path,\n",
        "            interactionsAvailable: interactions != null,\n"
        "            journey: _journey,\n"
        "            location: state.uri.path,\n",
        1,
    )
    production = production.replace(
        "              builder: (context, state) =>\n                  _FamilyHomeScreen(journey: _journey, session: session),\n",
        "              builder: (context, state) => _FamilyHomeScreen(\n"
        "                interactionsAvailable: interactions != null,\n"
        "                journey: _journey,\n"
        "                session: session,\n"
        "              ),\n",
        1,
    )

services_routes = """            if (interactions != null &&
                (session.can(SchoolCapability.documentsRead) ||
                    session.can(SchoolCapability.formsConsent)))
              GoRoute(
                path: '/services',
                builder: (context, state) => _FamilyServicesScreen(
                  interactions: interactions,
                  journey: _journey,
                  session: session,
                ),
              ),
            if (interactions != null &&
                session.can(SchoolCapability.documentsRead))
              GoRoute(
                path: '/documents',
                builder: (context, state) => _FamilyDocumentsScreen(
                  interactions: interactions,
                  journey: _journey,
                ),
              ),
            if (interactions != null &&
                session.can(SchoolCapability.formsConsent)) ...[
              GoRoute(
                path: '/forms',
                builder: (context, state) => _FamilyFormsScreen(
                  interactions: interactions,
                  journey: _journey,
                ),
              ),
              GoRoute(
                path: '/forms/:formId',
                builder: (context, state) => _FamilyFormScreen(
                  formId: state.pathParameters['formId']!,
                  interactions: interactions,
                  journey: _journey,
                ),
              ),
              if (session.activePersona == SchoolPersona.guardian)
                GoRoute(
                  path: '/consents',
                  builder: (context, state) => _FamilyConsentsScreen(
                    interactions: interactions,
                    journey: _journey,
                  ),
                ),
            ],
"""
fee_route_end = """            if (session.activePersona == SchoolPersona.guardian &&
                session.can(SchoolCapability.billingRead))
              GoRoute(
                path: '/fees',
                builder: (context, state) =>
                    _FamilyFeesReadScreen(journey: _journey),
              ),
"""
if services_routes not in production:
    production = production.replace(
        fee_route_end,
        fee_route_end + services_routes,
        1,
    )

message_route = """            if (session.can(SchoolCapability.messagesRead))
              GoRoute(
                path: '/messages',
                builder: (context, state) =>
                    _FamilyMessagesReadScreen(journey: _journey),
              ),
"""
conversation_routes = """            if (session.can(SchoolCapability.messagesRead))
              GoRoute(
                path: '/messages',
                builder: (context, state) =>
                    _FamilyMessagesReadScreen(journey: _journey),
              ),
            if (interactions != null &&
                session.can(SchoolCapability.messagesRead)) ...[
              GoRoute(
                path: '/conversations',
                builder: (context, state) => _FamilyConversationsScreen(
                  interactions: interactions,
                  journey: _journey,
                ),
              ),
              GoRoute(
                path: '/conversations/:conversationId',
                builder: (context, state) => _FamilyConversationScreen(
                  conversationId: state.pathParameters['conversationId']!,
                  interactions: interactions,
                  journey: _journey,
                  session: session,
                ),
              ),
            ],
"""
if message_route in production and conversation_routes not in production:
    production = production.replace(message_route, conversation_routes, 1)

if 'required this.interactionsAvailable,' not in production.split('class _FamilyJourneyView', 1)[0]:
    production = production.replace(
        "    required this.coordinator,\n    required this.journey,\n",
        "    required this.coordinator,\n"
        "    required this.interactionsAvailable,\n"
        "    required this.journey,\n",
        1,
    )
    production = production.replace(
        "  final MobileAppCoordinator coordinator;\n  final FamilyJourneyController journey;\n",
        "  final MobileAppCoordinator coordinator;\n"
        "  final bool interactionsAvailable;\n"
        "  final FamilyJourneyController journey;\n",
        1,
    )

old_nav_messages = """    if (session.can(SchoolCapability.messagesRead)) {
      paths.add('/messages');
      destinations.add(
        const SchoolDestination(
          icon: Icons.forum_outlined,
          label: 'Messages',
          selectedIcon: Icons.forum,
        ),
      );
    }
"""
new_nav_messages = """    if (interactionsAvailable &&
        (session.can(SchoolCapability.documentsRead) ||
            session.can(SchoolCapability.formsConsent))) {
      paths.add('/services');
      destinations.add(
        const SchoolDestination(
          icon: Icons.dashboard_customize_outlined,
          label: 'Services',
          selectedIcon: Icons.dashboard_customize,
        ),
      );
    }
    if (session.can(SchoolCapability.messagesRead)) {
      paths.add(interactionsAvailable ? '/conversations' : '/messages');
      destinations.add(
        SchoolDestination(
          icon: Icons.forum_outlined,
          label: interactionsAvailable ? 'Conversations' : 'Messages',
          selectedIcon: Icons.forum,
        ),
      );
    }
"""
if old_nav_messages in production:
    production = production.replace(old_nav_messages, new_nav_messages, 1)

if 'required this.interactionsAvailable,' not in production.split('class _FamilyAttendanceScreen', 1)[0].split('class _FamilyHomeScreen', 1)[1]:
    production = production.replace(
        "class _FamilyHomeScreen extends StatelessWidget {\n  const _FamilyHomeScreen({required this.journey, required this.session});\n\n  final FamilyJourneyController journey;\n",
        "class _FamilyHomeScreen extends StatelessWidget {\n"
        "  const _FamilyHomeScreen({\n"
        "    required this.interactionsAvailable,\n"
        "    required this.journey,\n"
        "    required this.session,\n"
        "  });\n\n"
        "  final bool interactionsAvailable;\n"
        "  final FamilyJourneyController journey;\n",
        1,
    )

home_messages = """      if (dashboard.messages != null) {
        addLink(
          Icons.forum_outlined,
          'Open messages',
          '/messages',
          '${dashboard.messages!.unreadCount} unread message(s)',
        );
      }
"""
home_interactions = """      if (interactionsAvailable &&
          (session.can(SchoolCapability.documentsRead) ||
              session.can(SchoolCapability.formsConsent))) {
        addLink(
          Icons.dashboard_customize_outlined,
          'Documents and forms',
          '/services',
          'Capability-scoped Family services',
        );
      }
      if (dashboard.messages != null) {
        addLink(
          Icons.forum_outlined,
          interactionsAvailable ? 'Open conversations' : 'Open messages',
          interactionsAvailable ? '/conversations' : '/messages',
          '${dashboard.messages!.unreadCount} unread message(s)',
        );
      }
"""
if home_messages in production:
    production = production.replace(home_messages, home_interactions, 1)

if '_interactions?.dispose();' not in production:
    production = production.replace(
        "  void dispose() {\n    _router.dispose();\n    _journey.dispose();\n",
        "  void dispose() {\n"
        "    _interactions?.dispose();\n"
        "    _router.dispose();\n"
        "    _journey.dispose();\n",
        1,
    )

production_path.write_text(production, encoding='utf-8')

print('Family interaction production UI checkpoint staged.')
