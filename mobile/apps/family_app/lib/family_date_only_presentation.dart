import 'package:flutter/material.dart';

/// Presentation/encoding boundary for Family form date-only answers.
///
/// The server contract remains the ISO calendar date `yyyy-MM-dd`. Rendering
/// uses locale-aware Material date formatting without converting through a
/// device or school timezone because a date-only value is not an instant.
abstract final class FamilyDateOnlyPresentation {
  static String display(BuildContext context, String isoDate) {
    final date = parse(isoDate);
    if (date == null) return isoDate;
    return MaterialLocalizations.of(context).formatMediumDate(date);
  }

  static String encode(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';

  static DateTime? parse(String? isoDate) {
    if (isoDate == null ||
        !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(isoDate)) {
      return null;
    }
    final parts = isoDate.split('-');
    final year = int.parse(parts[0]);
    final month = int.parse(parts[1]);
    final day = int.parse(parts[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    final parsed = DateTime(year, month, day);
    if (parsed.year != year || parsed.month != month || parsed.day != day) {
      return null;
    }
    return parsed;
  }
}
