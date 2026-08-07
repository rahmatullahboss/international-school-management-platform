import 'package:flutter/widgets.dart';
import 'package:school_design_system/school_localization.dart';
import 'package:school_family_domain/family_interactions.dart';

/// App-owned presentation copy for Family interaction journeys.
///
/// Authorization, form/consent versions, secure grants and message authority
/// remain server-owned. This catalog only translates their presentation.
final class FamilyInteractionStrings {
  const FamilyInteractionStrings._({
    required this.additionalVerificationRequired,
    required this.authorizedConversation,
    required this.capabilityScopedServices,
    required this.consentDecisionNotAccepted,
    required this.consentRequests,
    required this.consentRequestsUnavailable,
    required this.conversationAccessDescription,
    required this.conversationUnavailable,
    required this.conversations,
    required this.conversationsUnavailable,
    required this.decisionAccepted,
    required this.decline,
    required this.documentActionFailed,
    required this.documentClosedSecurely,
    required this.documentClosedSecurelyMessage,
    required this.documents,
    required this.documentsAndForms,
    required this.documentsUnavailable,
    required this.documentsMetadataOnlyDescription,
    required this.documentsServiceDescription,
    required this.forms,
    required this.formsUnavailable,
    required this.formNotSubmitted,
    required this.formUnavailable,
    required this.familyProfileUnavailable,
    required this.formsVersionDescription,
    required this.formsServiceDescription,
    required this.grantConsent,
    required this.guardianConsent,
    required this.guardianConsentDescription,
    required this.guardianOnlyConsentDescription,
    required this.loadEarlierMessages,
    required this.loadMoreConversations,
    required this.loadMoreDocuments,
    required this.message,
    required this.messageActionFailed,
    required this.noAuthorizedDocumentMetadata,
    required this.noConsentRequests,
    required this.noConversations,
    required this.noForms,
    required this.noInteractionServicesAuthorized,
    required this.noMessages,
    required this.noSubstituteInteractionValues,
    required this.openSecurely,
    required this.prepareSecureDownload,
    required this.secureGrantPrepared,
    required this.securePresentationNotConfigured,
    required this.sendMessage,
    required this.serviceUnavailable,
    required this.submitForm,
    required this.submissionAccepted,
    required this.tryAgain,
    required this.verifyAndOpenSecurely,
  });

  factory FamilyInteractionStrings.forLocale(
    Locale locale,
  ) => switch (SchoolLocalePolicy.resolve(locale)) {
    SchoolLanguage.bangla => const FamilyInteractionStrings._(
      additionalVerificationRequired: 'অতিরিক্ত যাচাই প্রয়োজন',
      authorizedConversation: 'অনুমোদিত কথোপকথন',
      capabilityScopedServices: 'অনুমতিনির্ভর সেবাসমূহ',
      consentDecisionNotAccepted: 'সম্মতির সিদ্ধান্ত গ্রহণ করা হয়নি',
      consentRequests: 'সম্মতির অনুরোধ',
      consentRequestsUnavailable: 'সম্মতির অনুরোধ পাওয়া যাচ্ছে না',
      conversationAccessDescription:
          'কথোপকথনের অ্যাক্সেস সক্রিয় স্কুল সম্পর্ক ও অনুমতির সীমা অনুসরণ করে।',
      conversationUnavailable: 'কথোপকথন পাওয়া যাচ্ছে না',
      conversations: 'কথোপকথন',
      conversationsUnavailable: 'কথোপকথনগুলো পাওয়া যাচ্ছে না',
      decisionAccepted: 'সিদ্ধান্ত গ্রহণ করা হয়েছে',
      decline: 'প্রত্যাখ্যান করুন',
      documentActionFailed: 'ডকুমেন্টের কাজ ব্যর্থ হয়েছে',
      documentClosedSecurely: 'ডকুমেন্ট নিরাপদে বন্ধ হয়েছে',
      documentClosedSecurelyMessage:
          'যাচাইকৃত ডকুমেন্টটি নো-স্টোর লিজ থেকে দেখানো হয়েছিল এবং অস্থায়ী বাইট মুছে ফেলা হয়েছে।',
      documents: 'ডকুমেন্ট',
      documentsAndForms: 'ডকুমেন্ট ও ফর্ম',
      documentsUnavailable: 'ডকুমেন্ট পাওয়া যাচ্ছে না',
      documentsMetadataOnlyDescription:
          'শুধু মেটাডেটা দেখানো হয়। সীমিত ফাইল নো-স্টোর থাকে এবং কাঁচা ডাউনলোড ক্রেডেনশিয়াল কখনো দেখানো হয় না।',
      documentsServiceDescription:
          'মেটাডেটা পর্যালোচনা করুন এবং স্বল্পমেয়াদি নিরাপদ ডাউনলোড গ্র্যান্ট প্রস্তুত করুন।',
      forms: 'ফর্ম',
      formsUnavailable: 'ফর্ম পাওয়া যাচ্ছে না',
      formNotSubmitted: 'ফর্ম জমা হয়নি',
      formUnavailable: 'ফর্ম পাওয়া যাচ্ছে না',
      familyProfileUnavailable: 'ফ্যামিলি প্রোফাইল পাওয়া যাচ্ছে না',
      formsVersionDescription:
          'জমা দেওয়ার সময় সার্ভার-প্রদত্ত বেস ও স্কিমা ভার্সন ব্যবহার করা হয়। ক্লায়েন্ট নতুন কোনো রিভিশন অনুমান করে না।',
      formsServiceDescription:
          'ক্লায়েন্টে কর্তৃত্ব না এনে সার্ভার-ভার্সনকৃত ফর্ম পূরণ করুন।',
      grantConsent: 'সম্মতি দিন',
      guardianConsent: 'অভিভাবকের সম্মতি',
      guardianConsentDescription:
          'পলিসি ভার্সন পর্যালোচনা করে স্পষ্ট সিদ্ধান্ত জমা দিন।',
      guardianOnlyConsentDescription:
          'শুধু সম্মতি দেওয়ার অনুমতিসহ অভিভাবক প্রোফাইল সিদ্ধান্ত জমা দিতে পারে।',
      loadEarlierMessages: 'আগের বার্তা লোড করুন',
      loadMoreConversations: 'আরও কথোপকথন লোড করুন',
      loadMoreDocuments: 'আরও ডকুমেন্ট লোড করুন',
      message: 'বার্তা',
      messageActionFailed: 'বার্তার কাজ ব্যর্থ হয়েছে',
      noAuthorizedDocumentMetadata: 'অনুমোদিত কোনো ডকুমেন্ট মেটাডেটা নেই।',
      noConsentRequests: 'কোনো সম্মতির অনুরোধ নেই।',
      noConversations: 'কোনো কথোপকথন নেই।',
      noForms: 'এই প্রোফাইলের জন্য কোনো ফর্ম নেই।',
      noInteractionServicesAuthorized: 'কোনো ইন্টারঅ্যাকশন সেবা অনুমোদিত নয়।',
      noMessages: 'কোনো বার্তা নেই।',
      noSubstituteInteractionValues:
          'অনুমোদিত সেবা ইন্টারঅ্যাকশনটি যাচাই করতে না পারলে কোনো ফিক্সচার বা ক্যাশড মান দেখানো হয় না।',
      openSecurely: 'নিরাপদে খুলুন',
      prepareSecureDownload: 'নিরাপদ ডাউনলোড প্রস্তুত করুন',
      secureGrantPrepared: 'নিরাপদ গ্র্যান্ট প্রস্তুত',
      securePresentationNotConfigured:
          'এই বিল্ডে নিরাপদ ডকুমেন্ট প্রদর্শন কনফিগার করা নেই।',
      sendMessage: 'বার্তা পাঠান',
      serviceUnavailable: 'সেবা পাওয়া যাচ্ছে না',
      submitForm: 'ফর্ম জমা দিন',
      submissionAccepted: 'জমা গ্রহণ করা হয়েছে',
      tryAgain: 'আবার চেষ্টা করুন',
      verifyAndOpenSecurely: 'যাচাই করে নিরাপদে খুলুন',
    ),
    SchoolLanguage.arabic => const FamilyInteractionStrings._(
      additionalVerificationRequired: 'يلزم تحقق إضافي',
      authorizedConversation: 'محادثة مصرح بها',
      capabilityScopedServices: 'خدمات وفق الصلاحيات',
      consentDecisionNotAccepted: 'لم يتم قبول قرار الموافقة',
      consentRequests: 'طلبات الموافقة',
      consentRequestsUnavailable: 'طلبات الموافقة غير متاحة',
      conversationAccessDescription:
          'يتبع الوصول إلى المحادثات علاقة المدرسة النشطة ونطاق الصلاحيات.',
      conversationUnavailable: 'المحادثة غير متاحة',
      conversations: 'المحادثات',
      conversationsUnavailable: 'المحادثات غير متاحة',
      decisionAccepted: 'تم قبول القرار',
      decline: 'رفض',
      documentActionFailed: 'فشل إجراء المستند',
      documentClosedSecurely: 'تم إغلاق المستند بأمان',
      documentClosedSecurelyMessage:
          'عُرض المستند المتحقق منه من حيازة بدون تخزين وتم حذف البايتات المؤقتة.',
      documents: 'المستندات',
      documentsAndForms: 'المستندات والنماذج',
      documentsUnavailable: 'المستندات غير متاحة',
      documentsMetadataOnlyDescription:
          'تُعرض البيانات الوصفية فقط. تبقى الملفات المقيدة بلا تخزين ولا تُعرض بيانات اعتماد التنزيل الخام.',
      documentsServiceDescription:
          'راجع البيانات الوصفية وجهّز منح تنزيل آمنة قصيرة الأجل.',
      forms: 'النماذج',
      formsUnavailable: 'النماذج غير متاحة',
      formNotSubmitted: 'لم يتم إرسال النموذج',
      formUnavailable: 'النموذج غير متاح',
      familyProfileUnavailable: 'ملف العائلة غير متاح',
      formsVersionDescription:
          'يستخدم الإرسال إصداري الأساس والمخطط الصادرين من الخادم. لا يستنتج العميل مراجعة أحدث.',
      formsServiceDescription:
          'أكمل النماذج ذات الإصدارات الخادمة دون نقل السلطة إلى العميل.',
      grantConsent: 'منح الموافقة',
      guardianConsent: 'موافقة ولي الأمر',
      guardianConsentDescription: 'راجع إصدارات السياسة وأرسل قرارًا صريحًا.',
      guardianOnlyConsentDescription:
          'يمكن فقط لملف ولي الأمر الذي يملك صلاحية الموافقة إرسال قرار.',
      loadEarlierMessages: 'تحميل الرسائل السابقة',
      loadMoreConversations: 'تحميل المزيد من المحادثات',
      loadMoreDocuments: 'تحميل المزيد من المستندات',
      message: 'رسالة',
      messageActionFailed: 'فشل إجراء الرسالة',
      noAuthorizedDocumentMetadata: 'لا تتوفر بيانات وصفية لمستندات مصرح بها.',
      noConsentRequests: 'لا توجد طلبات موافقة.',
      noConversations: 'لا توجد محادثات.',
      noForms: 'لا توجد نماذج متاحة لهذا الملف.',
      noInteractionServicesAuthorized: 'لا توجد خدمات تفاعل مصرح بها.',
      noMessages: 'لا توجد رسائل.',
      noSubstituteInteractionValues:
          'لا يتم استبدال قيم تجريبية أو مخزنة مؤقتًا عندما تعجز الخدمة المصرح بها عن التحقق من هذا التفاعل.',
      openSecurely: 'فتح بأمان',
      prepareSecureDownload: 'إعداد تنزيل آمن',
      secureGrantPrepared: 'تم إعداد المنحة الآمنة',
      securePresentationNotConfigured:
          'عرض المستند الآمن غير مهيأ في هذا الإصدار.',
      sendMessage: 'إرسال الرسالة',
      serviceUnavailable: 'الخدمة غير متاحة',
      submitForm: 'إرسال النموذج',
      submissionAccepted: 'تم قبول الإرسال',
      tryAgain: 'حاول مرة أخرى',
      verifyAndOpenSecurely: 'تحقق وافتح بأمان',
    ),
    SchoolLanguage.english => const FamilyInteractionStrings._(
      additionalVerificationRequired: 'Additional verification required',
      authorizedConversation: 'Authorized conversation',
      capabilityScopedServices: 'Capability-scoped services',
      consentDecisionNotAccepted: 'Consent decision not accepted',
      consentRequests: 'Consent requests',
      consentRequestsUnavailable: 'Consent requests unavailable',
      conversationAccessDescription:
          'Conversation access follows the active school relationship and capability scope.',
      conversationUnavailable: 'Conversation unavailable',
      conversations: 'Conversations',
      conversationsUnavailable: 'Conversations unavailable',
      decisionAccepted: 'Decision accepted',
      decline: 'Decline',
      documentActionFailed: 'Document action failed',
      documentClosedSecurely: 'Document closed securely',
      documentClosedSecurelyMessage:
          'The verified document was presented from a no-store lease and the temporary bytes were deleted.',
      documents: 'Documents',
      documentsAndForms: 'Documents and forms',
      documentsUnavailable: 'Documents unavailable',
      documentsMetadataOnlyDescription:
          'Only metadata is shown. Restricted files remain no-store and raw download credentials are never exposed.',
      documentsServiceDescription:
          'Review metadata and prepare short-lived secure download grants.',
      forms: 'Forms',
      formsUnavailable: 'Forms unavailable',
      formNotSubmitted: 'Form not submitted',
      formUnavailable: 'Form unavailable',
      familyProfileUnavailable: 'Family profile unavailable',
      formsVersionDescription:
          'Submission uses the server-issued base and schema versions. The client does not infer a newer revision.',
      formsServiceDescription:
          'Complete server-versioned forms without client-side authority.',
      grantConsent: 'Grant consent',
      guardianConsent: 'Guardian consent',
      guardianConsentDescription:
          'Review policy versions and submit explicit decisions.',
      guardianOnlyConsentDescription:
          'Only a guardian persona with the consent capability can submit a decision.',
      loadEarlierMessages: 'Load earlier messages',
      loadMoreConversations: 'Load more conversations',
      loadMoreDocuments: 'Load more documents',
      message: 'Message',
      messageActionFailed: 'Message action failed',
      noAuthorizedDocumentMetadata:
          'No authorized document metadata is available.',
      noConsentRequests: 'No consent requests are available.',
      noConversations: 'No conversations are available.',
      noForms: 'No forms are available for this profile.',
      noInteractionServicesAuthorized:
          'No interaction services are authorized.',
      noMessages: 'No messages are available.',
      noSubstituteInteractionValues:
          'No fixture or cached value is substituted when the authorized service cannot verify this interaction.',
      openSecurely: 'Open securely',
      prepareSecureDownload: 'Prepare secure download',
      secureGrantPrepared: 'Secure grant prepared',
      securePresentationNotConfigured:
          'Secure document presentation is not configured on this build.',
      sendMessage: 'Send message',
      serviceUnavailable: 'Service unavailable',
      submitForm: 'Submit form',
      submissionAccepted: 'Submission accepted',
      tryAgain: 'Try again',
      verifyAndOpenSecurely: 'Verify and open securely',
    ),
  };

  final String additionalVerificationRequired;
  final String authorizedConversation;
  final String capabilityScopedServices;
  final String consentDecisionNotAccepted;
  final String consentRequests;
  final String consentRequestsUnavailable;
  final String conversationAccessDescription;
  final String conversationUnavailable;
  final String conversations;
  final String conversationsUnavailable;
  final String decisionAccepted;
  final String decline;
  final String documentActionFailed;
  final String documentClosedSecurely;
  final String documentClosedSecurelyMessage;
  final String documents;
  final String documentsAndForms;
  final String documentsUnavailable;
  final String documentsMetadataOnlyDescription;
  final String documentsServiceDescription;
  final String forms;
  final String formsUnavailable;
  final String formNotSubmitted;
  final String formUnavailable;
  final String familyProfileUnavailable;
  final String formsVersionDescription;
  final String formsServiceDescription;
  final String grantConsent;
  final String guardianConsent;
  final String guardianConsentDescription;
  final String guardianOnlyConsentDescription;
  final String loadEarlierMessages;
  final String loadMoreConversations;
  final String loadMoreDocuments;
  final String message;
  final String messageActionFailed;
  final String noAuthorizedDocumentMetadata;
  final String noConsentRequests;
  final String noConversations;
  final String noForms;
  final String noInteractionServicesAuthorized;
  final String noMessages;
  final String noSubstituteInteractionValues;
  final String openSecurely;
  final String prepareSecureDownload;
  final String secureGrantPrepared;
  final String securePresentationNotConfigured;
  final String sendMessage;
  final String serviceUnavailable;
  final String submitForm;
  final String submissionAccepted;
  final String tryAgain;
  final String verifyAndOpenSecurely;

  static String documentClassificationFor(
    Locale locale,
    FamilyDocumentClassification value,
  ) => switch (SchoolLocalePolicy.resolve(locale)) {
    SchoolLanguage.bangla => switch (value) {
      FamilyDocumentClassification.general => 'সাধারণ',
      FamilyDocumentClassification.personal => 'ব্যক্তিগত',
      FamilyDocumentClassification.restricted => 'সীমিত',
    },
    SchoolLanguage.arabic => switch (value) {
      FamilyDocumentClassification.general => 'عام',
      FamilyDocumentClassification.personal => 'شخصي',
      FamilyDocumentClassification.restricted => 'مقيد',
    },
    SchoolLanguage.english => switch (value) {
      FamilyDocumentClassification.general => 'General',
      FamilyDocumentClassification.personal => 'Personal',
      FamilyDocumentClassification.restricted => 'Restricted',
    },
  };

  static String cachePolicyFor(
    Locale locale,
    FamilyDocumentCachePolicy value,
  ) => switch (SchoolLocalePolicy.resolve(locale)) {
    SchoolLanguage.bangla => switch (value) {
      FamilyDocumentCachePolicy.noStore => 'নো-স্টোর',
      FamilyDocumentCachePolicy.encryptedTemporary => 'এনক্রিপ্টেড অস্থায়ী',
    },
    SchoolLanguage.arabic => switch (value) {
      FamilyDocumentCachePolicy.noStore => 'بدون تخزين',
      FamilyDocumentCachePolicy.encryptedTemporary => 'مؤقت مشفر',
    },
    SchoolLanguage.english => switch (value) {
      FamilyDocumentCachePolicy.noStore => 'No-store',
      FamilyDocumentCachePolicy.encryptedTemporary => 'Encrypted temporary',
    },
  };

  static String formStatusFor(Locale locale, FamilyFormStatus value) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla => switch (value) {
          FamilyFormStatus.open => 'খোলা',
          FamilyFormStatus.submitted => 'জমা দেওয়া',
          FamilyFormStatus.closed => 'বন্ধ',
        },
        SchoolLanguage.arabic => switch (value) {
          FamilyFormStatus.open => 'مفتوح',
          FamilyFormStatus.submitted => 'مُرسل',
          FamilyFormStatus.closed => 'مغلق',
        },
        SchoolLanguage.english => switch (value) {
          FamilyFormStatus.open => 'Open',
          FamilyFormStatus.submitted => 'Submitted',
          FamilyFormStatus.closed => 'Closed',
        },
      };

  static String consentStatusFor(Locale locale, FamilyConsentStatus value) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla => switch (value) {
          FamilyConsentStatus.pending => 'অপেক্ষমাণ',
          FamilyConsentStatus.granted => 'অনুমোদিত',
          FamilyConsentStatus.declined => 'প্রত্যাখ্যাত',
          FamilyConsentStatus.expired => 'মেয়াদোত্তীর্ণ',
        },
        SchoolLanguage.arabic => switch (value) {
          FamilyConsentStatus.pending => 'معلق',
          FamilyConsentStatus.granted => 'ممنوح',
          FamilyConsentStatus.declined => 'مرفوض',
          FamilyConsentStatus.expired => 'منتهي',
        },
        SchoolLanguage.english => switch (value) {
          FamilyConsentStatus.pending => 'Pending',
          FamilyConsentStatus.granted => 'Granted',
          FamilyConsentStatus.declined => 'Declined',
          FamilyConsentStatus.expired => 'Expired',
        },
      };

  static String issuedFor(Locale locale, String dateLabel) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla => 'ইস্যু $dateLabel',
        SchoolLanguage.arabic => 'صدر $dateLabel',
        SchoolLanguage.english => 'issued $dateLabel',
      };

  static String dueFor(Locale locale, String dateLabel) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla => 'শেষ সময় $dateLabel',
        SchoolLanguage.arabic => 'الاستحقاق $dateLabel',
        SchoolLanguage.english => 'due $dateLabel',
      };

  static String grantExpiryFor(
    Locale locale,
    String dateTimeLabel, {
    required bool singleUse,
  }) => switch (SchoolLocalePolicy.resolve(locale)) {
    SchoolLanguage.bangla =>
      'স্বল্পমেয়াদি ${singleUse ? 'একবার ব্যবহারযোগ্য ' : ''}গ্র্যান্টের মেয়াদ $dateTimeLabel-এ শেষ হবে। কোনো URL বা ক্রেডেনশিয়াল দেখানো হয় না।',
    SchoolLanguage.arabic =>
      'تنتهي المنحة قصيرة الأجل ${singleUse ? 'ذات الاستخدام الواحد ' : ''}في $dateTimeLabel. لا يتم عرض أي رابط أو بيانات اعتماد.',
    SchoolLanguage.english =>
      'The short-lived ${singleUse ? 'single-use ' : ''}grant expires $dateTimeLabel. No URL or credential is shown.',
  };

  static String formDefinitionFor(
    Locale locale, {
    required int baseVersion,
    required int schemaVersion,
    required String isolatedStudentName,
  }) => switch (SchoolLocalePolicy.resolve(locale)) {
    SchoolLanguage.bangla =>
      'বেস ভার্সন $baseVersion · স্কিমা $schemaVersion · $isolatedStudentName',
    SchoolLanguage.arabic =>
      'الإصدار الأساسي $baseVersion · المخطط $schemaVersion · $isolatedStudentName',
    SchoolLanguage.english =>
      'Base version $baseVersion · schema $schemaVersion · $isolatedStudentName',
  };

  static String acceptedRevisionFor(Locale locale, int revision) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla => 'সার্ভার রিভিশন $revision গ্রহণ করেছে।',
        SchoolLanguage.arabic => 'قبل الخادم المراجعة $revision.',
        SchoolLanguage.english => 'The server accepted revision $revision.',
      };

  static String acceptedConsentRevisionFor(
    Locale locale,
    int revision,
  ) => switch (SchoolLocalePolicy.resolve(locale)) {
    SchoolLanguage.bangla =>
      'সার্ভার রিভিশন $revision গ্রহণ করেছে। প্রকাশিত অবস্থা যাচাই করতে হালনাগাদ করুন।',
    SchoolLanguage.arabic =>
      'قبل الخادم المراجعة $revision. حدّث للتحقق من الحالة المنشورة.',
    SchoolLanguage.english =>
      'The server accepted revision $revision. Refresh to verify the published status.',
  };

  static String policyStatusFor(
    Locale locale, {
    required String isolatedPolicyVersion,
    required FamilyConsentStatus status,
    String? dueLabel,
  }) {
    final statusLabel = consentStatusFor(locale, status);
    final due = dueLabel == null ? '' : ' · ${dueFor(locale, dueLabel)}';
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.bangla =>
        'পলিসি $isolatedPolicyVersion · $statusLabel$due',
      SchoolLanguage.arabic =>
        'السياسة $isolatedPolicyVersion · $statusLabel$due',
      SchoolLanguage.english =>
        'Policy $isolatedPolicyVersion · $statusLabel$due',
    };
  }
}
