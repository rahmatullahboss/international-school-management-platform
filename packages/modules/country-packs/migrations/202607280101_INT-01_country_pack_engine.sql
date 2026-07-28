CREATE SCHEMA IF NOT EXISTS country_pack;

GRANT USAGE ON SCHEMA country_pack TO app_runtime;

CREATE TABLE IF NOT EXISTS country_pack.manifest_release (
  pack_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  country_code text NOT NULL CHECK (char_length(country_code) = 2),
  release_status text NOT NULL CHECK (release_status IN ('draft', 'released')),
  manifest_fingerprint text NOT NULL,
  validation_result jsonb NOT NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_key, version),
  FOREIGN KEY (pack_key, version) REFERENCES platform.country_pack (pack_key, version)
);

CREATE OR REPLACE FUNCTION country_pack.prevent_released_manifest_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.release_status = 'released' THEN
    RAISE EXCEPTION 'released country-pack metadata is immutable';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS released_manifest_immutable ON country_pack.manifest_release;
CREATE TRIGGER released_manifest_immutable
  BEFORE UPDATE OR DELETE ON country_pack.manifest_release
  FOR EACH ROW EXECUTE FUNCTION country_pack.prevent_released_manifest_mutation();

CREATE TABLE IF NOT EXISTS country_pack.tenant_override (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  pack_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_fingerprint text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by_account_id uuid,
  PRIMARY KEY (tenant_id, pack_key),
  FOREIGN KEY (pack_key, version) REFERENCES platform.country_pack (pack_key, version)
);

CREATE TABLE IF NOT EXISTS country_pack.regression_result (
  pack_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  suite_key text NOT NULL,
  passed boolean NOT NULL,
  manifest_fingerprint text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_key, version, suite_key, executed_at),
  FOREIGN KEY (pack_key, version) REFERENCES platform.country_pack (pack_key, version)
);

CREATE INDEX IF NOT EXISTS country_pack_regression_result_lookup_idx
  ON country_pack.regression_result (pack_key, version, executed_at DESC);

ALTER TABLE country_pack.tenant_override ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_pack.tenant_override FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_policy ON country_pack.tenant_override;
CREATE POLICY tenant_policy ON country_pack.tenant_override
  FOR ALL
  TO app_runtime
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT SELECT ON country_pack.manifest_release, country_pack.regression_result TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON country_pack.tenant_override TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280101_INT-01_country_pack_engine',
  'INT-01',
  'Country-pack release metadata, validated tenant overrides and regression evidence'
)
ON CONFLICT (migration_id) DO NOTHING;
