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

CREATE INDEX IF NOT EXISTS tenant_domain_tenant_idx
  ON platform.tenant_domain (tenant_id);

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
