import 'package:flutter/widgets.dart';
import 'package:school_design_system/school_localization.dart';

/// Presentation-only formatter for exact integer minor-unit amounts.
///
/// This formatter never accepts floating-point money and never performs tax,
/// balance, invoice, fee, discount, or exchange-rate calculations.
abstract final class SchoolExactMoneyFormatter {
  static final _currencyCode = RegExp(r'^[A-Z]{3}$');

  static String format({
    required String currencyCode,
    required int fractionDigits,
    required Locale locale,
    required int minorUnits,
  }) {
    if (!_currencyCode.hasMatch(currencyCode)) {
      throw ArgumentError.value(
        currencyCode,
        'currencyCode',
        'A three-letter uppercase currency code is required.',
      );
    }
    if (fractionDigits < 0 || fractionDigits > 6) {
      throw RangeError.range(fractionDigits, 0, 6, 'fractionDigits');
    }

    final negative = minorUnits.isNegative;
    final digits = minorUnits.abs().toString().padLeft(fractionDigits + 1, '0');
    final integerEnd = digits.length - fractionDigits;
    final integerDigits = fractionDigits == 0
        ? digits
        : digits.substring(0, integerEnd);
    final fraction = fractionDigits == 0 ? '' : digits.substring(integerEnd);
    final language = SchoolLocalePolicy.resolve(locale);
    final grouped = _groupInteger(
      integerDigits,
      language == SchoolLanguage.arabic ? '٬' : ',',
    );
    final decimalSeparator = language == SchoolLanguage.arabic ? '٫' : '.';
    final asciiNumber = fraction.isEmpty
        ? grouped
        : '$grouped$decimalSeparator$fraction';
    final localizedNumber = _SchoolLocalizedDigits.convert(
      negative ? '−$asciiNumber' : asciiNumber,
      language,
    );

    if (language == SchoolLanguage.arabic) {
      return '$localizedNumber ${SchoolBidirectionalText.isolate(currencyCode)}';
    }
    return '$currencyCode $localizedNumber';
  }

  static String _groupInteger(String digits, String separator) {
    final buffer = StringBuffer();
    for (var index = 0; index < digits.length; index += 1) {
      final remaining = digits.length - index;
      buffer.write(digits[index]);
      if (remaining > 1 && remaining % 3 == 1) {
        buffer.write(separator);
      }
    }
    return buffer.toString();
  }
}

/// Presentation-only timestamp carrying an explicit UTC instant and offset.
///
/// The offset and timezone identifier are provided by an authoritative read
/// model. The client does not infer a school timezone from device settings.
final class SchoolOffsetTimestamp {
  SchoolOffsetTimestamp({
    required DateTime instantUtc,
    required Duration offset,
    required String timeZoneId,
  }) : instantUtc = _requireUtc(instantUtc),
       offset = _requireOffset(offset),
       timeZoneId = _requireTimeZone(timeZoneId);

  final DateTime instantUtc;
  final Duration offset;
  final String timeZoneId;

  String format(Locale locale) {
    final local = instantUtc.add(offset);
    final offsetMinutes = offset.inMinutes;
    final offsetSign = offsetMinutes < 0 ? '−' : '+';
    final offsetAbsoluteMinutes = offsetMinutes.abs();
    final offsetHours = offsetAbsoluteMinutes ~/ 60;
    final offsetRemainder = offsetAbsoluteMinutes % 60;
    final ascii = '${_four(local.year)}-${_two(local.month)}-'
        '${_two(local.day)} ${_two(local.hour)}:${_two(local.minute)} '
        'UTC$offsetSign${_two(offsetHours)}:${_two(offsetRemainder)} '
        '${SchoolBidirectionalText.isolate(timeZoneId)}';
    return _SchoolLocalizedDigits.convert(
      ascii,
      SchoolLocalePolicy.resolve(locale),
    );
  }

  static DateTime _requireUtc(DateTime value) {
    if (!value.isUtc) {
      throw ArgumentError.value(
        value,
        'instantUtc',
        'The authoritative timestamp instant must be UTC.',
      );
    }
    return value;
  }

  static Duration _requireOffset(Duration value) {
    if (value.inSeconds % Duration.secondsPerMinute != 0 ||
        value.abs() > const Duration(hours: 14)) {
      throw ArgumentError.value(
        value,
        'offset',
        'The explicit offset must use whole minutes within plus/minus 14 hours.',
      );
    }
    return value;
  }

  static String _requireTimeZone(String value) {
    final normalized = value.trim();
    if (normalized.isEmpty ||
        normalized.contains(RegExp(r'[\u0000-\u001F\u007F]'))) {
      throw ArgumentError.value(
        value,
        'timeZoneId',
        'A printable authoritative timezone identifier is required.',
      );
    }
    return normalized;
  }

  static String _two(int value) => value.toString().padLeft(2, '0');

  static String _four(int value) => value.toString().padLeft(4, '0');
}

abstract final class _SchoolLocalizedDigits {
  static const _ascii = '0123456789';
  static const _bangla = '০১২৩৪৫৬৭৮৯';
  static const _arabic = '٠١٢٣٤٥٦٧٨٩';

  static String convert(String value, SchoolLanguage language) {
    final target = switch (language) {
      SchoolLanguage.bangla => _bangla,
      SchoolLanguage.arabic => _arabic,
      SchoolLanguage.english => _ascii,
    };
    if (target == _ascii) {
      return value;
    }

    final buffer = StringBuffer();
    for (final codeUnit in value.codeUnits) {
      final character = String.fromCharCode(codeUnit);
      final digitIndex = _ascii.indexOf(character);
      buffer.write(digitIndex < 0 ? character : target[digitIndex]);
    }
    return buffer.toString();
  }
}
