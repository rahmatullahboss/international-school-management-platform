CREATE SCHEMA IF NOT EXISTS library;
GRANT USAGE ON SCHEMA library TO app_runtime;

CREATE TABLE IF NOT EXISTS library.title (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  title_id uuid NOT NULL DEFAULT gen_random_uuid(),
  isbn text NOT NULL,
  title text NOT NULL,
  authors jsonb NOT NULL,
  subject_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  publisher text NOT NULL,
  publication_year integer NOT NULL CHECK (publication_year BETWEEN 1000 AND 9999),
  language text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, title_id),
  UNIQUE (tenant_id, isbn),
  CHECK (jsonb_typeof(authors) = 'array'),
  CHECK (jsonb_array_length(authors) > 0)
);
CREATE INDEX IF NOT EXISTS library_title_subject_gin_idx ON library.title USING gin (subject_codes);

CREATE TABLE IF NOT EXISTS library.copy (
  tenant_id uuid NOT NULL,
  copy_id uuid NOT NULL DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL,
  barcode citext NOT NULL,
  home_location_ref text NOT NULL,
  replacement_cost_minor bigint NOT NULL CHECK (replacement_cost_minor >= 0),
  currency char(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('available', 'on-loan', 'on-hold', 'lost', 'damaged', 'withdrawn')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, copy_id),
  UNIQUE (tenant_id, barcode),
  FOREIGN KEY (tenant_id, title_id) REFERENCES library.title (tenant_id, title_id)
);
CREATE INDEX IF NOT EXISTS library_copy_title_status_idx ON library.copy (tenant_id, title_id, status);

CREATE TABLE IF NOT EXISTS library.patron (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  patron_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_ref text NOT NULL,
  patron_type text NOT NULL CHECK (patron_type IN ('student', 'staff', 'guardian', 'external')),
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, patron_id),
  UNIQUE (tenant_id, person_ref)
);

CREATE TABLE IF NOT EXISTS library.loan (
  tenant_id uuid NOT NULL,
  loan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  copy_id uuid NOT NULL,
  patron_id uuid NOT NULL,
  checked_out_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  returned_at timestamptz,
  renewals integer NOT NULL DEFAULT 0 CHECK (renewals >= 0),
  status text NOT NULL CHECK (status IN ('active', 'returned', 'lost')),
  fine_minor bigint NOT NULL DEFAULT 0 CHECK (fine_minor >= 0),
  created_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, loan_id),
  FOREIGN KEY (tenant_id, copy_id) REFERENCES library.copy (tenant_id, copy_id),
  FOREIGN KEY (tenant_id, patron_id) REFERENCES library.patron (tenant_id, patron_id),
  CHECK (due_at > checked_out_at),
  CHECK (returned_at IS NULL OR returned_at >= checked_out_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS library_copy_single_active_loan_idx
  ON library.loan (tenant_id, copy_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS library_loan_patron_status_due_idx
  ON library.loan (tenant_id, patron_id, status, due_at);

CREATE TABLE IF NOT EXISTS library.hold (
  tenant_id uuid NOT NULL,
  hold_id uuid NOT NULL DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL,
  patron_id uuid NOT NULL,
  placed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'ready', 'fulfilled', 'cancelled', 'expired')),
  ready_copy_id uuid,
  created_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, hold_id),
  FOREIGN KEY (tenant_id, title_id) REFERENCES library.title (tenant_id, title_id),
  FOREIGN KEY (tenant_id, patron_id) REFERENCES library.patron (tenant_id, patron_id),
  FOREIGN KEY (tenant_id, ready_copy_id) REFERENCES library.copy (tenant_id, copy_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS library_hold_single_active_idx
  ON library.hold (tenant_id, title_id, patron_id) WHERE status IN ('active', 'ready');
CREATE INDEX IF NOT EXISTS library_hold_queue_idx
  ON library.hold (tenant_id, title_id, status, placed_at, hold_id);

CREATE TABLE IF NOT EXISTS library.fine_source (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  fine_source_id uuid NOT NULL DEFAULT gen_random_uuid(),
  contract_version text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('library-overdue', 'library-lost', 'library-damaged')),
  source_id text NOT NULL,
  patron_ref text NOT NULL,
  copy_ref text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL,
  occurred_at timestamptz NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  finance_document_ref text,
  exported_at timestamptz,
  PRIMARY KEY (tenant_id, fine_source_id),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS library_fine_source_export_idx
  ON library.fine_source (tenant_id, exported_at) WHERE exported_at IS NULL;

DO $ops_library_rls$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['title', 'copy', 'patron', 'loan', 'hold', 'fine_source']
  LOOP
    EXECUTE format('ALTER TABLE library.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE library.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON library.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON library.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON library.%I TO app_runtime', table_name);
  END LOOP;
END
$ops_library_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280204_OPS-01_library',
  'OPS-01',
  'Library catalogue, copies, patrons, circulation, holds, loss and fine source records'
)
ON CONFLICT (migration_id) DO NOTHING;
