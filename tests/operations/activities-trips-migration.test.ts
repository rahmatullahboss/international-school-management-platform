import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../packages/modules/activities-trips/migrations/202607290207_OPS-01_activities_trips.sql',
  import.meta.url,
);

describe('OPS activities and trips migration', () => {
  it('creates activities, waitlists, trips, risk, consent, attendance and incident records', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const table of [
      'activity',
      'enrolment',
      'trip',
      'risk_assessment',
      'trip_participant',
      'trip_consent',
      'trip_attendance',
      'trip_incident',
      'finance_source',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS activities.${table}`);
    }
    expect(sql).toContain('activities_enrolment_queue_idx');
    expect(sql).toContain('activities_trip_participant_queue_idx');
    expect(sql).toContain('CHECK (recorded_by IS DISTINCT FROM approved_by)');
  });

  it('keeps SIS, CARE and FIN references opaque and stores idempotent source records', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('participant_ref text NOT NULL');
    expect(sql).toContain('medical_note_ref text');
    expect(sql).toContain('budget_ref text NOT NULL');
    expect(sql).toContain('UNIQUE (tenant_id, idempotency_key)');
    expect(sql).not.toContain('REFERENCES people.');
    expect(sql).not.toContain('REFERENCES care.');
    expect(sql).not.toContain('REFERENCES billing.');
    expect(sql).not.toContain('REFERENCES ledger.');
  });

  it('forces tenant RLS and registers OPS ownership', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('ALTER TABLE activities.%I ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE activities.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("'202607290207_OPS-01_activities_trips'");
    expect(sql).toContain("'OPS-01'");
  });
});
