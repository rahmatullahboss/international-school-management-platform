import 'package:flutter/widgets.dart';
import 'package:school_design_system/school_localization.dart';

/// App-owned localized copy for teacher production journeys and attendance sync.
///
/// This layer controls presentation only. Scheduling, roster, attendance and
/// synchronization authority remain with the existing server contracts.
final class StaffProductionStrings {
  const StaffProductionStrings._({
    required this.absent,
    required this.acceptedByServer,
    required this.alreadyAccepted,
    required this.assignedMeetingsDescription,
    required this.assignedRosterUnverified,
    required this.attendanceCaptureUnavailable,
    required this.attendanceRoster,
    required this.authorizedSession,
    required this.deviceOperationJournal,
    required this.encryptedQueueUnavailable,
    required this.excused,
    required this.late,
    required this.manualReviewRequired,
    required this.noAssignedMeetings,
    required this.noAttendanceOperationsWaiting,
    required this.noPendingDraft,
    required this.noRosterSubstituted,
    required this.noStudentsInAuthorizedRoster,
    required this.noSubstituteClassDataShown,
    required this.noTeacherMeetingsAssigned,
    required this.onlyAssignedRosters,
    required this.openAssignedMeetingFirst,
    required this.present,
    required this.reconciliationRequired,
    required this.refreshStatus,
    required this.rejected,
    required this.reviewRequired,
    required this.rosterNotSelected,
    required this.rosterUnavailable,
    required this.saveBeforeLeaving,
    required this.saveEncryptedDraft,
    required this.savedOnDevice,
    required this.schedulesRemainHidden,
    required this.selectMeeting,
    required this.sending,
    required this.serverAttendanceAuthoritative,
    required this.substitution,
    required this.syncNow,
    required this.syncUnavailable,
    required this.teacherInformationUnavailable,
    required this.teacherInformationUnverified,
    required this.tryAgain,
    required this.unsavedChanges,
    required this.versionConflict,
    required this.waitingForNetwork,
  });

  factory StaffProductionStrings.forLocale(Locale locale) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla => const StaffProductionStrings._(
          absent: 'অনুপস্থিত',
          acceptedByServer: 'সার্ভার গ্রহণ করেছে',
          alreadyAccepted: 'আগেই গ্রহণ করা হয়েছে',
          assignedMeetingsDescription:
              'নির্বাচিত স্কুল ক্যাম্পাসের নির্ধারিত ক্লাস ও বিকল্প দায়িত্ব।',
          assignedRosterUnverified:
              'এই ক্লাসের নির্ধারিত রোস্টার যাচাই করা যায়নি।',
          attendanceCaptureUnavailable:
              'অনুমোদিত রোস্টার সেবা সাড়া না দেওয়া পর্যন্ত উপস্থিতি নেওয়া যাবে না।',
          attendanceRoster: 'উপস্থিতির রোস্টার',
          authorizedSession: 'অনুমোদিত সেশন',
          deviceOperationJournal: 'ডিভাইস অপারেশন জার্নাল',
          encryptedQueueUnavailable:
              'এনক্রিপ্টেড উপস্থিতি কিউ খোলা যায়নি।',
          excused: 'অনুমোদিত অনুপস্থিতি',
          late: 'দেরিতে',
          manualReviewRequired: 'ম্যানুয়াল পর্যালোচনা প্রয়োজন',
          noAssignedMeetings: 'কোনো নির্ধারিত ক্লাস নেই',
          noAttendanceOperationsWaiting:
              'এই ডিভাইসে কোনো উপস্থিতি অপারেশন অপেক্ষায় নেই।',
          noPendingDraft: 'কোনো অপেক্ষমাণ খসড়া নেই',
          noRosterSubstituted: 'বিকল্প রোস্টার দেখানো হয়নি',
          noStudentsInAuthorizedRoster:
              'অনুমোদিত রোস্টারে কোনো শিক্ষার্থী নেই।',
          noSubstituteClassDataShown: 'বিকল্প ক্লাস ডেটা দেখানো হয়নি',
          noTeacherMeetingsAssigned:
              'এই দিনের জন্য কোনো শিক্ষক ক্লাস নির্ধারিত নেই।',
          onlyAssignedRosters:
              'শুধু নির্ধারিত ক্লাসের রোস্টার এই ডিভাইসে খোলা যাবে।',
          openAssignedMeetingFirst:
              'প্রথমে আজকের পেজ থেকে একটি নির্ধারিত ক্লাস খুলুন।',
          present: 'উপস্থিত',
          reconciliationRequired: 'সমন্বয় প্রয়োজন',
          refreshStatus: 'স্ট্যাটাস হালনাগাদ করুন',
          rejected: 'প্রত্যাখ্যাত',
          reviewRequired: 'পর্যালোচনা প্রয়োজন',
          rosterNotSelected: 'রোস্টার নির্বাচন করা হয়নি',
          rosterUnavailable: 'রোস্টার পাওয়া যাচ্ছে না',
          saveBeforeLeaving:
              'স্ক্রিন ছাড়ার আগে এই রোস্টারটি এনক্রিপ্টেড ডিভাইস স্টোরেজে সংরক্ষণ করুন।',
          saveEncryptedDraft: 'এনক্রিপ্টেড খসড়া সংরক্ষণ করুন',
          savedOnDevice: 'ডিভাইসে সংরক্ষিত',
          schedulesRemainHidden:
              'অনুমোদিত সেবা সাড়া না দেওয়া পর্যন্ত সময়সূচি, রোস্টার ও অপারেশনাল রেকর্ড গোপন থাকবে।',
          selectMeeting: 'একটি ক্লাস নির্বাচন করুন',
          sending: 'পাঠানো হচ্ছে',
          serverAttendanceAuthoritative:
              'উপস্থিতি গ্রহণ ও লক করার চূড়ান্ত কর্তৃত্ব সার্ভারের।',
          substitution: 'বিকল্প দায়িত্ব',
          syncNow: 'এখন সিঙ্ক করুন',
          syncUnavailable: 'সিঙ্ক পাওয়া যাচ্ছে না',
          teacherInformationUnavailable: 'শিক্ষকের তথ্য পাওয়া যাচ্ছে না',
          teacherInformationUnverified:
              'এই স্কুল স্কোপে নির্ধারিত শিক্ষকের তথ্য যাচাই করা যায়নি।',
          tryAgain: 'আবার চেষ্টা করুন',
          unsavedChanges: 'অসংরক্ষিত পরিবর্তন',
          versionConflict: 'ভার্সন সংঘাত',
          waitingForNetwork: 'নেটওয়ার্কের অপেক্ষায়',
        ),
        SchoolLanguage.arabic => const StaffProductionStrings._(
          absent: 'غائب',
          acceptedByServer: 'تم القبول من الخادم',
          alreadyAccepted: 'تم القبول مسبقًا',
          assignedMeetingsDescription:
              'الحصص المعينة والبدائل للحرم المدرسي المحدد.',
          assignedRosterUnverified:
              'تعذر التحقق من القائمة المعينة لهذه الحصة.',
          attendanceCaptureUnavailable:
              'لا يمكن تسجيل الحضور حتى تستجيب خدمة القوائم المصرح بها.',
          attendanceRoster: 'قائمة الحضور',
          authorizedSession: 'جلسة مصرح بها',
          deviceOperationJournal: 'سجل عمليات الجهاز',
          encryptedQueueUnavailable:
              'تعذر فتح قائمة انتظار الحضور المشفرة.',
          excused: 'بعذر',
          late: 'متأخر',
          manualReviewRequired: 'مراجعة يدوية مطلوبة',
          noAssignedMeetings: 'لا توجد حصص معينة',
          noAttendanceOperationsWaiting:
              'لا توجد عمليات حضور منتظرة على هذا الجهاز.',
          noPendingDraft: 'لا توجد مسودة معلقة',
          noRosterSubstituted: 'لم يتم عرض قائمة بديلة',
          noStudentsInAuthorizedRoster:
              'لا يوجد طلاب في القائمة المصرح بها.',
          noSubstituteClassDataShown: 'لم يتم عرض بيانات صف بديلة',
          noTeacherMeetingsAssigned: 'لا توجد حصص للمعلم معينة لهذا اليوم.',
          onlyAssignedRosters:
              'يمكن فتح قوائم الحصص المعينة فقط على هذا الجهاز.',
          openAssignedMeetingFirst:
              'افتح حصة معينة من صفحة اليوم أولًا.',
          present: 'حاضر',
          reconciliationRequired: 'المطابقة مطلوبة',
          refreshStatus: 'تحديث الحالة',
          rejected: 'مرفوض',
          reviewRequired: 'المراجعة مطلوبة',
          rosterNotSelected: 'لم يتم اختيار قائمة',
          rosterUnavailable: 'القائمة غير متاحة',
          saveBeforeLeaving:
              'احفظ هذه القائمة في تخزين الجهاز المشفر قبل مغادرة الشاشة.',
          saveEncryptedDraft: 'حفظ المسودة المشفرة',
          savedOnDevice: 'محفوظ على الجهاز',
          schedulesRemainHidden:
              'تظل الجداول والقوائم والسجلات التشغيلية مخفية حتى تستجيب الخدمة المصرح بها.',
          selectMeeting: 'اختر حصة',
          sending: 'جارٍ الإرسال',
          serverAttendanceAuthoritative:
              'يبقى الخادم المرجع النهائي لقبول الحضور وقفل السجل.',
          substitution: 'بديل',
          syncNow: 'المزامنة الآن',
          syncUnavailable: 'المزامنة غير متاحة',
          teacherInformationUnavailable: 'معلومات المعلم غير متاحة',
          teacherInformationUnverified:
              'تعذر التحقق من معلومات المعلم المعين ضمن نطاق المدرسة هذا.',
          tryAgain: 'حاول مرة أخرى',
          unsavedChanges: 'تغييرات غير محفوظة',
          versionConflict: 'تعارض الإصدار',
          waitingForNetwork: 'بانتظار الشبكة',
        ),
        SchoolLanguage.english => const StaffProductionStrings._(
          absent: 'Absent',
          acceptedByServer: 'Accepted by server',
          alreadyAccepted: 'Already accepted',
          assignedMeetingsDescription:
              'Assigned meetings and substitutions for the selected school campus.',
          assignedRosterUnverified:
              'The assigned roster could not be verified for this meeting.',
          attendanceCaptureUnavailable:
              'Attendance capture is unavailable until the authorized roster service responds.',
          attendanceRoster: 'Attendance roster',
          authorizedSession: 'Authorized session',
          deviceOperationJournal: 'Device operation journal',
          encryptedQueueUnavailable:
              'The encrypted attendance queue could not be opened.',
          excused: 'Excused',
          late: 'Late',
          manualReviewRequired: 'Manual review required',
          noAssignedMeetings: 'No assigned meetings',
          noAttendanceOperationsWaiting:
              'No attendance operations are waiting on this device.',
          noPendingDraft: 'No pending draft',
          noRosterSubstituted: 'No roster substituted',
          noStudentsInAuthorizedRoster:
              'No students are present in the authorized roster.',
          noSubstituteClassDataShown: 'No substitute class data shown',
          noTeacherMeetingsAssigned:
              'No teacher meetings are assigned for this day.',
          onlyAssignedRosters:
              'Only rosters for assigned meetings can be opened on this device.',
          openAssignedMeetingFirst:
              'Open an assigned meeting from Today first.',
          present: 'Present',
          reconciliationRequired: 'Reconciliation required',
          refreshStatus: 'Refresh status',
          rejected: 'Rejected',
          reviewRequired: 'Review required',
          rosterNotSelected: 'Roster not selected',
          rosterUnavailable: 'Roster unavailable',
          saveBeforeLeaving:
              'Save this roster to encrypted device storage before leaving the screen.',
          saveEncryptedDraft: 'Save encrypted draft',
          savedOnDevice: 'Saved on device',
          schedulesRemainHidden:
              'Schedules, rosters and operational records remain hidden until the authorized service responds.',
          selectMeeting: 'Select a meeting',
          sending: 'Sending',
          serverAttendanceAuthoritative:
              'The server remains authoritative for attendance acceptance and locking.',
          substitution: 'Substitution',
          syncNow: 'Sync now',
          syncUnavailable: 'Sync unavailable',
          teacherInformationUnavailable: 'Teacher information unavailable',
          teacherInformationUnverified:
              'Assigned teacher information could not be verified for this school scope.',
          tryAgain: 'Try again',
          unsavedChanges: 'Unsaved changes',
          versionConflict: 'Version conflict',
          waitingForNetwork: 'Waiting for network',
        ),
      };

  final String absent;
  final String acceptedByServer;
  final String alreadyAccepted;
  final String assignedMeetingsDescription;
  final String assignedRosterUnverified;
  final String attendanceCaptureUnavailable;
  final String attendanceRoster;
  final String authorizedSession;
  final String deviceOperationJournal;
  final String encryptedQueueUnavailable;
  final String excused;
  final String late;
  final String manualReviewRequired;
  final String noAssignedMeetings;
  final String noAttendanceOperationsWaiting;
  final String noPendingDraft;
  final String noRosterSubstituted;
  final String noStudentsInAuthorizedRoster;
  final String noSubstituteClassDataShown;
  final String noTeacherMeetingsAssigned;
  final String onlyAssignedRosters;
  final String openAssignedMeetingFirst;
  final String present;
  final String reconciliationRequired;
  final String refreshStatus;
  final String rejected;
  final String reviewRequired;
  final String rosterNotSelected;
  final String rosterUnavailable;
  final String saveBeforeLeaving;
  final String saveEncryptedDraft;
  final String savedOnDevice;
  final String schedulesRemainHidden;
  final String selectMeeting;
  final String sending;
  final String serverAttendanceAuthoritative;
  final String substitution;
  final String syncNow;
  final String syncUnavailable;
  final String teacherInformationUnavailable;
  final String teacherInformationUnverified;
  final String tryAgain;
  final String unsavedChanges;
  final String versionConflict;
  final String waitingForNetwork;
}
