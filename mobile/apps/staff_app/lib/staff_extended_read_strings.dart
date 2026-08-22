import 'package:flutter/widgets.dart';
import 'package:school_design_system/school_localization.dart';

final class StaffExtendedReadStrings {
  const StaffExtendedReadStrings._({
    required this.assessmentsDescription,
    required this.assessmentsEmpty,
    required this.assessmentsTitle,
    required this.conversationsDescription,
    required this.conversationsEmpty,
    required this.conversationsTitle,
    required this.enteredOfRoster,
    required this.latestWindowNotice,
    required this.locked,
    required this.messagesEmpty,
    required this.open,
    required this.readOnlyConversation,
    required this.refresh,
    required this.unavailable,
  });

  factory StaffExtendedReadStrings.forLocale(
    Locale locale,
  ) => switch (SchoolLocalePolicy.resolve(locale)) {
    SchoolLanguage.bangla => const StaffExtendedReadStrings._(
      assessmentsDescription: 'আপনার নির্ধারিত সেকশনের কর্তৃত্বপূর্ণ মূল্যায়ন।',
      assessmentsEmpty: 'এই স্কুল স্কোপে কোনো নির্ধারিত মূল্যায়ন নেই।',
      assessmentsTitle: 'মূল্যায়ন',
      conversationsDescription:
          'আপনি যেসব কথোপকথনে বর্তমান স্টাফ অংশগ্রহণকারী।',
      conversationsEmpty: 'কোনো অনুমোদিত কথোপকথন নেই।',
      conversationsTitle: 'কথোপকথন',
      enteredOfRoster: 'এন্ট্রি %1 / %2',
      latestWindowNotice:
          'সর্বশেষ রেকর্ডগুলো দেখানো হচ্ছে; আগের রেকর্ডের জন্য পূর্ণ পোর্টাল ব্যবহার করুন।',
      locked: 'লক করা',
      messagesEmpty: 'যোগদানের পর কোনো বার্তা নেই।',
      open: 'খোলা',
      readOnlyConversation: 'এই মোবাইল ভিউটি এখন শুধু পড়ার জন্য।',
      refresh: 'হালনাগাদ করুন',
      unavailable: 'কর্তৃত্বপূর্ণ ডেটা এখন পাওয়া যাচ্ছে না।',
    ),
    SchoolLanguage.arabic => const StaffExtendedReadStrings._(
      assessmentsDescription: 'التقييمات الموثوقة للأقسام المعينة لك.',
      assessmentsEmpty: 'لا توجد تقييمات معينة في نطاق المدرسة هذا.',
      assessmentsTitle: 'التقييمات',
      conversationsDescription: 'المحادثات التي تشارك فيها حاليًا كموظف.',
      conversationsEmpty: 'لا توجد محادثات مصرح بها.',
      conversationsTitle: 'المحادثات',
      enteredOfRoster: 'تم الإدخال %1 / %2',
      latestWindowNotice:
          'يتم عرض أحدث السجلات؛ استخدم البوابة الكاملة للسجلات الأقدم.',
      locked: 'مقفل',
      messagesEmpty: 'لا توجد رسائل بعد انضمامك.',
      open: 'مفتوح',
      readOnlyConversation: 'عرض المحادثة على الهاتف للقراءة فقط حاليًا.',
      refresh: 'تحديث',
      unavailable: 'البيانات الموثوقة غير متاحة الآن.',
    ),
    SchoolLanguage.english => const StaffExtendedReadStrings._(
      assessmentsDescription:
          'Authoritative assessments for sections assigned to you.',
      assessmentsEmpty:
          'No assigned assessments are available in this school scope.',
      assessmentsTitle: 'Assessments',
      conversationsDescription:
          'Conversations where you are a current staff participant.',
      conversationsEmpty: 'No authorized conversations are available.',
      conversationsTitle: 'Conversations',
      enteredOfRoster: 'Entered %1 / %2',
      latestWindowNotice:
          'Showing the latest records; use the full portal for older records.',
      locked: 'Locked',
      messagesEmpty: 'No messages have been sent since you joined.',
      open: 'Open',
      readOnlyConversation: 'Mobile conversation access is read-only for now.',
      refresh: 'Refresh',
      unavailable: 'Authoritative data is unavailable right now.',
    ),
  };

  final String assessmentsDescription;
  final String assessmentsEmpty;
  final String assessmentsTitle;
  final String conversationsDescription;
  final String conversationsEmpty;
  final String conversationsTitle;
  final String enteredOfRoster;
  final String latestWindowNotice;
  final String locked;
  final String messagesEmpty;
  final String open;
  final String readOnlyConversation;
  final String refresh;
  final String unavailable;

  String enteredCount(int entered, int roster) => enteredOfRoster
      .replaceFirst('%1', entered.toString())
      .replaceFirst('%2', roster.toString());
}
