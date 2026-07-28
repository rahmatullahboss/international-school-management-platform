CREATE TABLE IF NOT EXISTS integration.standard_profile (
  standard_key text NOT NULL,
  standard_version text NOT NULL,
  profile_version integer NOT NULL CHECK (profile_version > 0),
  mode text NOT NULL,
  conformance_claim text NOT NULL,
  profile_document jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (standard_key, standard_version, profile_version, mode)
);

CREATE OR REPLACE FUNCTION integration.prevent_standard_profile_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'published standard profiles are immutable';
END
$function$;

DROP TRIGGER IF EXISTS standard_profile_immutable ON integration.standard_profile;
CREATE TRIGGER standard_profile_immutable
  BEFORE UPDATE OR DELETE ON integration.standard_profile
  FOR EACH ROW EXECUTE FUNCTION integration.prevent_standard_profile_mutation();

CREATE TABLE IF NOT EXISTS integration.standard_exchange (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  exchange_id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid,
  standard_key text NOT NULL,
  standard_version text NOT NULL,
  profile_version integer NOT NULL,
  profile_mode text NOT NULL DEFAULT 'csv',
  sync_mode text NOT NULL CHECK (sync_mode IN ('full', 'delta')),
  direction text NOT NULL CHECK (direction IN ('import', 'export')),
  source_checksum text NOT NULL,
  status text NOT NULL CHECK (status IN ('validating', 'valid', 'invalid', 'executing', 'completed', 'failed')),
  object_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, exchange_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.connection (tenant_id, connection_id),
  FOREIGN KEY (standard_key, standard_version, profile_version, profile_mode)
    REFERENCES integration.standard_profile (standard_key, standard_version, profile_version, mode)
);

CREATE TABLE IF NOT EXISTS integration.standard_exchange_issue (
  tenant_id uuid NOT NULL,
  exchange_id uuid NOT NULL,
  issue_number integer NOT NULL CHECK (issue_number > 0),
  file_name text NOT NULL,
  row_number integer,
  field_name text,
  sourced_id text,
  issue_code text NOT NULL,
  reference_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, exchange_id, issue_number),
  FOREIGN KEY (tenant_id, exchange_id)
    REFERENCES integration.standard_exchange (tenant_id, exchange_id) ON DELETE CASCADE
);

DO $tenant_isolation$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['standard_exchange', 'standard_exchange_issue']
  LOOP
    EXECUTE format('ALTER TABLE integration.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE integration.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON integration.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON integration.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON integration.%I TO app_runtime', table_name);
  END LOOP;
END
$tenant_isolation$;

GRANT SELECT ON integration.standard_profile TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280105_INT-01_oneroster_profile',
  'INT-01',
  'Versioned OneRoster supported profile and exchange validation evidence'
)
ON CONFLICT (migration_id) DO NOTHING;
