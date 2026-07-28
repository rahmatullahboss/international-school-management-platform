CREATE SCHEMA IF NOT EXISTS gradebook;

CREATE TABLE IF NOT EXISTS gradebook.grading_policy_version (
  tenant_id uuid NOT NULL,
  policy_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  version_label text NOT NULL,
  calculation_mode text NOT NULL CHECK (calculation_mode IN ('traditional', 'standards', 'hybrid')),
  missing_score_treatment text NOT NULL CHECK (missing_score_treatment IN ('zero', 'exclude')),
  rounding_decimals integer NOT NULL CHECK (rounding_decimals BETWEEN 0 AND 4),
  publication_state text NOT NULL DEFAULT 'draft' CHECK (publication_state IN ('draft', 'published')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, policy_version_id),
  UNIQUE (tenant_id, policy_key, version_label)
);

CREATE TABLE IF NOT EXISTS gradebook.assessment_category (
  tenant_id uuid NOT NULL,
  category_id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_version_id uuid NOT NULL,
  category_code text NOT NULL,
  category_label text NOT NULL,
  weight_percent numeric(7,4) NOT NULL CHECK (weight_percent > 0 AND weight_percent <= 100),
  PRIMARY KEY (tenant_id, category_id),
  UNIQUE (tenant_id, policy_version_id, category_code),
  FOREIGN KEY (tenant_id, policy_version_id)
    REFERENCES gradebook.grading_policy_version (tenant_id, policy_version_id)
);

CREATE TABLE IF NOT EXISTS gradebook.grade_scale_level (
  tenant_id uuid NOT NULL,
  scale_level_id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_version_id uuid NOT NULL,
  level_label text NOT NULL,
  minimum_percent numeric(7,4) NOT NULL CHECK (minimum_percent BETWEEN 0 AND 100),
  maximum_percent numeric(7,4) NOT NULL CHECK (maximum_percent BETWEEN 0 AND 100),
  grade_point numeric(7,4),
  passing boolean NOT NULL,
  PRIMARY KEY (tenant_id, scale_level_id),
  FOREIGN KEY (tenant_id, policy_version_id)
    REFERENCES gradebook.grading_policy_version (tenant_id, policy_version_id),
  CHECK (maximum_percent >= minimum_percent)
);

CREATE TABLE IF NOT EXISTS gradebook.rubric (
  tenant_id uuid NOT NULL,
  rubric_id uuid NOT NULL DEFAULT gen_random_uuid(),
  rubric_title text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, rubric_id)
);

CREATE TABLE IF NOT EXISTS gradebook.rubric_criterion (
  tenant_id uuid NOT NULL,
  criterion_id uuid NOT NULL DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL,
  criterion_code text NOT NULL,
  criterion_label text NOT NULL,
  maximum_points numeric(12,4) NOT NULL CHECK (maximum_points > 0),
  standard_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  PRIMARY KEY (tenant_id, criterion_id),
  UNIQUE (tenant_id, rubric_id, criterion_code),
  UNIQUE (tenant_id, rubric_id, sequence_no),
  FOREIGN KEY (tenant_id, rubric_id)
    REFERENCES gradebook.rubric (tenant_id, rubric_id),
  CHECK (jsonb_typeof(standard_ids) = 'array')
);

CREATE TABLE IF NOT EXISTS gradebook.assessment (
  tenant_id uuid NOT NULL,
  assessment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  reporting_period_id uuid NOT NULL,
  policy_version_id uuid NOT NULL,
  category_id uuid NOT NULL,
  assessment_title text NOT NULL,
  maximum_points numeric(12,4) NOT NULL CHECK (maximum_points > 0),
  due_at timestamptz NOT NULL,
  rubric_id uuid,
  standard_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  assessment_state text NOT NULL DEFAULT 'draft'
    CHECK (assessment_state IN ('draft', 'published', 'closed')),
  moderated_by uuid,
  moderated_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, assessment_id),
  FOREIGN KEY (tenant_id, policy_version_id)
    REFERENCES gradebook.grading_policy_version (tenant_id, policy_version_id),
  FOREIGN KEY (tenant_id, category_id)
    REFERENCES gradebook.assessment_category (tenant_id, category_id),
  FOREIGN KEY (tenant_id, rubric_id)
    REFERENCES gradebook.rubric (tenant_id, rubric_id),
  CHECK (jsonb_typeof(standard_ids) = 'array'),
  CHECK ((moderated_by IS NULL) = (moderated_at IS NULL))
);
CREATE INDEX IF NOT EXISTS gradebook_assessment_period_idx
  ON gradebook.assessment (tenant_id, section_id, reporting_period_id, assessment_state);

CREATE TABLE IF NOT EXISTS gradebook.assessment_result (
  tenant_id uuid NOT NULL,
  assessment_result_id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  student_profile_id uuid NOT NULL,
  result_state text NOT NULL CHECK (result_state IN ('scored', 'missing', 'exempt', 'late')),
  raw_score numeric(12,4),
  comment text,
  entered_by uuid NOT NULL,
  entered_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, assessment_result_id),
  UNIQUE (tenant_id, assessment_id, student_profile_id),
  FOREIGN KEY (tenant_id, assessment_id)
    REFERENCES gradebook.assessment (tenant_id, assessment_id),
  CHECK (
    (result_state IN ('scored', 'late') AND raw_score IS NOT NULL AND raw_score >= 0)
    OR (result_state IN ('missing', 'exempt') AND raw_score IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS gradebook_student_result_idx
  ON gradebook.assessment_result (tenant_id, student_profile_id, entered_at DESC);

CREATE TABLE IF NOT EXISTS gradebook.outcome_result (
  tenant_id uuid NOT NULL,
  outcome_result_id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_result_id uuid NOT NULL,
  standard_id uuid NOT NULL,
  attainment_level numeric(12,4) NOT NULL,
  evidence text,
  PRIMARY KEY (tenant_id, outcome_result_id),
  UNIQUE (tenant_id, assessment_result_id, standard_id),
  FOREIGN KEY (tenant_id, assessment_result_id)
    REFERENCES gradebook.assessment_result (tenant_id, assessment_result_id)
);

CREATE TABLE IF NOT EXISTS gradebook.grade_calculation_snapshot (
  tenant_id uuid NOT NULL,
  snapshot_id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  reporting_period_id uuid NOT NULL,
  student_profile_id uuid NOT NULL,
  policy_version_id uuid NOT NULL,
  category_percentages jsonb NOT NULL,
  calculated_percent numeric(12,4) NOT NULL CHECK (calculated_percent BETWEEN 0 AND 100),
  displayed_grade text NOT NULL,
  grade_point numeric(12,4),
  formula text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, snapshot_id),
  FOREIGN KEY (tenant_id, policy_version_id)
    REFERENCES gradebook.grading_policy_version (tenant_id, policy_version_id),
  CHECK (jsonb_typeof(category_percentages) = 'object')
);
CREATE INDEX IF NOT EXISTS gradebook_snapshot_student_idx
  ON gradebook.grade_calculation_snapshot
    (tenant_id, student_profile_id, reporting_period_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS gradebook.grade_calculation_input (
  tenant_id uuid NOT NULL,
  calculation_input_id uuid NOT NULL DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  category_id uuid NOT NULL,
  result_state text NOT NULL CHECK (result_state IN ('scored', 'missing', 'exempt', 'late')),
  raw_score numeric(12,4),
  maximum_points numeric(12,4) NOT NULL CHECK (maximum_points > 0),
  included boolean NOT NULL,
  normalized_percent numeric(12,4),
  PRIMARY KEY (tenant_id, calculation_input_id),
  FOREIGN KEY (tenant_id, snapshot_id)
    REFERENCES gradebook.grade_calculation_snapshot (tenant_id, snapshot_id),
  FOREIGN KEY (tenant_id, assessment_id)
    REFERENCES gradebook.assessment (tenant_id, assessment_id),
  FOREIGN KEY (tenant_id, category_id)
    REFERENCES gradebook.assessment_category (tenant_id, category_id)
);

CREATE TABLE IF NOT EXISTS gradebook.gradebook_lock (
  tenant_id uuid NOT NULL,
  lock_id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  reporting_period_id uuid NOT NULL,
  lock_state text NOT NULL CHECK (lock_state IN ('open', 'locked')),
  locked_by uuid,
  locked_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, lock_id),
  UNIQUE (tenant_id, section_id, reporting_period_id),
  CHECK ((lock_state = 'open' AND locked_by IS NULL AND locked_at IS NULL)
    OR (lock_state = 'locked' AND locked_by IS NOT NULL AND locked_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS gradebook.grade_publication (
  tenant_id uuid NOT NULL,
  publication_id uuid NOT NULL DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL,
  available_from timestamptz NOT NULL,
  available_to timestamptz,
  published_by uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, publication_id),
  UNIQUE (tenant_id, snapshot_id),
  FOREIGN KEY (tenant_id, snapshot_id)
    REFERENCES gradebook.grade_calculation_snapshot (tenant_id, snapshot_id),
  CHECK (available_to IS NULL OR available_to >= available_from)
);

CREATE TABLE IF NOT EXISTS gradebook.grade_change_request (
  tenant_id uuid NOT NULL,
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_result_id uuid NOT NULL,
  requested_raw_score numeric(12,4),
  requested_state text NOT NULL CHECK (requested_state IN ('scored', 'missing', 'exempt', 'late')),
  reason text NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  request_status text NOT NULL DEFAULT 'pending'
    CHECK (request_status IN ('pending', 'approved', 'rejected')),
  PRIMARY KEY (tenant_id, request_id),
  FOREIGN KEY (tenant_id, assessment_result_id)
    REFERENCES gradebook.assessment_result (tenant_id, assessment_result_id)
);

CREATE TABLE IF NOT EXISTS gradebook.grade_change_decision (
  tenant_id uuid NOT NULL,
  decision_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decision_note text NOT NULL,
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, decision_id),
  UNIQUE (tenant_id, request_id),
  FOREIGN KEY (tenant_id, request_id)
    REFERENCES gradebook.grade_change_request (tenant_id, request_id)
);

CREATE OR REPLACE FUNCTION gradebook.reject_published_policy_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.publication_state = 'published' THEN
    RAISE EXCEPTION 'published grading policy versions are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;
DROP TRIGGER IF EXISTS published_grading_policy_immutable ON gradebook.grading_policy_version;
CREATE TRIGGER published_grading_policy_immutable
  BEFORE UPDATE OR DELETE ON gradebook.grading_policy_version
  FOR EACH ROW EXECUTE FUNCTION gradebook.reject_published_policy_mutation();

CREATE OR REPLACE FUNCTION gradebook.reject_locked_result_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE section uuid;
DECLARE period uuid;
DECLARE locked text;
BEGIN
  SELECT a.section_id, a.reporting_period_id INTO section, period
  FROM gradebook.assessment a
  WHERE a.tenant_id = OLD.tenant_id AND a.assessment_id = OLD.assessment_id;
  SELECT l.lock_state INTO locked
  FROM gradebook.gradebook_lock l
  WHERE l.tenant_id = OLD.tenant_id
    AND l.section_id = section
    AND l.reporting_period_id = period;
  IF locked = 'locked' THEN
    RAISE EXCEPTION 'locked gradebook results require an approved grade-change command';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;
DROP TRIGGER IF EXISTS locked_grade_result_guard ON gradebook.assessment_result;
CREATE TRIGGER locked_grade_result_guard
  BEFORE UPDATE OR DELETE ON gradebook.assessment_result
  FOR EACH ROW EXECUTE FUNCTION gradebook.reject_locked_result_mutation();

CREATE OR REPLACE FUNCTION gradebook.reject_append_only_change()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'grade calculation and publication evidence is append-only';
END
$function$;
DO $gradebook_append_only$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'grade_calculation_snapshot', 'grade_calculation_input', 'grade_publication', 'grade_change_decision'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS append_only_guard ON gradebook.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER append_only_guard BEFORE UPDATE OR DELETE ON gradebook.%I FOR EACH ROW EXECUTE FUNCTION gradebook.reject_append_only_change()',
      table_name
    );
  END LOOP;
END
$gradebook_append_only$;

DO $gradebook_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'grading_policy_version', 'assessment_category', 'grade_scale_level', 'rubric',
    'rubric_criterion', 'assessment', 'assessment_result', 'outcome_result',
    'grade_calculation_snapshot', 'grade_calculation_input', 'gradebook_lock',
    'grade_publication', 'grade_change_request', 'grade_change_decision'
  ]
  LOOP
    EXECUTE format('ALTER TABLE gradebook.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE gradebook.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON gradebook.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON gradebook.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON gradebook.%I TO app_runtime', table_name);
  END LOOP;
END
$gradebook_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280204_ACAD-01_gradebook',
  'ACAD-01',
  'Versioned grading policies, assessments, results, explainable snapshots, locks, publication and grade changes'
)
ON CONFLICT (migration_id) DO NOTHING;
