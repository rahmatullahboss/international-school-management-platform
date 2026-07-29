import 'dart:collection';

import 'package:school_mobile_core/mobile_core.dart';

enum FamilyDocumentClassification { general, personal, restricted }

enum FamilyDocumentCachePolicy { noStore, encryptedTemporary }

final class FamilyDocumentSummary {
  FamilyDocumentSummary({
    required this.cachePolicy,
    required this.classification,
    required DateTime issuedAt,
    required String documentId,
    required String fileName,
    required int sizeBytes,
    required String title,
  }) : documentId = _requiredInteraction(documentId, 'documentId'),
       fileName = _requiredInteraction(fileName, 'fileName'),
       issuedAt = issuedAt.toUtc(),
       sizeBytes = _nonNegativeInteraction(sizeBytes, 'sizeBytes'),
       title = _requiredInteraction(title, 'title') {
    if (classification == FamilyDocumentClassification.restricted &&
        cachePolicy != FamilyDocumentCachePolicy.noStore) {
      throw const FamilyInteractionException(
        'FAMILY_RESTRICTED_DOCUMENT_NO_STORE_REQUIRED',
      );
    }
  }

  final String documentId;
  final String title;
  final String fileName;
  final int sizeBytes;
  final DateTime issuedAt;
  final FamilyDocumentClassification classification;
  final FamilyDocumentCachePolicy cachePolicy;
}

final class FamilyDocumentPage {
  FamilyDocumentPage({
    required Iterable<FamilyDocumentSummary> documents,
    String? nextCursor,
  }) : documents = List<FamilyDocumentSummary>.unmodifiable(documents),
       nextCursor = _optionalInteraction(nextCursor, 'nextCursor') {
    _requireUniqueInteraction(
      this.documents.map((document) => document.documentId),
      'FAMILY_DOCUMENT_DUPLICATE',
    );
  }

  final List<FamilyDocumentSummary> documents;
  final String? nextCursor;
}

/// A server reference that can be exchanged by the native download service.
///
/// It intentionally contains no raw URL, bearer token or document bytes.
final class FamilyDocumentDownloadGrant {
  FamilyDocumentDownloadGrant({
    required String documentId,
    required DateTime expiresAt,
    required String grantId,
    required this.requiresStepUp,
    required this.singleUse,
  }) : documentId = _requiredInteraction(documentId, 'documentId'),
       expiresAt = expiresAt.toUtc(),
       grantId = _requiredInteraction(grantId, 'grantId');

  final String grantId;
  final String documentId;
  final DateTime expiresAt;
  final bool requiresStepUp;
  final bool singleUse;

  @override
  String toString() =>
      'FamilyDocumentDownloadGrant(documentId: $documentId, grantId: [REDACTED])';
}

enum FamilyFormStatus { open, submitted, closed }

enum FamilyFormFieldType { text, boolean, singleChoice, date }

final class FamilyFormSummary {
  FamilyFormSummary({
    required String formId,
    required this.status,
    required String title,
    DateTime? dueAt,
  }) : dueAt = dueAt?.toUtc(),
       formId = _requiredInteraction(formId, 'formId'),
       title = _requiredInteraction(title, 'title');

  final String formId;
  final String title;
  final FamilyFormStatus status;
  final DateTime? dueAt;
}

final class FamilyFormFieldDefinition {
  FamilyFormFieldDefinition({
    required String fieldId,
    required String label,
    required this.required,
    required this.type,
    Iterable<String> options = const <String>[],
  }) : fieldId = _identifierInteraction(fieldId, 'fieldId'),
       label = _requiredInteraction(label, 'label'),
       options = List<String>.unmodifiable(
         options.map((option) => _requiredInteraction(option, 'option')),
       ) {
    if (type == FamilyFormFieldType.singleChoice && this.options.isEmpty) {
      throw const FamilyInteractionException(
        'FAMILY_FORM_CHOICE_OPTIONS_REQUIRED',
      );
    }
    if (type != FamilyFormFieldType.singleChoice && this.options.isNotEmpty) {
      throw const FamilyInteractionException(
        'FAMILY_FORM_OPTIONS_NOT_ALLOWED',
      );
    }
    _requireUniqueInteraction(
      this.options,
      'FAMILY_FORM_OPTION_DUPLICATE',
    );
  }

  final String fieldId;
  final String label;
  final FamilyFormFieldType type;
  final bool required;
  final List<String> options;
}

final class FamilyFormDefinition {
  FamilyFormDefinition({
    required Iterable<FamilyFormFieldDefinition> fields,
    required String formId,
    required int schemaVersion,
    required FamilyFormStatus status,
    required String title,
    DateTime? dueAt,
  }) : dueAt = dueAt?.toUtc(),
       fields = List<FamilyFormFieldDefinition>.unmodifiable(fields),
       formId = _requiredInteraction(formId, 'formId'),
       schemaVersion = _positiveInteraction(schemaVersion, 'schemaVersion'),
       status = status,
       title = _requiredInteraction(title, 'title') {
    _requireUniqueInteraction(
      this.fields.map((field) => field.fieldId),
      'FAMILY_FORM_FIELD_DUPLICATE',
    );
  }

  final String formId;
  final String title;
  final FamilyFormStatus status;
  final DateTime? dueAt;
  final int schemaVersion;
  final List<FamilyFormFieldDefinition> fields;
}

final class FamilyFormSubmissionCommand {
  FamilyFormSubmissionCommand({
    required Map<String, Object?> answers,
    required int baseVersion,
    required String formId,
    required String idempotencyKey,
    required int schemaVersion,
    required String studentId,
  }) : answers = UnmodifiableMapView<String, Object?>(
         _validatedAnswers(answers),
       ),
       baseVersion = _nonNegativeInteraction(baseVersion, 'baseVersion'),
       formId = _requiredInteraction(formId, 'formId'),
       idempotencyKey = _requiredInteraction(
         idempotencyKey,
         'idempotencyKey',
       ),
       schemaVersion = _positiveInteraction(schemaVersion, 'schemaVersion'),
       studentId = _requiredInteraction(studentId, 'studentId');

  final String formId;
  final String studentId;
  final int schemaVersion;
  final int baseVersion;
  final String idempotencyKey;
  final Map<String, Object?> answers;
}

enum FamilyConsentStatus { pending, granted, declined, expired }

enum FamilyConsentDecision { grant, decline }

final class FamilyConsentRequest {
  FamilyConsentRequest({
    required String consentId,
    required String policyVersion,
    required this.status,
    required String studentId,
    required String title,
    DateTime? dueAt,
  }) : consentId = _requiredInteraction(consentId, 'consentId'),
       dueAt = dueAt?.toUtc(),
       policyVersion = _requiredInteraction(policyVersion, 'policyVersion'),
       studentId = _requiredInteraction(studentId, 'studentId'),
       title = _requiredInteraction(title, 'title');

  final String consentId;
  final String studentId;
  final String title;
  final String policyVersion;
  final FamilyConsentStatus status;
  final DateTime? dueAt;
}

final class FamilyConsentDecisionCommand {
  FamilyConsentDecisionCommand({
    required String consentId,
    required this.decision,
    required String idempotencyKey,
    required String policyVersion,
    required String studentId,
  }) : consentId = _requiredInteraction(consentId, 'consentId'),
       idempotencyKey = _requiredInteraction(
         idempotencyKey,
         'idempotencyKey',
       ),
       policyVersion = _requiredInteraction(policyVersion, 'policyVersion'),
       studentId = _requiredInteraction(studentId, 'studentId');

  final String consentId;
  final String studentId;
  final String policyVersion;
  final FamilyConsentDecision decision;
  final String idempotencyKey;

  void validateSession(SchoolSession session) {
    if (session.activePersona != SchoolPersona.guardian ||
        !session.can(SchoolCapability.formsConsent)) {
      throw const FamilyInteractionException(
        'FAMILY_GUARDIAN_CONSENT_CAPABILITY_REQUIRED',
      );
    }
  }
}

final class FamilyConversationSummary {
  FamilyConversationSummary({
    required String conversationId,
    required DateTime latestMessageAt,
    required String subject,
    required int unreadCount,
  }) : conversationId = _requiredInteraction(
         conversationId,
         'conversationId',
       ),
       latestMessageAt = latestMessageAt.toUtc(),
       subject = _requiredInteraction(subject, 'subject'),
       unreadCount = _nonNegativeInteraction(unreadCount, 'unreadCount');

  final String conversationId;
  final String subject;
  final int unreadCount;
  final DateTime latestMessageAt;
}

final class FamilyConversationPage {
  FamilyConversationPage({
    required Iterable<FamilyConversationSummary> conversations,
    String? nextCursor,
  }) : conversations = List<FamilyConversationSummary>.unmodifiable(
         conversations,
       ),
       nextCursor = _optionalInteraction(nextCursor, 'nextCursor') {
    _requireUniqueInteraction(
      this.conversations.map((conversation) => conversation.conversationId),
      'FAMILY_CONVERSATION_DUPLICATE',
    );
  }

  final List<FamilyConversationSummary> conversations;
  final String? nextCursor;
}

final class FamilyConversationMessage {
  FamilyConversationMessage({
    required String authorLabel,
    required String body,
    required String messageId,
    required DateTime sentAt,
  }) : authorLabel = _requiredInteraction(authorLabel, 'authorLabel'),
       body = _boundedMessage(body),
       messageId = _requiredInteraction(messageId, 'messageId'),
       sentAt = sentAt.toUtc();

  final String messageId;
  final String authorLabel;
  final String body;
  final DateTime sentAt;
}

final class FamilyConversationMessagePage {
  FamilyConversationMessagePage({
    required String conversationId,
    required Iterable<FamilyConversationMessage> messages,
    String? nextCursor,
  }) : conversationId = _requiredInteraction(
         conversationId,
         'conversationId',
       ),
       messages = List<FamilyConversationMessage>.unmodifiable(messages),
       nextCursor = _optionalInteraction(nextCursor, 'nextCursor') {
    _requireUniqueInteraction(
      this.messages.map((message) => message.messageId),
      'FAMILY_MESSAGE_DUPLICATE',
    );
  }

  final String conversationId;
  final List<FamilyConversationMessage> messages;
  final String? nextCursor;
}

final class FamilySendMessageCommand {
  FamilySendMessageCommand({
    required String body,
    required String conversationId,
    required String idempotencyKey,
  }) : body = _boundedMessage(body),
       conversationId = _requiredInteraction(
         conversationId,
         'conversationId',
       ),
       idempotencyKey = _requiredInteraction(
         idempotencyKey,
         'idempotencyKey',
       );

  final String conversationId;
  final String body;
  final String idempotencyKey;
}

final class FamilyInteractionException implements Exception {
  const FamilyInteractionException(this.code);

  final String code;

  @override
  String toString() => 'FamilyInteractionException($code)';
}

Map<String, Object?> _validatedAnswers(Map<String, Object?> source) {
  final validated = <String, Object?>{};
  for (final entry in source.entries) {
    final key = _identifierInteraction(entry.key, 'answerKey');
    validated[key] = _validatedAnswerValue(entry.value, key);
  }
  return validated;
}

Object? _validatedAnswerValue(Object? value, String path) {
  if (value == null || value is String || value is bool || value is num) {
    if (value is String && value.length > 4000) {
      throw FamilyInteractionException('FAMILY_FORM_ANSWER_TOO_LONG:$path');
    }
    return value;
  }
  if (value is List<Object?>) {
    if (value.length > 100) {
      throw FamilyInteractionException('FAMILY_FORM_ANSWER_LIST_TOO_LONG:$path');
    }
    return List<Object?>.unmodifiable(
      value.indexed.map(
        (entry) => _validatedAnswerValue(entry.$2, '$path[${entry.$1}]'),
      ),
    );
  }
  throw FamilyInteractionException('FAMILY_FORM_ANSWER_INVALID:$path');
}

String _boundedMessage(String value) {
  final normalized = value.trim();
  if (normalized.isEmpty || normalized.length > 4000) {
    throw const FamilyInteractionException('FAMILY_MESSAGE_BODY_INVALID');
  }
  return normalized;
}

String _identifierInteraction(String value, String field) {
  final normalized = _requiredInteraction(value, field);
  if (!RegExp(r'^[A-Za-z0-9_.-]{1,128}$').hasMatch(normalized)) {
    throw FamilyInteractionException('FAMILY_IDENTIFIER_INVALID:$field');
  }
  return normalized;
}

String _requiredInteraction(String value, String field) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw FamilyInteractionException('FAMILY_FIELD_REQUIRED:$field');
  }
  return normalized;
}

String? _optionalInteraction(String? value, String field) =>
    value == null ? null : _requiredInteraction(value, field);

int _nonNegativeInteraction(int value, String field) {
  if (value < 0) {
    throw FamilyInteractionException('FAMILY_FIELD_NEGATIVE:$field');
  }
  return value;
}

int _positiveInteraction(int value, String field) {
  if (value < 1) {
    throw FamilyInteractionException('FAMILY_FIELD_POSITIVE_REQUIRED:$field');
  }
  return value;
}

void _requireUniqueInteraction(Iterable<String> values, String code) {
  final list = values.toList(growable: false);
  if (list.toSet().length != list.length) {
    throw FamilyInteractionException(code);
  }
}
