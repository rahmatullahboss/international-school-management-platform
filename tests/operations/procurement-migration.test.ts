import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../packages/modules/procurement/migrations/202607280202_OPS-01_procurement_payables.sql',
  import.meta.url,
);

describe('OPS procurement migration', () => {
  it('creates complete owned procurement and payable source-document tables', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const table of [
      'supplier',
      'budget_envelope',
      'requisition',
      'requisition_line',
      'purchase_order',
      'goods_receipt',
      'goods_receipt_line',
      'supplier_invoice',
      'finance_export',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS procurement.${table}`);
    }
    expect(sql).not.toContain('REFERENCES finance.');
    expect(sql).not.toContain('REFERENCES billing.');
    expect(sql).not.toContain('REFERENCES ledger.');
  });

  it('models money in minor units, duplicate prevention and three-way-match evidence', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('amount_minor bigint');
    expect(sql).toContain('committed_minor bigint');
    expect(sql).toContain('spent_minor bigint');
    expect(sql).toContain('UNIQUE (tenant_id, supplier_id, supplier_invoice_number)');
    expect(sql).toContain('UNIQUE (tenant_id, idempotency_key)');
    expect(sql).toContain('match_status text NOT NULL');
    expect(sql).toContain('source_document jsonb NOT NULL');
  });

  it('forces RLS on all tenant tables and registers OPS-01 migration ownership', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('ALTER TABLE procurement.%I ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE procurement.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain("'202607280202_OPS-01_procurement_payables'");
    expect(sql).toContain("'OPS-01'");
  });
});
