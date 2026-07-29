import 'package:school_api_client/school_api_client.dart';
import 'package:school_family_domain/family_interactions.dart';
import 'package:school_mobile_core/mobile_core.dart';

final class FamilyInteractionApi {
  const FamilyInteractionApi(this._client);

  final SchoolApiClient _client;

  Future<FamilyDocumentPage> listDocuments({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  }) async {
    _requireCapability(session, SchoolCapability.documentsRead);
    final response = await _client.getJson(
      '${_studentPath(studentId)}/documents',
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
      queryParameters: _pageQuery(cursor, limit),
    );
    try {
      return FamilyDocumentPage(
        documents: _objectList(response, 'documents').map(_document),
        nextCursor: _optionalString(response, 'nextCursor'),
      );
    } on Object catch (error) {
      throw _invalidResponse('documents', error);
    }
  }

  Future<FamilyDocumentDownloadGrant> requestDocumentDownload({
    required String correlationId,
    required String documentId,
    required String idempotencyKey,
    required SchoolSession session,
  }) async {
    _requireCapability(session, SchoolCapability.documentsRead);
    final normalizedId = _requiredStringValue(documentId, 'documentId');
    final response = await _client.postJson(
      '/v1/mobile/family/documents/${Uri.encodeComponent(normalizedId)}/download-grants',
      body: const <String, Object?>{},
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
      idempotencyKey: idempotencyKey,
    );
    try {
      const forbiddenKeys = {
        'url',
        'downloadUrl',
        'accessToken',
        'authorization',
        'bearerToken',
      };
      if (response.keys.any(forbiddenKeys.contains)) {
        throw const FormatException('FAMILY_DOCUMENT_RAW_CREDENTIAL_FORBIDDEN');
      }
      final grant = FamilyDocumentDownloadGrant(
        documentId: _requiredString(response, 'documentId'),
        expiresAt: _dateTime(response, 'expiresAt'),
        grantId: _requiredString(response, 'grantId'),
        requiresStepUp: _requiredBool(response, 'requiresStepUp'),
        singleUse: _requiredBool(response, 'singleUse'),
      );
      if (grant.documentId != normalizedId) {
        throw const FormatException('FAMILY_DOCUMENT_GRANT_SCOPE_MISMATCH');
      }
      return grant;
    } on Object catch (error) {
      throw _invalidResponse('document-download-grant', error);
    }
  }

  Future<List<FamilyFormSummary>> listForms({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  }) async {
    _requireCapability(session, SchoolCapability.formsConsent);
    final response = await _client.getJson(
      '${_studentPath(studentId)}/forms',
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      final forms = _objectList(response, 'forms').map(_formSummary).toList(
        growable: false,
      );
      _requireUnique(forms.map((form) => form.formId), 'FAMILY_FORM_DUPLICATE');
      return List<FamilyFormSummary>.unmodifiable(forms);
    } on Object catch (error) {
      throw _invalidResponse('forms', error);
    }
  }

  Future<FamilyFormDefinition> loadForm({
    required String correlationId,
    required String formId,
    required SchoolSession session,
  }) async {
    _requireCapability(session, SchoolCapability.formsConsent);
    final normalizedId = _requiredStringValue(formId, 'formId');
    final response = await _client.getJson(
      '/v1/mobile/family/forms/${Uri.encodeComponent(normalizedId)}',
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      final definition = FamilyFormDefinition(
        dueAt: _optionalDateTime(response, 'dueAt'),
        fields: _objectList(response, 'fields').map(_formField),
        formId: _requiredString(response, 'formId'),
        schemaVersion: _requiredInt(response, 'schemaVersion'),
        status: _formStatus(_requiredString(response, 'status')),
        title: _requiredString(response, 'title'),
      );
      if (definition.formId != normalizedId) {
        throw const FormatException('FAMILY_FORM_SCOPE_MISMATCH');
      }
      return definition;
    } on Object catch (error) {
      throw _invalidResponse('form', error);
    }
  }

  Future<int> submitForm({
    required String correlationId,
    required FamilyFormSubmissionCommand command,
    required SchoolSession session,
  }) async {
    _requireCapability(session, SchoolCapability.formsConsent);
    final response = await _client.postJson(
      '/v1/mobile/family/forms/${Uri.encodeComponent(command.formId)}/submit',
      body: <String, Object?>{
        'studentId': command.studentId,
        'schemaVersion': command.schemaVersion,
        'baseVersion': command.baseVersion,
        'answers': command.answers,
      },
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
      idempotencyKey: command.idempotencyKey,
    );
    return _acceptedRevision(response, 'form-submission');
  }

  Future<List<FamilyConsentRequest>> listConsents({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
  }) async {
    _requireCapability(session, SchoolCapability.formsConsent);
    final response = await _client.getJson(
      '${_studentPath(studentId)}/consents',
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
    );
    try {
      final consents = _objectList(response, 'consents')
          .map(_consent)
          .toList(growable: false);
      _requireUnique(
        consents.map((consent) => consent.consentId),
        'FAMILY_CONSENT_DUPLICATE',
      );
      return List<FamilyConsentRequest>.unmodifiable(consents);
    } on Object catch (error) {
      throw _invalidResponse('consents', error);
    }
  }

  Future<int> decideConsent({
    required String correlationId,
    required FamilyConsentDecisionCommand command,
    required SchoolSession session,
  }) async {
    command.validateSession(session);
    final response = await _client.postJson(
      '/v1/mobile/family/consents/${Uri.encodeComponent(command.consentId)}/decisions',
      body: <String, Object?>{
        'studentId': command.studentId,
        'policyVersion': command.policyVersion,
        'decision': command.decision.name,
      },
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
      idempotencyKey: command.idempotencyKey,
    );
    return _acceptedRevision(response, 'consent-decision');
  }

  Future<FamilyConversationPage> listConversations({
    required String correlationId,
    required SchoolSession session,
    required String studentId,
    String? cursor,
    int limit = 25,
  }) async {
    _requireCapability(session, SchoolCapability.messagesRead);
    final response = await _client.getJson(
      '${_studentPath(studentId)}/conversations',
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
      queryParameters: _pageQuery(cursor, limit),
    );
    try {
      return FamilyConversationPage(
        conversations: _objectList(
          response,
          'conversations',
        ).map(_conversation),
        nextCursor: _optionalString(response, 'nextCursor'),
      );
    } on Object catch (error) {
      throw _invalidResponse('conversations', error);
    }
  }

  Future<FamilyConversationMessagePage> listMessages({
    required String correlationId,
    required String conversationId,
    required SchoolSession session,
    String? cursor,
    int limit = 50,
  }) async {
    _requireCapability(session, SchoolCapability.messagesRead);
    final normalizedId = _requiredStringValue(
      conversationId,
      'conversationId',
    );
    final response = await _client.getJson(
      '/v1/mobile/family/conversations/${Uri.encodeComponent(normalizedId)}/messages',
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
      queryParameters: _pageQuery(cursor, limit),
    );
    try {
      final page = FamilyConversationMessagePage(
        conversationId: _requiredString(response, 'conversationId'),
        messages: _objectList(response, 'messages').map(_message),
        nextCursor: _optionalString(response, 'nextCursor'),
      );
      if (page.conversationId != normalizedId) {
        throw const FormatException('FAMILY_CONVERSATION_SCOPE_MISMATCH');
      }
      return page;
    } on Object catch (error) {
      throw _invalidResponse('conversation-messages', error);
    }
  }

  Future<FamilyConversationMessage> sendMessage({
    required String correlationId,
    required FamilySendMessageCommand command,
    required SchoolSession session,
  }) async {
    _requireCapability(session, SchoolCapability.messagesSend);
    final response = await _client.postJson(
      '/v1/mobile/family/conversations/${Uri.encodeComponent(command.conversationId)}/messages',
      body: <String, Object?>{'body': command.body},
      context: ApiRequestContext(
        correlationId: correlationId,
        session: session,
      ),
      idempotencyKey: command.idempotencyKey,
    );
    try {
      return _message(response);
    } on Object catch (error) {
      throw _invalidResponse('sent-message', error);
    }
  }

  String _studentPath(String studentId) =>
      '/v1/mobile/family/students/${Uri.encodeComponent(_requiredStringValue(studentId, 'studentId'))}';

  Map<String, String> _pageQuery(String? cursor, int limit) {
    if (limit < 1 || limit > 100) {
      throw const FamilyInteractionException('FAMILY_PAGE_LIMIT_INVALID');
    }
    return <String, String>{
      'limit': '$limit',
      if (cursor != null && cursor.trim().isNotEmpty) 'cursor': cursor.trim(),
    };
  }

  void _requireCapability(SchoolSession session, String capability) {
    if (session.activePersona != SchoolPersona.guardian &&
        session.activePersona != SchoolPersona.student) {
      throw const FamilyInteractionException('FAMILY_PERSONA_REQUIRED');
    }
    if (!session.can(capability)) {
      throw FamilyInteractionException(
        'FAMILY_CAPABILITY_REQUIRED:$capability',
      );
    }
  }

  FamilyDocumentSummary _document(Map<String, Object?> json) =>
      FamilyDocumentSummary(
        cachePolicy: _documentCachePolicy(
          _requiredString(json, 'cachePolicy'),
        ),
        classification: _documentClassification(
          _requiredString(json, 'classification'),
        ),
        documentId: _requiredString(json, 'documentId'),
        fileName: _requiredString(json, 'fileName'),
        issuedAt: _dateTime(json, 'issuedAt'),
        sizeBytes: _requiredInt(json, 'sizeBytes'),
        title: _requiredString(json, 'title'),
      );

  FamilyFormSummary _formSummary(Map<String, Object?> json) =>
      FamilyFormSummary(
        dueAt: _optionalDateTime(json, 'dueAt'),
        formId: _requiredString(json, 'formId'),
        status: _formStatus(_requiredString(json, 'status')),
        title: _requiredString(json, 'title'),
      );

  FamilyFormFieldDefinition _formField(Map<String, Object?> json) =>
      FamilyFormFieldDefinition(
        fieldId: _requiredString(json, 'fieldId'),
        label: _requiredString(json, 'label'),
        options: _stringList(json, 'options'),
        required: _requiredBool(json, 'required'),
        type: _formFieldType(_requiredString(json, 'type')),
      );

  FamilyConsentRequest _consent(Map<String, Object?> json) =>
      FamilyConsentRequest(
        consentId: _requiredString(json, 'consentId'),
        dueAt: _optionalDateTime(json, 'dueAt'),
        policyVersion: _requiredString(json, 'policyVersion'),
        status: _consentStatus(_requiredString(json, 'status')),
        studentId: _requiredString(json, 'studentId'),
        title: _requiredString(json, 'title'),
      );

  FamilyConversationSummary _conversation(Map<String, Object?> json) =>
      FamilyConversationSummary(
        conversationId: _requiredString(json, 'conversationId'),
        latestMessageAt: _dateTime(json, 'latestMessageAt'),
        subject: _requiredString(json, 'subject'),
        unreadCount: _requiredInt(json, 'unreadCount'),
      );

  FamilyConversationMessage _message(Map<String, Object?> json) =>
      FamilyConversationMessage(
        authorLabel: _requiredString(json, 'authorLabel'),
        body: _requiredString(json, 'body'),
        messageId: _requiredString(json, 'messageId'),
        sentAt: _dateTime(json, 'sentAt'),
      );

  FamilyDocumentClassification _documentClassification(String value) =>
      switch (value) {
        'general' => FamilyDocumentClassification.general,
        'personal' => FamilyDocumentClassification.personal,
        'restricted' => FamilyDocumentClassification.restricted,
        _ => throw const FormatException(
          'FAMILY_DOCUMENT_CLASSIFICATION_UNKNOWN',
        ),
      };

  FamilyDocumentCachePolicy _documentCachePolicy(String value) =>
      switch (value) {
        'noStore' => FamilyDocumentCachePolicy.noStore,
        'encryptedTemporary' => FamilyDocumentCachePolicy.encryptedTemporary,
        _ => throw const FormatException('FAMILY_DOCUMENT_CACHE_POLICY_UNKNOWN'),
      };

  FamilyFormStatus _formStatus(String value) => switch (value) {
    'open' => FamilyFormStatus.open,
    'submitted' => FamilyFormStatus.submitted,
    'closed' => FamilyFormStatus.closed,
    _ => throw const FormatException('FAMILY_FORM_STATUS_UNKNOWN'),
  };

  FamilyFormFieldType _formFieldType(String value) => switch (value) {
    'text' => FamilyFormFieldType.text,
    'boolean' => FamilyFormFieldType.boolean,
    'singleChoice' => FamilyFormFieldType.singleChoice,
    'date' => FamilyFormFieldType.date,
    _ => throw const FormatException('FAMILY_FORM_FIELD_TYPE_UNKNOWN'),
  };

  FamilyConsentStatus _consentStatus(String value) => switch (value) {
    'pending' => FamilyConsentStatus.pending,
    'granted' => FamilyConsentStatus.granted,
    'declined' => FamilyConsentStatus.declined,
    'expired' => FamilyConsentStatus.expired,
    _ => throw const FormatException('FAMILY_CONSENT_STATUS_UNKNOWN'),
  };

  int _acceptedRevision(Map<String, Object?> response, String workflow) {
    try {
      final revision = _requiredInt(response, 'acceptedRevision');
      if (revision < 1) {
        throw const FormatException('FAMILY_ACCEPTED_REVISION_INVALID');
      }
      return revision;
    } on Object catch (error) {
      throw _invalidResponse(workflow, error);
    }
  }

  SchoolApiException _invalidResponse(String workflow, Object error) =>
      SchoolApiException(
        code: 'INVALID_FAMILY_INTERACTION_RESPONSE',
        message: 'The $workflow response failed validation.',
      );
}

Map<String, Object?> _requiredObject(
  Map<String, Object?> json,
  String key,
) {
  final value = json[key];
  if (value is! Map<String, Object?>) {
    throw FormatException('FAMILY_OBJECT_REQUIRED:$key');
  }
  return value;
}

List<Map<String, Object?>> _objectList(
  Map<String, Object?> json,
  String key,
) {
  final value = json[key];
  if (value is! List<Object?>) {
    throw FormatException('FAMILY_LIST_REQUIRED:$key');
  }
  return value
      .map((item) {
        if (item is! Map<String, Object?>) {
          throw FormatException('FAMILY_LIST_OBJECT_REQUIRED:$key');
        }
        return item;
      })
      .toList(growable: false);
}

List<String> _stringList(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! List<Object?>) {
    throw FormatException('FAMILY_STRING_LIST_REQUIRED:$key');
  }
  return value.map((item) {
    if (item is! String || item.trim().isEmpty) {
      throw FormatException('FAMILY_STRING_LIST_VALUE_INVALID:$key');
    }
    return item.trim();
  }).toList(growable: false);
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('FAMILY_STRING_REQUIRED:$key');
  }
  return value.trim();
}

String _requiredStringValue(String value, String key) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw FamilyInteractionException('FAMILY_FIELD_REQUIRED:$key');
  }
  return normalized;
}

String? _optionalString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('FAMILY_STRING_INVALID:$key');
  }
  return value.trim();
}

int _requiredInt(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! int) {
    throw FormatException('FAMILY_INTEGER_REQUIRED:$key');
  }
  return value;
}

bool _requiredBool(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! bool) {
    throw FormatException('FAMILY_BOOLEAN_REQUIRED:$key');
  }
  return value;
}

DateTime _dateTime(Map<String, Object?> json, String key) =>
    DateTime.parse(_requiredString(json, key)).toUtc();

DateTime? _optionalDateTime(Map<String, Object?> json, String key) {
  final value = _optionalString(json, key);
  return value == null ? null : DateTime.parse(value).toUtc();
}

void _requireUnique(Iterable<String> values, String code) {
  final list = values.toList(growable: false);
  if (list.toSet().length != list.length) {
    throw FamilyInteractionException(code);
  }
}
