BEGIN;

CREATE SCHEMA IF NOT EXISTS wellbeing;
GRANT USAGE ON SCHEMA wellbeing TO app_runtime;

CREATE TABLE IF NOT EXISTS wellbeing.referral (
  tenant_id uuid NOT NULL,
  referral_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_person_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  referral_category text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('routine','priority','urgent')),
  referral_summary text NOT NULL,
  referred_by_principal_id uuid NOT NULL,
  assigned_counselor_principal_id uuid,
  status text NOT NULL CHECK (status IN ('submitted','triaged','accepted','closed','declined')),
  idempotency_key text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, referral_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE TABLE IF NOT EXISTS wellbeing.basis_evidence (
  tenant_id uuid NOT NULL,
  basis_evidence_id uuid NOT NULL DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  basis_code text NOT NULL
    CHECK (basis_code IN ('consent','vital-interests','legal-obligation','public-task')),
  evidence_reference text NOT NULL CHECK (length(trim(evidence_reference)) > 0),
  status text NOT NULL CHECK (status IN ('active','withdrawn','expired')),
  effective_from timestamptz NOT NULL,
  expires_at timestamptz,
  supersedes_basis_evidence_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, basis_evidence_id),
  FOREIGN KEY (tenant_id, referral_id)
    REFERENCES wellbeing.referral (tenant_id, referral_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_basis_evidence_id)
    REFERENCES wellbeing.basis_evidence (tenant_id, basis_evidence_id),
  CHECK (expires_at IS NULL OR expires_at > effective_from)
);

CREATE TABLE IF NOT EXISTS wellbeing.counselling_case (
  tenant_id uuid NOT NULL,
  counselling_case_id uuid NOT NULL DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  assigned_counselor_principal_id uuid NOT NULL,
  purpose_code text NOT NULL DEFAULT 'student-support-plan'
    CHECK (purpose_code = 'student-support-plan'),
  status text NOT NULL CHECK (status IN ('open','paused','closed')),
  opened_at timestamptz NOT NULL,
  closed_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, counselling_case_id),
  UNIQUE (tenant_id, referral_id),
  FOREIGN KEY (tenant_id, referral_id)
    REFERENCES wellbeing.referral (tenant_id, referral_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK ((status = 'closed' AND closed_at IS NOT NULL) OR status <> 'closed')
);

CREATE TABLE IF NOT EXISTS wellbeing.counselling_session (
  tenant_id uuid NOT NULL,
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  counselling_case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  counselor_principal_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('individual','group','check-in','crisis')),
  restricted_note text NOT NULL,
  controlled_outcome_code text NOT NULL
    CHECK (controlled_outcome_code IN ('continue','review','escalate','close')),
  classification text NOT NULL DEFAULT 'CARE-C3' CHECK (classification = 'CARE-C3'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, session_id),
  FOREIGN KEY (tenant_id, counselling_case_id)
    REFERENCES wellbeing.counselling_case (tenant_id, counselling_case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS wellbeing.session_correction (
  tenant_id uuid NOT NULL,
  correction_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  replacement_outcome_code text
    CHECK (replacement_outcome_code IN ('continue','review','escalate','close')),
  replacement_occurred_at timestamptz,
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  corrected_by_principal_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, correction_id),
  FOREIGN KEY (tenant_id, session_id)
    REFERENCES wellbeing.counselling_session (tenant_id, session_id),
  CHECK (replacement_outcome_code IS NOT NULL OR replacement_occurred_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS wellbeing.risk_assessment (
  tenant_id uuid NOT NULL,
  risk_assessment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  counselling_case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low','moderate','high','immediate')),
  factors jsonb NOT NULL CHECK (jsonb_typeof(factors) = 'array'),
  protective_factors jsonb NOT NULL CHECK (jsonb_typeof(protective_factors) = 'array'),
  required_actions jsonb NOT NULL CHECK (jsonb_typeof(required_actions) = 'array'),
  assessed_by_principal_id uuid NOT NULL,
  assessed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active','superseded','closed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_risk_assessment_id uuid,
  PRIMARY KEY (tenant_id, risk_assessment_id),
  FOREIGN KEY (tenant_id, counselling_case_id)
    REFERENCES wellbeing.counselling_case (tenant_id, counselling_case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_risk_assessment_id)
    REFERENCES wellbeing.risk_assessment (tenant_id, risk_assessment_id)
);

CREATE TABLE IF NOT EXISTS wellbeing.support_plan (
  tenant_id uuid NOT NULL,
  support_plan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  counselling_case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  goals jsonb NOT NULL CHECK (jsonb_typeof(goals) = 'array'),
  interventions jsonb NOT NULL CHECK (jsonb_typeof(interventions) = 'array'),
  review_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','active','superseded','closed')),
  approved_by_principal_id uuid,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_support_plan_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, support_plan_id),
  FOREIGN KEY (tenant_id, counselling_case_id)
    REFERENCES wellbeing.counselling_case (tenant_id, counselling_case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_support_plan_id)
    REFERENCES wellbeing.support_plan (tenant_id, support_plan_id),
  CHECK (status <> 'active' OR approved_by_principal_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS wellbeing.plan_review (
  tenant_id uuid NOT NULL,
  review_id uuid NOT NULL DEFAULT gen_random_uuid(),
  support_plan_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  outcome_code text NOT NULL CHECK (outcome_code IN ('continue','adjust','close','escalate')),
  next_review_at timestamptz,
  restricted_note text,
  reviewed_by_principal_id uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, review_id),
  FOREIGN KEY (tenant_id, support_plan_id)
    REFERENCES wellbeing.support_plan (tenant_id, support_plan_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS wellbeing.safeguarding_escalation (
  tenant_id uuid NOT NULL,
  escalation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  counselling_case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('high','immediate')),
  reason_category text NOT NULL,
  safeguarding_intake_reference text NOT NULL,
  status text NOT NULL CHECK (status IN ('requested','accepted','rejected')),
  created_by_principal_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, escalation_id),
  UNIQUE (tenant_id, safeguarding_intake_reference),
  FOREIGN KEY (tenant_id, counselling_case_id)
    REFERENCES wellbeing.counselling_case (tenant_id, counselling_case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS wellbeing.publication (
  tenant_id uuid NOT NULL,
  publication_id uuid NOT NULL DEFAULT gen_random_uuid(),
  counselling_case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  audience text NOT NULL CHECK (audience IN ('student','guardian')),
  version bigint NOT NULL CHECK (version > 0),
  support_summary text NOT NULL,
  next_review_at timestamptz,
  prepared_by_principal_id uuid NOT NULL,
  approved_by_principal_id uuid NOT NULL,
  effective_from timestamptz NOT NULL,
  expires_at timestamptz,
  supersedes_publication_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, publication_id),
  UNIQUE (tenant_id, counselling_case_id, audience, version),
  FOREIGN KEY (tenant_id, counselling_case_id)
    REFERENCES wellbeing.counselling_case (tenant_id, counselling_case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_publication_id)
    REFERENCES wellbeing.publication (tenant_id, publication_id),
  CHECK (prepared_by_principal_id <> approved_by_principal_id),
  CHECK (expires_at IS NULL OR expires_at > effective_from)
);

CREATE OR REPLACE FUNCTION wellbeing.prevent_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'CARE_WELLBEING_APPEND_ONLY_RECORD';
END
$function$;

DO $care_wellbeing_append_only$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'basis_evidence','counselling_session','session_correction','risk_assessment',
    'plan_review','safeguarding_escalation','publication'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS append_only ON wellbeing.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON wellbeing.%I FOR EACH ROW EXECUTE FUNCTION wellbeing.prevent_append_only_mutation()',
      table_name
    );
  END LOOP;
END
$care_wellbeing_append_only$;

DO $care_wellbeing_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'referral','basis_evidence','counselling_case','counselling_session',
    'session_correction','risk_assessment','support_plan','plan_review',
    'safeguarding_escalation','publication'
  ] LOOP
    EXECUTE format('ALTER TABLE wellbeing.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE wellbeing.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON wellbeing.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON wellbeing.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END
$care_wellbeing_rls$;

GRANT SELECT, INSERT, UPDATE ON wellbeing.referral TO app_runtime;
GRANT SELECT, INSERT ON wellbeing.basis_evidence TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON wellbeing.counselling_case TO app_runtime;
GRANT SELECT, INSERT ON wellbeing.counselling_session TO app_runtime;
GRANT SELECT, INSERT ON wellbeing.session_correction TO app_runtime;
GRANT SELECT, INSERT ON wellbeing.risk_assessment TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON wellbeing.support_plan TO app_runtime;
GRANT SELECT, INSERT ON wellbeing.plan_review TO app_runtime;
GRANT SELECT, INSERT ON wellbeing.safeguarding_escalation TO app_runtime;
GRANT SELECT, INSERT ON wellbeing.publication TO app_runtime;

CREATE OR REPLACE VIEW wellbeing.operational_monthly_counts_v
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  campus_id,
  date_trunc('month', created_at) AS referral_month,
  urgency,
  count(*)::bigint AS referral_count
FROM wellbeing.referral
GROUP BY tenant_id, campus_id, date_trunc('month', created_at), urgency
HAVING count(*) >= 5;

GRANT SELECT ON wellbeing.operational_monthly_counts_v TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607290204_CARE-01_wellbeing',
  'CARE-01',
  'Pastoral referrals, counselling cases and sessions, risk, support plans, safeguarding escalation and minimized publication'
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
