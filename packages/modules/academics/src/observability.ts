export const ACADEMIC_METRICS = {
  commandDurationMs: 'academic_command_duration_ms',
  commandFailuresTotal: 'academic_command_failures_total',
  publicationBlockers: 'academic_publication_blockers',
  timetableConflicts: 'academic_timetable_conflicts',
  attendanceSyncRejectedTotal: 'academic_attendance_sync_rejected_total',
  attendanceIncompleteSessions: 'academic_attendance_incomplete_sessions',
  gradebookUnmoderatedAssessments: 'academic_gradebook_unmoderated_assessments',
  recordsPendingApprovals: 'academic_records_pending_approvals',
  transcriptReissuesTotal: 'academic_transcript_reissues_total',
} as const;

export type AcademicMetricName = (typeof ACADEMIC_METRICS)[keyof typeof ACADEMIC_METRICS];
export type AcademicOperationOutcome = 'succeeded' | 'rejected' | 'failed';

export interface AcademicMetricPoint {
  name: AcademicMetricName;
  kind: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels: Readonly<Record<string, string>>;
  recordedAt: string;
}

export interface AcademicOperationLog {
  tenantId: string;
  actorId: string;
  correlationId: string;
  operation: string;
  outcome: AcademicOperationOutcome;
  durationMs: number;
  errorCode?: string;
  aggregateType?: string;
  aggregateId?: string;
  recordedAt: string;
}

export interface AcademicHealthInput {
  migrationReady: boolean;
  publicationBlockers: number;
  timetableConflicts: number;
  incompleteAttendanceSessions: number;
  unmoderatedAssessments: number;
  pendingRecordApprovals: number;
  staleReadModelSeconds?: number;
}

export interface AcademicHealthSnapshot extends AcademicHealthInput {
  status: 'ready' | 'degraded' | 'not-ready';
  reasons: readonly string[];
  evaluatedAt: string;
}

const forbiddenLogKeys = new Set([
  'studentName',
  'studentDisplayName',
  'guardianName',
  'comment',
  'reason',
  'evidence',
  'rawScore',
  'attendanceReason',
]);

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new AcademicObservabilityError(
      'ACADEMIC_OBSERVABILITY_VALUE_INVALID',
      `${field} must be a finite non-negative number`,
    );
  }
}

function sanitizeLabels(
  labels: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (forbiddenLogKeys.has(key)) {
      throw new AcademicObservabilityError(
        'ACADEMIC_OBSERVABILITY_PII_LABEL_FORBIDDEN',
        `Metric label ${key} may contain academic personal data`,
      );
    }
    if (value.length > 160) {
      throw new AcademicObservabilityError(
        'ACADEMIC_OBSERVABILITY_LABEL_TOO_LONG',
        `Metric label ${key} is too long`,
      );
    }
    safe[key] = value;
  }
  return safe;
}

export class AcademicObservabilityError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AcademicObservabilityError';
  }
}

export class AcademicObservabilityRegistry {
  readonly #metrics: AcademicMetricPoint[] = [];
  readonly #operations: AcademicOperationLog[] = [];

  counter(
    name: AcademicMetricName,
    increment = 1,
    labels: Readonly<Record<string, string>> = {},
  ): void {
    assertFiniteNonNegative(increment, 'counter increment');
    this.#metrics.push({
      name,
      kind: 'counter',
      value: increment,
      labels: sanitizeLabels(labels),
      recordedAt: new Date().toISOString(),
    });
  }

  gauge(
    name: AcademicMetricName,
    value: number,
    labels: Readonly<Record<string, string>> = {},
  ): void {
    assertFiniteNonNegative(value, 'gauge value');
    this.#metrics.push({
      name,
      kind: 'gauge',
      value,
      labels: sanitizeLabels(labels),
      recordedAt: new Date().toISOString(),
    });
  }

  histogram(
    name: AcademicMetricName,
    value: number,
    labels: Readonly<Record<string, string>> = {},
  ): void {
    assertFiniteNonNegative(value, 'histogram value');
    this.#metrics.push({
      name,
      kind: 'histogram',
      value,
      labels: sanitizeLabels(labels),
      recordedAt: new Date().toISOString(),
    });
  }

  operation(input: Omit<AcademicOperationLog, 'recordedAt'>): void {
    assertFiniteNonNegative(input.durationMs, 'operation duration');
    if (!input.tenantId || !input.actorId || !input.correlationId || !input.operation) {
      throw new AcademicObservabilityError(
        'ACADEMIC_OBSERVABILITY_CONTEXT_REQUIRED',
        'Operation logs require tenant, actor, correlation and operation identifiers',
      );
    }
    this.#operations.push({
      ...input,
      recordedAt: new Date().toISOString(),
    });
    this.histogram(ACADEMIC_METRICS.commandDurationMs, input.durationMs, {
      operation: input.operation,
      outcome: input.outcome,
    });
    if (input.outcome !== 'succeeded') {
      this.counter(ACADEMIC_METRICS.commandFailuresTotal, 1, {
        operation: input.operation,
        outcome: input.outcome,
        errorCode: input.errorCode ?? 'UNKNOWN',
      });
    }
  }

  health(input: AcademicHealthInput): AcademicHealthSnapshot {
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'number') assertFiniteNonNegative(value, key);
    }
    const reasons: string[] = [];
    if (!input.migrationReady) reasons.push('database migrations are not ready');
    if (input.publicationBlockers > 0) reasons.push('academic publication blockers exist');
    if (input.timetableConflicts > 0) reasons.push('blocking timetable conflicts exist');
    if (input.incompleteAttendanceSessions > 0) reasons.push('attendance sessions are incomplete');
    if (input.unmoderatedAssessments > 0) reasons.push('assessments await moderation');
    if (input.pendingRecordApprovals > 0) reasons.push('academic records await approval');
    if ((input.staleReadModelSeconds ?? 0) > 300) reasons.push('academic read model is stale');
    const status = !input.migrationReady
      ? 'not-ready'
      : reasons.length === 0
        ? 'ready'
        : 'degraded';
    return {
      ...input,
      status,
      reasons,
      evaluatedAt: new Date().toISOString(),
    };
  }

  metrics(): readonly AcademicMetricPoint[] {
    return this.#metrics.map((point) => ({ ...point, labels: { ...point.labels } }));
  }

  operations(): readonly AcademicOperationLog[] {
    return this.#operations.map((entry) => ({ ...entry }));
  }
}
