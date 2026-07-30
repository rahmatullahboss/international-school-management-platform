import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Languages approved for the first mobile localization verification tranche.
enum SchoolLanguage { english, bangla, arabic }

/// Locale and directionality rules shared by Family and Staff applications.
///
/// The policy deliberately falls back to English for unsupported locales. It
/// does not infer tenant language, change the active school/persona, or fetch
/// remote translations.
abstract final class SchoolLocalePolicy {
  static const fallbackLocale = Locale('en');

  static const supportedLocales = <Locale>[
    fallbackLocale,
    Locale('bn'),
    Locale('ar'),
  ];

  static SchoolLanguage resolve(Locale locale) => switch (
    locale.languageCode.toLowerCase()
  ) {
    'bn' => SchoolLanguage.bangla,
    'ar' => SchoolLanguage.arabic,
    _ => SchoolLanguage.english,
  };

  static bool isSupported(Locale locale) => supportedLocales.any(
    (supported) =>
        supported.languageCode.toLowerCase() ==
        locale.languageCode.toLowerCase(),
  );

  static Locale resolveSupportedLocale(
    Locale? requestedLocale,
    Iterable<Locale> supportedLocales,
  ) {
    final requestedLanguage = requestedLocale?.languageCode.toLowerCase();
    if (requestedLanguage != null) {
      for (final supported in supportedLocales) {
        if (supported.languageCode.toLowerCase() == requestedLanguage) {
          return supported;
        }
      }
    }

    for (final supported in supportedLocales) {
      if (supported.languageCode.toLowerCase() ==
          fallbackLocale.languageCode) {
        return supported;
      }
    }
    return fallbackLocale;
  }

  static Locale resolvePreferredLocales(
    List<Locale>? preferredLocales,
    Iterable<Locale> supportedLocales,
  ) {
    for (final preferred in preferredLocales ?? const <Locale>[]) {
      final preferredLanguage = preferred.languageCode.toLowerCase();
      for (final supported in supportedLocales) {
        if (supported.languageCode.toLowerCase() == preferredLanguage) {
          return supported;
        }
      }
    }
    return resolveSupportedLocale(null, supportedLocales);
  }

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
    required this.teacherProfile,
    required this.today,
  });

  static const LocalizationsDelegate<SchoolShellStrings> delegate =
      _SchoolShellStringsDelegate();

  static SchoolShellStrings of(BuildContext context) {
    final strings = Localizations.of<SchoolShellStrings>(
      context,
      SchoolShellStrings,
    );
    assert(strings != null, 'SchoolShellStrings delegate is not configured.');
    return strings ?? forLocale(SchoolLocalePolicy.fallbackLocale);
  }

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
          teacherProfile: 'শিক্ষক প্রোফাইল',
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
          teacherProfile: 'ملف المعلم',
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
          teacherProfile: 'Teacher profile',
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
  final String teacherProfile;
  final String today;
}

final class _SchoolShellStringsDelegate
    extends LocalizationsDelegate<SchoolShellStrings> {
  const _SchoolShellStringsDelegate();

  @override
  bool isSupported(Locale locale) => SchoolLocalePolicy.isSupported(locale);

  @override
  Future<SchoolShellStrings> load(Locale locale) =>
      SynchronousFuture(SchoolShellStrings.forLocale(locale));

  @override
  bool shouldReload(_SchoolShellStringsDelegate old) => false;
}

/// Widgets-level localization that supplies the approved reading direction.
///
/// Framework-provided control labels intentionally remain the default English
/// values in this source tranche. Global Material/Cupertino translations remain
/// a separate production-adoption checkpoint.
final class SchoolWidgetsLocalizations extends DefaultWidgetsLocalizations {
  const SchoolWidgetsLocalizations._(this.locale);

  static const LocalizationsDelegate<WidgetsLocalizations> delegate =
      _SchoolWidgetsLocalizationsDelegate();

  final Locale locale;

  @override
  TextDirection get textDirection =>
      SchoolLocalePolicy.textDirectionFor(locale);
}

final class _SchoolWidgetsLocalizationsDelegate
    extends LocalizationsDelegate<WidgetsLocalizations> {
  const _SchoolWidgetsLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => SchoolLocalePolicy.isSupported(locale);

  @override
  Future<WidgetsLocalizations> load(Locale locale) => SynchronousFuture(
    SchoolWidgetsLocalizations._(locale),
  );

  @override
  bool shouldReload(_SchoolWidgetsLocalizationsDelegate old) => false;
}

/// Shared MaterialApp/WidgetsApp localization configuration.
abstract final class SchoolLocalizationConfiguration {
  static const localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    SchoolShellStrings.delegate,
    SchoolWidgetsLocalizations.delegate,
  ];

  static const supportedLocales = SchoolLocalePolicy.supportedLocales;

  static Locale localeResolutionCallback(
    Locale? locale,
    Iterable<Locale> supportedLocales,
  ) => SchoolLocalePolicy.resolveSupportedLocale(locale, supportedLocales);

  static Locale localeListResolutionCallback(
    List<Locale>? locales,
    Iterable<Locale> supportedLocales,
  ) => SchoolLocalePolicy.resolvePreferredLocales(locales, supportedLocales);
}

/// Removes directional control characters from dynamic content and encloses it
/// in a first-strong isolate so identifiers and user content cannot reorder
/// surrounding labels in LTR or RTL shells.
abstract final class SchoolBidirectionalText {
  static const _firstStrongIsolate = '\u2068';
  static const _popDirectionalIsolate = '\u2069';
  static final _directionalControls = RegExp(
    '[\u200E\u200F\u202A-\u202E\u2066-\u2069]',
  );

  static String isolate(String value) {
    final sanitized = value.replaceAll(_directionalControls, '');
    return '$_firstStrongIsolate$sanitized$_popDirectionalIsolate';
  }
}

/// Accessibility settings that are presentation-only and cannot change
/// authorization, synchronization, or document-security decisions.
final class SchoolAccessibilityPreferences {
  const SchoolAccessibilityPreferences({
    required this.boldText,
    required this.highContrast,
    required this.reduceMotion,
    required this.textScaler,
  });

  factory SchoolAccessibilityPreferences.fromMediaQuery(MediaQueryData data) =>
      SchoolAccessibilityPreferences(
        boldText: data.boldText,
        highContrast: data.highContrast,
        reduceMotion: data.disableAnimations,
        textScaler: data.textScaler,
      );

  final bool boldText;
  final bool highContrast;
  final bool reduceMotion;
  final TextScaler textScaler;

  Duration motionDuration(Duration standardDuration) =>
      reduceMotion ? Duration.zero : standardDuration;
}

/// Minimum accessibility evidence targets for mobile release verification.
abstract final class SchoolAccessibilityTargets {
  static const minimumInteractiveExtent = 48.0;
  static const requiredTextScale = 2.0;
}
