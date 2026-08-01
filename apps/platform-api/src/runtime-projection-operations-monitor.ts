export interface RuntimeProjectionOperationsMonitorInput {
  readonly tenantId: string;
  readonly warningAgeSeconds: number;
  readonly staleSourceSeconds: number;
}

export type RuntimeProjectionOperationsHealth = 'healthy' | 'warning' | 'critical';

export interface RuntimeProjectionOperationsSnapshot {
  readonly schemaVersion: 1;
  readonly tenantId: string;
  readonly health: RuntimeProjectionOperationsHealth;
  readonly generatedAt: string;
  readonly controls: {
    readonly exactEventAllowlist: true;
    readonly tenantScoped: true;
    readonly payloadRedacted: true;
    readonly functionOnlyAccess: true;
  };
  readonly backlog: {
    readonly eligible: number;
    readonly retryScheduled: number;
    readonly oldestEligibleSeconds: number;
  };
  readonly delivery: {
    readonly appliedLastHour: number;
    readonly deadLetterTotal: number;
    readonly deadLettersLast24Hours: number;
    readonly byCode: {
      readonly invalidEvent: number;
      readonly sourceUnavailable: number;
      readonly projectionStateConflict: number;
      readonly processorError: number;
    };
  };
  readonly sources: {
    readonly current: number;
    readonly stale: number;
    readonly unapplied: number;
    readonly missingForMappedMemberships: number;
  };
  readonly mappings: {
    readonly activeUnique: number;
    readonly unmapped: number;
    readonly ambiguous: number;
  };
}

export interface RuntimeProjectionOperationsMonitorStore {
  read(input: RuntimeProjectionOperationsMonitorInput): Promise<RuntimeProjectionOperationsSnapshot>;
}

export type RuntimeProjectionOperationsMonitorResolution =
  | { readonly ok: true; readonly snapshot: RuntimeProjectionOperationsSnapshot }
  | {
      readonly ok: false;
      readonly reason: 'invalid-monitor-request' | 'monitor-disabled' | 'monitor-unavailable';
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validInteger(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function validateInput(value: unknown): RuntimeProjectionOperationsMonitorInput | undefined {
  if (!isRecord(value)) return undefined;
  const expectedKeys = ['tenantId', 'warningAgeSeconds', 'staleSourceSeconds'];
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    return undefined;
  }
  if (
    typeof value.tenantId !== 'string' ||
    !UUID_PATTERN.test(value.tenantId) ||
    !validInteger(value.warningAgeSeconds, 60, 86_400) ||
    !validInteger(value.staleSourceSeconds, 300, 604_800)
  ) {
    return undefined;
  }
  return {
    tenantId: value.tenantId,
    warningAgeSeconds: value.warningAgeSeconds,
    staleSourceSeconds: value.staleSourceSeconds,
  };
}

export async function readRuntimeProjectionOperationsSnapshot(options: {
  readonly configured: boolean;
  readonly input: unknown;
  readonly store: RuntimeProjectionOperationsMonitorStore;
}): Promise<RuntimeProjectionOperationsMonitorResolution> {
  if (!options.configured) return { ok: false, reason: 'monitor-disabled' };
  const input = validateInput(options.input);
  if (input === undefined) return { ok: false, reason: 'invalid-monitor-request' };
  try {
    const snapshot = await options.store.read(input);
    return { ok: true, snapshot };
  } catch {
    return { ok: false, reason: 'monitor-unavailable' };
  }
}
