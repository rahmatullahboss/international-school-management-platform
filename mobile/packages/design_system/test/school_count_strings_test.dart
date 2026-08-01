import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_count_strings.dart';

void main() {
  test('English copy uses zero, singular and plural sentences', () {
    final strings = SchoolCountStrings.forLocale(const Locale('en', 'GB'));

    expect(
      strings.attendanceChangesWaiting(0),
      'No attendance changes are waiting to sync.',
    );
    expect(
      strings.attendanceChangesWaiting(1),
      '1 attendance change is waiting to sync.',
    );
    expect(
      strings.attendanceChangesWaiting(3),
      '3 attendance changes are waiting to sync.',
    );
    expect(strings.unreadMessages(1), '1 unread message');
    expect(strings.publishedResults(4), '4 published results');
    expect(strings.rosterStudents(0), 'No students');
    expect(strings.rosterStudents(1), '1 student');
    expect(strings.rosterStudents(25), '25 students');
    expect(strings.assignedMeetings(2), '2 assigned meetings');
    expect(strings.documentsAvailable(1), '1 document available');
    expect(strings.formsAwaitingResponse(3), '3 forms are awaiting a response');
    expect(strings.openConversations(2), '2 open conversations');
    expect(
      strings.encryptedOperationsWaiting(1),
      '1 encrypted operation is waiting for server acceptance.',
    );
    expect(
      strings.operationsRequireReview(2),
      '2 operations are conflicted, rejected or require reconciliation.',
    );
  });

  test('Bangla copy localizes digits without English suffix placeholders', () {
    final strings = SchoolCountStrings.forLocale(const Locale('bn', 'BD'));

    expect(
      strings.attendanceChangesWaiting(2),
      '২টি উপস্থিতি পরিবর্তন সিঙ্কের অপেক্ষায় আছে।',
    );
    expect(strings.unreadMessages(12), '১২টি অপঠিত বার্তা');
    expect(strings.finalizedSessions(0), 'কোনো চূড়ান্ত সেশন নেই');
    expect(strings.rosterStudents(12), '১২ জন শিক্ষার্থী');
    expect(strings.assignedMeetings(3), '৩টি নির্ধারিত ক্লাস');
    expect(strings.documentsAvailable(4), '৪টি নথি উপলভ্য');
    expect(strings.formsAwaitingResponse(2), '২টি ফর্ম উত্তরের অপেক্ষায় আছে');
    expect(strings.openConversations(5), '৫টি চলমান কথোপকথন');
    expect(
      strings.encryptedOperationsWaiting(2),
      '২টি এনক্রিপ্টেড অপারেশন সার্ভারের অনুমোদনের অপেক্ষায় আছে।',
    );
    expect(
      strings.operationsRequireReview(1),
      '১টি অপারেশন দ্বন্দ্বে আছে, প্রত্যাখ্যাত হয়েছে বা সমন্বয় প্রয়োজন।',
    );
  });

  test(
    'Arabic copy applies reviewed cardinal categories and Arabic digits',
    () {
      final strings = SchoolCountStrings.forLocale(const Locale('ar', 'SA'));

      expect(
        strings.attendanceChangesWaiting(0),
        'لا توجد تغييرات حضور بانتظار المزامنة.',
      );
      expect(
        strings.attendanceChangesWaiting(1),
        'تغيير حضور واحد بانتظار المزامنة.',
      );
      expect(
        strings.attendanceChangesWaiting(2),
        'تغييران للحضور بانتظار المزامنة.',
      );
      expect(
        strings.attendanceChangesWaiting(7),
        '٧ تغييرات حضور بانتظار المزامنة.',
      );
      expect(strings.publishedResults(12), '١٢ نتيجة منشورة');
      expect(strings.rosterStudents(0), 'لا طلاب');
      expect(strings.rosterStudents(1), 'طالب واحد');
      expect(strings.rosterStudents(2), 'طالبان');
      expect(strings.rosterStudents(7), '٧ طلاب');
      expect(strings.assignedMeetings(2), 'حصتان مسندتان');
      expect(strings.documentsAvailable(3), '٣ مستندات متاحة');
      expect(strings.formsAwaitingResponse(1), 'نموذج واحد بانتظار الرد');
      expect(strings.openConversations(2), 'محادثتان مفتوحتان');
      expect(
        strings.encryptedOperationsWaiting(2),
        'عمليتان مشفرتان بانتظار قبول الخادم.',
      );
      expect(
        strings.operationsRequireReview(3),
        '٣ عمليات متعارضة أو مرفوضة أو تتطلب تسوية.',
      );
    },
  );

  test('count strings reject negative authority values', () {
    final strings = SchoolCountStrings.forLocale(const Locale('en'));

    expect(() => strings.unreadMessages(-1), throwsRangeError);
    expect(() => strings.publishedResults(-1), throwsRangeError);
    expect(() => strings.rosterStudents(-1), throwsRangeError);
    expect(() => strings.assignedMeetings(-1), throwsRangeError);
    expect(() => strings.documentsAvailable(-1), throwsRangeError);
    expect(() => strings.formsAwaitingResponse(-1), throwsRangeError);
    expect(() => strings.openConversations(-1), throwsRangeError);
    expect(() => strings.encryptedOperationsWaiting(-1), throwsRangeError);
    expect(() => strings.operationsRequireReview(-1), throwsRangeError);
  });
}
