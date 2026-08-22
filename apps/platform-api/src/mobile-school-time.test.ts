import { describe, expect, it } from 'vitest';

import { requireSchoolTimeZone, schoolLocalTimestamp } from './mobile-school-time.js';

describe('mobile school time', () => {
  it('serializes canonical UTC instants with the authoritative campus offset', () => {
    expect(schoolLocalTimestamp('2026-08-22T15:00:00.125Z', 'Asia/Dhaka', 'School time')).toBe(
      '2026-08-22T21:00:00.125+06:00',
    );
  });

  it('preserves per-instant daylight-saving offsets', () => {
    expect(
      schoolLocalTimestamp('2026-01-15T17:00:00.000Z', 'America/New_York', 'School time'),
    ).toBe('2026-01-15T12:00:00.000-05:00');
    expect(
      schoolLocalTimestamp('2026-07-15T16:00:00.000Z', 'America/New_York', 'School time'),
    ).toBe('2026-07-15T12:00:00.000-04:00');
  });

  it('emits an explicit numeric zero offset rather than a UTC fallback marker', () => {
    expect(schoolLocalTimestamp('2026-08-22T15:00:00.000Z', 'UTC', 'School time')).toBe(
      '2026-08-22T15:00:00.000+00:00',
    );
  });

  it('fails closed on malformed instants or timezone identifiers', () => {
    expect(() => schoolLocalTimestamp('2026-08-22T15:00:00+00:00', 'UTC', 'School time')).toThrow(
      'invalid school timestamp metadata',
    );
    expect(() => requireSchoolTimeZone('Not/AZone', 'School time')).toThrow(
      'invalid school timestamp metadata',
    );
  });
});
