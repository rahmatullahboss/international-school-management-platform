import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_pluralization.dart';

void main() {
  test('English cardinal rules distinguish one from other', () {
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('en'), 1),
      SchoolPluralCategory.one,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('en'), 0),
      SchoolPluralCategory.other,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('en'), 2),
      SchoolPluralCategory.other,
    );
  });

  test('Bangla cardinal rules treat zero and one as one category', () {
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('bn'), 0),
      SchoolPluralCategory.one,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('bn'), 1),
      SchoolPluralCategory.one,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('bn'), 2),
      SchoolPluralCategory.other,
    );
  });

  test('Arabic cardinal rules cover zero, one, two, few, many and other', () {
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('ar'), 0),
      SchoolPluralCategory.zero,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('ar'), 1),
      SchoolPluralCategory.one,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('ar'), 2),
      SchoolPluralCategory.two,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('ar'), 3),
      SchoolPluralCategory.few,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('ar'), 11),
      SchoolPluralCategory.many,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('ar'), 100),
      SchoolPluralCategory.other,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('ar'), 103),
      SchoolPluralCategory.few,
    );
    expect(
      SchoolCardinalPluralRules.categoryFor(const Locale('ar'), 111),
      SchoolPluralCategory.many,
    );
  });

  test('plural selection rejects negative counts', () {
    expect(
      () => SchoolCardinalPluralRules.categoryFor(const Locale('en'), -1),
      throwsRangeError,
    );
  });
}
