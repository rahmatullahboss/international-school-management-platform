import 'package:flutter/widgets.dart';
import 'package:school_design_system/school_localization.dart';

/// Cardinal plural categories used by reviewed mobile presentation copy.
enum SchoolPluralCategory { zero, one, two, few, many, other }

/// Integer cardinal plural rules for the approved English, Bangla and Arabic
/// mobile locales.
///
/// The rules select presentation copy only. They do not change counts,
/// authorization, academic calculations, financial values or server commands.
abstract final class SchoolCardinalPluralRules {
  static SchoolPluralCategory categoryFor(Locale locale, int count) {
    if (count < 0) {
      throw RangeError.value(
        count,
        'count',
        'A non-negative count is required.',
      );
    }

    return switch (SchoolLocalePolicy.resolve(locale)) {
      SchoolLanguage.english =>
        count == 1 ? SchoolPluralCategory.one : SchoolPluralCategory.other,
      SchoolLanguage.bangla =>
        count == 0 || count == 1
            ? SchoolPluralCategory.one
            : SchoolPluralCategory.other,
      SchoolLanguage.arabic => _arabic(count),
    };
  }

  static SchoolPluralCategory _arabic(int count) {
    if (count == 0) return SchoolPluralCategory.zero;
    if (count == 1) return SchoolPluralCategory.one;
    if (count == 2) return SchoolPluralCategory.two;

    final remainder = count % 100;
    if (remainder >= 3 && remainder <= 10) {
      return SchoolPluralCategory.few;
    }
    if (remainder >= 11 && remainder <= 99) {
      return SchoolPluralCategory.many;
    }
    return SchoolPluralCategory.other;
  }
}
