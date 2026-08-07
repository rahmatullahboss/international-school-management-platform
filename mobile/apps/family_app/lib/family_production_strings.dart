import 'package:flutter/widgets.dart';
import 'package:school_design_system/school_localization.dart';

/// App-owned copy for Family production read journeys.
///
/// These strings change presentation only. Dynamic identifiers and authoritative
/// values remain supplied by server read models and are isolated at the call site.
final class FamilyProductionStrings {
  const FamilyProductionStrings._({
    required this.absent,
    required this.amountsFromIssuedInvoices,
    required this.capabilityScopedFamilyServices,
    required this.conversationAccessDescription,
    required this.documentsAndForms,
    required this.feesAndReceipts,
    required this.informationUnavailable,
    required this.invoice,
    required this.lastReceipt,
    required this.late,
    required this.loadingPublishedInformation,
    required this.messages,
    required this.myAttendance,
    required this.noFeeSummary,
    required this.noMessageSummary,
    required this.noPublishedAttendanceSummary,
    required this.noPublishedResults,
    required this.noPublishedTimetableItems,
    required this.noSubstituteValuesShown,
    required this.openConversationDataPending,
    required this.openConversations,
    required this.openMessages,
    required this.outstanding,
    required this.present,
    required this.publishedInformation,
    required this.publishedResults,
    required this.publishedResultsDescription,
    required this.publishedSessionsDescription,
    required this.reviewAttendance,
    required this.reviewFeesAndReceipts,
    required this.selectedProfileRefreshing,
    required this.substituteValuesHiddenUntilVerified,
    required this.todaysTimetable,
    required this.totalFinalizedSessions,
    required this.tryAgain,
    required this.unableToLoadFamilyInformation,
    required this.viewPublishedResults,
  });

  factory FamilyProductionStrings.forLocale(
    Locale locale,
  ) => switch (SchoolLocalePolicy.resolve(locale)) {
    SchoolLanguage.bangla => const FamilyProductionStrings._(
      absent: 'অনুপস্থিত',
      amountsFromIssuedInvoices:
          'পরিমাণগুলো ইস্যুকৃত ইনভয়েস ও বরাদ্দকৃত রসিদ থেকে এসেছে।',
      capabilityScopedFamilyServices: 'অনুমতিনির্ভর ফ্যামিলি সেবা',
      conversationAccessDescription:
          'কথোপকথনের অ্যাক্সেস স্কুলের সম্পর্কভিত্তিক অনুমতি অনুসরণ করে।',
      documentsAndForms: 'ডকুমেন্ট ও ফর্ম',
      feesAndReceipts: 'ফি ও রসিদ',
      informationUnavailable: 'তথ্য পাওয়া যাচ্ছে না',
      invoice: 'ইনভয়েস',
      lastReceipt: 'সর্বশেষ রসিদ',
      late: 'দেরিতে',
      loadingPublishedInformation: 'প্রকাশিত তথ্য লোড হচ্ছে',
      messages: 'বার্তা',
      myAttendance: 'আমার উপস্থিতি',
      noFeeSummary: 'এই প্রোফাইলের জন্য কোনো ফি সারাংশ নেই।',
      noMessageSummary: 'কোনো বার্তা সারাংশ নেই।',
      noPublishedAttendanceSummary: 'কোনো প্রকাশিত উপস্থিতির সারাংশ নেই।',
      noPublishedResults: 'কোনো প্রকাশিত ফলাফল নেই।',
      noPublishedTimetableItems: 'কোনো প্রকাশিত সময়সূচির আইটেম নেই।',
      noSubstituteValuesShown: 'কোনো বিকল্প মান দেখানো হয়নি',
      openConversationDataPending:
          'খোলা কথোপকথনের তথ্য সার্ভার-নিয়ন্ত্রিত মেসেজিং চুক্তির মাধ্যমে যোগ করা হবে।',
      openConversations: 'কথোপকথন খুলুন',
      openMessages: 'বার্তা খুলুন',
      outstanding: 'বকেয়া',
      present: 'উপস্থিত',
      publishedInformation: 'প্রকাশিত তথ্য',
      publishedResults: 'প্রকাশিত ফলাফল',
      publishedResultsDescription:
          'একাডেমিক প্রকাশনা প্রক্রিয়ায় প্রকাশিত ফলাফলই এখানে দেখানো হয়।',
      publishedSessionsDescription:
          'শুধু প্রকাশিত সেশন। অনুমোদিত সংশোধনে এই মোট পরিবর্তিত হতে পারে।',
      reviewAttendance: 'উপস্থিতি দেখুন',
      reviewFeesAndReceipts: 'ফি ও রসিদ দেখুন',
      selectedProfileRefreshing:
          'নির্বাচিত স্কুল প্রোফাইলটি হালনাগাদ করা হচ্ছে।',
      substituteValuesHiddenUntilVerified:
          'অনুমোদিত সেবা সাড়া না দেওয়া পর্যন্ত একাডেমিক ও আর্থিক মান গোপন থাকবে।',
      todaysTimetable: 'আজকের সময়সূচি',
      totalFinalizedSessions: 'চূড়ান্ত মোট সেশন',
      tryAgain: 'আবার চেষ্টা করুন',
      unableToLoadFamilyInformation: 'ফ্যামিলি তথ্য লোড করা যায়নি',
      viewPublishedResults: 'প্রকাশিত ফলাফল দেখুন',
    ),
    SchoolLanguage.arabic => const FamilyProductionStrings._(
      absent: 'غائب',
      amountsFromIssuedInvoices:
          'تأتي المبالغ من الفواتير الصادرة والإيصالات المخصصة.',
      capabilityScopedFamilyServices: 'خدمات العائلة وفق الصلاحيات',
      conversationAccessDescription:
          'يتبع الوصول إلى المحادثات صلاحيات العلاقة المدرسية.',
      documentsAndForms: 'المستندات والنماذج',
      feesAndReceipts: 'الرسوم والإيصالات',
      informationUnavailable: 'المعلومات غير متاحة',
      invoice: 'الفاتورة',
      lastReceipt: 'آخر إيصال',
      late: 'متأخر',
      loadingPublishedInformation: 'جارٍ تحميل المعلومات المنشورة',
      messages: 'الرسائل',
      myAttendance: 'حضوري',
      noFeeSummary: 'لا يتوفر ملخص رسوم لهذا الملف.',
      noMessageSummary: 'لا يتوفر ملخص للرسائل.',
      noPublishedAttendanceSummary: 'لا يتوفر ملخص حضور منشور.',
      noPublishedResults: 'لا توجد نتائج منشورة.',
      noPublishedTimetableItems: 'لا توجد عناصر جدول منشورة.',
      noSubstituteValuesShown: 'لا يتم عرض قيم بديلة',
      openConversationDataPending:
          'ستُضاف بيانات المحادثات المفتوحة من خلال عقد المراسلة الذي يملكه الخادم.',
      openConversations: 'فتح المحادثات',
      openMessages: 'فتح الرسائل',
      outstanding: 'المستحق',
      present: 'حاضر',
      publishedInformation: 'المعلومات المنشورة',
      publishedResults: 'النتائج المنشورة',
      publishedResultsDescription:
          'تُعرض فقط النتائج التي أُصدرت عبر مسار النشر الأكاديمي.',
      publishedSessionsDescription:
          'الجلسات المنشورة فقط. قد تغيّر التصحيحات المعتمدة هذه الإجماليات.',
      reviewAttendance: 'مراجعة الحضور',
      reviewFeesAndReceipts: 'مراجعة الرسوم والإيصالات',
      selectedProfileRefreshing: 'يتم تحديث ملف المدرسة المحدد.',
      substituteValuesHiddenUntilVerified:
          'ستظل القيم الأكاديمية والمالية مخفية حتى تستجيب الخدمة المصرح بها.',
      todaysTimetable: 'جدول اليوم',
      totalFinalizedSessions: 'إجمالي الجلسات النهائية',
      tryAgain: 'حاول مرة أخرى',
      unableToLoadFamilyInformation: 'تعذر تحميل معلومات العائلة',
      viewPublishedResults: 'عرض النتائج المنشورة',
    ),
    SchoolLanguage.english => const FamilyProductionStrings._(
      absent: 'Absent',
      amountsFromIssuedInvoices:
          'Amounts come from issued invoices and allocated receipts.',
      capabilityScopedFamilyServices: 'Capability-scoped Family services',
      conversationAccessDescription:
          'Conversation access follows school relationship permissions.',
      documentsAndForms: 'Documents and forms',
      feesAndReceipts: 'Fees and receipts',
      informationUnavailable: 'Information unavailable',
      invoice: 'Invoice',
      lastReceipt: 'Last receipt',
      late: 'Late',
      loadingPublishedInformation: 'Loading published information',
      messages: 'Messages',
      myAttendance: 'My attendance',
      noFeeSummary: 'No fee summary is available for this profile.',
      noMessageSummary: 'No message summary is available.',
      noPublishedAttendanceSummary:
          'No published attendance summary is available.',
      noPublishedResults: 'No published results are available.',
      noPublishedTimetableItems: 'No published timetable items.',
      noSubstituteValuesShown: 'No substitute values shown',
      openConversationDataPending:
          'Open conversation data will be added through the server-owned messaging contract.',
      openConversations: 'Open conversations',
      openMessages: 'Open messages',
      outstanding: 'Outstanding',
      present: 'Present',
      publishedInformation: 'Published information',
      publishedResults: 'Published results',
      publishedResultsDescription:
          'Only results released by the academic publication workflow are shown.',
      publishedSessionsDescription:
          'Published sessions only. Approved corrections may change these totals.',
      reviewAttendance: 'Review attendance',
      reviewFeesAndReceipts: 'Review fees and receipts',
      selectedProfileRefreshing:
          'The selected school profile is being refreshed.',
      substituteValuesHiddenUntilVerified:
          'Academic and financial values remain hidden until the authorized service responds.',
      todaysTimetable: 'Today’s timetable',
      totalFinalizedSessions: 'Total finalized sessions',
      tryAgain: 'Try again',
      unableToLoadFamilyInformation: 'Unable to load Family information',
      viewPublishedResults: 'View published results',
    ),
  };

  final String absent;
  final String amountsFromIssuedInvoices;
  final String capabilityScopedFamilyServices;
  final String conversationAccessDescription;
  final String documentsAndForms;
  final String feesAndReceipts;
  final String informationUnavailable;
  final String invoice;
  final String lastReceipt;
  final String late;
  final String loadingPublishedInformation;
  final String messages;
  final String myAttendance;
  final String noFeeSummary;
  final String noMessageSummary;
  final String noPublishedAttendanceSummary;
  final String noPublishedResults;
  final String noPublishedTimetableItems;
  final String noSubstituteValuesShown;
  final String openConversationDataPending;
  final String openConversations;
  final String openMessages;
  final String outstanding;
  final String present;
  final String publishedInformation;
  final String publishedResults;
  final String publishedResultsDescription;
  final String publishedSessionsDescription;
  final String reviewAttendance;
  final String reviewFeesAndReceipts;
  final String selectedProfileRefreshing;
  final String substituteValuesHiddenUntilVerified;
  final String todaysTimetable;
  final String totalFinalizedSessions;
  final String tryAgain;
  final String unableToLoadFamilyInformation;
  final String viewPublishedResults;
}
