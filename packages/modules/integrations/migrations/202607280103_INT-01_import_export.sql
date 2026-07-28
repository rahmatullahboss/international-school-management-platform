CREATE TABLE IF NOT EXISTS integration.import_mapping (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  mapping_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  object_type text NOT NULL,
  definition jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, mapping_key, version)
);

CREATE TABLE IF NOT EXISTS integration.import_job (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  job_id uuid NOT NULL DEFAULT gen_random_uuid(),
  mapping_key text NOT NULL,
  mapping_version integer NOT NULL,
  object_type text NOT NULL,
  source_file_name text NOT NULL,
  source_checksum text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('dry-run', 'commit')),
  status text NOT NULL CHECK (
    status IN ('validated', 'ready', 'executing', 'completed', 'completed-with-errors')
  ),
  input_rows integer NOT NULL DEFAULT 0 CHECK (input_rows >= 0),
  reconciliation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, job_id),
  UNIQUE (tenant_id, source_checksum, mapping_key, mapping_version, mode),
  FOREIGN KEY (tenant_id, mapping_key, mapping_version)
    REFERENCES integration.import_mapping (tenant_id, mapping_key, version)
);

CREATE TABLE IF NOT EXISTS integration.import_row (
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL,
  row_number integer NOT NULL CHECK (row_number > 1),
  idempotency_key text NOT NULL,
  source_record jsonb NOT NULL,
  mapped_payload jsonb NOT NULL,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('valid', 'invalid', 'succeeded', 'failed')),
  domain_id text,
  processed_at timestamptz,
  PRIMARY KEY (tenant_id, job_id, row_number),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, job_id)
    REFERENCES integration.import_job (tenant_id, job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS import_row_pending_idx
  ON integration.import_row (tenant_id, job_id, row_number)
  WHERE status = 'valid';

CREATE TABLE IF NOT EXISTS integration.export_job (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  export_job_id uuid NOT NULL DEFAULT gen_random_uuid(),
  object_type text NOT NULL,
  format text NOT NULL CHECK (format IN ('csv', 'xlsx')),
  columns jsonb NOT NULL,
  filter_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  output_checksum text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, export_job_id)
);

DO $tenant_isolation$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'import_mapping',
    'import_job',
    'import_row',
    'export_job'
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

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280103_INT-01_import_export',
  'INT-01',
  'Versioned mappings, staged imports, domain-command row evidence and bounded exports'
)
ON CONFLICT (migration_id) DO NOTHING;
