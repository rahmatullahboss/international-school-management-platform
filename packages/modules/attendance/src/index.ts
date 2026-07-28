import { AppendOnlyAuditLog, createDomainEvent, type DomainEvent } from '@school/events';

export type AttendanceMeaning = 'present' | 'absent' | 'late' | 'excused' | 'remote';
export type AttendanceSource = 'teacher' | 'office' | 'device' | 'import' | 'guardian';

export interface AttendancePolicyVersion {
  tenantId: string;
  policyVersionId: string;
  policyKey: string;
  versionLabel: string;
  minimumPresentMinutes?: number;
  lateAfterMinutes: number;
  chronicAbsenceThresholdPercent: number;
  state: 'draft' | 'published';
  version: number;
}

export interface AttendanceCode {
  tenantId: string;
  attendanceCodeId: string;
  policyVersionId: string;
  code: string;
  label: string;
  meaning: AttendanceMeaning;
  countsAsPresent: boolean;
  requiresReason: boolean;
}

export interface AttendanceSession {
  tenantId: string;
  sessionId: string;
  scheduledMeetingId: string;
  sectionId: string;
  campusId: string;
  localDate: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  rosterStudentIds: readonly string[];
  state: 'open' | 'finalized';
  version: number;
}

export interface AttendanceRecord {
  tenantId: string;
  attendanceRecordId: string;
  clientRecordId: string;
  sessionId: string;
  studentProfileId: string;
  attendanceCodeId: string;
  minutesPresent?: number;
  minutesAbsent?: number;
  reason?: string;
  evidenceDocumentId?: string;
  source: AttendanceSource;
  recordedBy: string;
  recordedAt: string;
  version: number;
}

export interface AttendanceAmendment {
  amendmentId: string;
  attendanceRecordId: string;
  previousAttendanceCodeId: string;
  replacementAttendanceCodeId: string;
  previousVersion: number;
  replacementVersion: number;
  reason: string;
  approvedBy?: string;
  amendedBy: string;
  amendedAt: string;
}

export interface AttendanceSyncEntry {
  clientRecordId: string;
  sessionId: string;
  studentProfileId: string;
  attendanceCodeId: string;
  minutesPresent?: number;
  minutesAbsent?: number;
  reason?: string;
  source: AttendanceSource;
  recordedBy: string;
}

export interface AttendanceSyncBatch {
  tenantId: string;
  syncBatchId: string;
  clientBatchId: string;
  deviceId: string;
  submittedAt: string;
  accepted: number;
  replayed: number;
  rejected: number;
  recordIds: readonly string[];
}

export interface AbsenceNotice {
  noticeId: string;
  studentProfileId: string;
  localDate: string;
  reason: string;
  evidenceDocumentId?: string;
  submittedBy: string;
  submittedAt: string;
}

export interface AttendanceSummary {
  studentProfileId: string;
  sessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  remote: number;
  attendancePercent: number;
  chronicAbsenceAlert: boolean;
}

export interface AttendanceCommandResult<T> {
  value: T;
  events: readonly DomainEvent<unknown>[];
}

export class AttendanceDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AttendanceDomainError';
  }
}

function cloneSession(session: AttendanceSession): AttendanceSession {
  return { ...session, rosterStudentIds: [...session.rosterStudentIds] };
}

function cloneRecord(record: AttendanceRecord): AttendanceRecord {
  return { ...record };
}

function entrySignature(entry: AttendanceSyncEntry): string {
  return JSON.stringify({
    sessionId: entry.sessionId,
    studentProfileId: entry.studentProfileId,
    attendanceCodeId: entry.attendanceCodeId,
    minutesPresent: entry.minutesPresent,
    minutesAbsent: entry.minutesAbsent,
    reason: entry.reason,
    source: entry.source,
    recordedBy: entry.recordedBy,
  });
}

export class AttendanceRegistry {
  readonly #policies = new Map<string, AttendancePolicyVersion>();
  readonly #codes = new Map<string, AttendanceCode>();
  readonly #sessions = new Map<string, AttendanceSession>();
  readonly #records = new Map<string, AttendanceRecord>();
  readonly #currentRecordByStudentSession = new Map<string, string>();
  readonly #recordByClientId = new Map<string, string>();
  readonly #clientSignatures = new Map<string, string>();
  readonly #amendments: AttendanceAmendment[] = [];
  readonly #syncBatches = new Map<string, AttendanceSyncBatch>();
  readonly #batchSignatures = new Map<string, string>();
  readonly #notices: AbsenceNotice[] = [];
  readonly #audit = new AppendOnlyAuditLog();

  get auditLog(): AppendOnlyAuditLog {
    return this.#audit;
  }

  createPolicy(input: {
    tenantId: string;
    policyKey: string;
    versionLabel: string;
    minimumPresentMinutes?: number;
    lateAfterMinutes: number;
    chronicAbsenceThresholdPercent: number;
    correlationId: string;
  }): AttendanceCommandResult<AttendancePolicyVersion> {
    if (
      input.lateAfterMinutes < 0 ||
      input.chronicAbsenceThresholdPercent < 0 ||
      input.chronicAbsenceThresholdPercent > 100
    ) {
      throw new AttendanceDomainError('ATTENDANCE_POLICY_INVALID', 'Attendance policy is invalid');
    }
    const duplicate = [...this.#policies.values()].some(
      (policy) =>
        policy.tenantId === input.tenantId &&
        policy.policyKey === input.policyKey &&
        policy.versionLabel === input.versionLabel,
    );
    if (duplicate) {
      throw new AttendanceDomainError('ATTENDANCE_POLICY_EXISTS', 'Policy version already exists');
    }
    const policy: AttendancePolicyVersion = {
      tenantId: input.tenantId,
      policyVersionId: crypto.randomUUID(),
      policyKey: input.policyKey,
      versionLabel: input.versionLabel,
      ...(input.minimumPresentMinutes === undefined
        ? {}
        : { minimumPresentMinutes: input.minimumPresentMinutes }),
      lateAfterMinutes: input.lateAfterMinutes,
      chronicAbsenceThresholdPercent: input.chronicAbsenceThresholdPercent,
      state: 'draft',
      version: 1,
    };
    this.#policies.set(policy.policyVersionId, policy);
    return this.#result(policy, 'attendance.policy.created.v1', input.correlationId);
  }

  addCode(input: {
    tenantId: string;
    policyVersionId: string;
    code: string;
    label: string;
    meaning: AttendanceMeaning;
    countsAsPresent: boolean;
    requiresReason?: boolean;
    correlationId: string;
  }): AttendanceCommandResult<AttendanceCode> {
    const policy = this.#requirePolicy(input.tenantId, input.policyVersionId);
    if (policy.state !== 'draft') {
      throw new AttendanceDomainError(
        'ATTENDANCE_POLICY_PUBLISHED_IMMUTABLE',
        'Published attendance policy is immutable',
      );
    }
    const duplicate = [...this.#codes.values()].some(
      (code) =>
        code.tenantId === input.tenantId &&
        code.policyVersionId === input.policyVersionId &&
        code.code === input.code,
    );
    if (duplicate) {
      throw new AttendanceDomainError('ATTENDANCE_CODE_EXISTS', 'Attendance code already exists');
    }
    const code: AttendanceCode = {
      tenantId: input.tenantId,
      attendanceCodeId: crypto.randomUUID(),
      policyVersionId: input.policyVersionId,
      code: input.code,
      label: input.label,
      meaning: input.meaning,
      countsAsPresent: input.countsAsPresent,
      requiresReason: input.requiresReason ?? false,
    };
    this.#codes.set(code.attendanceCodeId, code);
    policy.version += 1;
    return this.#result(code, 'attendance.code.created.v1', input.correlationId);
  }

  publishPolicy(input: {
    tenantId: string;
    policyVersionId: string;
    correlationId: string;
  }): AttendanceCommandResult<AttendancePolicyVersion> {
    const policy = this.#requirePolicy(input.tenantId, input.policyVersionId);
    if (policy.state === 'published') return { value: { ...policy }, events: [] };
    const codeMeanings = new Set(
      [...this.#codes.values()]
        .filter(
          (code) =>
            code.tenantId === input.tenantId && code.policyVersionId === input.policyVersionId,
        )
        .map((code) => code.meaning),
    );
    if (!codeMeanings.has('present') || !codeMeanings.has('absent')) {
      throw new AttendanceDomainError(
        'ATTENDANCE_POLICY_CODES_INCOMPLETE',
        'Published policy requires present and absent codes',
      );
    }
    policy.state = 'published';
    policy.version += 1;
    return this.#result({ ...policy }, 'attendance.policy.published.v1', input.correlationId);
  }

  openSession(input: {
    tenantId: string;
    scheduledMeetingId: string;
    sectionId: string;
    campusId: string;
    localDate: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    rosterStudentIds: readonly string[];
    correlationId: string;
  }): AttendanceCommandResult<AttendanceSession> {
    const duplicate = [...this.#sessions.values()].find(
      (session) =>
        session.tenantId === input.tenantId &&
        session.scheduledMeetingId === input.scheduledMeetingId,
    );
    if (duplicate) return { value: cloneSession(duplicate), events: [] };
    if (
      input.endsAt <= input.startsAt ||
      new Set(input.rosterStudentIds).size !== input.rosterStudentIds.length
    ) {
      throw new AttendanceDomainError(
        'ATTENDANCE_SESSION_INVALID',
        'Attendance session is invalid',
      );
    }
    const session: AttendanceSession = {
      tenantId: input.tenantId,
      sessionId: crypto.randomUUID(),
      scheduledMeetingId: input.scheduledMeetingId,
      sectionId: input.sectionId,
      campusId: input.campusId,
      localDate: input.localDate,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      rosterStudentIds: [...input.rosterStudentIds],
      state: 'open',
      version: 1,
    };
    this.#sessions.set(session.sessionId, session);
    return this.#result(cloneSession(session), 'attendance.session.opened.v1', input.correlationId);
  }

  sync(input: {
    tenantId: string;
    clientBatchId: string;
    deviceId: string;
    entries: readonly AttendanceSyncEntry[];
    correlationId: string;
  }): AttendanceCommandResult<AttendanceSyncBatch> {
    const batchKey = `${input.tenantId}:${input.clientBatchId}`;
    const batchSignature = JSON.stringify({
      deviceId: input.deviceId,
      entries: input.entries.map(entrySignature),
    });
    const replay = this.#syncBatches.get(batchKey);
    if (replay) {
      if (this.#batchSignatures.get(batchKey) !== batchSignature) {
        throw new AttendanceDomainError(
          'ATTENDANCE_BATCH_ID_CONFLICT',
          'Client batch ID is bound to a different payload',
        );
      }
      return { value: { ...replay, recordIds: [...replay.recordIds] }, events: [] };
    }
    let accepted = 0;
    let replayed = 0;
    let rejected = 0;
    const recordIds: string[] = [];
    for (const entry of input.entries) {
      try {
        const result = this.#capture(input.tenantId, entry);
        recordIds.push(result.record.attendanceRecordId);
        if (result.replayed) replayed += 1;
        else accepted += 1;
      } catch (error) {
        if (error instanceof AttendanceDomainError) {
          rejected += 1;
          continue;
        }
        throw error;
      }
    }
    const batch: AttendanceSyncBatch = {
      tenantId: input.tenantId,
      syncBatchId: crypto.randomUUID(),
      clientBatchId: input.clientBatchId,
      deviceId: input.deviceId,
      submittedAt: new Date().toISOString(),
      accepted,
      replayed,
      rejected,
      recordIds,
    };
    this.#syncBatches.set(batchKey, batch);
    this.#batchSignatures.set(batchKey, batchSignature);
    return this.#result(
      { ...batch, recordIds: [...batch.recordIds] },
      'attendance.sync-batch.accepted.v1',
      input.correlationId,
    );
  }

  amend(input: {
    tenantId: string;
    sessionId: string;
    studentProfileId: string;
    replacementAttendanceCodeId: string;
    reason: string;
    amendedBy: string;
    approvedBy?: string;
    canAmendFinalized?: boolean;
    correlationId: string;
  }): AttendanceCommandResult<AttendanceRecord> {
    const session = this.#requireSession(input.tenantId, input.sessionId);
    if (session.state === 'finalized' && (!input.canAmendFinalized || !input.approvedBy)) {
      throw new AttendanceDomainError(
        'ATTENDANCE_FINALIZED_AMENDMENT_FORBIDDEN',
        'Finalized attendance requires permission and approval',
      );
    }
    if (!input.reason.trim()) {
      throw new AttendanceDomainError(
        'ATTENDANCE_AMENDMENT_REASON_REQUIRED',
        'Amendment reason is required',
      );
    }
    this.#requireCode(input.tenantId, input.replacementAttendanceCodeId);
    const currentKey = `${input.tenantId}:${input.sessionId}:${input.studentProfileId}`;
    const recordId = this.#currentRecordByStudentSession.get(currentKey);
    if (!recordId) {
      throw new AttendanceDomainError(
        'ATTENDANCE_RECORD_NOT_FOUND',
        'Attendance record was not found',
      );
    }
    const record = this.#records.get(recordId);
    if (!record)
      throw new AttendanceDomainError(
        'ATTENDANCE_RECORD_NOT_FOUND',
        'Attendance record was not found',
      );
    const previousCode = record.attendanceCodeId;
    const previousVersion = record.version;
    record.attendanceCodeId = input.replacementAttendanceCodeId;
    record.reason = input.reason;
    record.recordedBy = input.amendedBy;
    record.recordedAt = new Date().toISOString();
    record.source = 'office';
    record.version += 1;
    this.#amendments.push({
      amendmentId: crypto.randomUUID(),
      attendanceRecordId: record.attendanceRecordId,
      previousAttendanceCodeId: previousCode,
      replacementAttendanceCodeId: input.replacementAttendanceCodeId,
      previousVersion,
      replacementVersion: record.version,
      reason: input.reason,
      ...(input.approvedBy === undefined ? {} : { approvedBy: input.approvedBy }),
      amendedBy: input.amendedBy,
      amendedAt: record.recordedAt,
    });
    return this.#result(cloneRecord(record), 'attendance.record.amended.v1', input.correlationId);
  }

  finalize(input: {
    tenantId: string;
    sessionId: string;
    finalizedBy: string;
    allowIncomplete?: boolean;
    correlationId: string;
  }): AttendanceCommandResult<AttendanceSession> {
    const session = this.#requireSession(input.tenantId, input.sessionId);
    if (session.state === 'finalized') return { value: cloneSession(session), events: [] };
    const missing = this.missingStudents(input.tenantId, input.sessionId);
    if (missing.length > 0 && !input.allowIncomplete) {
      throw new AttendanceDomainError(
        'ATTENDANCE_SESSION_INCOMPLETE',
        `Attendance is missing for ${missing.length} students`,
      );
    }
    session.state = 'finalized';
    session.version += 1;
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'attendance.session.finalized-by',
      subjectId: input.finalizedBy,
    });
    return this.#result(
      cloneSession(session),
      'attendance.session.finalized.v1',
      input.correlationId,
    );
  }

  submitAbsenceNotice(input: {
    tenantId: string;
    studentProfileId: string;
    localDate: string;
    reason: string;
    evidenceDocumentId?: string;
    submittedBy: string;
    correlationId: string;
  }): AttendanceCommandResult<AbsenceNotice> {
    if (!input.reason.trim()) {
      throw new AttendanceDomainError(
        'ATTENDANCE_NOTICE_REASON_REQUIRED',
        'Absence reason is required',
      );
    }
    const notice: AbsenceNotice = {
      noticeId: crypto.randomUUID(),
      studentProfileId: input.studentProfileId,
      localDate: input.localDate,
      reason: input.reason,
      ...(input.evidenceDocumentId === undefined
        ? {}
        : { evidenceDocumentId: input.evidenceDocumentId }),
      submittedBy: input.submittedBy,
      submittedAt: new Date().toISOString(),
    };
    this.#notices.push(notice);
    return this.#result(
      notice,
      'attendance.absence-notice.submitted.v1',
      input.correlationId,
      input.tenantId,
    );
  }

  missingStudents(tenantId: string, sessionId: string): readonly string[] {
    const session = this.#requireSession(tenantId, sessionId);
    return session.rosterStudentIds.filter(
      (studentId) =>
        !this.#currentRecordByStudentSession.has(`${tenantId}:${sessionId}:${studentId}`),
    );
  }

  sessionRecords(tenantId: string, sessionId: string): readonly AttendanceRecord[] {
    this.#requireSession(tenantId, sessionId);
    return [...this.#records.values()]
      .filter((record) => record.tenantId === tenantId && record.sessionId === sessionId)
      .map(cloneRecord);
  }

  amendments(tenantId: string, attendanceRecordId: string): readonly AttendanceAmendment[] {
    const record = this.#records.get(attendanceRecordId);
    if (!record || record.tenantId !== tenantId) {
      throw new AttendanceDomainError(
        'ATTENDANCE_RECORD_NOT_FOUND',
        'Attendance record was not found',
      );
    }
    return this.#amendments
      .filter((amendment) => amendment.attendanceRecordId === attendanceRecordId)
      .map((amendment) => ({ ...amendment }));
  }

  summary(input: {
    tenantId: string;
    policyVersionId: string;
    studentProfileId: string;
  }): AttendanceSummary {
    const policy = this.#requirePolicy(input.tenantId, input.policyVersionId);
    const records = [...this.#records.values()].filter(
      (record) =>
        record.tenantId === input.tenantId && record.studentProfileId === input.studentProfileId,
    );
    const totals: Record<AttendanceMeaning, number> = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      remote: 0,
    };
    let countedPresent = 0;
    for (const record of records) {
      const code = this.#requireCode(input.tenantId, record.attendanceCodeId);
      totals[code.meaning] += 1;
      if (code.countsAsPresent) countedPresent += 1;
    }
    const sessions = records.length;
    const attendancePercent =
      sessions === 0 ? 100 : Math.round((countedPresent / sessions) * 10_000) / 100;
    const absencePercent = 100 - attendancePercent;
    return {
      studentProfileId: input.studentProfileId,
      sessions,
      ...totals,
      attendancePercent,
      chronicAbsenceAlert: absencePercent >= policy.chronicAbsenceThresholdPercent,
    };
  }

  #capture(
    tenantId: string,
    entry: AttendanceSyncEntry,
  ): { record: AttendanceRecord; replayed: boolean } {
    const session = this.#requireSession(tenantId, entry.sessionId);
    if (session.state !== 'open') {
      throw new AttendanceDomainError('ATTENDANCE_SESSION_FINALIZED', 'Session is finalized');
    }
    if (!session.rosterStudentIds.includes(entry.studentProfileId)) {
      throw new AttendanceDomainError(
        'ATTENDANCE_STUDENT_NOT_ROSTERED',
        'Student is not in the session roster',
      );
    }
    const code = this.#requireCode(tenantId, entry.attendanceCodeId);
    if (code.requiresReason && !entry.reason?.trim()) {
      throw new AttendanceDomainError(
        'ATTENDANCE_REASON_REQUIRED',
        'This attendance code requires a reason',
      );
    }
    const clientKey = `${tenantId}:${entry.clientRecordId}`;
    const signature = entrySignature(entry);
    const existingId = this.#recordByClientId.get(clientKey);
    if (existingId) {
      if (this.#clientSignatures.get(clientKey) !== signature) {
        throw new AttendanceDomainError(
          'ATTENDANCE_CLIENT_ID_CONFLICT',
          'Client record ID is bound to different attendance data',
        );
      }
      const existing = this.#records.get(existingId);
      if (!existing)
        throw new AttendanceDomainError(
          'ATTENDANCE_RECORD_NOT_FOUND',
          'Attendance record was not found',
        );
      return { record: cloneRecord(existing), replayed: true };
    }
    const currentKey = `${tenantId}:${entry.sessionId}:${entry.studentProfileId}`;
    if (this.#currentRecordByStudentSession.has(currentKey)) {
      throw new AttendanceDomainError(
        'ATTENDANCE_CURRENT_RESULT_EXISTS',
        'Use an amendment to change the current attendance result',
      );
    }
    const record: AttendanceRecord = {
      tenantId,
      attendanceRecordId: crypto.randomUUID(),
      clientRecordId: entry.clientRecordId,
      sessionId: entry.sessionId,
      studentProfileId: entry.studentProfileId,
      attendanceCodeId: entry.attendanceCodeId,
      ...(entry.minutesPresent === undefined ? {} : { minutesPresent: entry.minutesPresent }),
      ...(entry.minutesAbsent === undefined ? {} : { minutesAbsent: entry.minutesAbsent }),
      ...(entry.reason === undefined ? {} : { reason: entry.reason }),
      source: entry.source,
      recordedBy: entry.recordedBy,
      recordedAt: new Date().toISOString(),
      version: 1,
    };
    this.#records.set(record.attendanceRecordId, record);
    this.#currentRecordByStudentSession.set(currentKey, record.attendanceRecordId);
    this.#recordByClientId.set(clientKey, record.attendanceRecordId);
    this.#clientSignatures.set(clientKey, signature);
    return { record: cloneRecord(record), replayed: false };
  }

  #requirePolicy(tenantId: string, policyVersionId: string): AttendancePolicyVersion {
    const policy = this.#policies.get(policyVersionId);
    if (!policy || policy.tenantId !== tenantId) {
      throw new AttendanceDomainError(
        'ATTENDANCE_POLICY_NOT_FOUND',
        'Attendance policy was not found',
      );
    }
    return policy;
  }

  #requireCode(tenantId: string, attendanceCodeId: string): AttendanceCode {
    const code = this.#codes.get(attendanceCodeId);
    if (!code || code.tenantId !== tenantId) {
      throw new AttendanceDomainError('ATTENDANCE_CODE_NOT_FOUND', 'Attendance code was not found');
    }
    return code;
  }

  #requireSession(tenantId: string, sessionId: string): AttendanceSession {
    const session = this.#sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new AttendanceDomainError(
        'ATTENDANCE_SESSION_NOT_FOUND',
        'Attendance session was not found',
      );
    }
    return session;
  }

  #result<T extends object>(
    value: T,
    eventType: string,
    correlationId: string,
    explicitTenantId?: string,
  ): AttendanceCommandResult<T> {
    const tenantId =
      explicitTenantId ??
      ('tenantId' in value && typeof value.tenantId === 'string' ? value.tenantId : undefined);
    if (!tenantId)
      throw new AttendanceDomainError('ATTENDANCE_TENANT_REQUIRED', 'Tenant is required');
    const aggregateId =
      ('sessionId' in value && typeof value.sessionId === 'string' ? value.sessionId : undefined) ??
      ('policyVersionId' in value && typeof value.policyVersionId === 'string'
        ? value.policyVersionId
        : undefined) ??
      crypto.randomUUID();
    this.#audit.append({ tenantId, action: eventType, subjectId: aggregateId });
    return {
      value,
      events: [
        createDomainEvent({
          eventType,
          schemaVersion: 1,
          tenantId,
          aggregateType: 'attendance',
          aggregateId,
          aggregateVersion:
            'version' in value && typeof value.version === 'number' ? value.version : 1,
          correlationId,
          payload: value,
        }),
      ],
    };
  }
}
