import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_family_app/family_utc_presentation.dart';

void main() {
  testWidgets('presents server instants explicitly as UTC', (tester) async {
    final source = DateTime.parse('2026-08-08T01:30:00+06:00');
    final utc = source.toUtc();
    late String dateLabel;
    late String dateTimeLabel;
    late String expectedDate;
    late String expectedTime;

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en', 'US'),
        home: Builder(
          builder: (context) {
            final localizations = MaterialLocalizations.of(context);
            expectedDate = localizations.formatMediumDate(utc);
            expectedTime = localizations.formatTimeOfDay(
              TimeOfDay(hour: utc.hour, minute: utc.minute),
            );
            dateLabel = FamilyUtcPresentation.date(context, source);
            dateTimeLabel = FamilyUtcPresentation.dateTime(context, source);
            return const SizedBox();
          },
        ),
      ),
    );

    expect(utc, DateTime.utc(2026, 8, 7, 19, 30));
    expect(dateLabel, '$expectedDate · UTC');
    expect(dateTimeLabel, '$expectedDate · $expectedTime · UTC');
    expect(dateLabel, isNot(contains('Aug 8')));
  });

  test(
    'production Family interaction presentation never infers device timezone',
    () {
      final screenSource = File(
        'lib/family_interaction_screens.dart',
      ).readAsStringSync();
      final utcSource = File(
        'lib/family_utc_presentation.dart',
      ).readAsStringSync();

      expect(screenSource, isNot(contains('.toLocal()')));
      expect(utcSource, isNot(contains('.toLocal()')));
      expect(utcSource, contains('.toUtc()'));
    },
  );
}
