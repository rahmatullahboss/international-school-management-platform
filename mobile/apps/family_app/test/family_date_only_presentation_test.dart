import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_design_system.dart';
import 'package:school_family_app/family_date_only_presentation.dart';

void main() {
  testWidgets(
    'date-only display follows the active locale without changing payload',
    (tester) async {
      const isoDate = '2026-08-07';
      late String banglaLabel;
      late String expectedBangla;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              expectedBangla = MaterialLocalizations.of(
                context,
              ).formatMediumDate(DateTime(2026, 8, 7));
              banglaLabel = FamilyDateOnlyPresentation.display(
                context,
                isoDate,
              );
              return const SizedBox();
            },
          ),
          locale: const Locale('bn'),
          localizationsDelegates:
              SchoolLocalizationConfiguration.localizationsDelegates,
          supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
        ),
      );

      expect(banglaLabel, expectedBangla);
      expect(banglaLabel, isNot(isoDate));
      expect(FamilyDateOnlyPresentation.encode(DateTime(2026, 8, 7)), isoDate);
    },
  );

  test('strict date-only parsing rejects rollover and timestamp values', () {
    expect(FamilyDateOnlyPresentation.parse('2026-02-29'), isNull);
    expect(FamilyDateOnlyPresentation.parse('2026-08-07T00:00:00Z'), isNull);
    expect(
      FamilyDateOnlyPresentation.parse('2026-08-07'),
      DateTime(2026, 8, 7),
    );
  });

  test('date-only presenter never performs timezone conversion', () {
    final source = File(
      'lib/family_date_only_presentation.dart',
    ).readAsStringSync();

    expect(source, isNot(contains('.toLocal()')));
    expect(source, isNot(contains('.toUtc()')));
  });
}
