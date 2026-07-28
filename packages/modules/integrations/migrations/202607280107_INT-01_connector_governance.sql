CREATE TABLE IF NOT EXISTS integration.connector_manifest (
  connector_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  display_name text NOT NULL,
  provider text NOT NULL,
  supported_regions jsonb NOT NULL,
  data_categories jsonb NOT NULL,
  authentication_modes jsonb NOT NULL,
  required_scopes jsonb NOT NULL,
  inbound_events jsonb NOT NULL,
  outbound_commands jsonb NOT NULL,
  rate_limit jsonb NOT NULL,
  retry_policy jsonb NOT NULL,
  retention_days integer NOT NULL CHECK (retention_days >= 0),
  manifest_document jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connector_key, version)
);

CREATE TABLE IF NOT EXISTS integration.connector_subprocessor (
  connector_key text NOT NULL,
  connector_version integer NOT NULL,
  legal_name text NOT NULL,
  country_code char(2) NOT NULL,
  privacy_url text NOT NULL,
  purpose text NOT NULL,
  reviewed_at timestamptz,
  PRIMARY KEY (connector_key, connector_version),
  FOREIGN KEY (connector_key, connector_version)
    REFERENCES integration.connector_manifest (connector_key, version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration.connector_approval (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  connector_key text NOT NULL,
  connector_version integer NOT NULL,
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  purpose text NOT NULL CHECK (length(btrim(purpose)) > 0),
  approved_scopes jsonb NOT NULL,
  approved_data_categories jsonb NOT NULL,
  retention_days integer NOT NULL CHECK (retention_days >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  decision_note text,
  sandbox_passed boolean,
  enabled_connection_id uuid,
  PRIMARY KEY (tenant_id, request_id),
  FOREIGN KEY (connector_key, connector_version)
    REFERENCES integration.connector_manifest (connector_key, version),
  CHECK ((status = 'pending') = (reviewed_at IS NULL)),
  CHECK (reviewed_by IS NULL OR reviewed_by <> requested_by)
);

CREATE TABLE IF NOT EXISTS integration.connector_sandbox_run (
  tenant_id uuid NOT NULL,
  sandbox_run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  passed boolean NOT NULL,
  checks jsonb NOT NULL,
  evidence jsonb NOT NULL,
  synthetic_only boolean NOT NULL DEFAULT true,
  executed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, sandbox_run_id),
  FOREIGN KEY (tenant_id, request_id)
    REFERENCES integration.connector_approval (tenant_id, request_id) ON DELETE CASCADE,
  CHECK (synthetic_only)
);

CREATE TABLE IF NOT EXISTS integration.connector_metric_bucket (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  connection_id uuid NOT NULL,
  bucket_at timestamptz NOT NULL,
  delivery_count bigint NOT NULL DEFAULT 0 CHECK (delivery_count >= 0),
  delivered_count bigint NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  failed_count bigint NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  dead_letter_count bigint NOT NULL DEFAULT 0 CHECK (dead_letter_count >= 0),
  delivery_latency_total_ms bigint NOT NULL DEFAULT 0 CHECK (delivery_latency_total_ms >= 0),
  import_run_count bigint NOT NULL DEFAULT 0 CHECK (import_run_count >= 0),
  import_row_count bigint NOT NULL DEFAULT 0 CHECK (import_row_count >= 0),
  import_failed_row_count bigint NOT NULL DEFAULT 0 CHECK (import_failed_row_count >= 0),
  import_duration_total_ms bigint NOT NULL DEFAULT 0 CHECK (import_duration_total_ms >= 0),
  PRIMARY KEY (tenant_id, connection_id, bucket_at),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.connection (tenant_id, connection_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration.connector_alert (
  tenant_id uuid NOT NULL,
  alert_id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  alert_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  PRIMARY KEY (tenant_id, alert_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.connection (tenant_id, connection_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS connector_alert_open_idx
  ON integration.connector_alert (tenant_id, connection_id, severity, opened_at DESC)
  WHERE status = 'open';

CREATE OR REPLACE FUNCTION integration.prevent_connector_manifest_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'published connector manifests are immutable';
END
$function$;

DROP TRIGGER IF EXISTS connector_manifest_immutable ON integration.connector_manifest;
CREATE TRIGGER connector_manifest_immutable
  BEFORE UPDATE OR DELETE ON integration.connector_manifest
  FOR EACH ROW EXECUTE FUNCTION integration.prevent_connector_manifest_mutation();

DO $tenant_isolation$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'connector_approval',
    'connector_sandbox_run',
    'connector_metric_bucket',
    'connector_alert'
  ]
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

GRANT SELECT ON integration.connector_manifest, integration.connector_subprocessor TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280107_INT-01_connector_governance',
  'INT-01',
  'Immutable connector manifests, approval, sandbox, subprocessor and observability evidence'
)
ON CONFLICT (migration_id) DO NOTHING;
