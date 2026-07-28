export interface DatabaseMigration {
  id: string;
  description: string;
  sql: string;
}

const foundationSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS tenancy;
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS integration_core;

CREATE TABLE IF NOT EXISTS platform.schema_migration (
  migration_id text PRIMARY KEY,
  stream_id text NOT NULL,
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user
);

DO $foundation_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT app_runtime TO %I', current_user);
END
$foundation_role$;

GRANT USAGE ON SCHEMA platform, tenancy, iam, audit, workflow, integration_core TO app_runtime;

CREATE TABLE IF NOT EXISTS tenancy.isolation_probe (
  tenant_id uuid NOT NULL,
  probe_id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, probe_id)
);

ALTER TABLE tenancy.isolation_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy.isolation_probe FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolation_probe_tenant_policy ON tenancy.isolation_probe;
CREATE POLICY isolation_probe_tenant_policy ON tenancy.isolation_probe
  FOR ALL
  TO app_runtime
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON tenancy.isolation_probe TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280001_FND-01_foundation', 'FND-01', 'Foundation schemas, runtime role and RLS proof table')
ON CONFLICT (migration_id) DO NOTHING;
`;

export const foundationMigrations: readonly DatabaseMigration[] = [
  {
    id: '202607280001_FND-01_foundation',
    description: 'Foundation schemas, runtime role and RLS proof table',
    sql: foundationSql,
  },
];

export function validateMigrationPlan(migrations: readonly DatabaseMigration[]): void {
  const ids = migrations.map((migration) => migration.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Migration identifiers must be unique');
  }

  const sorted = [...ids].sort((left, right) => left.localeCompare(right));
  if (ids.some((id, index) => id !== sorted[index])) {
    throw new Error('Migrations must be strictly ordered by identifier');
  }
}
