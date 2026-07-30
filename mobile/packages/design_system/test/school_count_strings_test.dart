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
  });

  test('Bangla copy localizes digits without English suffix placeholders', () {
    final strings = SchoolCountStrings.forLocale(const Locale('bn', 'BD'));

    expect(
      strings.attendanceChangesWaiting(2),
      '২টি উপস্থিতি পরিবর্তন সিঙ্কের অপেক্ষায় আছে।',
    );
    expect(strings.unreadMessages(12), '১২টি অপঠিত বার্তা');
    expect(strings.finalizedSessions(0), 'কোনো চূড়ান্ত সেশন নেই');
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
    },
  );

  test('count strings reject negative authority values', () {
    final strings = SchoolCountStrings.forLocale(const Locale('en'));

    expect(() => strings.unreadMessages(-1), throwsRangeError);
    expect(() => strings.publishedResults(-1), throwsRangeError);
  });
}
