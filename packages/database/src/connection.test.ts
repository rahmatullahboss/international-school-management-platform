import { describe, expect, it } from 'vitest';

import { createHttpDatabase, withWebSocketTransaction } from './connection.js';

class FakeClient {
  readonly statements: string[] = [];
  released = false;

  query(statement: string): Promise<{ rows: unknown[] }> {
    this.statements.push(statement);
    return Promise.resolve({ rows: [] });
  }

  release(): void {
    this.released = true;
  }
}

class FakePool {
  readonly client = new FakeClient();
  ended = false;

  connect(): Promise<FakeClient> {
    return Promise.resolve(this.client);
  }

  end(): Promise<void> {
    this.ended = true;
    return Promise.resolve();
  }
}

const TEST_DATABASE_URL = 'postgresql://unit-test.invalid/database';

describe('Neon connection adapters', () => {
  it('uses the HTTP query factory for one-shot parameterized queries', async () => {
    const calls: unknown[][] = [];
    const database = createHttpDatabase(TEST_DATABASE_URL, () => ({
      query: (statement: string, parameters?: readonly unknown[]) => {
        calls.push([statement, parameters]);
        return Promise.resolve([{ ok: true }]);
      },
    }));

    await expect(database.query('select $1::text as value', ['safe'])).resolves.toEqual([
      { ok: true },
    ]);
    expect(calls).toEqual([['select $1::text as value', ['safe']]]);
  });

  it('commits and always closes a request-scoped WebSocket transaction', async () => {
    const pool = new FakePool();
    const result = await withWebSocketTransaction(
      TEST_DATABASE_URL,
      async (client) => {
        await client.query('SELECT 1');
        return 'committed';
      },
      () => pool,
    );

    expect(result).toBe('committed');
    expect(pool.client.statements).toEqual(['BEGIN', 'SELECT 1', 'COMMIT']);
    expect(pool.client.released).toBe(true);
    expect(pool.ended).toBe(true);
  });

  it('rolls back and closes the pool when a transaction fails', async () => {
    const pool = new FakePool();

    await expect(
      withWebSocketTransaction(
        TEST_DATABASE_URL,
        () => Promise.reject(new Error('boom')),
        () => pool,
      ),
    ).rejects.toThrow('boom');

    expect(pool.client.statements).toEqual(['BEGIN', 'ROLLBACK']);
    expect(pool.client.released).toBe(true);
    expect(pool.ended).toBe(true);
  });
});
