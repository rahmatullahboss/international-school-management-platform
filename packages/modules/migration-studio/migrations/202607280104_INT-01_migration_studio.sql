CREATE SCHEMA IF NOT EXISTS migration_studio;

GRANT USAGE ON SCHEMA migration_studio TO app_runtime;

CREATE TABLE IF NOT EXISTS migration_studio.source_template (
  template_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  source_product text NOT NULL,
  definition jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_key, version)
);

CREATE TABLE IF NOT EXISTS migration_studio.project (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  project_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_system text NOT NULL,
  target_environment text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'cutover-approved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, project_id)
);

CREATE TABLE IF NOT EXISTS migration_studio.project_version (
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  template_key text NOT NULL,
  template_version integer NOT NULL,
  mapping_snapshot jsonb NOT NULL,
  transformation_snapshot jsonb NOT NULL,
  configuration_checksum text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, project_id, version),
  FOREIGN KEY (tenant_id, project_id)
    REFERENCES migration_studio.project (tenant_id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (template_key, template_version)
    REFERENCES migration_studio.source_template (template_key, version)
);

CREATE TABLE IF NOT EXISTS migration_studio.source_file (
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  version integer NOT NULL,
  file_name text NOT NULL,
  media_type text NOT NULL,
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  file_checksum text NOT NULL,
  object_reference text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, project_id, version, file_name),
  UNIQUE (tenant_id, project_id, version, file_checksum),
  FOREIGN KEY (tenant_id, project_id, version)
    REFERENCES migration_studio.project_version (tenant_id, project_id, version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS migration_studio.run (
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_key text NOT NULL,
  project_id uuid NOT NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'completed-with-errors')),
  configuration_checksum text NOT NULL,
  file_checksums jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, run_id),
  UNIQUE (tenant_id, run_key),
  FOREIGN KEY (tenant_id, project_id, version)
    REFERENCES migration_studio.project_version (tenant_id, project_id, version)
);

CREATE TABLE IF NOT EXISTS migration_studio.reconciliation (
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL,
  entity_type text NOT NULL,
  metric text NOT NULL,
  expected numeric NOT NULL,
  actual numeric NOT NULL,
  difference numeric NOT NULL,
  passed boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, run_id, entity_type, metric),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES migration_studio.run (tenant_id, run_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS migration_studio.cutover (
  tenant_id uuid NOT NULL,
  cutover_id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  version integer NOT NULL,
  run_id uuid NOT NULL,
  checklist jsonb NOT NULL,
  rollback_plan text NOT NULL CHECK (length(btrim(rollback_plan)) > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  signed_by text,
  signed_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, cutover_id),
  FOREIGN KEY (tenant_id, project_id, version)
    REFERENCES migration_studio.project_version (tenant_id, project_id, version),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES migration_studio.run (tenant_id, run_id),
  CHECK ((status = 'pending') = (signed_at IS NULL))
);

CREATE OR REPLACE FUNCTION migration_studio.prevent_template_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'published migration source templates are immutable';
END
$function$;

DROP TRIGGER IF EXISTS source_template_immutable ON migration_studio.source_template;
CREATE TRIGGER source_template_immutable
  BEFORE UPDATE OR DELETE ON migration_studio.source_template
  FOR EACH ROW EXECUTE FUNCTION migration_studio.prevent_template_mutation();

DO $tenant_isolation$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project',
    'project_version',
    'source_file',
    'run',
    'reconciliation',
    'cutover'
  ]
  LOOP
    EXECUTE format('ALTER TABLE migration_studio.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE migration_studio.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON migration_studio.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON migration_studio.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON migration_studio.%I TO app_runtime',
      table_name
    );
  END LOOP;
END
$tenant_isolation$;

GRANT SELECT ON migration_studio.source_template TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280104_INT-01_migration_studio',
  'INT-01',
  'Repeatable migration projects, source checksums, reconciliation and cutover evidence'
)
ON CONFLICT (migration_id) DO NOTHING;
