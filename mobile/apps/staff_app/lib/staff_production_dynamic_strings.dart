import 'package:flutter/widgets.dart';
import 'package:school_design_system/school_localization.dart';

/// Locale-aware Staff sentences that contain authoritative dynamic values.
abstract final class StaffProductionDynamicStrings {
  static String rosterVersionDescription(Locale locale, int version) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla =>
          'ভার্সন $version · সার্ভার গ্রহণ না করা পর্যন্ত এনক্রিপ্টেড খসড়া চূড়ান্ত নয়।',
        SchoolLanguage.arabic =>
          'الإصدار $version · تبقى المسودات المشفرة غير نهائية حتى يقبلها الخادم.',
        SchoolLanguage.english =>
          'Version $version · encrypted drafts remain non-authoritative until server acceptance.',
      };

  static String encryptedOperation(Locale locale, String isolatedOperationId) =>
      switch (SchoolLocalePolicy.resolve(locale)) {
        SchoolLanguage.bangla =>
          'অপারেশন $isolatedOperationId · এনক্রিপ্টেড পেলোড',
        SchoolLanguage.arabic =>
          'العملية $isolatedOperationId · حمولة مشفرة',
        SchoolLanguage.english =>
          'Operation $isolatedOperationId · encrypted payload',
      };
}
