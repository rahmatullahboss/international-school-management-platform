import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_family_app/family_utc_presentation.dart';
import 'package:school_mobile_core/mobile_core.dart';

void main() {
  testWidgets('presents authoritative school wall time with explicit offset', (tester) async {
    final timestamp = SchoolAuthoritativeTimestamp.parse(
      timestamp: '2026-08-08T01:30:00.000+06:00',
      timeZoneId: 'Asia/Dhaka',
    );
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
            final wallClock = timestamp.schoolWallClock;
            expectedDate = localizations.formatMediumDate(wallClock);
            expectedTime = localizations.formatTimeOfDay(
              TimeOfDay(hour: wallClock.hour, minute: wallClock.minute),
            );
            dateLabel = FamilySchoolTimePresentation.date(context, timestamp);
            dateTimeLabel = FamilySchoolTimePresentation.dateTime(context, timestamp);
            return const SizedBox();
          },
        ),
      ),
    );

    expect(timestamp.instantUtc, DateTime.utc(2026, 8, 7, 19, 30));
    expect(dateLabel, '$expectedDate · UTC+06:00 · Asia/Dhaka');
    expect(
      dateTimeLabel,
      '$expectedDate · $expectedTime · UTC+06:00 · Asia/Dhaka',
    );
    expect(dateLabel, contains('Aug 8'));
  });

  test(
    'production Family interaction presentation never infers device timezone',
    () {
      final screenSource = File(
        'lib/family_interaction_screens.dart',
      ).readAsStringSync();
      final timeSource = File(
        'lib/family_utc_presentation.dart',
      ).readAsStringSync();

      expect(screenSource, isNot(contains('.toLocal()')));
      expect(timeSource, isNot(contains('.toLocal()')));
      expect(timeSource, contains('schoolWallClock'));
      expect(timeSource, contains('UTC\$sign'));
    },
  );
}
