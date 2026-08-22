const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const OFFSET_NAME = /^GMT(?<sign>[+-])(?<hours>\d{2}):(?<minutes>\d{2})$/u;
const MAX_TIME_ZONE_LENGTH = 128;

function invalid(operation: string): Error {
  return new Error(`${operation} returned invalid school timestamp metadata.`);
}

export function requireSchoolTimeZone(value: unknown, operation: string): string {
  if (typeof value !== 'string') throw invalid(operation);
  const normalized = value.trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (normalized === '' || normalized.length > MAX_TIME_ZONE_LENGTH || hasControlCharacter) {
    throw invalid(operation);
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date(0));
  } catch {
    throw invalid(operation);
  }
  return normalized;
}

export function schoolLocalTimestamp(
  canonicalUtcTimestamp: unknown,
  timeZoneValue: unknown,
  operation: string,
): string {
  if (
    typeof canonicalUtcTimestamp !== 'string' ||
    !CANONICAL_UTC_TIMESTAMP.test(canonicalUtcTimestamp)
  ) {
    throw invalid(operation);
  }
  const instant = new Date(canonicalUtcTimestamp);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== canonicalUtcTimestamp) {
    throw invalid(operation);
  }
  const timeZone = requireSchoolTimeZone(timeZoneValue, operation);
  const formatter = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  });
  const parts = formatter.formatToParts(instant);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = byType.get('year');
  const month = byType.get('month');
  const day = byType.get('day');
  const hour = byType.get('hour');
  const minute = byType.get('minute');
  const second = byType.get('second');
  const zoneName = byType.get('timeZoneName');
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined ||
    zoneName === undefined
  ) {
    throw invalid(operation);
  }

  let offset = '+00:00';
  if (zoneName !== 'GMT') {
    const match = OFFSET_NAME.exec(zoneName);
    if (match?.groups === undefined) throw invalid(operation);
    const hours = Number(match.groups.hours);
    const minutes = Number(match.groups.minutes);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 14 || minutes > 59) {
      throw invalid(operation);
    }
    offset = `${match.groups.sign}${match.groups.hours}:${match.groups.minutes}`;
  }

  const milliseconds = instant.getUTCMilliseconds().toString().padStart(3, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${milliseconds}${offset}`;
}
