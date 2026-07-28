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

const tenancySql = `
CREATE TABLE IF NOT EXISTS platform.tenant (
  tenant_id uuid PRIMARY KEY,
  slug citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  home_region text NOT NULL,
  deployment_profile text NOT NULL CHECK (deployment_profile IN ('regional-pooled', 'dedicated')),
  database_binding text NOT NULL,
  provisioning_status text NOT NULL DEFAULT 'pending'
    CHECK (provisioning_status IN ('pending', 'database-ready', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.tenant_domain (
  domain citext PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id) ON DELETE CASCADE,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_domain_tenant_idx ON platform.tenant_domain (tenant_id);

CREATE TABLE IF NOT EXISTS tenancy.legal_entity (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  legal_entity_id uuid NOT NULL DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  country_code char(2) NOT NULL,
  default_currency char(3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id)
);

CREATE TABLE IF NOT EXISTS tenancy.campus (
  tenant_id uuid NOT NULL,
  campus_id uuid NOT NULL DEFAULT gen_random_uuid(),
  legal_entity_id uuid NOT NULL,
  code citext NOT NULL,
  name text NOT NULL,
  time_zone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, campus_id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, legal_entity_id)
    REFERENCES tenancy.legal_entity (tenant_id, legal_entity_id)
);

CREATE TABLE IF NOT EXISTS tenancy.entitlement (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  entitlement_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, entitlement_key)
);

ALTER TABLE tenancy.legal_entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy.legal_entity FORCE ROW LEVEL SECURITY;
ALTER TABLE tenancy.campus ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy.campus FORCE ROW LEVEL SECURITY;
ALTER TABLE tenancy.entitlement ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy.entitlement FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_entity_tenant_policy ON tenancy.legal_entity;
CREATE POLICY legal_entity_tenant_policy ON tenancy.legal_entity
  FOR ALL TO app_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS campus_tenant_policy ON tenancy.campus;
CREATE POLICY campus_tenant_policy ON tenancy.campus
  FOR ALL TO app_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS entitlement_tenant_policy ON tenancy.entitlement;
CREATE POLICY entitlement_tenant_policy ON tenancy.entitlement
  FOR ALL TO app_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON tenancy.legal_entity TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenancy.campus TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenancy.entitlement TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280002_FND-01_tenancy', 'FND-01', 'Tenant directory, regional routing, organizations and entitlements')
ON CONFLICT (migration_id) DO NOTHING;
`;

const identityPolicySql = `
CREATE TABLE IF NOT EXISTS iam.account (
  account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_subject text NOT NULL,
  email citext,
  assurance_level text NOT NULL DEFAULT 'aal1' CHECK (assurance_level IN ('aal1', 'aal2')),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS iam.person_link (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  account_id uuid NOT NULL REFERENCES iam.account (account_id),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, account_id)
);

CREATE TABLE IF NOT EXISTS iam.role (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  role_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  display_name text NOT NULL,
  system_role boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, role_id),
  UNIQUE (tenant_id, role_key)
);

CREATE TABLE IF NOT EXISTS iam.permission (
  permission_key text PRIMARY KEY,
  description text NOT NULL,
  required_assurance text NOT NULL DEFAULT 'aal1' CHECK (required_assurance IN ('aal1', 'aal2'))
);

CREATE TABLE IF NOT EXISTS iam.role_permission (
  tenant_id uuid NOT NULL,
  role_id uuid NOT NULL,
  permission_key text NOT NULL REFERENCES iam.permission (permission_key),
  PRIMARY KEY (tenant_id, role_id, permission_key),
  FOREIGN KEY (tenant_id, role_id) REFERENCES iam.role (tenant_id, role_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.membership (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES iam.account (account_id),
  campus_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, membership_id)
);

CREATE TABLE IF NOT EXISTS iam.membership_role (
  tenant_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  role_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, membership_id, role_id)
);

CREATE TABLE IF NOT EXISTS iam.privileged_access_grant (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  grant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  principal_account_id uuid NOT NULL REFERENCES iam.account (account_id),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by_account_id uuid REFERENCES iam.account (account_id),
  approved_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (tenant_id, grant_id),
  CHECK (expires_at > requested_at)
);

ALTER TABLE iam.person_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.role ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.membership_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.privileged_access_grant ENABLE ROW LEVEL SECURITY;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280003_FND-01_identity_policy', 'FND-01', 'Identity links, scoped roles, permissions and privileged access')
ON CONFLICT (migration_id) DO NOTHING;
`;

const transactionalPrimitivesSql = `
CREATE TABLE IF NOT EXISTS integration_core.idempotency_key (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, operation, idempotency_key)
);
CREATE TABLE IF NOT EXISTS integration_core.outbox_event (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  schema_version integer NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_version bigint NOT NULL,
  correlation_id text NOT NULL,
  causation_id text,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz,
  PRIMARY KEY (tenant_id, event_id)
);
CREATE TABLE IF NOT EXISTS audit.audit_event (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  action text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, audit_id)
);
CREATE TABLE IF NOT EXISTS audit.data_access_event (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  access_id uuid NOT NULL DEFAULT gen_random_uuid(),
  data_class text NOT NULL,
  subject_id text NOT NULL,
  purpose text NOT NULL,
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, access_id)
);
CREATE OR REPLACE FUNCTION audit.prevent_mutation() RETURNS trigger LANGUAGE plpgsql AS $audit$
BEGIN RAISE EXCEPTION 'audit records are append-only'; END
$audit$;
ALTER TABLE integration_core.idempotency_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_core.outbox_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.data_access_event ENABLE ROW LEVEL SECURITY;
INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280004_FND-01_transactional_primitives', 'FND-01', 'Idempotency, outbox and append-only audit primitives')
ON CONFLICT (migration_id) DO NOTHING;
`;

const sharedServicesSql = `
CREATE TABLE IF NOT EXISTS platform.country_pack (
  pack_key text NOT NULL,
  version integer NOT NULL,
  default_locale text NOT NULL,
  supported_locales jsonb NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_key, version)
);
CREATE TABLE IF NOT EXISTS tenancy.country_pack_activation (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  pack_key text NOT NULL,
  version integer NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, pack_key)
);
CREATE TABLE IF NOT EXISTS workflow.instance (
  tenant_id uuid NOT NULL,
  instance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL,
  workflow_version integer NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  correlation_id text NOT NULL,
  PRIMARY KEY (tenant_id, instance_id)
);
CREATE TABLE IF NOT EXISTS integration_core.document_object (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  object_key text NOT NULL,
  content_type text NOT NULL,
  scan_status text NOT NULL DEFAULT 'pending',
  PRIMARY KEY (tenant_id, document_id)
);
CREATE TABLE IF NOT EXISTS integration_core.notification_delivery (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  notification_key text NOT NULL,
  recipient_id text NOT NULL,
  channel text NOT NULL,
  template_key text NOT NULL,
  locale text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  PRIMARY KEY (tenant_id, notification_key)
);
ALTER TABLE tenancy.country_pack_activation ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_core.document_object ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_core.notification_delivery ENABLE ROW LEVEL SECURITY;
INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280005_FND-01_shared_services', 'FND-01', 'Country packs, workflows, documents and notification services')
ON CONFLICT (migration_id) DO NOTHING;
`;

export const foundationMigrations: readonly DatabaseMigration[] = [
  {
    id: '202607280001_FND-01_foundation',
    description: 'Foundation schemas, runtime role and RLS proof table',
    sql: foundationSql,
  },
  {
    id: '202607280002_FND-01_tenancy',
    description: 'Tenant directory, regional routing, organizations and entitlements',
    sql: tenancySql,
  },
  {
    id: '202607280003_FND-01_identity_policy',
    description: 'Identity links, scoped roles, permissions and privileged access',
    sql: identityPolicySql,
  },
  {
    id: '202607280004_FND-01_transactional_primitives',
    description: 'Idempotency, outbox and append-only audit primitives',
    sql: transactionalPrimitivesSql,
  },
  {
    id: '202607280005_FND-01_shared_services',
    description: 'Country packs, workflows, documents and notification services',
    sql: sharedServicesSql,
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
