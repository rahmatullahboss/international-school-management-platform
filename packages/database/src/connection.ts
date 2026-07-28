import { Pool, neon } from '@neondatabase/serverless';

export interface HttpDatabase {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<Row[]>;
}

interface HttpQueryFunction {
  query(statement: string, parameters?: readonly unknown[]): Promise<Record<string, unknown>[]>;
}

export type HttpQueryFactory = (connectionString: string) => HttpQueryFunction;

export interface TransactionClient {
  query(statement: string, parameters?: readonly unknown[]): Promise<{ rows: unknown[] }>;
  release(): void;
}

export interface TransactionPool {
  connect(): Promise<TransactionClient>;
  end(): Promise<void>;
}

export type TransactionPoolFactory = (connectionString: string) => TransactionPool;

function defaultHttpFactory(connectionString: string): HttpQueryFunction {
  return neon(connectionString);
}

function defaultPoolFactory(connectionString: string): TransactionPool {
  return new Pool({ connectionString });
}

export function createHttpDatabase(
  connectionString: string,
  factory: HttpQueryFactory = defaultHttpFactory,
): HttpDatabase {
  const sql = factory(connectionString);
  return {
    query: async <Row extends Record<string, unknown>>(
      statement: string,
      parameters: readonly unknown[] = [],
    ): Promise<Row[]> => sql.query(statement, parameters).then((rows) => rows as Row[]),
  };
}

export async function withWebSocketTransaction<Result>(
  connectionString: string,
  operation: (client: TransactionClient) => Promise<Result>,
  poolFactory: TransactionPoolFactory = defaultPoolFactory,
): Promise<Result> {
  const pool = poolFactory(connectionString);
  let client: TransactionClient | undefined;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}
