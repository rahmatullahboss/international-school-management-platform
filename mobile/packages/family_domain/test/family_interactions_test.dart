import 'package:school_family_domain/family_interactions.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:test/test.dart';

void main() {
  test('restricted documents require no-store handling', () {
    expect(
      () => FamilyDocumentSummary(
        cachePolicy: FamilyDocumentCachePolicy.encryptedTemporary,
        classification: FamilyDocumentClassification.restricted,
        documentId: 'document-1',
        fileName: 'report.pdf',
        issuedAt: DateTime.utc(2026, 7, 30),
        sizeBytes: 1024,
        title: 'Confidential report',
      ),
      throwsA(
        isA<FamilyInteractionException>().having(
          (error) => error.code,
          'code',
          'FAMILY_RESTRICTED_DOCUMENT_NO_STORE_REQUIRED',
        ),
      ),
    );
  });

  test('download grants do not expose transport credentials in diagnostics', () {
    final grant = FamilyDocumentDownloadGrant(
      documentId: 'document-1',
      expiresAt: DateTime.utc(2026, 7, 30, 2),
      grantId: 'opaque-download-reference',
      requiresStepUp: true,
      singleUse: true,
    );

    expect(grant.toString(), isNot(contains('opaque-download-reference')));
    expect(grant.toString(), contains('[REDACTED]'));
  });

  test('form definitions enforce schema and choice invariants', () {
    final definition = FamilyFormDefinition(
      fields: [
        FamilyFormFieldDefinition(
          fieldId: 'transport.mode',
          label: 'Preferred transport',
          options: const ['School bus', 'Private'],
          required: true,
          type: FamilyFormFieldType.singleChoice,
        ),
      ],
      formId: 'form-1',
      schemaVersion: 3,
      status: FamilyFormStatus.open,
      title: 'Transport form',
    );

    expect(definition.schemaVersion, 3);
    expect(definition.fields.single.options, hasLength(2));
    expect(
      () => FamilyFormFieldDefinition(
        fieldId: 'transport.mode',
        label: 'Preferred transport',
        required: true,
        type: FamilyFormFieldType.singleChoice,
      ),
      throwsA(
        isA<FamilyInteractionException>().having(
          (error) => error.code,
          'code',
          'FAMILY_FORM_CHOICE_OPTIONS_REQUIRED',
        ),
      ),
    );
  });

  test('form submissions copy and validate bounded JSON-like answers', () {
    final source = <String, Object?>{
      'transport.mode': 'School bus',
      'medical.confirmed': true,
      'pickup.days': <Object?>['Sunday', 'Monday'],
    };
    final command = FamilyFormSubmissionCommand(
      answers: source,
      baseVersion: 2,
      formId: 'form-1',
      idempotencyKey: 'form-1-student-1-version-2',
      schemaVersion: 3,
      studentId: 'student-1',
    );
    source['transport.mode'] = 'Private';

    expect(command.answers['transport.mode'], 'School bus');
    expect(
      () => command.answers['new.field'] = 'value',
      throwsUnsupportedError,
    );
    expect(
      () => FamilyFormSubmissionCommand(
        answers: <String, Object?>{'unsafe': <String, Object?>{'nested': true}},
        baseVersion: 0,
        formId: 'form-1',
        idempotencyKey: 'form-1-invalid',
        schemaVersion: 1,
        studentId: 'student-1',
      ),
      throwsA(
        isA<FamilyInteractionException>().having(
          (error) => error.code,
          'code',
          startsWith('FAMILY_FORM_ANSWER_INVALID:'),
        ),
      ),
    );
  });

  test('consent decisions require guardian consent capability', () {
    final command = FamilyConsentDecisionCommand(
      consentId: 'consent-1',
      decision: FamilyConsentDecision.grant,
      idempotencyKey: 'consent-1-policy-3-grant',
      policyVersion: 'policy-3',
      studentId: 'student-1',
    );
    final guardian = session(
      persona: SchoolPersona.guardian,
      capabilities: const {SchoolCapability.formsConsent},
    );
    final student = session(
      persona: SchoolPersona.student,
      capabilities: const {SchoolCapability.formsConsent},
    );

    expect(() => command.validateSession(guardian), returnsNormally);
    expect(
      () => command.validateSession(student),
      throwsA(
        isA<FamilyInteractionException>().having(
          (error) => error.code,
          'code',
          'FAMILY_GUARDIAN_CONSENT_CAPABILITY_REQUIRED',
        ),
      ),
    );
  });

  test('conversation pages reject duplicates and message bodies are bounded', () {
    expect(
      () => FamilyConversationPage(
        conversations: [
          FamilyConversationSummary(
            conversationId: 'conversation-1',
            latestMessageAt: DateTime.utc(2026, 7, 30),
            subject: 'Class update',
            unreadCount: 1,
          ),
          FamilyConversationSummary(
            conversationId: 'conversation-1',
            latestMessageAt: DateTime.utc(2026, 7, 30),
            subject: 'Duplicate',
            unreadCount: 0,
          ),
        ],
      ),
      throwsA(
        isA<FamilyInteractionException>().having(
          (error) => error.code,
          'code',
          'FAMILY_CONVERSATION_DUPLICATE',
        ),
      ),
    );
    expect(
      () => FamilySendMessageCommand(
        body: '   ',
        conversationId: 'conversation-1',
        idempotencyKey: 'message-1',
      ),
      throwsA(
        isA<FamilyInteractionException>().having(
          (error) => error.code,
          'code',
          'FAMILY_MESSAGE_BODY_INVALID',
        ),
      ),
    );
  });
}

SchoolSession session({
  required SchoolPersona persona,
  required Set<String> capabilities,
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
