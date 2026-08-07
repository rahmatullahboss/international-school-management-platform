import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_staff_app/staff_production_dynamic_strings.dart';
import 'package:school_staff_app/staff_production_strings.dart';

void main() {
  test('provides reviewed Staff production copy for English Bangla and Arabic', () {
    final english = StaffProductionStrings.forLocale(const Locale('en', 'GB'));
    final bangla = StaffProductionStrings.forLocale(const Locale('bn', 'BD'));
    final arabic = StaffProductionStrings.forLocale(const Locale('ar', 'SA'));

    expect(english.saveEncryptedDraft, 'Save encrypted draft');
    expect(english.reconciliationRequired, 'Reconciliation required');
    expect(bangla.saveEncryptedDraft, 'এনক্রিপ্টেড খসড়া সংরক্ষণ করুন');
    expect(bangla.rosterUnavailable, 'রোস্টার পাওয়া যাচ্ছে না');
    expect(arabic.saveEncryptedDraft, 'حفظ المسودة المشفرة');
    expect(arabic.rosterUnavailable, 'القائمة غير متاحة');
  });

  test('localizes dynamic Staff sentences without changing values', () {
    expect(
      StaffProductionDynamicStrings.rosterVersionDescription(
        const Locale('bn', 'BD'),
        7,
      ),
      contains('7'),
    );
    expect(
      StaffProductionDynamicStrings.encryptedOperation(
        const Locale('ar', 'SA'),
        'op-42',
      ),
      contains('op-42'),
    );
    expect(
      StaffProductionDynamicStrings.rosterVersionDescription(
        const Locale('en', 'GB'),
        3,
      ),
      'Version 3 · encrypted drafts remain non-authoritative until server acceptance.',
    );
  });

  test('falls back to English for unsupported locales', () {
    final strings = StaffProductionStrings.forLocale(const Locale('fr', 'FR'));

    expect(strings.present, 'Present');
    expect(strings.syncUnavailable, 'Sync unavailable');
    expect(strings.tryAgain, 'Try again');
    expect(
      StaffProductionDynamicStrings.encryptedOperation(
        const Locale('fr', 'FR'),
        'op-1',
      ),
      'Operation op-1 · encrypted payload',
    );
  });
}
