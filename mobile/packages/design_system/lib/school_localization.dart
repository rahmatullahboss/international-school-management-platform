import 'package:flutter/widgets.dart';

/// Languages approved for the first mobile localization verification tranche.
enum SchoolLanguage { english, bangla, arabic }

/// Locale and directionality rules shared by Family and Staff applications.
///
/// The policy deliberately falls back to English for unsupported locales. It
/// does not infer tenant language, change the active school/persona, or fetch
/// remote translations.
abstract final class SchoolLocalePolicy {
  static const supportedLocales = <Locale>[
    Locale('en'),
    Locale('bn'),
    Locale('ar'),
  ];

  static SchoolLanguage resolve(Locale locale) => switch (locale.languageCode) {
    'bn' => SchoolLanguage.bangla,
    'ar' => SchoolLanguage.arabic,
    _ => SchoolLanguage.english,
  };

  static bool isSupported(Locale locale) => supportedLocales.any(
    (supported) => supported.languageCode == locale.languageCode,
  );

  static TextDirection textDirectionFor(Locale locale) =>
      resolve(locale) == SchoolLanguage.arabic
      ? TextDirection.rtl
      : TextDirection.ltr;
}

/// Localized shell copy that can be adopted without moving authoritative
/// academic, financial, identity, or authorization decisions to the client.
final class SchoolShellStrings {
  const SchoolShellStrings._({
    required this.attendance,
    required this.conversations,
    required this.familyAppName,
    required this.fees,
    required this.gradebook,
    required this.guardianProfile,
    required this.home,
    required this.messages,
    required this.results,
    required this.services,
    required this.signOut,
    required this.staffAppName,
    required this.studentProfile,
    required this.switchProfile,
    required this.switchRole,
    required this.switchStudent,
    required this.today,
  });

  factory SchoolShellStrings.forLocale(Locale locale) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla => SchoolShellStrings._(
          attendance: 'উপস্থিতি',
          conversations: 'কথোপকথন',
          familyAppName: 'স্কুল ফ্যামিলি',
          fees: 'ফি',
          gradebook: 'গ্রেডবুক',
          guardianProfile: 'অভিভাবক প্রোফাইল',
          home: 'হোম',
          messages: 'বার্তা',
          results: 'ফলাফল',
          services: 'সেবাসমূহ',
          signOut: 'সাইন আউট',
          staffAppName: 'স্কুল স্টাফ',
          studentProfile: 'শিক্ষার্থী প্রোফাইল',
          switchProfile: 'প্রোফাইল পরিবর্তন করুন',
          switchRole: 'ভূমিকা পরিবর্তন করুন',
          switchStudent: 'শিক্ষার্থী পরিবর্তন করুন',
          today: 'আজ',
        ),
        SchoolLanguage.arabic => SchoolShellStrings._(
          attendance: 'الحضور',
          conversations: 'المحادثات',
          familyAppName: 'عائلة المدرسة',
          fees: 'الرسوم',
          gradebook: 'سجل الدرجات',
          guardianProfile: 'ملف ولي الأمر',
          home: 'الرئيسية',
          messages: 'الرسائل',
          results: 'النتائج',
          services: 'الخدمات',
          signOut: 'تسجيل الخروج',
          staffAppName: 'طاقم المدرسة',
          studentProfile: 'ملف الطالب',
          switchProfile: 'تبديل الملف',
          switchRole: 'تبديل الدور',
          switchStudent: 'تبديل الطالب',
          today: 'اليوم',
        ),
        SchoolLanguage.english => SchoolShellStrings._(
          attendance: 'Attendance',
          conversations: 'Conversations',
          familyAppName: 'School Family',
          fees: 'Fees',
          gradebook: 'Gradebook',
          guardianProfile: 'Guardian profile',
          home: 'Home',
          messages: 'Messages',
          results: 'Results',
          services: 'Services',
          signOut: 'Sign out',
          staffAppName: 'School Staff',
          studentProfile: 'Student profile',
          switchProfile: 'Switch profile',
          switchRole: 'Switch role',
          switchStudent: 'Switch student',
          today: 'Today',
        ),
      };

  final String attendance;
  final String conversations;
  final String familyAppName;
  final String fees;
  final String gradebook;
  final String guardianProfile;
  final String home;
  final String messages;
  final String results;
  final String services;
  final String signOut;
  final String staffAppName;
  final String studentProfile;
  final String switchProfile;
  final String switchRole;
  final String switchStudent;
  final String today;
}

/// Minimum accessibility evidence targets for mobile release verification.
abstract final class SchoolAccessibilityTargets {
  static const minimumInteractiveExtent = 48.0;
  static const requiredTextScale = 2.0;
}
