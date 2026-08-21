import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

import type { MobileReadScope } from './database-mobile-read-store.js';
import type {
  TeacherAttendanceWriteInput,
  TeacherGradeDraftWriteInput,
} from './mobile-teacher-write.js';

interface PayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
}

export interface MobileTeacherWriteReceipt {
  readonly operationId: string;
  readonly acceptedRevision: number;
  readonly status: 'accepted' | 'duplicate' | 'conflict' | 'rejected' | 'requiresReconciliation';
  readonly reasonCode?: string;
}

const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const RECEIPT_KEYS = new Set(['operationId', 'acceptedRevision', 'status', 'reasonCode']);

function invalidResponse(): Error {
  return new Error('Mobile teacher write returned an invalid database response.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateReceipt(value: unknown): MobileTeacherWriteReceipt {
  if (!isRecord(value)) throw invalidResponse();
  const keys = Object.keys(value);
  if (!keys.every((key) => RECEIPT_KEYS.has(key))) throw invalidResponse();
  if (
    !keys.includes('operationId') ||
    !keys.includes('acceptedRevision') ||
    !keys.includes('status')
  ) {
    throw invalidResponse();
  }
  const operationId = value.operationId;
  const acceptedRevision = value.acceptedRevision;
  const status = value.status;
  const reasonCode = value.reasonCode;
  if (typeof operationId !== 'string' || !OPERATION_ID_PATTERN.test(operationId)) {
    throw invalidResponse();
  }
  if (
    typeof acceptedRevision !== 'number' ||
    !Number.isSafeInteger(acceptedRevision) ||
    acceptedRevision < 0
  ) {
    throw invalidResponse();
  }
  if (
    status !== 'accepted' &&
    status !== 'duplicate' &&
    status !== 'conflict' &&
    status !== 'rejected' &&
    status !== 'requiresReconciliation'
  ) {
    throw invalidResponse();
  }
  if (reasonCode !== undefined && (typeof reasonCode !== 'string' || reasonCode.length > 128)) {
    throw invalidResponse();
  }
  return reasonCode === undefined
    ? { operationId, acceptedRevision, status }
    : { operationId, acceptedRevision, status, reasonCode };
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

export class DatabaseMobileTeacherWriteStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async submitAttendance(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    idempotencyKey: string,
    input: TeacherAttendanceWriteInput,
  ): Promise<MobileTeacherWriteReceipt | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.submit_mobile_teacher_attendance(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text,
         $6::text, $7::uuid, $8::bigint, $9::timestamptz, $10::jsonb
       ) AS payload`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        idempotencyKey,
        input.operationId,
        input.meetingId,
        input.baseVersion,
        input.clientCreatedAt,
        JSON.stringify(input.lines),
      ],
    );
    return this.#oneReceipt(rows);
  }

  async saveGradeDraft(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    idempotencyKey: string,
    assessmentId: string,
    input: TeacherGradeDraftWriteInput,
  ): Promise<MobileTeacherWriteReceipt | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.save_mobile_teacher_grade_draft(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text,
         $6::text, $7::uuid, $8::bigint, $9::integer, $10::bigint, $11::jsonb
       ) AS payload`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        idempotencyKey,
        input.operationId,
        assessmentId,
        input.baseVersion,
        input.scoreScale,
        input.maximumScoreUnits,
        JSON.stringify(input.entries),
      ],
    );
    return this.#oneReceipt(rows);
  }

  #oneReceipt(rows: readonly PayloadRow[]): MobileTeacherWriteReceipt | undefined {
    if (rows.length !== 1) throw invalidResponse();
    const row = rows[0];
    if (row === undefined) throw invalidResponse();
    if (row.payload === null || row.payload === undefined) return undefined;
    return validateReceipt(row.payload);
  }
}
