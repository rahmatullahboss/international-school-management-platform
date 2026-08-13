import { describe, expect, it, vi } from 'vitest';

import {
  processRuntimeProjectionBatch,
  resolveRuntimeProjectionWorkerReadiness,
} from './runtime-projection-worker.js';

const workerId = 'projection-worker-staging-01';

describe('runtime projection worker readiness', () => {
  it('stays disabled without the reviewed database processor binding', () => {
    expect(resolveRuntimeProjectionWorkerReadiness({})).toEqual({
      schemaVersion: 1,
      state: 'disabled',
      controls: {
        dedicatedDatabaseCredential: true,
        databaseNativeProcessing: true,
        exactEventAllowlist: true,
        concurrentSkipLockedClaims: true,
        appliedCommandDeduplication: true,
        boundedRetryBackoff: true,
        deadLetterIsolation: true,
        sourceProjectionIntegrity: true,
      },
      missingConfiguration: [
        'runtime-projection-database-url',
        'runtime-projection-worker-source',
      ],
    });
  });

  it('does not accept the shared API database credential', () => {
    const readiness = resolveRuntimeProjectionWorkerReadiness({
      DATABASE_URL: 'synthetic-api-db',
      RUNTIME_PROJECTION_WORKER_SOURCE: 'database',
    });

    expect(readiness.state).toBe('incomplete');
    expect(readiness.missingConfiguration).toEqual(['runtime-projection-database-url']);
  });

  it('requires the dedicated projection credential before becoming ready', () => {
    const readiness = resolveRuntimeProjectionWorkerReadiness({
      DATABASE_URL: 'synthetic-api-db',
      RUNTIME_PROJECTION_DATABASE_URL: 'synthetic-projection-db',
      RUNTIME_PROJECTION_WORKER_SOURCE: 'database',
    });

    expect(readiness.state).toBe('ready');
    expect(readiness.missingConfiguration).toEqual([]);
  });
});

describe('runtime projection batch processing', () => {
  it('runs a bounded database-native batch and returns typed counters', async () => {
    const store = {
      processBatch: vi.fn().mockResolvedValue({
        claimed: 3,
        completed: 2,
        retried: 1,
        deadLettered: 0,
      }),
    };

    await expect(
      processRuntimeProjectionBatch({
        configured: true,
        workerId,
        batchSize: 20,
        maxAttempts: 5,
        store,
      }),
    ).resolves.toEqual({
      ok: true,
      result: { claimed: 3, completed: 2, retried: 1, deadLettered: 0 },
    });
    expect(store.processBatch).toHaveBeenCalledWith(workerId, 20, 5);
  });

  it('rejects invalid worker settings before database access', async () => {
    const store = { processBatch: vi.fn() };
    await expect(
      processRuntimeProjectionBatch({
        configured: true,
        workerId: 'bad worker id',
        batchSize: 20,
        maxAttempts: 5,
        store,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'runtime_projection_worker_invalid' });
    await expect(
      processRuntimeProjectionBatch({
        configured: true,
        workerId,
        batchSize: 0,
        maxAttempts: 5,
        store,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'runtime_projection_worker_invalid' });
    expect(store.processBatch).not.toHaveBeenCalled();
  });

  it('fails closed when unconfigured or the database processor is unavailable', async () => {
    const store = { processBatch: vi.fn() };
    await expect(
      processRuntimeProjectionBatch({
        configured: false,
        workerId,
        batchSize: 20,
        maxAttempts: 5,
        store,
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'runtime_projection_worker_configuration_invalid',
      message: 'Runtime projection processing is not configured.',
    });
    expect(store.processBatch).not.toHaveBeenCalled();

    store.processBatch.mockRejectedValue(new Error('database details'));
    await expect(
      processRuntimeProjectionBatch({
        configured: true,
        workerId,
        batchSize: 20,
        maxAttempts: 5,
        store,
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'runtime_projection_worker_unavailable',
      message: 'Runtime projection processing is unavailable.',
    });
  });

  it('fails closed on malformed database counters', async () => {
    const store = {
      processBatch: vi.fn().mockResolvedValue({
        claimed: 1,
        completed: 2,
        retried: 0,
        deadLettered: 0,
      }),
    };
    await expect(
      processRuntimeProjectionBatch({
        configured: true,
        workerId,
        batchSize: 20,
        maxAttempts: 5,
        store,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'runtime_projection_worker_unavailable' });
  });
});
