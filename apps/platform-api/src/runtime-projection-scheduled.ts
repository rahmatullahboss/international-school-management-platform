import { createHttpDatabase } from '@school/database';

import { DatabaseProjectionWorkerStore } from './database-projection-worker-store.js';
import { emitRuntimeProjectionBatchObservation } from './runtime-operational-log.js';
import {
  processRuntimeProjectionBatch,
  resolveRuntimeProjectionWorkerReadiness,
  type RuntimeProjectionBatchResolution,
  type RuntimeProjectionBatchStore,
  type RuntimeProjectionWorkerBindings,
} from './runtime-projection-worker.js';

export interface RuntimeProjectionScheduledBindings extends RuntimeProjectionWorkerBindings {
  readonly RUNTIME_PROJECTION_WORKER_ID?: string;
  readonly RUNTIME_PROJECTION_WORKER_BATCH_SIZE?: string;
  readonly RUNTIME_PROJECTION_WORKER_MAX_ATTEMPTS?: string;
}

export interface RuntimeProjectionExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export type RuntimeProjectionStoreFactory = (databaseUrl: string) => RuntimeProjectionBatchStore;

function defaultStoreFactory(databaseUrl: string): RuntimeProjectionBatchStore {
  return new DatabaseProjectionWorkerStore(createHttpDatabase(databaseUrl));
}

function configuredValue(value: string | undefined): string | undefined {
  const configured = value?.trim();
  return configured === undefined || configured === '' ? undefined : configured;
}

function configuredInteger(value: string | undefined, fallback: number): number {
  const configured = configuredValue(value);
  if (configured === undefined) return fallback;
  if (!/^[0-9]+$/u.test(configured)) return Number.NaN;
  return Number.parseInt(configured, 10);
}

export async function runRuntimeProjectionScheduled(
  bindings: RuntimeProjectionScheduledBindings,
  storeFactory: RuntimeProjectionStoreFactory = defaultStoreFactory,
): Promise<RuntimeProjectionBatchResolution> {
  const readiness = resolveRuntimeProjectionWorkerReadiness(bindings);
  const databaseUrl = configuredValue(bindings.RUNTIME_PROJECTION_DATABASE_URL);
  const configured = readiness.state === 'ready' && databaseUrl !== undefined;
  const workerId =
    configuredValue(bindings.RUNTIME_PROJECTION_WORKER_ID) ?? 'runtime-projection-worker';
  const batchSize = configuredInteger(bindings.RUNTIME_PROJECTION_WORKER_BATCH_SIZE, 20);
  const maxAttempts = configuredInteger(bindings.RUNTIME_PROJECTION_WORKER_MAX_ATTEMPTS, 5);

  const unavailableStore: RuntimeProjectionBatchStore = {
    processBatch: () => Promise.reject(new Error('Projection worker is not configured.')),
  };
  const store =
    configured && databaseUrl !== undefined ? storeFactory(databaseUrl) : unavailableStore;

  return processRuntimeProjectionBatch({
    configured,
    workerId,
    batchSize,
    maxAttempts,
    store,
  });
}

export function scheduleRuntimeProjectionWorker(
  bindings: RuntimeProjectionScheduledBindings,
  executionContext: RuntimeProjectionExecutionContext,
  storeFactory: RuntimeProjectionStoreFactory = defaultStoreFactory,
): void {
  const processing = runRuntimeProjectionScheduled(bindings, storeFactory).then((resolution) => {
    emitRuntimeProjectionBatchObservation(resolution);
    return resolution;
  });
  executionContext.waitUntil(processing);
}
