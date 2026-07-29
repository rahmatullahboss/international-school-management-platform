CREATE SCHEMA IF NOT EXISTS activities;
GRANT USAGE ON SCHEMA activities TO app_runtime;

CREATE TABLE IF NOT EXISTS activities.activity (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  activity_id uuid NOT NULL DEFAULT gen_random_uuid(),
  code citext NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('club', 'sport', 'arts', 'service', 'academic')),
  leader_staff_ref text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  fee_minor bigint NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  currency char(3) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, activity_id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS activities.enrolment (
  tenant_id uuid NOT NULL,
  enrolment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  participant_ref text NOT NULL,
  guardian_ref text NOT NULL,
  joined_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  finance_document_ref text,
  created_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, enrolment_id),
  FOREIGN KEY (tenant_id, activity_id) REFERENCES activities.activity (tenant_id, activity_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS activities_enrolment_single_active_idx
  ON activities.enrolment (tenant_id, activity_id, participant_ref)
  WHERE status IN ('confirmed', 'waitlisted');
CREATE INDEX IF NOT EXISTS activities_enrolment_queue_idx
  ON activities.enrolment (tenant_id, activity_id, status, joined_on, created_at);

CREATE TABLE IF NOT EXISTS activities.trip (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  trip_id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_id uuid,
  title text NOT NULL,
  destination text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  budget_ref text NOT NULL,
  estimated_cost_minor bigint NOT NULL DEFAULT 0 CHECK (estimated_cost_minor >= 0),
  currency char(3) NOT NULL,
  medical_support_ref text,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'cancelled', 'completed')),
  created_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  finance_document_ref text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, trip_id),
  FOREIGN KEY (tenant_id, activity_id) REFERENCES activities.activity (tenant_id, activity_id),
  CHECK (ends_at > starts_at),
  CHECK (created_by IS DISTINCT FROM approved_by)
);
CREATE INDEX IF NOT EXISTS activities_trip_dates_status_idx
  ON activities.trip (tenant_id, starts_at, status);

CREATE TABLE IF NOT EXISTS activities.risk_assessment (
  tenant_id uuid NOT NULL,
  risk_assessment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  hazards jsonb NOT NULL,
  total_risk_score integer NOT NULL CHECK (total_risk_score > 0),
  emergency_contact_ref text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  recorded_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, risk_assessment_id),
  UNIQUE (tenant_id, trip_id),
  FOREIGN KEY (tenant_id, trip_id) REFERENCES activities.trip (tenant_id, trip_id),
  CHECK (jsonb_typeof(hazards) = 'array'),
  CHECK (jsonb_array_length(hazards) > 0),
  CHECK (recorded_by IS DISTINCT FROM approved_by)
);

CREATE TABLE IF NOT EXISTS activities.trip_participant (
  tenant_id uuid NOT NULL,
  trip_participant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  participant_ref text NOT NULL,
  guardian_ref text NOT NULL,
  medical_note_ref text,
  charge_minor bigint NOT NULL DEFAULT 0 CHECK (charge_minor >= 0),
  status text NOT NULL CHECK (status IN ('pending-consent', 'confirmed', 'waitlisted', 'cancelled')),
  consent_decision text CHECK (consent_decision IN ('approved', 'declined')),
  finance_document_ref text,
  registered_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, trip_participant_id),
  FOREIGN KEY (tenant_id, trip_id) REFERENCES activities.trip (tenant_id, trip_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS activities_trip_participant_single_active_idx
  ON activities.trip_participant (tenant_id, trip_id, participant_ref)
  WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS activities_trip_participant_queue_idx
  ON activities.trip_participant (tenant_id, trip_id, status, created_at);

CREATE TABLE IF NOT EXISTS activities.trip_consent (
  tenant_id uuid NOT NULL,
  trip_consent_id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_participant_id uuid NOT NULL,
  guardian_ref text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'declined')),
  signed_at timestamptz NOT NULL,
  recorded_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, trip_consent_id),
  UNIQUE (tenant_id, trip_participant_id),
  FOREIGN KEY (tenant_id, trip_participant_id)
    REFERENCES activities.trip_participant (tenant_id, trip_participant_id)
);

CREATE TABLE IF NOT EXISTS activities.trip_attendance (
  tenant_id uuid NOT NULL,
  trip_attendance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  participant_ref text NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent')),
  recorded_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  recorded_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, trip_attendance_id),
  UNIQUE (tenant_id, trip_id, participant_ref),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, trip_id) REFERENCES activities.trip (tenant_id, trip_id)
);

CREATE TABLE IF NOT EXISTS activities.trip_incident (
  tenant_id uuid NOT NULL,
  trip_incident_id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  participant_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  occurred_at timestamptz NOT NULL,
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'resolved')),
  recorded_by text NOT NULL,
  resolved_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, trip_incident_id),
  FOREIGN KEY (tenant_id, trip_id) REFERENCES activities.trip (tenant_id, trip_id),
  CHECK (jsonb_typeof(participant_refs) = 'array')
);
CREATE INDEX IF NOT EXISTS activities_trip_incident_open_idx
  ON activities.trip_incident (tenant_id, trip_id, severity, occurred_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS activities.finance_source (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  finance_source_id uuid NOT NULL DEFAULT gen_random_uuid(),
  contract_version text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('activity-fee', 'trip-participant-fee', 'trip-payable')),
  source_id text NOT NULL,
  person_ref text,
  budget_ref text,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  occurred_on date NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  finance_document_ref text,
  exported_at timestamptz,
  PRIMARY KEY (tenant_id, finance_source_id),
  UNIQUE (tenant_id, source_type, source_id),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS activities_finance_source_export_idx
  ON activities.finance_source (tenant_id, exported_at) WHERE exported_at IS NULL;

DO $ops_activities_rls$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'activity', 'enrolment', 'trip', 'risk_assessment', 'trip_participant',
    'trip_consent', 'trip_attendance', 'trip_incident', 'finance_source'
  ]
  LOOP
    EXECUTE format('ALTER TABLE activities.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE activities.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON activities.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON activities.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON activities.%I TO app_runtime', table_name);
  END LOOP;
END
$ops_activities_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607290207_OPS-01_activities_trips',
  'OPS-01',
  'Activities enrolment, waitlists, trips, risk, consent, attendance, incidents and finance source documents'
)
ON CONFLICT (migration_id) DO NOTHING;
