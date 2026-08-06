import type { HttpDatabase } from '@school/database';

import type {
  RuntimeProjectionOperationsHealth,
  RuntimeProjectionOperationsMonitorInput,
  RuntimeProjectionOperationsSnapshot,
} from './runtime-projection-operations-monitor.js';

interface ProjectionOperationsRow extends Record<string, unknown> {
  readonly value: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const HEALTH_STATES = new Set<RuntimeProjectionOperationsHealth>([
  'healthy',
  'warning',
  'critical',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function invalidResponse(): Error {
  return new Error('Runtime projection operations monitor returned an invalid database response.');
}

function requireRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(value) || !exactKeys(value, keys)) throw invalidResponse();
  return value;
}

function validateCounts(value: unknown, keys: readonly string[]): Record<string, number> {
  const record = requireRecord(value, keys);
  for (const key of keys) {
    if (!validCount(record[key])) throw invalidResponse();
  }
  return record as Record<string, number>;
}

function validateSnapshot(
  value: unknown,
  input: RuntimeProjectionOperationsMonitorInput,
): RuntimeProjectionOperationsSnapshot {
  const snapshot = requireRecord(value, [
    'schemaVersion',
    'tenantId',
    'health',
    'generatedAt',
    'controls',
    'backlog',
    'delivery',
    'sources',
    'mappings',
  ]);
  if (
    snapshot.schemaVersion !== 1 ||
    typeof snapshot.tenantId !== 'string' ||
    !UUID_PATTERN.test(snapshot.tenantId) ||
    snapshot.tenantId !== input.tenantId ||
    typeof snapshot.health !== 'string' ||
    !HEALTH_STATES.has(snapshot.health as RuntimeProjectionOperationsHealth) ||
    !validTimestamp(snapshot.generatedAt)
  ) {
    throw invalidResponse();
  }

  const controls = requireRecord(snapshot.controls, [
    'exactEventAllowlist',
    'tenantScoped',
    'payloadRedacted',
    'functionOnlyAccess',
  ]);
  if (
    controls.exactEventAllowlist !== true ||
    controls.tenantScoped !== true ||
    controls.payloadRedacted !== true ||
    controls.functionOnlyAccess !== true
  ) {
    throw invalidResponse();
  }

  const backlog = validateCounts(snapshot.backlog, [
    'eligible',
    'retryScheduled',
    'oldestEligibleSeconds',
  ]);
  const delivery = requireRecord(snapshot.delivery, [
    'appliedLastHour',
    'deadLetterTotal',
    'deadLettersLast24Hours',
    'byCode',
  ]);
  if (
    !validCount(delivery.appliedLastHour) ||
    !validCount(delivery.deadLetterTotal) ||
    !validCount(delivery.deadLettersLast24Hours)
  ) {
    throw invalidResponse();
  }
  const byCode = validateCounts(delivery.byCode, [
    'invalidEvent',
    'sourceUnavailable',
    'projectionStateConflict',
    'processorError',
  ]);
  const sources = validateCounts(snapshot.sources, [
    'current',
    'stale',
    'unapplied',
    'missingForMappedMemberships',
  ]);
  const mappings = validateCounts(snapshot.mappings, ['activeUnique', 'unmapped', 'ambiguous']);

  return {
    schemaVersion: 1,
    tenantId: snapshot.tenantId,
    health: snapshot.health as RuntimeProjectionOperationsHealth,
    generatedAt: snapshot.generatedAt,
    controls: {
      exactEventAllowlist: true,
      tenantScoped: true,
      payloadRedacted: true,
      functionOnlyAccess: true,
    },
    backlog: {
      eligible: backlog.eligible as number,
      retryScheduled: backlog.retryScheduled as number,
      oldestEligibleSeconds: backlog.oldestEligibleSeconds as number,
    },
    delivery: {
      appliedLastHour: delivery.appliedLastHour,
      deadLetterTotal: delivery.deadLetterTotal,
      deadLettersLast24Hours: delivery.deadLettersLast24Hours,
      byCode: {
        invalidEvent: byCode.invalidEvent as number,
        sourceUnavailable: byCode.sourceUnavailable as number,
        projectionStateConflict: byCode.projectionStateConflict as number,
        processorError: byCode.processorError as number,
      },
    },
    sources: {
      current: sources.current as number,
      stale: sources.stale as number,
      unapplied: sources.unapplied as number,
      missingForMappedMemberships: sources.missingForMappedMemberships as number,
    },
    mappings: {
      activeUnique: mappings.activeUnique as number,
      unmapped: mappings.unmapped as number,
      ambiguous: mappings.ambiguous as number,
    },
  };
}

export class DatabaseProjectionOperationsMonitorStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async read(
    input: RuntimeProjectionOperationsMonitorInput,
  ): Promise<RuntimeProjectionOperationsSnapshot> {
    const rows = await this.#database.query<ProjectionOperationsRow>(
      `SELECT platform.read_runtime_projection_operations_snapshot(
         $1::uuid,
         $2::integer,
         $3::integer
       ) AS value`,
      [input.tenantId, input.warningAgeSeconds, input.staleSourceSeconds],
    );
    const row = rows[0];
    if (rows.length !== 1 || row === undefined) throw invalidResponse();
    return validateSnapshot(row.value, input);
  }
}
