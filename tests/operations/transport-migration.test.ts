import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../packages/modules/transport/migrations/202607290205_OPS-01_transport.sql',
  import.meta.url,
);

describe('OPS transport migration', () => {
  it('creates fleet, route, trip, safeguarding and maintenance tables', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const table of [
      'vehicle',
      'driver',
      'route',
      'route_stop',
      'rider_assignment',
      'trip_run',
      'rider_event',
      'incident',
      'maintenance',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS transport.${table}`);
    }
    expect(sql).toContain('transport_vehicle_single_active_trip_idx');
    expect(sql).toContain('transport_driver_single_active_trip_idx');
    expect(sql).toContain("category IN ('operational', 'safeguarding')");
  });

  it('uses opaque SIS references and no cross-module foreign keys', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('rider_ref text NOT NULL');
    expect(sql).toContain('guardian_ref text NOT NULL');
    expect(sql).toContain('staff_ref text NOT NULL');
    expect(sql).not.toContain('REFERENCES people.');
    expect(sql).not.toContain('REFERENCES academics.');
  });

  it('forces RLS and registers OPS migration ownership', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('ALTER TABLE transport.%I ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE transport.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("'202607290205_OPS-01_transport'");
    expect(sql).toContain("'OPS-01'");
  });
});
