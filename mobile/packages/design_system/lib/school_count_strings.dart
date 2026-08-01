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
        SchoolPluralCategory.zero => 'لا توجد تغييرات حضور بانتظار المزامنة.',
        SchoolPluralCategory.one => 'تغيير حضور واحد بانتظار المزامنة.',
        SchoolPluralCategory.two => 'تغييران للحضور بانتظار المزامنة.',
        SchoolPluralCategory.few => '$digits تغييرات حضور بانتظار المزامنة.',
        SchoolPluralCategory.many =>
          '$digits تغييرًا في الحضور بانتظار المزامنة.',
        SchoolPluralCategory.other => '$digits تغيير حضور بانتظار المزامنة.',
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

  String rosterStudents(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No students',
        1 => '1 student',
        _ => '$digits students',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো শিক্ষার্থী নেই',
        _ => '$digits জন শিক্ষার্থী',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero => 'لا طلاب',
        SchoolPluralCategory.one => 'طالب واحد',
        SchoolPluralCategory.two => 'طالبان',
        SchoolPluralCategory.few => '$digits طلاب',
        SchoolPluralCategory.many => '$digits طالبًا',
        SchoolPluralCategory.other => '$digits طالب',
      },
    };
  }

  String assignedMeetings(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No assigned meetings',
        1 => '1 assigned meeting',
        _ => '$digits assigned meetings',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো নির্ধারিত ক্লাস নেই',
        _ => '$digitsটি নির্ধারিত ক্লাস',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero => 'لا حصص مسندة',
        SchoolPluralCategory.one => 'حصة واحدة مسندة',
        SchoolPluralCategory.two => 'حصتان مسندتان',
        SchoolPluralCategory.few => '$digits حصص مسندة',
        SchoolPluralCategory.many => '$digits حصة مسندة',
        SchoolPluralCategory.other => '$digits حصة مسندة',
      },
    };
  }

  String documentsAvailable(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No documents available',
        1 => '1 document available',
        _ => '$digits documents available',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো নথি উপলভ্য নেই',
        _ => '$digitsটি নথি উপলভ্য',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero => 'لا مستندات متاحة',
        SchoolPluralCategory.one => 'مستند واحد متاح',
        SchoolPluralCategory.two => 'مستندان متاحان',
        SchoolPluralCategory.few => '$digits مستندات متاحة',
        SchoolPluralCategory.many => '$digits مستندًا متاحًا',
        SchoolPluralCategory.other => '$digits مستند متاح',
      },
    };
  }

  String formsAwaitingResponse(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No forms are awaiting a response',
        1 => '1 form is awaiting a response',
        _ => '$digits forms are awaiting a response',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো ফর্ম উত্তরের অপেক্ষায় নেই',
        _ => '$digitsটি ফর্ম উত্তরের অপেক্ষায় আছে',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero => 'لا نماذج بانتظار الرد',
        SchoolPluralCategory.one => 'نموذج واحد بانتظار الرد',
        SchoolPluralCategory.two => 'نموذجان بانتظار الرد',
        SchoolPluralCategory.few => '$digits نماذج بانتظار الرد',
        SchoolPluralCategory.many => '$digits نموذجًا بانتظار الرد',
        SchoolPluralCategory.other => '$digits نموذج بانتظار الرد',
      },
    };
  }

  String openConversations(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No open conversations',
        1 => '1 open conversation',
        _ => '$digits open conversations',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো চলমান কথোপকথন নেই',
        _ => '$digitsটি চলমান কথোপকথন',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero => 'لا محادثات مفتوحة',
        SchoolPluralCategory.one => 'محادثة واحدة مفتوحة',
        SchoolPluralCategory.two => 'محادثتان مفتوحتان',
        SchoolPluralCategory.few => '$digits محادثات مفتوحة',
        SchoolPluralCategory.many => '$digits محادثة مفتوحة',
        SchoolPluralCategory.other => '$digits محادثة مفتوحة',
      },
    };
  }

  String encryptedOperationsWaiting(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No encrypted operations are waiting for server acceptance.',
        1 => '1 encrypted operation is waiting for server acceptance.',
        _ => '$digits encrypted operations are waiting for server acceptance.',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো এনক্রিপ্টেড অপারেশন সার্ভারের অনুমোদনের অপেক্ষায় নেই।',
        _ => '$digitsটি এনক্রিপ্টেড অপারেশন সার্ভারের অনুমোদনের অপেক্ষায় আছে।',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero =>
          'لا توجد عمليات مشفرة بانتظار قبول الخادم.',
        SchoolPluralCategory.one =>
          'عملية مشفرة واحدة بانتظار قبول الخادم.',
        SchoolPluralCategory.two =>
          'عمليتان مشفرتان بانتظار قبول الخادم.',
        SchoolPluralCategory.few =>
          '$digits عمليات مشفرة بانتظار قبول الخادم.',
        SchoolPluralCategory.many =>
          '$digits عملية مشفرة بانتظار قبول الخادم.',
        SchoolPluralCategory.other =>
          '$digits عملية مشفرة بانتظار قبول الخادم.',
      },
    };
  }

  String operationsRequireReview(int count) {
    _validateCount(count);
    final digits = _localizedInteger(count);
    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english => switch (count) {
        0 => 'No operations require manual review.',
        1 => '1 operation is conflicted, rejected or requires reconciliation.',
        _ => '$digits operations are conflicted, rejected or require reconciliation.',
      },
      SchoolLanguage.bangla => switch (count) {
        0 => 'কোনো অপারেশন ম্যানুয়াল পর্যালোচনা প্রয়োজন করে না।',
        _ => '$digitsটি অপারেশন দ্বন্দ্বে আছে, প্রত্যাখ্যাত হয়েছে বা সমন্বয় প্রয়োজন।',
      },
      SchoolLanguage.arabic => switch (SchoolCardinalPluralRules.categoryFor(
        locale,
        count,
      )) {
        SchoolPluralCategory.zero =>
          'لا توجد عمليات تتطلب مراجعة يدوية.',
        SchoolPluralCategory.one =>
          'عملية واحدة متعارضة أو مرفوضة أو تتطلب تسوية.',
        SchoolPluralCategory.two =>
          'عمليتان متعارضتان أو مرفوضتان أو تتطلبان تسوية.',
        SchoolPluralCategory.few =>
          '$digits عمليات متعارضة أو مرفوضة أو تتطلب تسوية.',
        SchoolPluralCategory.many =>
          '$digits عملية متعارضة أو مرفوضة أو تتطلب تسوية.',
        SchoolPluralCategory.other =>
          '$digits عملية متعارضة أو مرفوضة أو تتطلب تسوية.',
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
