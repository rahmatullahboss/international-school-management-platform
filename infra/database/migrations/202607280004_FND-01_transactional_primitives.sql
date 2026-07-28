CREATE TABLE IF NOT EXISTS integration_core.idempotency_key (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, operation, idempotency_key),
  CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS integration_core.outbox_event (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id text NOT NULL,
  causation_id text,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS outbox_pending_idx
  ON integration_core.outbox_event (available_at, occurred_at)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS audit.audit_event (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_account_id uuid,
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
  actor_account_id uuid,
  data_class text NOT NULL,
  subject_id text NOT NULL,
  purpose text NOT NULL,
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, access_id)
);

CREATE OR REPLACE FUNCTION audit.prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'audit records are append-only';
END
$function$;

DROP TRIGGER IF EXISTS audit_event_append_only ON audit.audit_event;
CREATE TRIGGER audit_event_append_only
  BEFORE UPDATE OR DELETE ON audit.audit_event
  FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

DROP TRIGGER IF EXISTS data_access_event_append_only ON audit.data_access_event;
CREATE TRIGGER data_access_event_append_only
  BEFORE UPDATE OR DELETE ON audit.data_access_event
  FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

ALTER TABLE integration_core.idempotency_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_core.idempotency_key FORCE ROW LEVEL SECURITY;
ALTER TABLE integration_core.outbox_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_core.outbox_event FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_event FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.data_access_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.data_access_event FORCE ROW LEVEL SECURITY;

DO $policies$
DECLARE
  qualified_name text;
  schema_name text;
  table_name text;
BEGIN
  FOREACH qualified_name IN ARRAY ARRAY[
    'integration_core.idempotency_key',
    'integration_core.outbox_event',
    'audit.audit_event',
    'audit.data_access_event'
  ]
  LOOP
    schema_name := split_part(qualified_name, '.', 1);
    table_name := split_part(qualified_name, '.', 2);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON %I.%I', schema_name, table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON %I.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      schema_name,
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO app_runtime', schema_name, table_name);
  END LOOP;
END
$policies$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280004_FND-01_transactional_primitives', 'FND-01', 'Idempotency, outbox and append-only audit primitives')
ON CONFLICT (migration_id) DO NOTHING;
