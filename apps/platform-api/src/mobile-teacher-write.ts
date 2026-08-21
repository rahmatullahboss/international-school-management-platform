export type TeacherAttendanceMark = 'present' | 'absent' | 'late' | 'excused';
export type TeacherGradeEntryStatus = 'scored' | 'missing' | 'exempt';

export interface TeacherAttendanceWriteInput {
  readonly operationId: string;
  readonly meetingId: string;
  readonly baseVersion: number;
  readonly clientCreatedAt: string;
  readonly lines: readonly {
    readonly studentId: string;
    readonly mark: TeacherAttendanceMark;
  }[];
}

export interface TeacherGradeDraftWriteInput {
  readonly operationId: string;
  readonly baseVersion: number;
  readonly scoreScale: number;
  readonly maximumScoreUnits: number;
  readonly entries: readonly {
    readonly studentId: string;
    readonly status: TeacherGradeEntryStatus;
    readonly scoreUnits?: number;
  }[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const ATTENDANCE_KEYS = new Set([
  'operationId',
  'meetingId',
  'baseVersion',
  'clientCreatedAt',
  'lines',
]);
const GRADE_KEYS = new Set([
  'operationId',
  'baseVersion',
  'scoreScale',
  'maximumScoreUnits',
  'entries',
]);
const ATTENDANCE_LINE_KEYS = new Set(['studentId', 'mark']);
const GRADE_ENTRY_KEYS = new Set(['studentId', 'status', 'scoreUnits']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function parseJsonRecord(text: string | undefined): Record<string, unknown> | undefined {
  if (text === undefined || text.trim() === '') return undefined;
  try {
    const decoded = JSON.parse(text) as unknown;
    return isRecord(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function safeInteger(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

function exactUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function validOperationId(value: unknown): value is string {
  return typeof value === 'string' && OPERATION_ID_PATTERN.test(value);
}

export function isMobileTeacherWriteIdempotencyKey(value: string | undefined): value is string {
  return value !== undefined && IDEMPOTENCY_KEY_PATTERN.test(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function parseTeacherAttendanceWrite(
  text: string | undefined,
): TeacherAttendanceWriteInput | undefined {
  const decoded = parseJsonRecord(text);
  if (decoded === undefined || !hasExactKeys(decoded, ATTENDANCE_KEYS)) return undefined;
  if (
    !validOperationId(decoded.operationId) ||
    !validUuid(decoded.meetingId) ||
    !safeInteger(decoded.baseVersion, 0, Number.MAX_SAFE_INTEGER) ||
    !exactUtcTimestamp(decoded.clientCreatedAt) ||
    !Array.isArray(decoded.lines) ||
    decoded.lines.length < 1 ||
    decoded.lines.length > 256
  ) {
    return undefined;
  }

  const seenStudents = new Set<string>();
  const lines: { studentId: string; mark: TeacherAttendanceMark }[] = [];
  for (const rawLine of decoded.lines) {
    if (!isRecord(rawLine) || !hasExactKeys(rawLine, ATTENDANCE_LINE_KEYS)) return undefined;
    const studentId = rawLine.studentId;
    const mark = rawLine.mark;
    if (
      !validUuid(studentId) ||
      seenStudents.has(studentId) ||
      (mark !== 'present' && mark !== 'absent' && mark !== 'late' && mark !== 'excused')
    ) {
      return undefined;
    }
    seenStudents.add(studentId);
    lines.push({ studentId, mark });
  }

  return {
    operationId: decoded.operationId,
    meetingId: decoded.meetingId,
    baseVersion: decoded.baseVersion,
    clientCreatedAt: decoded.clientCreatedAt,
    lines,
  };
}

export function parseTeacherGradeDraftWrite(
  text: string | undefined,
): TeacherGradeDraftWriteInput | undefined {
  const decoded = parseJsonRecord(text);
  if (decoded === undefined || !hasExactKeys(decoded, GRADE_KEYS)) return undefined;
  if (
    !validOperationId(decoded.operationId) ||
    !safeInteger(decoded.baseVersion, 0, Number.MAX_SAFE_INTEGER) ||
    !safeInteger(decoded.scoreScale, 1, 1_000_000) ||
    !safeInteger(decoded.maximumScoreUnits, 1, 1_000_000_000) ||
    !Array.isArray(decoded.entries) ||
    decoded.entries.length < 1 ||
    decoded.entries.length > 512
  ) {
    return undefined;
  }

  const seenStudents = new Set<string>();
  const entries: {
    studentId: string;
    status: TeacherGradeEntryStatus;
    scoreUnits?: number;
  }[] = [];
  for (const rawEntry of decoded.entries) {
    if (!isRecord(rawEntry) || !hasOnlyKeys(rawEntry, GRADE_ENTRY_KEYS)) return undefined;
    const keys = Object.keys(rawEntry);
    if (!keys.includes('studentId') || !keys.includes('status')) return undefined;
    const studentId = rawEntry.studentId;
    const status = rawEntry.status;
    if (
      !validUuid(studentId) ||
      seenStudents.has(studentId) ||
      (status !== 'scored' && status !== 'missing' && status !== 'exempt')
    ) {
      return undefined;
    }
    seenStudents.add(studentId);

    if (status === 'scored') {
      if (!safeInteger(rawEntry.scoreUnits, 0, decoded.maximumScoreUnits) || keys.length !== 3) {
        return undefined;
      }
      entries.push({ studentId, status, scoreUnits: rawEntry.scoreUnits });
      continue;
    }
    if ('scoreUnits' in rawEntry || keys.length !== 2) return undefined;
    entries.push({ studentId, status });
  }

  return {
    operationId: decoded.operationId,
    baseVersion: decoded.baseVersion,
    scoreScale: decoded.scoreScale,
    maximumScoreUnits: decoded.maximumScoreUnits,
    entries,
  };
}
