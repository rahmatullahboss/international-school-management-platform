import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

import { requireSchoolTimeZone, schoolLocalTimestamp } from './mobile-school-time.js';

export type MobileReadPersona = 'guardian' | 'student' | 'teacher';

export interface MobileReadScope {
  readonly tenantId: string;
  readonly campusId: string;
  readonly persona: MobileReadPersona;
}

interface PayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
  readonly timeZoneId?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_TEXT = 512;
const MAX_ARRAY = 64;
const MAX_PAYLOAD_BYTES = 256 * 1024;

function invalidResponse(operation: string): Error {
  return new Error(`${operation} returned an invalid database response.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, operation: string): Record<string, unknown> {
  if (!isRecord(value)) throw invalidResponse(operation);
  return value;
}

function requireUuid(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw invalidResponse(operation);
  return value;
}

function requireText(value: unknown, operation: string, maximum = MAX_TEXT): string {
  if (typeof value !== 'string') throw invalidResponse(operation);
  const normalized = value.trim();
  if (normalized === '' || normalized.length > maximum) throw invalidResponse(operation);
  return normalized;
}

function requireTimestamp(value: unknown, operation: string): string {
  const timestamp = requireText(value, operation, 64);
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    throw invalidResponse(operation);
  }
  return timestamp;
}

function requireInteger(value: unknown, operation: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw invalidResponse(operation);
  }
  return value;
}

function requireArray(value: unknown, operation: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ARRAY) throw invalidResponse(operation);
  return value;
}

function validatePayloadSize(value: Record<string, unknown>, operation: string): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw invalidResponse(operation);
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_PAYLOAD_BYTES) {
    throw invalidResponse(operation);
  }
}

function validateStudentProfile(value: unknown, operation: string): Record<string, unknown> {
  const profile = requireRecord(value, operation);
  return {
    studentId: requireUuid(profile.studentId, operation),
    campusId: requireUuid(profile.campusId, operation),
    displayName: requireText(profile.displayName, operation),
    gradeLabel: requireText(profile.gradeLabel, operation),
    relationshipLabel: requireText(profile.relationshipLabel, operation),
  };
}

function validateFamilyProfiles(value: unknown): Record<string, unknown> {
  const operation = 'Mobile family profiles';
  const payload = requireRecord(value, operation);
  const students = requireArray(payload.students, operation).map((student) =>
    validateStudentProfile(student, operation),
  );
  if (students.length === 0) throw invalidResponse(operation);
  const activeStudentId = requireUuid(payload.activeStudentId, operation);
  if (!students.some((student) => student.studentId === activeStudentId)) {
    throw invalidResponse(operation);
  }
  const validated = {
    accountId: requireUuid(payload.accountId, operation),
    activeStudentId,
    students,
  };
  validatePayloadSize(validated, operation);
  return validated;
}

function validateFamilyDashboard(value: unknown, timeZoneValue: unknown): Record<string, unknown> {
  const operation = 'Mobile family dashboard';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = requireRecord(value, operation);
  const timetable = requireArray(payload.timetable, operation).map((entry) => {
    const item = requireRecord(entry, operation);
    return {
      itemId: requireUuid(item.itemId, operation),
      subjectLabel: requireText(item.subjectLabel, operation),
      locationLabel: requireText(item.locationLabel, operation),
      startsAt: schoolLocalTimestamp(
        requireTimestamp(item.startsAt, operation),
        timeZoneId,
        operation,
      ),
      endsAt: schoolLocalTimestamp(requireTimestamp(item.endsAt, operation), timeZoneId, operation),
    };
  });
  const publishedResults = requireArray(payload.publishedResults, operation).map((entry) => {
    const result = requireRecord(entry, operation);
    return {
      resultId: requireUuid(result.resultId, operation),
      assessmentLabel: requireText(result.assessmentLabel, operation),
      subjectLabel: requireText(result.subjectLabel, operation),
      gradeLabel: requireText(result.gradeLabel, operation),
      publishedAt: schoolLocalTimestamp(
        requireTimestamp(result.publishedAt, operation),
        timeZoneId,
        operation,
      ),
    };
  });

  let attendance: Record<string, unknown> | null = null;
  if (payload.attendance !== null && payload.attendance !== undefined) {
    const raw = requireRecord(payload.attendance, operation);
    attendance = {
      presentSessions: requireInteger(raw.presentSessions, operation),
      absentSessions: requireInteger(raw.absentSessions, operation),
      lateSessions: requireInteger(raw.lateSessions, operation),
      totalSessions: requireInteger(raw.totalSessions, operation),
      summaryLabel: requireText(raw.summaryLabel, operation),
    };
  }

  if (payload.fees !== null && payload.fees !== undefined) throw invalidResponse(operation);
  if (payload.messages !== null && payload.messages !== undefined) throw invalidResponse(operation);

  const validated = {
    student: validateStudentProfile(payload.student, operation),
    timetable,
    attendance,
    publishedResults,
    fees: null,
    messages: null,
    generatedAt: schoolLocalTimestamp(
      requireTimestamp(payload.generatedAt, operation),
      timeZoneId,
      operation,
    ),
    timeZoneId,
  };
  validatePayloadSize(validated, operation);
  return validated;
}

function validateTeacherToday(value: unknown, timeZoneValue: unknown): Record<string, unknown> {
  const operation = 'Mobile teacher today';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = requireRecord(value, operation);
  const meetings = requireArray(payload.meetings, operation).map((entry) => {
    const meeting = requireRecord(entry, operation);
    const attendanceStatus = meeting.attendanceStatus;
    if (
      attendanceStatus !== 'notStarted' &&
      attendanceStatus !== 'draft' &&
      attendanceStatus !== 'submitted' &&
      attendanceStatus !== 'locked'
    ) {
      throw invalidResponse(operation);
    }
    const substitution = meeting.substitutionForTeacherLabel;
    if (substitution !== null && substitution !== undefined && typeof substitution !== 'string') {
      throw invalidResponse(operation);
    }
    return {
      meetingId: requireUuid(meeting.meetingId, operation),
      sectionId: requireUuid(meeting.sectionId, operation),
      sectionLabel: requireText(meeting.sectionLabel, operation),
      subjectLabel: requireText(meeting.subjectLabel, operation),
      roomLabel: requireText(meeting.roomLabel, operation),
      startsAt: schoolLocalTimestamp(
        requireTimestamp(meeting.startsAt, operation),
        timeZoneId,
        operation,
      ),
      endsAt: schoolLocalTimestamp(
        requireTimestamp(meeting.endsAt, operation),
        timeZoneId,
        operation,
      ),
      rosterCount: requireInteger(meeting.rosterCount, operation),
      attendanceStatus,
      ...(substitution === null || substitution === undefined
        ? {}
        : { substitutionForTeacherLabel: requireText(substitution, operation) }),
    };
  });
  const validated = {
    campusId: requireUuid(payload.campusId, operation),
    generatedAt: schoolLocalTimestamp(
      requireTimestamp(payload.generatedAt, operation),
      timeZoneId,
      operation,
    ),
    teacherDisplayName: requireText(payload.teacherDisplayName, operation),
    meetings,
    timeZoneId,
  };
  validatePayloadSize(validated, operation);
  return validated;
}

function validateTeacherRoster(value: unknown): Record<string, unknown> {
  const operation = 'Mobile teacher roster';
  const payload = requireRecord(value, operation);
  const students = requireArray(payload.students, operation).map((entry) => {
    const student = requireRecord(entry, operation);
    return {
      studentId: requireUuid(student.studentId, operation),
      displayName: requireText(student.displayName, operation),
      rollLabel: requireText(student.rollLabel, operation),
    };
  });
  const validated = {
    meetingId: requireUuid(payload.meetingId, operation),
    sectionId: requireUuid(payload.sectionId, operation),
    version: requireInteger(payload.version, operation),
    students,
  };
  validatePayloadSize(validated, operation);
  return validated;
}

function requireIdentity(
  identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
): readonly [string, string] {
  const issuer = identity.issuer.trim();
  const subject = identity.subject.trim();
  if (issuer === '' || subject === '' || issuer.length > 2048 || subject.length > 512) {
    throw new Error('Mobile identity is invalid.');
  }
  return [issuer, subject];
}

function requireScope(scope: MobileReadScope): MobileReadScope {
  if (!UUID_PATTERN.test(scope.tenantId) || !UUID_PATTERN.test(scope.campusId)) {
    throw new Error('Mobile request scope is invalid.');
  }
  return scope;
}

export class DatabaseMobileReadStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async familyProfiles(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
  ): Promise<Record<string, unknown> | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireScope(scope);
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_family_profiles(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text
       ) AS payload`,
      [issuer, subject, scope.tenantId, scope.campusId, scope.persona],
    );
    return this.#onePayload(rows, validateFamilyProfiles, 'Mobile family profiles');
  }

  async familyDashboard(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    studentId: string,
  ): Promise<Record<string, unknown> | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireScope(scope);
    if (!UUID_PATTERN.test(studentId)) throw new Error('Mobile student identifier is invalid.');
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_family_dashboard(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text, $6::uuid
       ) AS payload,
       (SELECT request_scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text
       ) AS request_scope) AS "timeZoneId"`,
      [issuer, subject, scope.tenantId, scope.campusId, scope.persona, studentId],
    );
    return this.#onePayload(rows, validateFamilyDashboard, 'Mobile family dashboard');
  }

  async teacherToday(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
  ): Promise<Record<string, unknown> | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireScope(scope);
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_teacher_today(
         $1::text, $2::text, $3::uuid, $4::uuid
       ) AS payload,
       (SELECT request_scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text, $2::text, $3::uuid, $4::uuid, 'teacher'::text
       ) AS request_scope) AS "timeZoneId"`,
      [issuer, subject, scope.tenantId, scope.campusId],
    );
    return this.#onePayload(rows, validateTeacherToday, 'Mobile teacher today');
  }

  async teacherRoster(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    meetingId: string,
  ): Promise<Record<string, unknown> | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireScope(scope);
    if (!UUID_PATTERN.test(meetingId)) throw new Error('Mobile meeting identifier is invalid.');
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_teacher_roster(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::uuid
       ) AS payload`,
      [issuer, subject, scope.tenantId, scope.campusId, meetingId],
    );
    return this.#onePayload(rows, validateTeacherRoster, 'Mobile teacher roster');
  }

  #onePayload(
    rows: readonly PayloadRow[],
    validator: (value: unknown, timeZoneValue: unknown) => Record<string, unknown>,
    operation: string,
  ): Record<string, unknown> | undefined {
    if (rows.length !== 1) throw invalidResponse(operation);
    const row = rows[0];
    if (row === undefined) throw invalidResponse(operation);
    if (row.payload === null || row.payload === undefined) return undefined;
    return validator(row.payload, row.timeZoneId);
  }
}
