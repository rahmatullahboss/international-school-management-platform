/// An authoritative school-local timestamp supplied by the server.
///
/// The transport value must include a numeric RFC3339 offset for the instant.
/// The IANA timezone identifier is supplied separately by the same server-owned
/// school scope. Device timezone settings are never consulted.
final class SchoolAuthoritativeTimestamp {
  factory SchoolAuthoritativeTimestamp.parse({
    required String timestamp,
    required String timeZoneId,
  }) {
    final normalizedZone = timeZoneId.trim();
    if (
      normalizedZone.isEmpty ||
      normalizedZone.length > 128 ||
      normalizedZone.contains(RegExp(r'[\u0000-\u001F\u007F]'))
    ) {
      throw const SchoolTimeContractException('SCHOOL_TIME_ZONE_INVALID');
    }

    final match = _explicitOffsetTimestamp.firstMatch(timestamp);
    if (match == null) {
      throw const SchoolTimeContractException(
        'SCHOOL_TIMESTAMP_EXPLICIT_OFFSET_REQUIRED',
      );
    }
    int part(int index) => int.parse(match.group(index)!);
    final year = part(1);
    final month = part(2);
    final day = part(3);
    final hour = part(4);
    final minute = part(5);
    final second = part(6);
    final millisecond = part(7);
    final offsetHours = part(9);
    final offsetMinutesPart = part(10);
    if (
      offsetHours > 14 ||
      offsetMinutesPart > 59 ||
      (offsetHours == 14 && offsetMinutesPart != 0)
    ) {
      throw const SchoolTimeContractException('SCHOOL_TIMESTAMP_OFFSET_INVALID');
    }

    final wallClock = DateTime.utc(
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
    );
    if (
      wallClock.year != year ||
      wallClock.month != month ||
      wallClock.day != day ||
      wallClock.hour != hour ||
      wallClock.minute != minute ||
      wallClock.second != second ||
      wallClock.millisecond != millisecond
    ) {
      throw const SchoolTimeContractException('SCHOOL_TIMESTAMP_INVALID');
    }

    final isNegativeOffset = match.group(8) == '-';
    if (isNegativeOffset && offsetHours == 0 && offsetMinutesPart == 0) {
      throw const SchoolTimeContractException('SCHOOL_TIMESTAMP_OFFSET_UNKNOWN');
    }
    final sign = isNegativeOffset ? -1 : 1;
    final totalOffsetMinutes = sign * (offsetHours * 60 + offsetMinutesPart);
    final offset = Duration(minutes: totalOffsetMinutes);
    final instantUtc = wallClock.subtract(offset);
    DateTime parsed;
    try {
      parsed = DateTime.parse(timestamp).toUtc();
    } on FormatException {
      throw const SchoolTimeContractException('SCHOOL_TIMESTAMP_INVALID');
    }
    if (parsed != instantUtc) {
      throw const SchoolTimeContractException('SCHOOL_TIMESTAMP_INVALID');
    }

    return SchoolAuthoritativeTimestamp._(
      instantUtc: instantUtc,
      offset: offset,
      timeZoneId: normalizedZone,
    );
  }

  const SchoolAuthoritativeTimestamp._({
    required this.instantUtc,
    required this.offset,
    required this.timeZoneId,
  });

  final DateTime instantUtc;
  final Duration offset;
  final String timeZoneId;

  /// A wall-clock representation for formatting only.
  ///
  /// This remains a UTC-tagged [DateTime] intentionally so Dart cannot apply a
  /// device timezone conversion. Consumers must treat it as school wall time.
  DateTime get schoolWallClock => instantUtc.add(offset);
}

final RegExp _explicitOffsetTimestamp = RegExp(
  r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})([+-])(\d{2}):(\d{2})$',
);

final class SchoolTimeContractException implements Exception {
  const SchoolTimeContractException(this.code);

  final String code;

  @override
  String toString() => 'SchoolTimeContractException($code)';
}
