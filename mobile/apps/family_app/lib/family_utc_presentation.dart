import 'package:flutter/material.dart';
import 'package:school_mobile_core/mobile_core.dart';

/// Presents a server-owned school-local timestamp without consulting device time.
abstract final class FamilySchoolTimePresentation {
  static String date(BuildContext context, SchoolAuthoritativeTimestamp value) {
    final localizations = MaterialLocalizations.of(context);
    return '${localizations.formatMediumDate(value.schoolWallClock)} · '
        '${_offsetLabel(value.offset)} · ${value.timeZoneId}';
  }

  static String dateTime(BuildContext context, SchoolAuthoritativeTimestamp value) {
    final localizations = MaterialLocalizations.of(context);
    final wallClock = value.schoolWallClock;
    final time = TimeOfDay(hour: wallClock.hour, minute: wallClock.minute);
    return '${localizations.formatMediumDate(wallClock)} · '
        '${localizations.formatTimeOfDay(time)} · '
        '${_offsetLabel(value.offset)} · ${value.timeZoneId}';
  }

  static String _offsetLabel(Duration offset) {
    final minutes = offset.inMinutes;
    final sign = minutes < 0 ? '−' : '+';
    final absolute = minutes.abs();
    final hours = (absolute ~/ 60).toString().padLeft(2, '0');
    final remainder = (absolute % 60).toString().padLeft(2, '0');
    return 'UTC$sign$hours:$remainder';
  }
}
