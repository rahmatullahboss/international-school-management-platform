import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../packages/modules/inventory-assets/migrations/202607280203_OPS-01_inventory_assets.sql',
  import.meta.url,
);

describe('OPS inventory and asset migration', () => {
  it('creates immutable stock and complete asset lifecycle records', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const table of [
      'item',
      'location',
      'stock_movement',
      'stock_reservation',
      'stock_count',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS inventory.${table}`);
    }
    for (const table of ['asset_register', 'assignment', 'maintenance', 'disposal']) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS asset.${table}`);
    }
    expect(sql).toContain('UNIQUE (tenant_id, idempotency_key)');
    expect(sql).toContain('adjustment_movement_id');
    expect(sql).toContain('CHECK (requested_by IS DISTINCT FROM approved_by)');
  });

  it('derives stock through indexed movement history rather than mutable balance storage', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).not.toContain('stock_balance');
    expect(sql).toContain('inventory_movement_item_time_idx');
    expect(sql).toContain('inventory_movement_from_idx');
    expect(sql).toContain('inventory_movement_to_idx');
  });

  it('forces tenant RLS for both schemas and registers OPS ownership', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain("'202607280203_OPS-01_inventory_assets'");
    expect(sql).toContain("'OPS-01'");
  });
});
