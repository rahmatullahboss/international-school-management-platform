import { describe, expect, it, vi } from 'vitest';

import {
  runRuntimeProjectionScheduled,
  scheduleRuntimeProjectionWorker,
} from './runtime-projection-scheduled.js';

const configuredBindings = {
  DATABASE_URL: 'postgresql://database.example/school',
  RUNTIME_PROJECTION_WORKER_SOURCE: 'database',
  RUNTIME_PROJECTION_WORKER_ID: 'projection-worker-staging-01',
  RUNTIME_PROJECTION_WORKER_BATCH_SIZE: '12',
  RUNTIME_PROJECTION_WORKER_MAX_ATTEMPTS: '4',
};

describe('scheduled runtime projection execution', () => {
  it('does not construct a database store while unconfigured', async () => {
    const storeFactory = vi.fn();
    await expect(runRuntimeProjectionScheduled({}, storeFactory)).resolves.toEqual({
      ok: false,
      code: 'runtime_projection_worker_configuration_invalid',
      message: 'Runtime projection processing is not configured.',
    });
    expect(storeFactory).not.toHaveBeenCalled();
  });

  it('passes bounded configured settings to the database store', async () => {
    const processBatch = vi.fn().mockResolvedValue({
      claimed: 2,
      completed: 1,
      retried: 0,
      deadLettered: 1,
    });
    const storeFactory = vi.fn().mockReturnValue({ processBatch });

    await expect(runRuntimeProjectionScheduled(configuredBindings, storeFactory)).resolves.toEqual({
      ok: true,
      result: { claimed: 2, completed: 1, retried: 0, deadLettered: 1 },
    });
    expect(storeFactory).toHaveBeenCalledWith(configuredBindings.DATABASE_URL);
    expect(processBatch).toHaveBeenCalledWith('projection-worker-staging-01', 12, 4);
  });

  it('rejects malformed numeric configuration before querying', async () => {
    const processBatch = vi.fn();
    const storeFactory = vi.fn().mockReturnValue({ processBatch });
    await expect(
      runRuntimeProjectionScheduled(
        { ...configuredBindings, RUNTIME_PROJECTION_WORKER_BATCH_SIZE: '20x' },
        storeFactory,
      ),
    ).resolves.toMatchObject({ ok: false, code: 'runtime_projection_worker_invalid' });
    expect(processBatch).not.toHaveBeenCalled();
  });

  it('registers one sanitized execution promise with the scheduled context', async () => {
    const processBatch = vi.fn().mockResolvedValue({
      claimed: 0,
      completed: 0,
      retried: 0,
      deadLettered: 0,
    });
    const waitUntil = vi.fn();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    scheduleRuntimeProjectionWorker(configuredBindings, { waitUntil }, () => ({ processBatch }));
    expect(waitUntil).toHaveBeenCalledTimes(1);
    const promise = waitUntil.mock.calls[0]?.[0] as Promise<unknown>;
    await expect(promise).resolves.toMatchObject({ ok: true });
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'runtime_projection_batch',
        ok: true,
        claimed: 0,
        completed: 0,
        retried: 0,
        deadLettered: 0,
      }),
    );
    log.mockRestore();
  });
});
