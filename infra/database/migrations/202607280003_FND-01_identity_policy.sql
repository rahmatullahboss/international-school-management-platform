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
  PRIMARY KEY (tenant_id, account_id),
  UNIQUE (tenant_id, person_id, account_id)
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
  PRIMARY KEY (tenant_id, membership_id),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE TABLE IF NOT EXISTS iam.membership_role (
  tenant_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  role_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, membership_id, role_id),
  FOREIGN KEY (tenant_id, membership_id) REFERENCES iam.membership (tenant_id, membership_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, role_id) REFERENCES iam.role (tenant_id, role_id) ON DELETE CASCADE
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
  CHECK (expires_at > requested_at),
  CHECK ((approved_at IS NULL) = (approved_by_account_id IS NULL))
);

ALTER TABLE iam.person_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.person_link FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.role ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.role FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.role_permission FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.membership FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.membership_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.membership_role FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.privileged_access_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.privileged_access_grant FORCE ROW LEVEL SECURITY;

DO $policies$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['person_link', 'role', 'role_permission', 'membership', 'membership_role', 'privileged_access_grant']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON iam.%I', table_name || '_tenant_policy', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON iam.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name || '_tenant_policy',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON iam.%I TO app_runtime', table_name);
  END LOOP;
END
$policies$;

GRANT SELECT ON iam.permission TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280003_FND-01_identity_policy', 'FND-01', 'Identity links, scoped roles, permissions and privileged access')
ON CONFLICT (migration_id) DO NOTHING;
