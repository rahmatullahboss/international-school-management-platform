part of 'main.dart';

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
    FamilySecureDocumentExchange? secureDocumentExchange,
  }) : _clock = clock ?? DateTime.now,
       _repository = repository,
       _secureDocumentExchange = secureDocumentExchange,
       _session = session;

  FamilyInteractionRepository _repository;
  SchoolSession _session;
  final DateTime Function() _clock;
  final FamilySecureDocumentExchange? _secureDocumentExchange;
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
  bool documentOpening = false;
  SecureDocumentExchangeReceipt? documentReceipt;

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

  bool get secureDocumentExchangeAvailable => _secureDocumentExchange != null;

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
    documentReceipt = null;
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

  Future<void> openPreparedDocument() async {
    final exchange = _secureDocumentExchange;
    final grant = downloadGrant;
    final document = grant == null
        ? null
        : documents
              .where((item) => item.documentId == grant.documentId)
              .firstOrNull;
    if (exchange == null) {
      documentsReasonCode = 'FAMILY_SECURE_DOCUMENT_RUNTIME_REQUIRED';
      _safeNotify();
      return;
    }
    if (grant == null || document == null) {
      documentsReasonCode = 'FAMILY_DOCUMENT_GRANT_REQUIRED';
      _safeNotify();
      return;
    }
    final revision = _scopeRevision;
    documentOpening = true;
    documentReceipt = null;
    documentsReasonCode = null;
    _safeNotify();
    try {
      final receipt = await exchange.exchangeAndPresent(
        document: document,
        grant: grant,
        session: _session,
      );
      if (revision != _scopeRevision) return;
      documentReceipt = receipt;
      downloadGrant = null;
    } on Object catch (error) {
      if (revision != _scopeRevision) return;
      documentsReasonCode = _familyInteractionReason(error);
    }
    if (revision == _scopeRevision) {
      documentOpening = false;
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
          ? _mergeByIdentity(
              messages,
              page.messages,
              (message) => message.messageId,
            )
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
      messages = _mergeByIdentity(messages, <FamilyConversationMessage>[
        message,
      ], (item) => item.messageId);
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
    documentOpening = false;
    documentReceipt = null;
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
  SecureDocumentException(:final code) => code,
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
