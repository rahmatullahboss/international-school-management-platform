import 'package:flutter/material.dart';

/// Presentation fallback for server timestamps that currently carry an
/// authoritative UTC instant but no authoritative school offset/timezone.
///
/// Until the owning read model supplies school timezone metadata, the Family
/// app presents the instant explicitly as UTC. It must never infer presentation
/// time from the device timezone.
abstract final class FamilyUtcPresentation {
  static String date(BuildContext context, DateTime value) {
    final utc = value.toUtc();
    final localizations = MaterialLocalizations.of(context);
    return '${localizations.formatMediumDate(utc)} · UTC';
  }

  static String dateTime(BuildContext context, DateTime value) {
    final utc = value.toUtc();
    final localizations = MaterialLocalizations.of(context);
    final time = TimeOfDay(hour: utc.hour, minute: utc.minute);
    return '${localizations.formatMediumDate(utc)} · '
        '${localizations.formatTimeOfDay(time)} · UTC';
  }
}
