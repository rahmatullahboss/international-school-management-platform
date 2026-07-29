import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../packages/modules/residential-catering/migrations/202607290206_OPS-01_hostel_cafeteria.sql',
  import.meta.url,
);

describe('OPS hostel and cafeteria migration', () => {
  it('creates complete hostel occupancy, safeguarding and maintenance records', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const table of [
      'building',
      'room',
      'bed',
      'allocation',
      'visitor',
      'incident',
      'maintenance',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS hostel.${table}`);
    }
    expect(sql).toContain('hostel_single_active_bed_allocation_idx');
    expect(sql).toContain('hostel_single_active_resident_allocation_idx');
    expect(sql).toContain("category IN ('safeguarding', 'health', 'discipline', 'facility')");
  });

  it('creates allergen, entitlement, service and finance source records without cross-module foreign keys', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const table of ['menu_item', 'meal_plan', 'meal_order', 'meal_service', 'charge_source']) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS cafeteria.${table}`);
    }
    expect(sql).toContain('allergen_codes jsonb');
    expect(sql).toContain('inventory_item_refs jsonb');
    expect(sql).toContain('UNIQUE (tenant_id, idempotency_key)');
    expect(sql).not.toContain('REFERENCES people.');
    expect(sql).not.toContain('REFERENCES billing.');
    expect(sql).not.toContain('REFERENCES inventory.');
  });

  it('forces tenant RLS on both schemas and registers OPS ownership', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain("'202607290206_OPS-01_hostel_cafeteria'");
    expect(sql).toContain("'OPS-01'");
  });
});
