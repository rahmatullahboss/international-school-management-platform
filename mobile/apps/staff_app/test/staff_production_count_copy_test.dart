import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_staff_app/main.dart';

void main() {
  test('staff production counts use reviewed English copy', () {
    final copy = StaffProductionCountCopy.forLocale(const Locale('en', 'GB'));

    expect(copy.rosterStudents(1), '1 student');
    expect(copy.rosterStudents(24), '24 students');
    expect(copy.assignedMeetings(0), 'No assigned meetings');
    expect(copy.assignedMeetings(2), '2 assigned meetings');
    expect(
      copy.encryptedOperationsWaiting(2),
      '2 encrypted operations are waiting for server acceptance.',
    );
    expect(
      copy.operationsRequireReview(1),
      '1 operation is conflicted, rejected or requires reconciliation.',
    );
  });

  test('staff production counts use Bangla digits and sentences', () {
    final copy = StaffProductionCountCopy.forLocale(const Locale('bn', 'BD'));

    expect(copy.rosterStudents(12), '১২ জন শিক্ষার্থী');
    expect(copy.assignedMeetings(3), '৩টি নির্ধারিত ক্লাস');
    expect(
      copy.encryptedOperationsWaiting(2),
      '২টি এনক্রিপ্টেড অপারেশন সার্ভারের অনুমোদনের অপেক্ষায় আছে।',
    );
    expect(
      copy.operationsRequireReview(1),
      '১টি অপারেশন দ্বন্দ্বে আছে, প্রত্যাখ্যাত হয়েছে বা সমন্বয় প্রয়োজন।',
    );
  });

  test('staff production counts use Arabic cardinal forms', () {
    final copy = StaffProductionCountCopy.forLocale(const Locale('ar', 'SA'));

    expect(copy.rosterStudents(2), 'طالبان');
    expect(copy.assignedMeetings(2), 'حصتان مسندتان');
    expect(
      copy.encryptedOperationsWaiting(2),
      'عمليتان مشفرتان بانتظار قبول الخادم.',
    );
    expect(
      copy.operationsRequireReview(3),
      '٣ عمليات متعارضة أو مرفوضة أو تتطلب تسوية.',
    );
  });

  test('staff production counts fail closed on negative values', () {
    final copy = StaffProductionCountCopy.forLocale(const Locale('en'));

    expect(() => copy.rosterStudents(-1), throwsRangeError);
    expect(() => copy.assignedMeetings(-1), throwsRangeError);
    expect(() => copy.encryptedOperationsWaiting(-1), throwsRangeError);
    expect(() => copy.operationsRequireReview(-1), throwsRangeError);
  });
}
