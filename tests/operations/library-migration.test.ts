import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../packages/modules/library/migrations/202607280204_OPS-01_library.sql',
  import.meta.url,
);

describe('OPS library migration', () => {
  it('creates catalogue, circulation, holds and fine source tables', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const table of ['title', 'copy', 'patron', 'loan', 'hold', 'fine_source']) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS library.${table}`);
    }
    expect(sql).toContain('library_copy_single_active_loan_idx');
    expect(sql).toContain('library_hold_queue_idx');
    expect(sql).toContain('UNIQUE (tenant_id, idempotency_key)');
  });

  it('uses opaque patron and finance references without cross-module table coupling', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('person_ref text NOT NULL');
    expect(sql).toContain('finance_document_ref text');
    expect(sql).not.toContain('REFERENCES people.');
    expect(sql).not.toContain('REFERENCES billing.');
    expect(sql).not.toContain('REFERENCES ledger.');
  });

  it('forces tenant RLS and registers OPS ownership', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('ALTER TABLE library.%I ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE library.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("'202607280204_OPS-01_library'");
    expect(sql).toContain("'OPS-01'");
  });
});
