import { describe, expect, it } from 'vitest';

import { createHttpDatabase } from '@school/database';

const databaseUrl = process.env.DATABASE_URL;

const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('direct Neon serverless driver', () => {
  it('executes a parameterized HTTP query against the configured database', async () => {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for the live Neon integration test');
    }

    const database = createHttpDatabase(databaseUrl);
    const rows = await database.query<{ database_name: string; echoed: string }>(
      'SELECT current_database() AS database_name, $1::text AS echoed',
      ['fnd-01'],
    );

    expect(rows[0]?.database_name).toBeTruthy();
    expect(rows[0]?.echoed).toBe('fnd-01');
  });
});
