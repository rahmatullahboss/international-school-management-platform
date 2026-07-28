CREATE SCHEMA IF NOT EXISTS integration;

GRANT USAGE ON SCHEMA integration TO app_runtime;

CREATE TABLE IF NOT EXISTS integration.api_spec (
  api_version text PRIMARY KEY,
  openapi_version text NOT NULL,
  document jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  deprecated_at timestamptz,
  sunset_at timestamptz,
  CHECK (sunset_at IS NULL OR deprecated_at IS NOT NULL),
  CHECK (sunset_at IS NULL OR sunset_at > deprecated_at)
);

CREATE OR REPLACE FUNCTION integration.prevent_api_spec_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'published API specifications are immutable';
END
$function$;

DROP TRIGGER IF EXISTS api_spec_immutable ON integration.api_spec;
CREATE TRIGGER api_spec_immutable
  BEFORE UPDATE OR DELETE ON integration.api_spec
  FOR EACH ROW EXECUTE FUNCTION integration.prevent_api_spec_mutation();

CREATE TABLE IF NOT EXISTS integration.connection (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  connection_id uuid NOT NULL DEFAULT gen_random_uuid(),
  connector_key text NOT NULL,
  connector_version integer NOT NULL CHECK (connector_version > 0),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'disabled', 'error')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, connection_id)
);

CREATE TABLE IF NOT EXISTS integration.credential (
  tenant_id uuid NOT NULL,
  credential_id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  key_id text NOT NULL,
  display_name text NOT NULL,
  value_digest text NOT NULL,
  scopes jsonb NOT NULL,
  data_categories jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, credential_id),
  UNIQUE (tenant_id, key_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.connection (tenant_id, connection_id) ON DELETE CASCADE,
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS integration.external_identifier (
  tenant_id uuid NOT NULL,
  external_identifier_id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  object_type text NOT NULL,
  internal_id text NOT NULL,
  external_id text NOT NULL,
  external_version text,
  etag text,
  authority text NOT NULL CHECK (authority IN ('internal', 'external', 'shared')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'tombstoned')),
  last_synchronized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, external_identifier_id),
  UNIQUE (tenant_id, connection_id, object_type, internal_id),
  UNIQUE (tenant_id, connection_id, object_type, external_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.connection (tenant_id, connection_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration.webhook_subscription (
  tenant_id uuid NOT NULL,
  subscription_id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  endpoint_url text NOT NULL,
  event_types jsonb NOT NULL,
  signing_key_reference text NOT NULL,
  retry_policy jsonb NOT NULL DEFAULT '{"max_attempts": 5}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, subscription_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.connection (tenant_id, connection_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration.outbound_delivery (
  tenant_id uuid NOT NULL,
  delivery_id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  event_id uuid NOT NULL,
  event_type text NOT NULL,
  body jsonb NOT NULL,
  body_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'retrying', 'delivered', 'dead-letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  replay_count integer NOT NULL DEFAULT 0 CHECK (replay_count >= 0),
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  response_status integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, delivery_id),
  UNIQUE (tenant_id, subscription_id, event_id),
  FOREIGN KEY (tenant_id, subscription_id)
    REFERENCES integration.webhook_subscription (tenant_id, subscription_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS outbound_delivery_due_idx
  ON integration.outbound_delivery (next_attempt_at, created_at)
  WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS outbound_delivery_dead_letter_idx
  ON integration.outbound_delivery (tenant_id, updated_at DESC)
  WHERE status = 'dead-letter';

CREATE TABLE IF NOT EXISTS integration.inbound_receipt (
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  provider_event_id text NOT NULL,
  payload_hash text NOT NULL,
  result_status integer,
  result_body jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, connection_id, provider_event_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.connection (tenant_id, connection_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration.connection_health (
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'healthy', 'degraded', 'down', 'disabled')),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, connection_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.connection (tenant_id, connection_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration.disclosure_event (
  tenant_id uuid NOT NULL,
  disclosure_id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  destination text NOT NULL,
  data_categories jsonb NOT NULL,
  purpose text NOT NULL CHECK (length(btrim(purpose)) > 0),
  record_count integer NOT NULL CHECK (record_count >= 0),
  status text NOT NULL CHECK (status IN ('attempted', 'delivered', 'failed', 'suppressed')),
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, disclosure_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.connection (tenant_id, connection_id)
);

CREATE OR REPLACE FUNCTION integration.prevent_disclosure_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'disclosure events are append-only';
END
$function$;

DROP TRIGGER IF EXISTS disclosure_event_append_only ON integration.disclosure_event;
CREATE TRIGGER disclosure_event_append_only
  BEFORE UPDATE OR DELETE ON integration.disclosure_event
  FOR EACH ROW EXECUTE FUNCTION integration.prevent_disclosure_mutation();

DO $tenant_isolation$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'connection',
    'credential',
    'external_identifier',
    'webhook_subscription',
    'outbound_delivery',
    'inbound_receipt',
    'connection_health',
    'disclosure_event'
  ]
  LOOP
    EXECUTE format('ALTER TABLE integration.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE integration.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON integration.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON integration.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON integration.%I TO app_runtime',
      table_name
    );
  END LOOP;
END
$tenant_isolation$;

GRANT SELECT ON integration.api_spec TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280102_INT-01_integration_runtime',
  'INT-01',
  'Versioned API, scoped credentials, external IDs, replay-safe webhooks, health and disclosure audit'
)
ON CONFLICT (migration_id) DO NOTHING;
