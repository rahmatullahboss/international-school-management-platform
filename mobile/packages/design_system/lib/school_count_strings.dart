import 'package:flutter/widgets.dart';
import 'package:school_design_system/school_localization.dart';
import 'package:school_design_system/school_pluralization.dart';

/// Reviewed presentation-only count sentences for common Family and Staff
/// journeys.
///
/// Counts remain integer values supplied by owning read models. These strings
/// do not calculate attendance, messages, results, sync state, or authority.
final class SchoolCountStrings {
  const SchoolCountStrings._(this.locale);

  factory SchoolCountStrings.forLocale(Locale locale) => SchoolCountStrings._(
    SchoolLocalePolicy.resolveSupportedLocale(
      locale,
      SchoolLocalePolicy.supportedLocales,
    ),
  );

  static SchoolCountStrings of(BuildContext context) =>
      SchoolCountStrings.forLocale(Localizations.localeOf(context));

  final Locale locale;

  String attendanceChangesWaiting(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No attendance changes are waiting to sync.',
        1 => '1 attendance change is waiting to sync.',
        _ => '$digits attendance changes are waiting to sync.',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো উপস্থিতি পরিবর্তন সিঙ্কের অপেক্ষায় নেই।',
        _ => '$digitsটি উপস্থিতি পরিবর্তন সিঙ্কের অপেক্ষায় আছে।',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero =>
          'لا توجد تغييرات حضور بانتظار المزامنة.',
        SchoolPluralCategory.one => 'تغيير حضور واحد بانتظار المزامنة.',
        SchoolPluralCategory.two => 'تغييران للحضور بانتظار المزامنة.',
        SchoolPluralCategory.few =>
          '$digits تغييرات حضور بانتظار المزامنة.',
        SchoolPluralCategory.many =>
          '$digits تغييرًا في الحضور بانتظار المزامنة.',
        SchoolPluralCategory.other =>
          '$digits تغيير حضور بانتظار المزامنة.',
      },
    };
  }

  String unreadMessages(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No unread messages',
        1 => '1 unread message',
        _ => '$digits unread messages',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো অপঠিত বার্তা নেই',
        _ => '$digitsটি অপঠিত বার্তা',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero => 'لا رسائل غير مقروءة',
        SchoolPluralCategory.one => 'رسالة واحدة غير مقروءة',
        SchoolPluralCategory.two => 'رسالتان غير مقروءتين',
        SchoolPluralCategory.few => '$digits رسائل غير مقروءة',
        SchoolPluralCategory.many => '$digits رسالة غير مقروءة',
        SchoolPluralCategory.other => '$digits رسالة غير مقروءة',
      },
    };
  }

  String publishedResults(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No published results',
        1 => '1 published result',
        _ => '$digits published results',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো প্রকাশিত ফলাফল নেই',
        _ => '$digitsটি প্রকাশিত ফলাফল',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero => 'لا نتائج منشورة',
        SchoolPluralCategory.one => 'نتيجة منشورة واحدة',
        SchoolPluralCategory.two => 'نتيجتان منشورتان',
        SchoolPluralCategory.few => '$digits نتائج منشورة',
        SchoolPluralCategory.many => '$digits نتيجة منشورة',
        SchoolPluralCategory.other => '$digits نتيجة منشورة',
      },
    };
  }

  String finalizedSessions(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No finalized sessions',
        1 => '1 finalized session',
        _ => '$digits finalized sessions',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো চূড়ান্ত সেশন নেই',
        _ => '$digitsটি চূড়ান্ত সেশন',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero => 'لا حصص نهائية',
        SchoolPluralCategory.one => 'حصة نهائية واحدة',
        SchoolPluralCategory.two => 'حصتان نهائيتان',
        SchoolPluralCategory.few => '$digits حصص نهائية',
        SchoolPluralCategory.many => '$digits حصة نهائية',
        SchoolPluralCategory.other => '$digits حصة نهائية',
      },
    };
  }

  String _localizedInteger(int value) {
    final source = value.toString();
    final digits = switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => '0123456789',
      SchoolLanguage.bangla => '০১২৩৪৫৬৭৮৯',
      SchoolLanguage.arabic => '٠١٢٣٤٥٦٧٨٩',
    };
    return source.split('').map((character) {
      final index = int.parse(character);
      return digits[index];
    }).join();
  }

  static void _validateCount(int count) {
    if (count < 0) {
      throw RangeError.value(
        count,
        'count',
        'A non-negative count is required.',
      );
    }
  }
}
