export interface RuntimeProjectionWorkerBindings {
  readonly RUNTIME_PROJECTION_DATABASE_URL?: string;
  readonly RUNTIME_PROJECTION_WORKER_SOURCE?: string;
}

export interface RuntimeProjectionWorkerReadiness {
  readonly schemaVersion: 1;
  readonly state: 'disabled' | 'incomplete' | 'ready';
  readonly controls: {
    readonly databaseNativeProcessing: true;
    readonly dedicatedDatabaseCredential: true;
    readonly exactEventAllowlist: true;
    readonly concurrentSkipLockedClaims: true;
    readonly appliedCommandDeduplication: true;
    readonly boundedRetryBackoff: true;
    readonly deadLetterIsolation: true;
    readonly sourceProjectionIntegrity: true;
  };
  readonly missingConfiguration: readonly (
    'runtime-projection-database-url' | 'runtime-projection-worker-source'
  )[];
}

export interface RuntimeProjectionBatchResult {
  readonly claimed: number;
  readonly completed: number;
  readonly retried: number;
  readonly deadLettered: number;
}

export interface RuntimeProjectionBatchStore {
  processBatch(
    workerId: string,
    batchSize: number,
    maxAttempts: number,
  ): Promise<RuntimeProjectionBatchResult>;
}

export type RuntimeProjectionBatchResolution =
  | { readonly ok: true; readonly result: RuntimeProjectionBatchResult }
  | {
      readonly ok: false;
      readonly code:
        | 'runtime_projection_worker_configuration_invalid'
        | 'runtime_projection_worker_invalid'
        | 'runtime_projection_worker_unavailable';
      readonly message: string;
    };

const WORKER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/u;
const MAX_BATCH_SIZE = 50;
const MIN_MAX_ATTEMPTS = 2;
const MAX_MAX_ATTEMPTS = 10;

function configuredValue(value: string | undefined): string | undefined {
  const configured = value?.trim();
  return configured === undefined || configured === '' ? undefined : configured;
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validBatchResult(value: RuntimeProjectionBatchResult, batchSize: number): boolean {
  if (
    !validCount(value.claimed) ||
    !validCount(value.completed) ||
    !validCount(value.retried) ||
    !validCount(value.deadLettered)
  ) {
    return false;
  }
  return (
    value.claimed <= batchSize &&
    value.completed + value.retried + value.deadLettered === value.claimed
  );
}

export function resolveRuntimeProjectionWorkerReadiness(
  bindings: RuntimeProjectionWorkerBindings,
): RuntimeProjectionWorkerReadiness {
  const missingConfiguration: (
    'runtime-projection-database-url' | 'runtime-projection-worker-source'
  )[] = [];
  if (configuredValue(bindings.RUNTIME_PROJECTION_DATABASE_URL) === undefined) {
    missingConfiguration.push('runtime-projection-database-url');
  }
  if (configuredValue(bindings.RUNTIME_PROJECTION_WORKER_SOURCE) !== 'database') {
    missingConfiguration.push('runtime-projection-worker-source');
  }

  return {
    schemaVersion: 1,
    state:
      missingConfiguration.length === 2
        ? 'disabled'
        : missingConfiguration.length > 0
          ? 'incomplete'
          : 'ready',
    controls: {
      databaseNativeProcessing: true,
      dedicatedDatabaseCredential: true,
      exactEventAllowlist: true,
      concurrentSkipLockedClaims: true,
      appliedCommandDeduplication: true,
      boundedRetryBackoff: true,
      deadLetterIsolation: true,
      sourceProjectionIntegrity: true,
    },
    missingConfiguration,
  };
}

function validSettings(workerId: string, batchSize: number, maxAttempts: number): boolean {
  return (
    WORKER_ID_PATTERN.test(workerId) &&
    Number.isSafeInteger(batchSize) &&
    batchSize >= 1 &&
    batchSize <= MAX_BATCH_SIZE &&
    Number.isSafeInteger(maxAttempts) &&
    maxAttempts >= MIN_MAX_ATTEMPTS &&
    maxAttempts <= MAX_MAX_ATTEMPTS
  );
}

export async function processRuntimeProjectionBatch(input: {
  readonly configured: boolean;
  readonly workerId: string;
  readonly batchSize: number;
  readonly maxAttempts: number;
  readonly store: RuntimeProjectionBatchStore;
}): Promise<RuntimeProjectionBatchResolution> {
  if (!input.configured) {
    return {
      ok: false,
      code: 'runtime_projection_worker_configuration_invalid',
      message: 'Runtime projection processing is not configured.',
    };
  }
  if (!validSettings(input.workerId, input.batchSize, input.maxAttempts)) {
    return {
      ok: false,
      code: 'runtime_projection_worker_invalid',
      message: 'Runtime projection worker settings are invalid.',
    };
  }

  try {
    const result = await input.store.processBatch(
      input.workerId,
      input.batchSize,
      input.maxAttempts,
    );
    if (!validBatchResult(result, input.batchSize)) {
      throw new Error('Runtime projection counters are invalid.');
    }
    return { ok: true, result };
  } catch {
    return {
      ok: false,
      code: 'runtime_projection_worker_unavailable',
      message: 'Runtime projection processing is unavailable.',
    };
  }
}
