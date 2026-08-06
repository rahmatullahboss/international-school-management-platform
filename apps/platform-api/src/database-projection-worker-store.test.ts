import { describe, expect, it, vi } from 'vitest';

import { DatabaseProjectionWorkerStore } from './database-projection-worker-store.js';

const workerId = 'projection-worker-staging-01';

function databaseWith(rows: readonly Record<string, unknown>[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database projection worker store', () => {
  it('calls the reviewed database batch processor', async () => {
    const database = databaseWith([
      {
        value: {
          claimed: 3,
          completed: 2,
          retried: 1,
          deadLettered: 0,
        },
      },
    ]);
    const store = new DatabaseProjectionWorkerStore(database);

    await expect(store.processBatch(workerId, 20, 5)).resolves.toEqual({
      claimed: 3,
      completed: 2,
      retried: 1,
      deadLettered: 0,
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.process_runtime_projection_refresh_batch'),
      [workerId, 20, 5],
    );
  });

  it('rejects invalid inputs before querying', async () => {
    const database = databaseWith([]);
    const store = new DatabaseProjectionWorkerStore(database);
    await expect(store.processBatch('bad worker id', 20, 5)).rejects.toThrow(/workerId/u);
    await expect(store.processBatch(workerId, 0, 5)).rejects.toThrow(/batchSize/u);
    await expect(store.processBatch(workerId, 20, 1)).rejects.toThrow(/maxAttempts/u);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('fails closed on ambiguous or malformed database responses', async () => {
    await expect(
      new DatabaseProjectionWorkerStore(databaseWith([])).processBatch(workerId, 20, 5),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseProjectionWorkerStore(databaseWith([{ value: {} }, { value: {} }])).processBatch(
        workerId,
        20,
        5,
      ),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseProjectionWorkerStore(
        databaseWith([
          {
            value: {
              claimed: 1,
              completed: 2,
              retried: 0,
              deadLettered: 0,
            },
          },
        ]),
      ).processBatch(workerId, 20, 5),
    ).rejects.toThrow(/invalid database response/u);
  });
});
