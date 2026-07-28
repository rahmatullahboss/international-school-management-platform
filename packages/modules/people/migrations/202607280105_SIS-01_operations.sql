CREATE TABLE IF NOT EXISTS people.import_batch (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  import_batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL
    CHECK (entity_type IN ('person', 'household', 'guardian-authority', 'student-profile', 'enrollment')),
  idempotency_key text NOT NULL,
  source_filename text,
  source_document_id uuid,
  column_mapping jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'validated', 'applying', 'completed', 'completed-with-errors', 'failed')),
  dry_run boolean NOT NULL DEFAULT false,
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows integer NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  invalid_rows integer NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  applied_rows integer NOT NULL DEFAULT 0 CHECK (applied_rows >= 0),
  created_by_account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, import_batch_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, source_document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  CHECK (valid_rows + invalid_rows <= total_rows),
  CHECK (applied_rows <= valid_rows)
);

CREATE TABLE IF NOT EXISTS people.import_row (
  tenant_id uuid NOT NULL,
  import_row_id uuid NOT NULL DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL,
  row_number integer NOT NULL CHECK (row_number > 0),
  source_key text NOT NULL,
  row_checksum text NOT NULL,
  normalized_values jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('valid', 'invalid', 'applied', 'skipped')),
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_reference text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, import_row_id),
  UNIQUE (tenant_id, import_batch_id, row_number),
  FOREIGN KEY (tenant_id, import_batch_id)
    REFERENCES people.import_batch (tenant_id, import_batch_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS import_row_source_replay_idx
  ON people.import_row (tenant_id, source_key, row_checksum)
  WHERE status = 'applied';

CREATE TABLE IF NOT EXISTS people.data_quality_issue (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  data_quality_issue_id uuid NOT NULL DEFAULT gen_random_uuid(),
  issue_type text NOT NULL
    CHECK (issue_type IN (
      'duplicate-source-key', 'missing-required-field', 'invalid-value',
      'duplicate-identity', 'orphan-reference', 'reconciliation-mismatch'
    )),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  entity_type text NOT NULL,
  entity_reference text NOT NULL,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  assigned_to_account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY (tenant_id, data_quality_issue_id)
);
CREATE INDEX IF NOT EXISTS data_quality_open_queue_idx
  ON people.data_quality_issue (tenant_id, severity, created_at)
  WHERE status IN ('open', 'acknowledged');

CREATE TABLE IF NOT EXISTS people.export_audit (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  export_audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  export_type text NOT NULL,
  purpose text NOT NULL CHECK (length(btrim(purpose)) > 0),
  selected_fields jsonb NOT NULL,
  filter_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  record_count integer NOT NULL CHECK (record_count >= 0),
  includes_restricted_documents boolean NOT NULL DEFAULT false,
  requested_by_account_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, export_audit_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.report_snapshot (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  report_snapshot_id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_key text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_data jsonb NOT NULL,
  generated_by_account_id uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, report_snapshot_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.reconciliation_run (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  reconciliation_run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'sis',
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'completed-with-issues', 'failed')),
  applications_checked integer NOT NULL DEFAULT 0 CHECK (applications_checked >= 0),
  profiles_checked integer NOT NULL DEFAULT 0 CHECK (profiles_checked >= 0),
  enrollments_checked integer NOT NULL DEFAULT 0 CHECK (enrollments_checked >= 0),
  issues_found integer NOT NULL DEFAULT 0 CHECK (issues_found >= 0),
  started_by_account_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, reconciliation_run_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.reconciliation_issue (
  tenant_id uuid NOT NULL,
  reconciliation_issue_id uuid NOT NULL DEFAULT gen_random_uuid(),
  reconciliation_run_id uuid NOT NULL,
  issue_type text NOT NULL
    CHECK (issue_type IN (
      'converted-application-missing-profile', 'converted-application-missing-enrollment',
      'profile-missing-enrollment', 'enrollment-missing-profile',
      'student-missing-guardian', 'portal-authority-unverified'
    )),
  severity text NOT NULL CHECK (severity IN ('warning', 'error', 'critical')),
  entity_reference text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY (tenant_id, reconciliation_issue_id),
  FOREIGN KEY (tenant_id, reconciliation_run_id)
    REFERENCES student_lifecycle.reconciliation_run (tenant_id, reconciliation_run_id)
    ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION student_lifecycle.prevent_report_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'report snapshots are immutable';
END
$function$;
DROP TRIGGER IF EXISTS report_snapshot_immutable ON student_lifecycle.report_snapshot;
CREATE TRIGGER report_snapshot_immutable
  BEFORE UPDATE OR DELETE ON student_lifecycle.report_snapshot
  FOR EACH ROW EXECUTE FUNCTION student_lifecycle.prevent_report_snapshot_mutation();

DO $sis_operations_rls$
DECLARE
  qualified_name text;
  schema_name text;
  table_name text;
BEGIN
  FOREACH qualified_name IN ARRAY ARRAY[
    'people.import_batch',
    'people.import_row',
    'people.data_quality_issue',
    'people.export_audit',
    'student_lifecycle.report_snapshot',
    'student_lifecycle.reconciliation_run',
    'student_lifecycle.reconciliation_issue'
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
$sis_operations_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280105_SIS-01_operations',
  'SIS-01',
  'Import staging, data-quality queues, privacy-aware exports, reconciliation and immutable report snapshots'
)
ON CONFLICT (migration_id) DO NOTHING;
