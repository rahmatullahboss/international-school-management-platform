import 'package:school_mobile_core/mobile_core.dart';
import 'package:test/test.dart';

void main() {
  test('keeps the authoritative instant offset and timezone identifier', () {
    final timestamp = SchoolAuthoritativeTimestamp.parse(
      timestamp: '2026-08-22T21:00:00.125+06:00',
      timeZoneId: 'Asia/Dhaka',
    );

    expect(timestamp.instantUtc, DateTime.utc(2026, 8, 22, 15, 0, 0, 125));
    expect(timestamp.offset, const Duration(hours: 6));
    expect(timestamp.timeZoneId, 'Asia/Dhaka');
    expect(timestamp.schoolWallClock, DateTime.utc(2026, 8, 22, 21, 0, 0, 125));
  });

  test('preserves different daylight-saving offsets for the same timezone', () {
    final winter = SchoolAuthoritativeTimestamp.parse(
      timestamp: '2026-01-15T12:00:00.000-05:00',
      timeZoneId: 'America/New_York',
    );
    final summer = SchoolAuthoritativeTimestamp.parse(
      timestamp: '2026-07-15T12:00:00.000-04:00',
      timeZoneId: 'America/New_York',
    );

    expect(winter.offset, const Duration(hours: -5));
    expect(summer.offset, const Duration(hours: -4));
  });

  test('requires numeric offset and rejects invalid wall-clock values', () {
    expect(
      () => SchoolAuthoritativeTimestamp.parse(
        timestamp: '2026-08-22T15:00:00.000Z',
        timeZoneId: 'UTC',
      ),
      throwsA(
        isA<SchoolTimeContractException>().having(
          (error) => error.code,
          'code',
          'SCHOOL_TIMESTAMP_EXPLICIT_OFFSET_REQUIRED',
        ),
      ),
    );
    expect(
      () => SchoolAuthoritativeTimestamp.parse(
        timestamp: '2026-02-30T12:00:00.000+06:00',
        timeZoneId: 'Asia/Dhaka',
      ),
      throwsA(isA<SchoolTimeContractException>()),
    );
    expect(
      () => SchoolAuthoritativeTimestamp.parse(
        timestamp: '2026-08-22T12:00:00.000+14:30',
        timeZoneId: 'Pacific/Kiritimati',
      ),
      throwsA(
        isA<SchoolTimeContractException>().having(
          (error) => error.code,
          'code',
          'SCHOOL_TIMESTAMP_OFFSET_INVALID',
        ),
      ),
    );
    expect(
      () => SchoolAuthoritativeTimestamp.parse(
        timestamp: '2026-08-22T12:00:00.000-00:00',
        timeZoneId: 'UTC',
      ),
      throwsA(
        isA<SchoolTimeContractException>().having(
          (error) => error.code,
          'code',
          'SCHOOL_TIMESTAMP_OFFSET_UNKNOWN',
        ),
      ),
    );
  });
}
