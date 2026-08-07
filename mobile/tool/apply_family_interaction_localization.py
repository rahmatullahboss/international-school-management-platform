from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    return text.replace(old, new)


# Wire the app-owned interaction catalog into the part library.
main_path = Path('mobile/apps/family_app/lib/main.dart')
main = main_path.read_text()
interaction_import = "import 'package:school_family_app/family_interaction_strings.dart';\n"
if interaction_import not in main:
    anchor = "import 'package:school_family_app/family_production_strings.dart';\n"
    main = replace_once(main, anchor, interaction_import + anchor, 'family interaction import')
    main_path.write_text(main)

# Complete the catalog fields and remove the discarded instance-only label helper.
catalog_path = Path('mobile/apps/family_app/lib/family_interaction_strings.dart')
catalog = catalog_path.read_text()
for anchor, insertion, label in [
    (
        '    required this.documentsMetadataOnlyDescription,\n',
        '    required this.documentsMetadataOnlyDescription,\n    required this.documentsServiceDescription,\n',
        'documents service ctor',
    ),
    (
        '    required this.formsVersionDescription,\n',
        '    required this.formsVersionDescription,\n    required this.formsServiceDescription,\n',
        'forms service ctor',
    ),
    (
        '    required this.formUnavailable,\n',
        '    required this.formUnavailable,\n    required this.familyProfileUnavailable,\n',
        'profile ctor',
    ),
]:
    catalog = replace_once(catalog, anchor, insertion, label)

locale_insertions = {
    "          documentsMetadataOnlyDescription:\n              'শুধু মেটাডেটা দেখানো হয়। সীমিত ফাইল নো-স্টোর থাকে এবং কাঁচা ডাউনলোড ক্রেডেনশিয়াল কখনো দেখানো হয় না।',\n":
        "          documentsMetadataOnlyDescription:\n              'শুধু মেটাডেটা দেখানো হয়। সীমিত ফাইল নো-স্টোর থাকে এবং কাঁচা ডাউনলোড ক্রেডেনশিয়াল কখনো দেখানো হয় না।',\n          documentsServiceDescription:\n              'মেটাডেটা পর্যালোচনা করুন এবং স্বল্পমেয়াদি নিরাপদ ডাউনলোড গ্র্যান্ট প্রস্তুত করুন।',\n",
    "          formsVersionDescription:\n              'জমা দেওয়ার সময় সার্ভার-প্রদত্ত বেস ও স্কিমা ভার্সন ব্যবহার করা হয়। ক্লায়েন্ট নতুন কোনো রিভিশন অনুমান করে না।',\n":
        "          formsVersionDescription:\n              'জমা দেওয়ার সময় সার্ভার-প্রদত্ত বেস ও স্কিমা ভার্সন ব্যবহার করা হয়। ক্লায়েন্ট নতুন কোনো রিভিশন অনুমান করে না।',\n          formsServiceDescription:\n              'ক্লায়েন্টে কর্তৃত্ব না এনে সার্ভার-ভার্সনকৃত ফর্ম পূরণ করুন।',\n",
    "          formUnavailable: 'ফর্ম পাওয়া যাচ্ছে না',\n":
        "          formUnavailable: 'ফর্ম পাওয়া যাচ্ছে না',\n          familyProfileUnavailable: 'ফ্যামিলি প্রোফাইল পাওয়া যাচ্ছে না',\n",
    "          documentsMetadataOnlyDescription:\n              'تُعرض البيانات الوصفية فقط. تبقى الملفات المقيدة بلا تخزين ولا تُعرض بيانات اعتماد التنزيل الخام.',\n":
        "          documentsMetadataOnlyDescription:\n              'تُعرض البيانات الوصفية فقط. تبقى الملفات المقيدة بلا تخزين ولا تُعرض بيانات اعتماد التنزيل الخام.',\n          documentsServiceDescription:\n              'راجع البيانات الوصفية وجهّز منح تنزيل آمنة قصيرة الأجل.',\n",
    "          formsVersionDescription:\n              'يستخدم الإرسال إصداري الأساس والمخطط الصادرين من الخادم. لا يستنتج العميل مراجعة أحدث.',\n":
        "          formsVersionDescription:\n              'يستخدم الإرسال إصداري الأساس والمخطط الصادرين من الخادم. لا يستنتج العميل مراجعة أحدث.',\n          formsServiceDescription:\n              'أكمل النماذج ذات الإصدارات الخادمة دون نقل السلطة إلى العميل.',\n",
    "          formUnavailable: 'النموذج غير متاح',\n":
        "          formUnavailable: 'النموذج غير متاح',\n          familyProfileUnavailable: 'ملف العائلة غير متاح',\n",
    "          documentsMetadataOnlyDescription:\n              'Only metadata is shown. Restricted files remain no-store and raw download credentials are never exposed.',\n":
        "          documentsMetadataOnlyDescription:\n              'Only metadata is shown. Restricted files remain no-store and raw download credentials are never exposed.',\n          documentsServiceDescription:\n              'Review metadata and prepare short-lived secure download grants.',\n",
    "          formsVersionDescription:\n              'Submission uses the server-issued base and schema versions. The client does not infer a newer revision.',\n":
        "          formsVersionDescription:\n              'Submission uses the server-issued base and schema versions. The client does not infer a newer revision.',\n          formsServiceDescription:\n              'Complete server-versioned forms without client-side authority.',\n",
    "          formUnavailable: 'Form unavailable',\n":
        "          formUnavailable: 'Form unavailable',\n          familyProfileUnavailable: 'Family profile unavailable',\n",
}
for old, new in locale_insertions.items():
    catalog = replace_once(catalog, old, new, 'catalog locale field')

for anchor, insertion, label in [
    (
        '  final String documentsMetadataOnlyDescription;\n',
        '  final String documentsMetadataOnlyDescription;\n  final String documentsServiceDescription;\n',
        'documents service final',
    ),
    (
        '  final String formsVersionDescription;\n',
        '  final String formsVersionDescription;\n  final String formsServiceDescription;\n',
        'forms service final',
    ),
    (
        '  final String formUnavailable;\n',
        '  final String formUnavailable;\n  final String familyProfileUnavailable;\n',
        'profile final',
    ),
]:
    catalog = replace_once(catalog, anchor, insertion, label)

catalog, removed = re.subn(
    r"\n  String documentClassification\(FamilyDocumentClassification value\) =>\n      switch \(SchoolLocalePolicy\.resolve\(_localeForStrings\(this\)\)\) \{\n        _ => throw StateError\('unreachable'\),\n      \};\n",
    '\n',
    catalog,
)
if removed not in (0, 1):
    raise SystemExit(f'instance document classification removal drifted: {removed}')
catalog, removed_helper = re.subn(
    r"\nLocale _localeForStrings\(FamilyInteractionStrings strings\) =>\n    throw UnsupportedError\('Use the locale-aware static label helpers\.'\);\n?",
    '\n',
    catalog,
)
if removed_helper not in (0, 1):
    raise SystemExit(f'catalog helper removal drifted: {removed_helper}')
catalog_path.write_text(catalog)

path = Path('mobile/apps/family_app/lib/family_interaction_screens.dart')
text = path.read_text()

# Services landing.
text = replace_once(
    text,
    """    builder: (context, directory) {
      final services = <Widget>[];""",
    """    builder: (context, directory) {
      final strings = FamilyInteractionStrings.forLocale(
        Localizations.localeOf(context),
      );
      final services = <Widget>[];""",
    'services strings',
)
for old, new, label in [
    ("          'Documents',", '          strings.documents,', 'services documents'),
    ("          'Review metadata and prepare short-lived secure download grants.',", '          strings.documentsServiceDescription,', 'services documents description'),
    ("          'Forms',", '          strings.forms,', 'services forms'),
    ("          'Complete server-versioned forms without client-side authority.',", '          strings.formsServiceDescription,', 'services forms description'),
    ("            'Guardian consent',", '            strings.guardianConsent,', 'services consent'),
    ("            'Review policy versions and submit explicit decisions.',", '            strings.guardianConsentDescription,', 'services consent description'),
    ("            title: 'Documents and forms',", '            title: strings.documentsAndForms,', 'services page title'),
    ("                  ? const Text('No interaction services are authorized.')", '                  ? Text(strings.noInteractionServicesAuthorized)', 'services empty'),
]:
    text = replace_once(text, old, new, label)
text = replace_once(
    text,
    """            description:
                '${directory.activeStudent.displayName} · capability-scoped services',""",
    """            description:
                '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · '
                '${strings.capabilityScopedServices}',""",
    'services page description',
)

# Documents.
text = replace_once(
    text,
    """        builder: (context, _) {
          if (interactions.documentsPhase == FamilyInteractionPhase.loading &&""",
    """        builder: (context, _) {
          final locale = Localizations.localeOf(context);
          final strings = FamilyInteractionStrings.forLocale(locale);
          if (interactions.documentsPhase == FamilyInteractionPhase.loading &&""",
    'documents strings',
)
text = replace_once(text, "              title: 'Documents unavailable',", '              title: strings.documentsUnavailable,', 'documents unavailable')
text = replace_once(
    text,
    """                description:
                    '${countCopy.documentsAvailable(interactions.documents.length)} · '
                    'Only metadata is shown. Restricted files remain no-store and raw download credentials are never exposed.',
                title: '${directory.activeStudent.displayName} documents',""",
    """                description:
                    '${countCopy.documentsAvailable(interactions.documents.length)} · '
                    '${strings.documentsMetadataOnlyDescription}',
                title:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.documents}',""",
    'documents page',
)
for old, new, label in [
    ("                          label: 'Document action failed',", '                          label: strings.documentActionFailed,', 'document action failed'),
    ("                              ? 'Additional verification required'", '                              ? strings.additionalVerificationRequired', 'document verify label'),
    ("                              : 'Secure grant prepared',", '                              : strings.secureGrantPrepared,', 'document grant label'),
    ("                                ? 'Verify and open securely'", '                                ? strings.verifyAndOpenSecurely', 'verify open'),
    ("                                : 'Open securely',", '                                : strings.openSecurely,', 'open securely'),
    ("                              'Secure document presentation is not configured on this build.',", '                              strings.securePresentationNotConfigured,', 'secure presenter unavailable'),
    ("                          label: 'Document closed securely',", '                          label: strings.documentClosedSecurely,', 'document closed label'),
    ("                              'The verified document was presented from a no-store lease and the temporary bytes were deleted.',", '                              strings.documentClosedSecurelyMessage,', 'document closed message'),
    ("                          'No authorized document metadata is available.',", '                          strings.noAuthorizedDocumentMetadata,', 'no documents'),
    ("                          label: const Text('Load more documents'),", '                          label: Text(strings.loadMoreDocuments),', 'load docs'),
]:
    text = replace_once(text, old, new, label)
text = replace_once(
    text,
    """                          message:
                              'The short-lived ${interactions.downloadGrant!.singleUse ? 'single-use ' : ''}grant expires ${_familyDateTimeLabel(context, interactions.downloadGrant!.expiresAt)}. No URL or credential is shown.',""",
    """                          message: FamilyInteractionStrings.grantExpiryFor(
                            locale,
                            _familyDateTimeLabel(
                              context,
                              interactions.downloadGrant!.expiresAt,
                            ),
                            singleUse: interactions.downloadGrant!.singleUse,
                          ),""",
    'document grant expiry',
)

# Document tile: localize metadata labels and isolate dynamic values.
text = replace_once(
    text,
    """  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,""",
    """  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final strings = FamilyInteractionStrings.forLocale(locale);
    return ListTile(
      contentPadding: EdgeInsets.zero,""",
    'document tile build',
)
text = replace_once(text, '    title: Text(document.title),', '      title: Text(SchoolBidirectionalText.isolate(document.title)),', 'document title isolate')
text = replace_once(
    text,
    """    subtitle: Text(
      '${document.fileName} · ${_fileSizeLabel(document.sizeBytes)} · issued ${_familyDateLabel(context, document.issuedAt)}\n${document.classification.name} · ${document.cachePolicy.name}',
    ),""",
    """      subtitle: Text(
        '${SchoolBidirectionalText.isolate(document.fileName)} · '
        '${_fileSizeLabel(document.sizeBytes)} · '
        '${FamilyInteractionStrings.issuedFor(locale, _familyDateLabel(context, document.issuedAt))}\n'
        '${FamilyInteractionStrings.documentClassificationFor(locale, document.classification)} · '
        '${FamilyInteractionStrings.cachePolicyFor(locale, document.cachePolicy)}',
      ),""",
    'document subtitle',
)
text = replace_once(text, "            tooltip: 'Prepare secure download',", '            tooltip: strings.prepareSecureDownload,', 'document tooltip')
text = replace_once(
    text,
    """            tooltip: strings.prepareSecureDownload,
          ),
  );
}""",
    """            tooltip: strings.prepareSecureDownload,
          ),
    );
  }
}""",
    'document tile close',
)

# Forms list.
text = replace_once(
    text,
    """        builder: (context, _) {
          if (interactions.formsPhase == FamilyInteractionPhase.loading &&""",
    """        builder: (context, _) {
          final locale = Localizations.localeOf(context);
          final strings = FamilyInteractionStrings.forLocale(locale);
          if (interactions.formsPhase == FamilyInteractionPhase.loading &&""",
    'forms strings',
)
text = replace_once(text, "              title: 'Forms unavailable',", '              title: strings.formsUnavailable,', 'forms unavailable')
text = replace_once(
    text,
    """                description:
                    '${countCopy.formsAwaitingResponse(openFormCount)} · '
                    'Submission uses the server-issued base and schema versions. The client does not infer a newer revision.',
                title: '${directory.activeStudent.displayName} forms',""",
    """                description:
                    '${countCopy.formsAwaitingResponse(openFormCount)} · '
                    '${strings.formsVersionDescription}',
                title:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.forms}',""",
    'forms page',
)
text = replace_once(text, "                      ? const Text('No forms are available for this profile.')", '                      ? Text(strings.noForms)', 'forms empty')
text = replace_once(
    text,
    """                                subtitle: Text(
                                  '${interactions.forms[index].status.name}${interactions.forms[index].dueAt == null ? '' : ' · due ${_familyDateLabel(context, interactions.forms[index].dueAt!)}'}',
                                ),
                                title: Text(interactions.forms[index].title),""",
    """                                subtitle: Text(
                                  '${FamilyInteractionStrings.formStatusFor(locale, interactions.forms[index].status)}'
                                  '${interactions.forms[index].dueAt == null ? '' : ' · ${FamilyInteractionStrings.dueFor(locale, _familyDateLabel(context, interactions.forms[index].dueAt!))}'}',
                                ),
                                title: Text(
                                  SchoolBidirectionalText.isolate(
                                    interactions.forms[index].title,
                                  ),
                                ),""",
    'form list item',
)

# Form detail.
text = replace_once(
    text,
    """        builder: (context, _) {
          final active = interactions.activeForm;""",
    """        builder: (context, _) {
          final locale = Localizations.localeOf(context);
          final strings = FamilyInteractionStrings.forLocale(locale);
          final active = interactions.activeForm;""",
    'form detail strings',
)
text = replace_once(text, "              title: 'Form unavailable',", '              title: strings.formUnavailable,', 'form unavailable')
text = replace_once(
    text,
    """                description:
                    'Base version ${active.baseVersion} · schema ${active.schemaVersion} · ${directory.activeStudent.displayName}',
                title: active.title,""",
    """                description: FamilyInteractionStrings.formDefinitionFor(
                  locale,
                  baseVersion: active.baseVersion,
                  schemaVersion: active.schemaVersion,
                  isolatedStudentName: SchoolBidirectionalText.isolate(
                    directory.activeStudent.displayName,
                  ),
                ),
                title: SchoolBidirectionalText.isolate(active.title),""",
    'form definition',
)
for old, new, label in [
    ("                          label: 'Form not submitted',", '                          label: strings.formNotSubmitted,', 'form failed label'),
    ("                          message: interactions.formReasonCode!,", '                          message: SchoolBidirectionalText.isolate(interactions.formReasonCode!),', 'form reason isolate'),
    ("                          label: 'Submission accepted',", '                          label: strings.submissionAccepted,', 'form accepted label'),
    ("                        label: const Text('Submit form'),", '                        label: Text(strings.submitForm),', 'submit form'),
]:
    text = replace_once(text, old, new, label)
text = replace_once(
    text,
    """                          message:
                              'The server accepted revision ${interactions.formAcceptedRevision}.',""",
    """                          message: FamilyInteractionStrings.acceptedRevisionFor(
                            locale,
                            interactions.formAcceptedRevision!,
                          ),""",
    'form accepted revision',
)

# Form field labels/options: keep raw values as command values, isolate presentation only.
text = replace_once(
    text,
    """  @override
  Widget build(BuildContext context) => switch (field.type) {""",
    """  @override
  Widget build(BuildContext context) {
    final displayLabel = SchoolBidirectionalText.isolate(field.label);
    return switch (field.type) {""",
    'form field build',
)
text = text.replace("labelText: '${field.label}${field.required ? ' *' : ''}',", "labelText: '$displayLabel${field.required ? ' *' : ''}',")
text = text.replace("title: Text('${field.label}${field.required ? ' *' : ''}'),", "title: Text('$displayLabel${field.required ? ' *' : ''}'),")
text = replace_once(text, '.map((option) => DropdownMenuItem(value: option, child: Text(option)))', '.map(\n            (option) => DropdownMenuItem(\n              value: option,\n              child: Text(SchoolBidirectionalText.isolate(option)),\n            ),\n          )', 'form option isolate')
text = replace_once(text, "      label: '${field.label}${field.required ? ' *' : ''}',", "      label: '$displayLabel${field.required ? ' *' : ''}',", 'date field label')
text = replace_once(text, "  };\n}\n\nclass _FamilyDateField", "    };\n  }\n}\n\nclass _FamilyDateField", 'form field close')

# Consents.
text = replace_once(
    text,
    """        builder: (context, _) {
          if (interactions.consentsPhase == FamilyInteractionPhase.loading &&""",
    """        builder: (context, _) {
          final locale = Localizations.localeOf(context);
          final strings = FamilyInteractionStrings.forLocale(locale);
          if (interactions.consentsPhase == FamilyInteractionPhase.loading &&""",
    'consent strings',
)
text = replace_once(text, "              title: 'Consent requests unavailable',", '              title: strings.consentRequestsUnavailable,', 'consent unavailable')
text = replace_once(text, "                    'Only a guardian persona with the consent capability can submit a decision.',", '                    strings.guardianOnlyConsentDescription,', 'consent description')
text = replace_once(
    text,
    """                title:
                    '${directory.activeStudent.displayName} consent requests',""",
    """                title:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.consentRequests}',""",
    'consent title',
)
for old, new, label in [
    ("                          label: 'Consent decision not accepted',", '                          label: strings.consentDecisionNotAccepted,', 'consent fail'),
    ("                          message: interactions.consentsReasonCode!,", '                          message: SchoolBidirectionalText.isolate(interactions.consentsReasonCode!),', 'consent reason isolate'),
    ("                          label: 'Decision accepted',", '                          label: strings.decisionAccepted,', 'consent accepted'),
    ("                        const Text('No consent requests are available.')", '                        Text(strings.noConsentRequests)', 'no consents'),
]:
    text = replace_once(text, old, new, label)
text = replace_once(
    text,
    """                          message:
                              'The server accepted revision ${interactions.consentAcceptedRevision}. Refresh to verify the published status.',""",
    """                          message: FamilyInteractionStrings.acceptedConsentRevisionFor(
                            locale,
                            interactions.consentAcceptedRevision!,
                          ),""",
    'consent revision',
)

# Consent tile.
text = replace_once(
    text,
    """  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,""",
    """  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final strings = FamilyInteractionStrings.forLocale(locale);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,""",
    'consent tile build',
)
text = replace_once(
    text,
    """        subtitle: Text(
          'Policy ${consent.policyVersion} · ${consent.status.name}${consent.dueAt == null ? '' : ' · due ${_familyDateLabel(context, consent.dueAt!)}'}',
        ),
        title: Text(consent.title),""",
    """        subtitle: Text(
          FamilyInteractionStrings.policyStatusFor(
            locale,
            isolatedPolicyVersion: SchoolBidirectionalText.isolate(
              consent.policyVersion,
            ),
            status: consent.status,
            dueLabel: consent.dueAt == null
                ? null
                : _familyDateLabel(context, consent.dueAt!),
          ),
        ),
        title: Text(SchoolBidirectionalText.isolate(consent.title)),""",
    'consent tile metadata',
)
text = replace_once(text, "              label: const Text('Grant consent'),", '              label: Text(strings.grantConsent),', 'grant consent')
text = replace_once(text, "              label: const Text('Decline'),", '              label: Text(strings.decline),', 'decline consent')
text = replace_once(text, "    ],\n  );\n}\n\nclass _FamilyConversationsScreen", "      ],\n    );\n  }\n}\n\nclass _FamilyConversationsScreen", 'consent tile close')

# Conversation list.
text = replace_once(
    text,
    """        builder: (context, _) {
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.loading &&""",
    """        builder: (context, _) {
          final strings = FamilyInteractionStrings.forLocale(
            Localizations.localeOf(context),
          );
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.loading &&""",
    'conversation list strings',
)
text = replace_once(text, "              title: 'Conversations unavailable',", '              title: strings.conversationsUnavailable,', 'conversations unavailable')
text = replace_once(
    text,
    """                description:
                    '${countCopy.openConversations(interactions.conversations.length)} · '
                    'Conversation access follows the active school relationship and capability scope.',
                title: '${directory.activeStudent.displayName} conversations',""",
    """                description:
                    '${countCopy.openConversations(interactions.conversations.length)} · '
                    '${strings.conversationAccessDescription}',
                title:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.conversations}',""",
    'conversations page',
)
text = replace_once(text, "                        const Text('No conversations are available.')", '                        Text(strings.noConversations)', 'no conversations')
text = replace_once(text, "                              interactions.conversations[index].subject,", '                              SchoolBidirectionalText.isolate(\n                                interactions.conversations[index].subject,\n                              ),', 'conversation subject isolate')
text = replace_once(text, "                          label: const Text('Load more conversations'),", '                          label: Text(strings.loadMoreConversations),', 'load conversations')

# Conversation detail.
text = replace_once(
    text,
    """        builder: (context, _) {
          if (interactions.conversationsPhase ==""",
    """        builder: (context, _) {
          final strings = FamilyInteractionStrings.forLocale(
            Localizations.localeOf(context),
          );
          if (interactions.conversationsPhase ==""",
    'conversation detail strings',
)
text = replace_once(text, "              title: 'Conversation unavailable',", '              title: strings.conversationUnavailable,', 'conversation unavailable')
text = replace_once(
    text,
    """                description:
                    '${directory.activeStudent.displayName} · authorized conversation',
                title: conversation.subject,""",
    """                description:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.authorizedConversation}',
                title: SchoolBidirectionalText.isolate(conversation.subject),""",
    'conversation page',
)
for old, new, label in [
    ("                          label: 'Message action failed',", '                          label: strings.messageActionFailed,', 'message action failed'),
    ("                          message: interactions.messagesReasonCode!,", '                          message: SchoolBidirectionalText.isolate(interactions.messagesReasonCode!),', 'message reason isolate'),
    ("                        const Text('No messages are available.')", '                        Text(strings.noMessages)', 'no messages'),
    ("                          label: const Text('Load earlier messages'),", '                          label: Text(strings.loadEarlierMessages),', 'load earlier messages'),
    ("                            labelText: 'Message',", '                            labelText: strings.message,', 'message field label'),
    ("                          label: const Text('Send message'),", '                          label: Text(strings.sendMessage),', 'send message'),
]:
    text = replace_once(text, old, new, label)
text = replace_once(
    text,
    """                              '${_familyDateTimeLabel(context, message.sentAt)}\n${message.body}',
                            ),
                            title: Text(message.authorLabel),""",
    """                              '${_familyDateTimeLabel(context, message.sentAt)}\n'
                              '${SchoolBidirectionalText.isolate(message.body)}',
                            ),
                            title: Text(
                              SchoolBidirectionalText.isolate(message.authorLabel),
                            ),""",
    'message dynamic isolate',
)
text = replace_once(text, '                          decoration: const InputDecoration(', '                          decoration: InputDecoration(', 'message decoration const')

# Shared journey/failure state.
text = replace_once(
    text,
    """        return const _FamilyInteractionFailure(
          reasonCode: 'FAMILY_PROFILE_DIRECTORY_UNAVAILABLE',
          title: 'Family profile unavailable',
        );""",
    """        return _FamilyInteractionFailure(
          reasonCode: 'FAMILY_PROFILE_DIRECTORY_UNAVAILABLE',
          title: FamilyInteractionStrings.forLocale(
            Localizations.localeOf(context),
          ).familyProfileUnavailable,
        );""",
    'profile unavailable',
)
text = replace_once(
    text,
    """  @override
  Widget build(BuildContext context) => ListView(
    children: [""",
    """  @override
  Widget build(BuildContext context) {
    final strings = FamilyInteractionStrings.forLocale(
      Localizations.localeOf(context),
    );
    return ListView(
      children: [""",
    'interaction failure build',
)
text = replace_once(text, "            'No fixture or cached value is substituted when the authorized service cannot verify this interaction.',", '            strings.noSubstituteInteractionValues,', 'failure description')
text = replace_once(text, "                label: 'Service unavailable',", '                label: strings.serviceUnavailable,', 'failure label')
text = replace_once(text, "                message: reasonCode ?? 'FAMILY_INTERACTION_UNAVAILABLE',", "                message: SchoolBidirectionalText.isolate(\n                  reasonCode ?? 'FAMILY_INTERACTION_UNAVAILABLE',\n                ),", 'failure reason')
text = replace_once(text, "                  label: const Text('Try again'),", '                  label: Text(strings.tryAgain),', 'failure retry')
text = replace_once(text, "    ],\n  );\n}\n\nvoid _afterFrame", "      ],\n    );\n  }\n}\n\nvoid _afterFrame", 'interaction failure close')

path.write_text(text)
