import { describe, expect, it } from 'vitest';

import { foundationMigrations, validateMigrationPlan } from './migrations.js';

describe('foundation migration plan', () => {
  it('is strictly ordered and contains unique identifiers', () => {
    expect(() => validateMigrationPlan(foundationMigrations)).not.toThrow();
    expect(foundationMigrations.map((migration) => migration.id)).toEqual([
      '202607280001_FND-01_foundation',
      '202607280002_FND-01_tenancy',
      '202607280003_FND-01_identity_policy',
    ]);
  });

  it('creates the owned schemas and an RLS isolation probe', () => {
    const sql = foundationMigrations[0]?.sql ?? '';

    for (const schema of ['platform', 'tenancy', 'iam', 'audit', 'workflow', 'integration_core']) {
      expect(sql).toContain(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    }

    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).toContain('CREATE ROLE app_runtime NOLOGIN');
  });

  it('models regional tenant routing and tenant-owned organization records', () => {
    const sql = foundationMigrations[1]?.sql ?? '';
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS platform.tenant');
    expect(sql).toContain('home_region');
    expect(sql).toContain('deployment_profile');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS tenancy.legal_entity');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS tenancy.campus');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS tenancy.entitlement');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
  });

  it('models identity links, scoped roles and expiring privileged access', () => {
    const sql = foundationMigrations[2]?.sql ?? '';
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS iam.account');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS iam.person_link');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS iam.role_permission');
    expect(sql).toContain('required_assurance');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS iam.privileged_access_grant');
    expect(sql).toContain('expires_at');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
  });
});
