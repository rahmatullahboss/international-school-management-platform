import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_family_app/family_production_strings.dart';

void main() {
  test('provides reviewed Family read copy for English Bangla and Arabic', () {
    final english = FamilyProductionStrings.forLocale(const Locale('en', 'GB'));
    final bangla = FamilyProductionStrings.forLocale(const Locale('bn', 'BD'));
    final arabic = FamilyProductionStrings.forLocale(const Locale('ar', 'SA'));

    expect(english.reviewAttendance, 'Review attendance');
    expect(english.feesAndReceipts, 'Fees and receipts');
    expect(bangla.reviewAttendance, 'উপস্থিতি দেখুন');
    expect(bangla.noPublishedResults, 'কোনো প্রকাশিত ফলাফল নেই।');
    expect(arabic.reviewAttendance, 'مراجعة الحضور');
    expect(arabic.noPublishedResults, 'لا توجد نتائج منشورة.');
  });

  test('falls back to English for unsupported locales', () {
    final strings = FamilyProductionStrings.forLocale(const Locale('fr', 'FR'));

    expect(strings.messages, 'Messages');
    expect(strings.tryAgain, 'Try again');
    expect(strings.outstanding, 'Outstanding');
  });
}
