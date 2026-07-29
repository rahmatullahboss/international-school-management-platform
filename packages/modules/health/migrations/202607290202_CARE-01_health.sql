BEGIN;

CREATE SCHEMA IF NOT EXISTS health;
GRANT USAGE ON SCHEMA health TO app_runtime;

CREATE TABLE IF NOT EXISTS health.profile (
  tenant_id uuid NOT NULL,
  profile_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_person_id uuid NOT NULL,
  blood_group text,
  primary_clinic_campus_id uuid,
  emergency_instructions text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','resolved','entered-in-error')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, profile_id),
  UNIQUE (tenant_id, student_person_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, primary_clinic_campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE TABLE IF NOT EXISTS health.legal_basis_evidence (
  tenant_id uuid NOT NULL,
  legal_basis_evidence_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  basis_code text NOT NULL
    CHECK (basis_code IN ('consent','vital-interests','legal-obligation','public-task')),
  evidence_reference text NOT NULL CHECK (length(trim(evidence_reference)) > 0),
  status text NOT NULL CHECK (status IN ('active','withdrawn','expired')),
  effective_from timestamptz NOT NULL,
  expires_at timestamptz,
  supersedes_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_basis_evidence_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_id)
    REFERENCES health.legal_basis_evidence (tenant_id, legal_basis_evidence_id),
  CHECK (expires_at IS NULL OR expires_at > effective_from)
);

CREATE TABLE IF NOT EXISTS health.condition (
  tenant_id uuid NOT NULL,
  condition_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  code text NOT NULL,
  display text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('mild','moderate','severe','life-threatening')),
  status text NOT NULL CHECK (status IN ('active','resolved','entered-in-error')),
  onset_date date,
  supersedes_condition_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, condition_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_condition_id)
    REFERENCES health.condition (tenant_id, condition_id)
);

CREATE TABLE IF NOT EXISTS health.allergy (
  tenant_id uuid NOT NULL,
  allergy_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  substance_code text NOT NULL,
  display text NOT NULL,
  reaction text,
  severity text NOT NULL CHECK (severity IN ('mild','moderate','severe','life-threatening')),
  status text NOT NULL CHECK (status IN ('active','resolved','entered-in-error')),
  supersedes_allergy_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, allergy_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_allergy_id)
    REFERENCES health.allergy (tenant_id, allergy_id)
);

CREATE INDEX IF NOT EXISTS health_active_allergy_lookup
  ON health.allergy (tenant_id, profile_id, substance_code)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS health.medication_order (
  tenant_id uuid NOT NULL,
  medication_order_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  medication_code text NOT NULL,
  display text NOT NULL,
  ingredient_codes text[] NOT NULL DEFAULT '{}',
  dose text NOT NULL,
  route text NOT NULL,
  schedule text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL CHECK (status IN ('active','held','completed','cancelled')),
  prescriber_reference text NOT NULL,
  authorization_document_reference text NOT NULL,
  supersedes_medication_order_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, medication_order_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_medication_order_id)
    REFERENCES health.medication_order (tenant_id, medication_order_id),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS health.medication_administration (
  tenant_id uuid NOT NULL,
  administration_id uuid NOT NULL DEFAULT gen_random_uuid(),
  medication_order_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  administered_at timestamptz NOT NULL,
  dose text NOT NULL,
  route text NOT NULL,
  administrator_principal_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('given','refused','omitted','partial')),
  reason_code text,
  idempotency_key text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, administration_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, medication_order_id)
    REFERENCES health.medication_order (tenant_id, medication_order_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS health.medication_administration_correction (
  tenant_id uuid NOT NULL,
  correction_id uuid NOT NULL DEFAULT gen_random_uuid(),
  administration_id uuid NOT NULL,
  corrected_by_principal_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  replacement_outcome text CHECK (replacement_outcome IN ('given','refused','omitted','partial')),
  replacement_dose text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, correction_id),
  FOREIGN KEY (tenant_id, administration_id)
    REFERENCES health.medication_administration (tenant_id, administration_id),
  CHECK (replacement_outcome IS NOT NULL OR replacement_dose IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS health.immunization (
  tenant_id uuid NOT NULL,
  immunization_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  vaccine_code text NOT NULL,
  administered_on date NOT NULL,
  dose_number text,
  evidence_reference text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','resolved','entered-in-error')),
  supersedes_immunization_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, immunization_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_immunization_id)
    REFERENCES health.immunization (tenant_id, immunization_id)
);

CREATE TABLE IF NOT EXISTS health.care_plan (
  tenant_id uuid NOT NULL,
  care_plan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  title text NOT NULL,
  goals jsonb NOT NULL CHECK (jsonb_typeof(goals) = 'array'),
  actions jsonb NOT NULL CHECK (jsonb_typeof(actions) = 'array'),
  emergency_actions jsonb NOT NULL CHECK (jsonb_typeof(emergency_actions) = 'array'),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  status text NOT NULL CHECK (status IN ('draft','active','superseded','closed')),
  approved_by_principal_id uuid,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_care_plan_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, care_plan_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_care_plan_id)
    REFERENCES health.care_plan (tenant_id, care_plan_id),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK (status <> 'active' OR approved_by_principal_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS health.clinic_encounter (
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  opened_at timestamptz NOT NULL,
  opened_by_principal_id uuid NOT NULL,
  reason_category text NOT NULL,
  narrative text NOT NULL,
  status text NOT NULL CHECK (status IN ('open','closed')),
  closed_at timestamptz,
  disposition text CHECK (disposition IN ('returned-to-class','sent-home','emergency-transfer','follow-up')),
  follow_up_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, encounter_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id),
  CHECK (
    (status = 'open' AND closed_at IS NULL AND disposition IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL AND disposition IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS health_encounter_operational_index
  ON health.clinic_encounter (tenant_id, campus_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS health.restricted_document (
  tenant_id uuid NOT NULL,
  health_document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_type text NOT NULL,
  classification text NOT NULL DEFAULT 'CARE-C3' CHECK (classification = 'CARE-C3'),
  source_classification text NOT NULL DEFAULT 'CARE-C3' CHECK (source_classification = 'CARE-C3'),
  status text NOT NULL CHECK (status IN ('active','superseded','quarantined')),
  supersedes_health_document_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, health_document_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  FOREIGN KEY (tenant_id, supersedes_health_document_id)
    REFERENCES health.restricted_document (tenant_id, health_document_id)
);

CREATE TABLE IF NOT EXISTS health.emergency_projection (
  tenant_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  projection_version bigint NOT NULL CHECK (projection_version > 0),
  minimum_payload jsonb NOT NULL CHECK (jsonb_typeof(minimum_payload) = 'object'),
  generated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (tenant_id, profile_id, projection_version),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES health.profile (tenant_id, profile_id),
  FOREIGN KEY (tenant_id, student_person_id) REFERENCES people.person (tenant_id, person_id),
  CHECK (expires_at > generated_at)
);

CREATE OR REPLACE FUNCTION health.prevent_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'CARE_HEALTH_APPEND_ONLY_RECORD';
END
$function$;

DROP TRIGGER IF EXISTS medication_administration_append_only
  ON health.medication_administration;
CREATE TRIGGER medication_administration_append_only
  BEFORE UPDATE OR DELETE ON health.medication_administration
  FOR EACH ROW EXECUTE FUNCTION health.prevent_append_only_mutation();

DROP TRIGGER IF EXISTS medication_correction_append_only
  ON health.medication_administration_correction;
CREATE TRIGGER medication_correction_append_only
  BEFORE UPDATE OR DELETE ON health.medication_administration_correction
  FOR EACH ROW EXECUTE FUNCTION health.prevent_append_only_mutation();

DROP TRIGGER IF EXISTS legal_basis_evidence_append_only
  ON health.legal_basis_evidence;
CREATE TRIGGER legal_basis_evidence_append_only
  BEFORE UPDATE OR DELETE ON health.legal_basis_evidence
  FOR EACH ROW EXECUTE FUNCTION health.prevent_append_only_mutation();

CREATE OR REPLACE FUNCTION health.prevent_closed_encounter_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'CARE_HEALTH_CLOSED_ENCOUNTER_IMMUTABLE';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS closed_encounter_immutable ON health.clinic_encounter;
CREATE TRIGGER closed_encounter_immutable
  BEFORE UPDATE ON health.clinic_encounter
  FOR EACH ROW EXECUTE FUNCTION health.prevent_closed_encounter_rewrite();

DO $care_health_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profile','legal_basis_evidence','condition','allergy','medication_order',
    'medication_administration','medication_administration_correction','immunization',
    'care_plan','clinic_encounter','restricted_document','emergency_projection'
  ] LOOP
    EXECUTE format('ALTER TABLE health.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE health.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON health.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON health.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END
$care_health_rls$;

GRANT SELECT, INSERT, UPDATE ON health.profile TO app_runtime;
GRANT SELECT, INSERT ON health.legal_basis_evidence TO app_runtime;
GRANT SELECT, INSERT ON health.condition TO app_runtime;
GRANT SELECT, INSERT ON health.allergy TO app_runtime;
GRANT SELECT, INSERT ON health.medication_order TO app_runtime;
GRANT SELECT, INSERT ON health.medication_administration TO app_runtime;
GRANT SELECT, INSERT ON health.medication_administration_correction TO app_runtime;
GRANT SELECT, INSERT ON health.immunization TO app_runtime;
GRANT SELECT, INSERT ON health.care_plan TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON health.clinic_encounter TO app_runtime;
GRANT SELECT, INSERT ON health.restricted_document TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON health.emergency_projection TO app_runtime;

CREATE OR REPLACE VIEW health.operational_daily_counts_v
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  campus_id,
  date_trunc('day', opened_at) AS encounter_day,
  count(*)::bigint AS encounter_count,
  count(*) FILTER (WHERE disposition = 'sent-home')::bigint AS sent_home_count,
  count(*) FILTER (WHERE disposition = 'emergency-transfer')::bigint AS emergency_transfer_count
FROM health.clinic_encounter
WHERE status = 'closed'
GROUP BY tenant_id, campus_id, date_trunc('day', opened_at)
HAVING count(*) >= 5;

GRANT SELECT ON health.operational_daily_counts_v TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607290202_CARE-01_health',
  'CARE-01',
  'Health profiles, allergy and medication controls, clinic encounters, care plans, evidence and emergency projections'
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
