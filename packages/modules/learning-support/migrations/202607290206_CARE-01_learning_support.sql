BEGIN;

CREATE SCHEMA IF NOT EXISTS learning_support;
GRANT USAGE ON SCHEMA learning_support TO app_runtime;

CREATE TABLE IF NOT EXISTS learning_support.referral (
  tenant_id uuid NOT NULL,
  referral_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_person_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  referral_category text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('routine','priority','urgent')),
  classroom_summary text NOT NULL,
  referred_by_principal_id uuid NOT NULL,
  assigned_lead_principal_id uuid,
  status text NOT NULL CHECK (status IN ('submitted','accepted','declined','closed')),
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

CREATE TABLE IF NOT EXISTS learning_support.basis_evidence (
  tenant_id uuid NOT NULL,
  basis_evidence_id uuid NOT NULL DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  basis_code text NOT NULL
    CHECK (basis_code IN ('consent','legal-obligation','public-task','vital-interests')),
  evidence_reference text NOT NULL CHECK (length(trim(evidence_reference)) > 0),
  status text NOT NULL CHECK (status IN ('active','withdrawn','expired')),
  effective_from timestamptz NOT NULL,
  expires_at timestamptz,
  supersedes_basis_evidence_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, basis_evidence_id),
  FOREIGN KEY (tenant_id, referral_id)
    REFERENCES learning_support.referral (tenant_id, referral_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_basis_evidence_id)
    REFERENCES learning_support.basis_evidence (tenant_id, basis_evidence_id),
  CHECK (expires_at IS NULL OR expires_at > effective_from)
);

CREATE TABLE IF NOT EXISTS learning_support.assessment (
  tenant_id uuid NOT NULL,
  assessment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  need_categories jsonb NOT NULL CHECK (jsonb_typeof(need_categories) = 'array'),
  strengths jsonb NOT NULL CHECK (jsonb_typeof(strengths) = 'array'),
  restricted_findings text NOT NULL,
  assessed_by_principal_id uuid NOT NULL,
  independently_reviewed_by_principal_id uuid NOT NULL,
  assessed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active','superseded','closed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_assessment_id uuid,
  PRIMARY KEY (tenant_id, assessment_id),
  FOREIGN KEY (tenant_id, referral_id)
    REFERENCES learning_support.referral (tenant_id, referral_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_assessment_id)
    REFERENCES learning_support.assessment (tenant_id, assessment_id),
  CHECK (assessed_by_principal_id <> independently_reviewed_by_principal_id)
);

CREATE TABLE IF NOT EXISTS learning_support.accommodation (
  tenant_id uuid NOT NULL,
  accommodation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  accommodation_code text NOT NULL,
  category text NOT NULL
    CHECK (category IN ('instruction','environment','assessment','communication','access')),
  classroom_instruction text NOT NULL,
  restricted_rationale text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  approved_by_principal_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('active','superseded','closed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_accommodation_id uuid,
  PRIMARY KEY (tenant_id, accommodation_id),
  UNIQUE (tenant_id, student_person_id, accommodation_code, version),
  FOREIGN KEY (tenant_id, assessment_id)
    REFERENCES learning_support.assessment (tenant_id, assessment_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_accommodation_id)
    REFERENCES learning_support.accommodation (tenant_id, accommodation_id),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE TABLE IF NOT EXISTS learning_support.support_plan (
  tenant_id uuid NOT NULL,
  support_plan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  title text NOT NULL,
  review_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','active','superseded','closed')),
  prepared_by_principal_id uuid NOT NULL,
  approved_by_principal_id uuid,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_support_plan_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, support_plan_id),
  FOREIGN KEY (tenant_id, referral_id)
    REFERENCES learning_support.referral (tenant_id, referral_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_support_plan_id)
    REFERENCES learning_support.support_plan (tenant_id, support_plan_id),
  CHECK (status <> 'active' OR approved_by_principal_id IS NOT NULL),
  CHECK (approved_by_principal_id IS NULL OR prepared_by_principal_id <> approved_by_principal_id)
);

CREATE TABLE IF NOT EXISTS learning_support.plan_goal (
  tenant_id uuid NOT NULL,
  goal_id uuid NOT NULL DEFAULT gen_random_uuid(),
  support_plan_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  title text NOT NULL,
  success_measure text NOT NULL,
  target_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('planned','active','achieved','closed')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, goal_id),
  FOREIGN KEY (tenant_id, support_plan_id)
    REFERENCES learning_support.support_plan (tenant_id, support_plan_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS learning_support.plan_accommodation (
  tenant_id uuid NOT NULL,
  plan_accommodation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  support_plan_id uuid NOT NULL,
  accommodation_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, plan_accommodation_id),
  UNIQUE (tenant_id, support_plan_id, accommodation_id),
  FOREIGN KEY (tenant_id, support_plan_id)
    REFERENCES learning_support.support_plan (tenant_id, support_plan_id),
  FOREIGN KEY (tenant_id, accommodation_id)
    REFERENCES learning_support.accommodation (tenant_id, accommodation_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS learning_support.plan_review (
  tenant_id uuid NOT NULL,
  review_id uuid NOT NULL DEFAULT gen_random_uuid(),
  support_plan_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  outcome_code text NOT NULL CHECK (outcome_code IN ('continue','adjust','close','escalate')),
  goal_outcome_codes jsonb NOT NULL CHECK (jsonb_typeof(goal_outcome_codes) = 'object'),
  next_review_at timestamptz,
  restricted_note text,
  reviewed_by_principal_id uuid NOT NULL,
  independently_approved_by_principal_id uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, review_id),
  FOREIGN KEY (tenant_id, support_plan_id)
    REFERENCES learning_support.support_plan (tenant_id, support_plan_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (reviewed_by_principal_id <> independently_approved_by_principal_id)
);

CREATE TABLE IF NOT EXISTS learning_support.academic_projection (
  tenant_id uuid NOT NULL,
  academic_projection_id uuid NOT NULL DEFAULT gen_random_uuid(),
  support_plan_id uuid NOT NULL,
  support_plan_version bigint NOT NULL CHECK (support_plan_version > 0),
  student_person_id uuid NOT NULL,
  minimum_payload jsonb NOT NULL CHECK (jsonb_typeof(minimum_payload) = 'object'),
  generated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (tenant_id, academic_projection_id),
  FOREIGN KEY (tenant_id, support_plan_id)
    REFERENCES learning_support.support_plan (tenant_id, support_plan_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (expires_at > generated_at)
);

CREATE TABLE IF NOT EXISTS learning_support.publication (
  tenant_id uuid NOT NULL,
  publication_id uuid NOT NULL DEFAULT gen_random_uuid(),
  support_plan_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  audience text NOT NULL CHECK (audience IN ('student','guardian')),
  version bigint NOT NULL CHECK (version > 0),
  support_summary text NOT NULL,
  goal_summaries jsonb NOT NULL CHECK (jsonb_typeof(goal_summaries) = 'array'),
  next_review_at timestamptz,
  prepared_by_principal_id uuid NOT NULL,
  approved_by_principal_id uuid NOT NULL,
  effective_from timestamptz NOT NULL,
  expires_at timestamptz,
  supersedes_publication_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, publication_id),
  UNIQUE (tenant_id, support_plan_id, audience, version),
  FOREIGN KEY (tenant_id, support_plan_id)
    REFERENCES learning_support.support_plan (tenant_id, support_plan_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_publication_id)
    REFERENCES learning_support.publication (tenant_id, publication_id),
  CHECK (prepared_by_principal_id <> approved_by_principal_id),
  CHECK (expires_at IS NULL OR expires_at > effective_from)
);

CREATE TABLE IF NOT EXISTS learning_support.restricted_document (
  tenant_id uuid NOT NULL,
  restricted_document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_type text NOT NULL,
  classification text NOT NULL DEFAULT 'CARE-C3' CHECK (classification = 'CARE-C3'),
  source_classification text NOT NULL DEFAULT 'CARE-C3' CHECK (source_classification = 'CARE-C3'),
  recorded_by_principal_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  supersedes_restricted_document_id uuid,
  PRIMARY KEY (tenant_id, restricted_document_id),
  FOREIGN KEY (tenant_id, referral_id)
    REFERENCES learning_support.referral (tenant_id, referral_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  FOREIGN KEY (tenant_id, supersedes_restricted_document_id)
    REFERENCES learning_support.restricted_document (tenant_id, restricted_document_id)
);

CREATE OR REPLACE FUNCTION learning_support.prevent_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'CARE_LEARNING_SUPPORT_APPEND_ONLY_RECORD';
END
$function$;

DO $care_learning_support_append_only$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'basis_evidence','assessment','accommodation','support_plan','plan_goal',
    'plan_accommodation','plan_review','academic_projection','publication','restricted_document'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS append_only ON learning_support.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON learning_support.%I FOR EACH ROW EXECUTE FUNCTION learning_support.prevent_append_only_mutation()',
      table_name
    );
  END LOOP;
END
$care_learning_support_append_only$;

DO $care_learning_support_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'referral','basis_evidence','assessment','accommodation','support_plan','plan_goal',
    'plan_accommodation','plan_review','academic_projection','publication','restricted_document'
  ] LOOP
    EXECUTE format('ALTER TABLE learning_support.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE learning_support.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON learning_support.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON learning_support.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END
$care_learning_support_rls$;

GRANT SELECT, INSERT, UPDATE ON learning_support.referral TO app_runtime;
GRANT SELECT, INSERT ON learning_support.basis_evidence TO app_runtime;
GRANT SELECT, INSERT ON learning_support.assessment TO app_runtime;
GRANT SELECT, INSERT ON learning_support.accommodation TO app_runtime;
GRANT SELECT, INSERT ON learning_support.support_plan TO app_runtime;
GRANT SELECT, INSERT ON learning_support.plan_goal TO app_runtime;
GRANT SELECT, INSERT ON learning_support.plan_accommodation TO app_runtime;
GRANT SELECT, INSERT ON learning_support.plan_review TO app_runtime;
GRANT SELECT, INSERT ON learning_support.academic_projection TO app_runtime;
GRANT SELECT, INSERT ON learning_support.publication TO app_runtime;
GRANT SELECT, INSERT ON learning_support.restricted_document TO app_runtime;

CREATE OR REPLACE VIEW learning_support.operational_monthly_counts_v
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  campus_id,
  date_trunc('month', created_at) AS referral_month,
  priority,
  count(*)::bigint AS referral_count
FROM learning_support.referral
GROUP BY tenant_id, campus_id, date_trunc('month', created_at), priority
HAVING count(*) >= 5;

GRANT SELECT ON learning_support.operational_monthly_counts_v TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607290206_CARE-01_learning_support',
  'CARE-01',
  'Learning-support referrals, assessments, accommodations, plans, academic projections and minimized publication'
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
