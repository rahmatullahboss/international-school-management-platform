import 'package:flutter/widgets.dart';
import 'package:school_design_system/school_localization.dart';

/// Presentation-only copy for Staff routes whose authoritative server read
/// model has not been activated for the mobile client.
final class StaffServerBoundaryStrings {
  const StaffServerBoundaryStrings._({
    required this.gradebookDescription,
    required this.gradebookLabel,
    required this.gradebookMessage,
    required this.gradebookTitle,
    required this.messagesDescription,
    required this.messagesLabel,
    required this.messagesMessage,
    required this.messagesTitle,
  });

  factory StaffServerBoundaryStrings.forLocale(Locale locale) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla => const StaffServerBoundaryStrings._(
          gradebookDescription:
              'এই মোবাইল ক্লায়েন্টের জন্য প্রোডাকশন গ্রেডবুক রিড মডেল এখনো সক্রিয় নয়।',
          gradebookLabel: 'বিকল্প মূল্যায়ন ডেটা দেখানো হয়নি',
          gradebookMessage:
              'মোবাইল কনট্রাক্ট অনুমোদিত গ্রেড খসড়া সংরক্ষণ করতে পারে, কিন্তু কোনো কর্তৃত্বপূর্ণ মূল্যায়ন রিড মডেল এখনো পাওয়া যায় না। নমুনা স্কোরকে বর্তমান ডেটা হিসেবে কখনো দেখানো হবে না।',
          gradebookTitle: 'গ্রেডবুক পাওয়া যাচ্ছে না',
          messagesDescription:
              'এই মোবাইল ক্লায়েন্টের জন্য শিক্ষকের প্রোডাকশন কথোপকথন এখনো সক্রিয় নয়।',
          messagesLabel: 'বিকল্প কথোপকথন দেখানো হয়নি',
          messagesMessage:
              'কর্তৃত্বপূর্ণ শিক্ষক কথোপকথনের রিড মডেল এখনো পাওয়া যায় না। নমুনা কথোপকথনকে বর্তমান স্কুল ডেটা হিসেবে কখনো দেখানো হবে না।',
          messagesTitle: 'বার্তা পাওয়া যাচ্ছে না',
        ),
        SchoolLanguage.arabic => const StaffServerBoundaryStrings._(
          gradebookDescription:
              'لم يتم تفعيل نموذج قراءة سجل الدرجات الإنتاجي لهذا العميل المحمول بعد.',
          gradebookLabel: 'لم يتم عرض بيانات تقييم بديلة',
          gradebookMessage:
              'يمكن لعقد الهاتف حفظ مسودات الدرجات المصرح بها، لكن لا يتوفر بعد نموذج قراءة موثوق للتقييمات. لن تُعرض الدرجات التجريبية على أنها بيانات حالية.',
          gradebookTitle: 'سجل الدرجات غير متاح',
          messagesDescription:
              'لم يتم تفعيل محادثات المعلمين الإنتاجية لهذا العميل المحمول بعد.',
          messagesLabel: 'لم يتم عرض محادثات بديلة',
          messagesMessage:
              'لا يتوفر بعد نموذج قراءة موثوق لمحادثات المعلمين. لن تُعرض المحادثات التجريبية على أنها بيانات مدرسية حالية.',
          messagesTitle: 'الرسائل غير متاحة',
        ),
        SchoolLanguage.english => const StaffServerBoundaryStrings._(
          gradebookDescription:
              'The production gradebook read model is not activated for this mobile client yet.',
          gradebookLabel: 'No substitute assessment data shown',
          gradebookMessage:
              'The mobile contract can save authorized grade drafts, but no authoritative assessment read model is available yet. Sample scores are never shown as current data.',
          gradebookTitle: 'Gradebook unavailable',
          messagesDescription:
              'Production teacher conversations are not activated for this mobile client yet.',
          messagesLabel: 'No substitute conversations shown',
          messagesMessage:
              'No authoritative teacher conversation read model is available yet. Sample conversations are never shown as current school data.',
          messagesTitle: 'Messages unavailable',
        ),
      };

  final String gradebookDescription;
  final String gradebookLabel;
  final String gradebookMessage;
  final String gradebookTitle;
  final String messagesDescription;
  final String messagesLabel;
  final String messagesMessage;
  final String messagesTitle;
}
