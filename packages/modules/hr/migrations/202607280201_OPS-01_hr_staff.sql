CREATE SCHEMA IF NOT EXISTS hr;
GRANT USAGE ON SCHEMA hr TO app_runtime;

CREATE TABLE IF NOT EXISTS hr.staff_profile (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  legal_entity_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  staff_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_ref text NOT NULL,
  staff_number citext NOT NULL,
  display_name text NOT NULL,
  work_email citext NOT NULL,
  employment_status text NOT NULL
    CHECK (employment_status IN ('active', 'on-leave', 'suspended', 'ended')),
  joined_on date NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, staff_id),
  UNIQUE (tenant_id, staff_number),
  UNIQUE (tenant_id, person_ref),
  CHECK (length(btrim(person_ref)) > 0),
  CHECK (length(btrim(display_name)) > 0)
);
CREATE INDEX IF NOT EXISTS hr_staff_campus_status_idx
  ON hr.staff_profile (tenant_id, campus_id, employment_status);

CREATE TABLE IF NOT EXISTS hr.employment_contract (
  tenant_id uuid NOT NULL,
  contract_id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  position_code text NOT NULL,
  department_code text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  workload_basis_points integer NOT NULL
    CHECK (workload_basis_points > 0 AND workload_basis_points <= 10000),
  salary_reference text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'superseded', 'ended')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_contract_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, contract_id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES hr.staff_profile (tenant_id, staff_id),
  FOREIGN KEY (tenant_id, supersedes_contract_id)
    REFERENCES hr.employment_contract (tenant_id, contract_id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS hr_contract_staff_dates_idx
  ON hr.employment_contract (tenant_id, staff_id, starts_on, ends_on);
CREATE UNIQUE INDEX IF NOT EXISTS hr_contract_single_active_idx
  ON hr.employment_contract (tenant_id, staff_id)
  WHERE status = 'active' AND ends_on IS NULL;

CREATE TABLE IF NOT EXISTS hr.leave_request (
  tenant_id uuid NOT NULL,
  leave_request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  leave_type text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  decision_reason text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, leave_request_id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES hr.staff_profile (tenant_id, staff_id),
  CHECK (ends_on >= starts_on),
  CHECK (length(btrim(reason)) >= 3),
  CHECK (requested_by IS DISTINCT FROM approved_by)
);
CREATE INDEX IF NOT EXISTS hr_leave_staff_dates_idx
  ON hr.leave_request (tenant_id, staff_id, starts_on, ends_on, status);

CREATE TABLE IF NOT EXISTS hr.staff_attendance (
  tenant_id uuid NOT NULL,
  attendance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  attendance_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'late', 'absent', 'leave')),
  minutes_worked integer NOT NULL DEFAULT 0 CHECK (minutes_worked BETWEEN 0 AND 1440),
  note text,
  idempotency_key text NOT NULL,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, attendance_id),
  UNIQUE (tenant_id, staff_id, attendance_date),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES hr.staff_profile (tenant_id, staff_id)
);
CREATE INDEX IF NOT EXISTS hr_attendance_date_status_idx
  ON hr.staff_attendance (tenant_id, attendance_date, status);

DO $ops_hr_rls$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'staff_profile',
    'employment_contract',
    'leave_request',
    'staff_attendance'
  ]
  LOOP
    EXECUTE format('ALTER TABLE hr.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE hr.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON hr.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON hr.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON hr.%I TO app_runtime', table_name);
  END LOOP;
END
$ops_hr_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280201_OPS-01_hr_staff',
  'OPS-01',
  'HR staff, versioned contracts, leave approvals and staff attendance'
)
ON CONFLICT (migration_id) DO NOTHING;
