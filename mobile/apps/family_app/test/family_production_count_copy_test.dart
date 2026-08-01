import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_family_app/main.dart';

void main() {
  test('family production counts use reviewed English copy', () {
    final copy = FamilyProductionCountCopy.forLocale(const Locale('en', 'GB'));

    expect(copy.documentsAvailable(0), 'No documents available');
    expect(copy.documentsAvailable(2), '2 documents available');
    expect(copy.formsAwaitingResponse(1), '1 form is awaiting a response');
    expect(copy.openConversations(3), '3 open conversations');
  });

  test('family production counts use Bangla digits and sentences', () {
    final copy = FamilyProductionCountCopy.forLocale(const Locale('bn', 'BD'));

    expect(copy.documentsAvailable(12), '১২টি নথি উপলভ্য');
    expect(copy.formsAwaitingResponse(2), '২টি ফর্ম উত্তরের অপেক্ষায় আছে');
    expect(copy.openConversations(4), '৪টি চলমান কথোপকথন');
  });

  test('family production counts use Arabic cardinal forms', () {
    final copy = FamilyProductionCountCopy.forLocale(const Locale('ar', 'SA'));

    expect(copy.documentsAvailable(2), 'مستندان متاحان');
    expect(copy.formsAwaitingResponse(3), '٣ نماذج بانتظار الرد');
    expect(copy.openConversations(2), 'محادثتان مفتوحتان');
  });

  test('family production counts fail closed on negative values', () {
    final copy = FamilyProductionCountCopy.forLocale(const Locale('en'));

    expect(() => copy.documentsAvailable(-1), throwsRangeError);
    expect(() => copy.formsAwaitingResponse(-1), throwsRangeError);
    expect(() => copy.openConversations(-1), throwsRangeError);
  });
}
