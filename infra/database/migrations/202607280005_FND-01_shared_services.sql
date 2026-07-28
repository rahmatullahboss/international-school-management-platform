CREATE TABLE IF NOT EXISTS platform.country_pack (
  pack_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  default_locale text NOT NULL,
  supported_locales jsonb NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_key, version)
);

CREATE OR REPLACE FUNCTION platform.prevent_country_pack_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'published country-pack versions are immutable';
END
$function$;

DROP TRIGGER IF EXISTS country_pack_immutable ON platform.country_pack;
CREATE TRIGGER country_pack_immutable
  BEFORE UPDATE OR DELETE ON platform.country_pack
  FOR EACH ROW EXECUTE FUNCTION platform.prevent_country_pack_mutation();

CREATE TABLE IF NOT EXISTS tenancy.country_pack_activation (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  pack_key text NOT NULL,
  version integer NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by_account_id uuid,
  PRIMARY KEY (tenant_id, pack_key),
  FOREIGN KEY (pack_key, version) REFERENCES platform.country_pack (pack_key, version)
);

CREATE TABLE IF NOT EXISTS workflow.definition (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  workflow_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  definition jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, workflow_key, version)
);

CREATE TABLE IF NOT EXISTS workflow.instance (
  tenant_id uuid NOT NULL,
  instance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL,
  workflow_version integer NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, instance_id),
  FOREIGN KEY (tenant_id, workflow_key, workflow_version)
    REFERENCES workflow.definition (tenant_id, workflow_key, version)
);

CREATE TABLE IF NOT EXISTS workflow.task (
  tenant_id uuid NOT NULL,
  task_id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  assignee_account_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected', 'cancelled')),
  decision_note text,
  due_at timestamptz,
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, task_id),
  FOREIGN KEY (tenant_id, instance_id) REFERENCES workflow.instance (tenant_id, instance_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration_core.document_object (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  object_key text NOT NULL,
  content_type text NOT NULL,
  content_length bigint,
  checksum text,
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'quarantined', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  scanned_at timestamptz,
  PRIMARY KEY (tenant_id, document_id),
  UNIQUE (tenant_id, object_key)
);

CREATE TABLE IF NOT EXISTS integration_core.notification_preference (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  recipient_id text NOT NULL,
  channel text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  locale text,
  quiet_hours jsonb,
  PRIMARY KEY (tenant_id, recipient_id, channel)
);

CREATE TABLE IF NOT EXISTS integration_core.notification_delivery (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  notification_key text NOT NULL,
  recipient_id text NOT NULL,
  channel text NOT NULL,
  template_key text NOT NULL,
  locale text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'suppressed')),
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, notification_key)
);

DO $rls$
DECLARE
  qualified_name text;
  schema_name text;
  table_name text;
BEGIN
  FOREACH qualified_name IN ARRAY ARRAY[
    'tenancy.country_pack_activation',
    'workflow.definition',
    'workflow.instance',
    'workflow.task',
    'integration_core.document_object',
    'integration_core.notification_preference',
    'integration_core.notification_delivery'
  ]
  LOOP
    schema_name := split_part(qualified_name, '.', 1);
    table_name := split_part(qualified_name, '.', 2);
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', schema_name, table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', schema_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON %I.%I', schema_name, table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON %I.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      schema_name,
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO app_runtime', schema_name, table_name);
  END LOOP;
END
$rls$;

GRANT SELECT ON platform.country_pack TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280005_FND-01_shared_services', 'FND-01', 'Country packs, workflows, documents and notification services')
ON CONFLICT (migration_id) DO NOTHING;
