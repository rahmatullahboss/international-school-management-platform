import type { HttpDatabase } from '@school/database';

import type { RuntimeProjectionBatchResult } from './runtime-projection-worker.js';

interface RuntimeProjectionBatchRow extends Record<string, unknown> {
  readonly value: unknown;
}

const WORKER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function invalidResponse(): Error {
  return new Error('Runtime projection worker returned an invalid database response.');
}

function validateResult(value: unknown, batchSize: number): RuntimeProjectionBatchResult {
  if (!isRecord(value)) throw invalidResponse();
  const { claimed, completed, retried, deadLettered } = value;
  if (
    !validCount(claimed) ||
    !validCount(completed) ||
    !validCount(retried) ||
    !validCount(deadLettered) ||
    claimed > batchSize ||
    completed + retried + deadLettered !== claimed
  ) {
    throw invalidResponse();
  }
  return { claimed, completed, retried, deadLettered };
}

function requireWorkerId(value: string): string {
  if (!WORKER_ID_PATTERN.test(value)) throw new Error('workerId is invalid.');
  return value;
}

function requireBatchSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) {
    throw new Error('batchSize is invalid.');
  }
  return value;
}

function requireMaxAttempts(value: number): number {
  if (!Number.isSafeInteger(value) || value < 2 || value > 10) {
    throw new Error('maxAttempts is invalid.');
  }
  return value;
}

export class DatabaseProjectionWorkerStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async processBatch(
    workerId: string,
    batchSize: number,
    maxAttempts: number,
  ): Promise<RuntimeProjectionBatchResult> {
    const validatedWorkerId = requireWorkerId(workerId);
    const validatedBatchSize = requireBatchSize(batchSize);
    const validatedMaxAttempts = requireMaxAttempts(maxAttempts);

    const rows = await this.#database.query<RuntimeProjectionBatchRow>(
      `SELECT platform.process_runtime_projection_refresh_batch(
         $1::text,
         $2::integer,
         $3::integer
       ) AS value`,
      [validatedWorkerId, validatedBatchSize, validatedMaxAttempts],
    );
    const row = rows[0];
    if (rows.length !== 1 || row === undefined) throw invalidResponse();
    return validateResult(row.value, validatedBatchSize);
  }
}
