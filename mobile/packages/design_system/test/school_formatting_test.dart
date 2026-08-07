import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_formatting.dart';

void main() {
  group('exact money presentation', () {
    test('formats integer minor units without floating point conversion', () {
      expect(
        SchoolExactMoneyFormatter.format(
          currencyCode: 'BDT',
          fractionDigits: 2,
          locale: const Locale('en', 'BD'),
          minorUnits: 123456789,
        ),
        'BDT 1,234,567.89',
      );
      expect(
        SchoolExactMoneyFormatter.format(
          currencyCode: 'BDT',
          fractionDigits: 2,
          locale: const Locale('bn', 'BD'),
          minorUnits: 123456789,
        ),
        'BDT ১,২৩৪,৫৬৭.৮৯',
      );
      expect(
        SchoolExactMoneyFormatter.format(
          currencyCode: 'SAR',
          fractionDigits: 2,
          locale: const Locale('ar', 'SA'),
          minorUnits: 123456789,
        ),
        '١٬٢٣٤٬٥٦٧٫٨٩ \u2068SAR\u2069',
      );
    });

    test('preserves negative, zero-decimal and leading-zero values', () {
      expect(
        SchoolExactMoneyFormatter.format(
          currencyCode: 'JPY',
          fractionDigits: 0,
          locale: const Locale('en'),
          minorUnits: -1200,
        ),
        'JPY −1,200',
      );
      expect(
        SchoolExactMoneyFormatter.format(
          currencyCode: 'USD',
          fractionDigits: 2,
          locale: const Locale('en'),
          minorUnits: 5,
        ),
        'USD 0.05',
      );
    });

    test('rejects malformed currency metadata', () {
      expect(
        () => SchoolExactMoneyFormatter.format(
          currencyCode: 'usd',
          fractionDigits: 2,
          locale: const Locale('en'),
          minorUnits: 100,
        ),
        throwsArgumentError,
      );
      expect(
        () => SchoolExactMoneyFormatter.format(
          currencyCode: 'USD',
          fractionDigits: 7,
          locale: const Locale('en'),
          minorUnits: 100,
        ),
        throwsRangeError,
      );
    });
  });

  group('explicit offset timestamp presentation', () {
    test('formats the authoritative offset without device inference', () {
      final timestamp = SchoolOffsetTimestamp(
        instantUtc: DateTime.utc(2026, 7, 30, 12, 5),
        offset: const Duration(hours: 6),
        timeZoneId: 'Asia/Dhaka',
      );

      expect(
        timestamp.format(const Locale('en', 'BD')),
        '2026-07-30 18:05 UTC+06:00 \u2068Asia/Dhaka\u2069',
      );
      expect(
        timestamp.format(const Locale('bn', 'BD')),
        '২০২৬-০৭-৩০ ১৮:০৫ UTC+০৬:০০ \u2068Asia/Dhaka\u2069',
      );
      expect(
        timestamp.format(const Locale('ar', 'SA')),
        '٢٠٢٦-٠٧-٣٠ ١٨:٠٥ UTC+٠٦:٠٠ \u2068Asia/Dhaka\u2069',
      );
    });

    test('supports explicit negative offsets', () {
      final timestamp = SchoolOffsetTimestamp(
        instantUtc: DateTime.utc(2026, 7, 30, 12, 5),
        offset: const Duration(hours: -4, minutes: -30),
        timeZoneId: 'America/St_Johns',
      );

      expect(
        timestamp.format(const Locale('en', 'CA')),
        '2026-07-30 07:35 UTC−04:30 \u2068America/St_Johns\u2069',
      );
    });

    test('rejects local instants, invalid offsets and control characters', () {
      expect(
        () => SchoolOffsetTimestamp(
          instantUtc: DateTime(2026, 7, 30, 12),
          offset: Duration.zero,
          timeZoneId: 'UTC',
        ),
        throwsArgumentError,
      );
      expect(
        () => SchoolOffsetTimestamp(
          instantUtc: DateTime.utc(2026, 7, 30, 12),
          offset: const Duration(hours: 15),
          timeZoneId: 'UTC+15',
        ),
        throwsArgumentError,
      );
      expect(
        () => SchoolOffsetTimestamp(
          instantUtc: DateTime.utc(2026, 7, 30, 12),
          offset: Duration.zero,
          timeZoneId: 'UTC\nsecret',
        ),
        throwsArgumentError,
      );
    });
  });
}
