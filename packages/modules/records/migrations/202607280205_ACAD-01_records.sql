CREATE SCHEMA IF NOT EXISTS records;

CREATE TABLE IF NOT EXISTS records.reporting_period (
  tenant_id uuid NOT NULL,
  reporting_period_id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL,
  term_id uuid,
  period_code text NOT NULL,
  period_name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  period_state text NOT NULL DEFAULT 'draft' CHECK (period_state IN ('draft', 'closed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, reporting_period_id),
  UNIQUE (tenant_id, academic_year_id, period_code),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS records.report_card_template_version (
  tenant_id uuid NOT NULL,
  template_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  version_label text NOT NULL,
  locale text NOT NULL,
  title text NOT NULL,
  publication_state text NOT NULL DEFAULT 'draft' CHECK (publication_state IN ('draft', 'published')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, template_version_id),
  UNIQUE (tenant_id, template_key, version_label)
);

CREATE TABLE IF NOT EXISTS records.report_card_template_section (
  tenant_id uuid NOT NULL,
  template_section_id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_version_id uuid NOT NULL,
  section_key text NOT NULL,
  section_label text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  PRIMARY KEY (tenant_id, template_section_id),
  UNIQUE (tenant_id, template_version_id, section_key),
  UNIQUE (tenant_id, template_version_id, sequence_no),
  FOREIGN KEY (tenant_id, template_version_id)
    REFERENCES records.report_card_template_version (tenant_id, template_version_id)
);

CREATE TABLE IF NOT EXISTS records.report_card_snapshot (
  tenant_id uuid NOT NULL,
  report_card_id uuid NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  student_profile_id uuid NOT NULL,
  reporting_period_id uuid NOT NULL,
  template_version_id uuid NOT NULL,
  course_results jsonb NOT NULL,
  attendance_summary jsonb NOT NULL,
  advisor_comment text,
  principal_comment text,
  report_card_state text NOT NULL DEFAULT 'draft'
    CHECK (report_card_state IN ('draft', 'approved', 'published')),
  approved_by uuid,
  approved_at timestamptz,
  published_by uuid,
  published_at timestamptz,
  available_from timestamptz,
  available_to timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, report_card_id),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, student_profile_id, reporting_period_id, template_version_id),
  FOREIGN KEY (tenant_id, reporting_period_id)
    REFERENCES records.reporting_period (tenant_id, reporting_period_id),
  FOREIGN KEY (tenant_id, template_version_id)
    REFERENCES records.report_card_template_version (tenant_id, template_version_id),
  CHECK (jsonb_typeof(course_results) = 'array' AND jsonb_array_length(course_results) > 0),
  CHECK (jsonb_typeof(attendance_summary) = 'object'),
  CHECK (available_to IS NULL OR available_to >= available_from),
  CHECK ((approved_by IS NULL) = (approved_at IS NULL)),
  CHECK ((published_by IS NULL) = (published_at IS NULL))
);
CREATE INDEX IF NOT EXISTS records_report_card_student_idx
  ON records.report_card_snapshot (tenant_id, student_profile_id, reporting_period_id);

CREATE TABLE IF NOT EXISTS records.promotion_proposal (
  tenant_id uuid NOT NULL,
  proposal_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  from_grade_level text NOT NULL,
  proposed_grade_level text NOT NULL,
  recommendation text NOT NULL CHECK (recommendation IN ('promote', 'retain', 'complete', 'review')),
  rationale text NOT NULL,
  evidence_report_card_ids jsonb NOT NULL,
  proposed_by uuid NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  proposal_status text NOT NULL DEFAULT 'pending'
    CHECK (proposal_status IN ('pending', 'approved', 'rejected')),
  PRIMARY KEY (tenant_id, proposal_id),
  CHECK (jsonb_typeof(evidence_report_card_ids) = 'array' AND jsonb_array_length(evidence_report_card_ids) > 0)
);

CREATE TABLE IF NOT EXISTS records.promotion_decision (
  tenant_id uuid NOT NULL,
  decision_id uuid NOT NULL DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  effective_on date NOT NULL,
  decided_by uuid NOT NULL,
  decision_note text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, decision_id),
  UNIQUE (tenant_id, proposal_id),
  FOREIGN KEY (tenant_id, proposal_id)
    REFERENCES records.promotion_proposal (tenant_id, proposal_id)
);

CREATE TABLE IF NOT EXISTS records.credit_policy_version (
  tenant_id uuid NOT NULL,
  credit_policy_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  version_label text NOT NULL,
  minimum_passing_percent numeric(7,4) NOT NULL CHECK (minimum_passing_percent BETWEEN 0 AND 100),
  minimum_passing_grade_point numeric(7,4),
  gpa_decimals integer NOT NULL CHECK (gpa_decimals BETWEEN 0 AND 4),
  publication_state text NOT NULL DEFAULT 'draft' CHECK (publication_state IN ('draft', 'published')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, credit_policy_version_id),
  UNIQUE (tenant_id, policy_key, version_label)
);

CREATE TABLE IF NOT EXISTS records.gpa_calculation_snapshot (
  tenant_id uuid NOT NULL,
  gpa_snapshot_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  credit_policy_version_id uuid NOT NULL,
  course_outcomes jsonb NOT NULL,
  quality_points numeric(14,6) NOT NULL,
  credits_attempted numeric(14,6) NOT NULL CHECK (credits_attempted >= 0),
  credits_earned numeric(14,6) NOT NULL CHECK (credits_earned >= 0 AND credits_earned <= credits_attempted),
  gpa numeric(10,4),
  formula text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, gpa_snapshot_id),
  FOREIGN KEY (tenant_id, credit_policy_version_id)
    REFERENCES records.credit_policy_version (tenant_id, credit_policy_version_id),
  CHECK (jsonb_typeof(course_outcomes) = 'array' AND jsonb_array_length(course_outcomes) > 0)
);
CREATE INDEX IF NOT EXISTS records_gpa_student_idx
  ON records.gpa_calculation_snapshot (tenant_id, student_profile_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS records.transcript_record (
  tenant_id uuid NOT NULL,
  transcript_id uuid NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key text,
  transcript_number text NOT NULL,
  student_profile_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_transcript_id uuid,
  transcript_status text NOT NULL CHECK (transcript_status IN ('issued', 'superseded', 'revoked')),
  locale text NOT NULL,
  school_name text NOT NULL,
  student_display_name text NOT NULL,
  gpa_snapshot_id uuid NOT NULL,
  course_outcomes jsonb NOT NULL,
  cumulative_gpa numeric(10,4),
  credits_attempted numeric(14,6) NOT NULL CHECK (credits_attempted >= 0),
  credits_earned numeric(14,6) NOT NULL CHECK (credits_earned >= 0 AND credits_earned <= credits_attempted),
  issued_by uuid NOT NULL,
  issued_at timestamptz NOT NULL,
  artifact_digest text NOT NULL,
  correction_reason text,
  PRIMARY KEY (tenant_id, transcript_id),
  UNIQUE (tenant_id, transcript_number),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, gpa_snapshot_id)
    REFERENCES records.gpa_calculation_snapshot (tenant_id, gpa_snapshot_id),
  FOREIGN KEY (tenant_id, supersedes_transcript_id)
    REFERENCES records.transcript_record (tenant_id, transcript_id),
  CHECK (jsonb_typeof(course_outcomes) = 'array' AND jsonb_array_length(course_outcomes) > 0),
  CHECK ((version_number = 1 AND supersedes_transcript_id IS NULL)
    OR (version_number > 1 AND supersedes_transcript_id IS NOT NULL AND correction_reason IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS records_transcript_student_idx
  ON records.transcript_record (tenant_id, student_profile_id, version_number);

CREATE TABLE IF NOT EXISTS records.transcript_amendment (
  tenant_id uuid NOT NULL,
  amendment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  original_transcript_id uuid NOT NULL,
  replacement_transcript_id uuid NOT NULL,
  reason text NOT NULL,
  approved_by uuid NOT NULL,
  amended_by uuid NOT NULL,
  amended_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, amendment_id),
  UNIQUE (tenant_id, replacement_transcript_id),
  FOREIGN KEY (tenant_id, original_transcript_id)
    REFERENCES records.transcript_record (tenant_id, transcript_id),
  FOREIGN KEY (tenant_id, replacement_transcript_id)
    REFERENCES records.transcript_record (tenant_id, transcript_id),
  CHECK (original_transcript_id <> replacement_transcript_id),
  CHECK (approved_by <> amended_by)
);

CREATE OR REPLACE FUNCTION records.reject_published_template_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.publication_state = 'published' THEN
    RAISE EXCEPTION 'published report-card and credit policy versions are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;
DROP TRIGGER IF EXISTS published_report_card_template_immutable ON records.report_card_template_version;
CREATE TRIGGER published_report_card_template_immutable
  BEFORE UPDATE OR DELETE ON records.report_card_template_version
  FOR EACH ROW EXECUTE FUNCTION records.reject_published_template_mutation();
DROP TRIGGER IF EXISTS published_credit_policy_immutable ON records.credit_policy_version;
CREATE TRIGGER published_credit_policy_immutable
  BEFORE UPDATE OR DELETE ON records.credit_policy_version
  FOR EACH ROW EXECUTE FUNCTION records.reject_published_template_mutation();

CREATE OR REPLACE FUNCTION records.reject_published_report_card_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.report_card_state = 'published' THEN
    RAISE EXCEPTION 'published report cards are immutable snapshots';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;
DROP TRIGGER IF EXISTS published_report_card_immutable ON records.report_card_snapshot;
CREATE TRIGGER published_report_card_immutable
  BEFORE UPDATE OR DELETE ON records.report_card_snapshot
  FOR EACH ROW EXECUTE FUNCTION records.reject_published_report_card_mutation();

CREATE OR REPLACE FUNCTION records.reject_append_only_artifact_change()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'issued academic record evidence is append-only';
END
$function$;
DO $records_append_only$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'promotion_decision', 'gpa_calculation_snapshot', 'transcript_amendment'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS append_only_guard ON records.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER append_only_guard BEFORE UPDATE OR DELETE ON records.%I FOR EACH ROW EXECUTE FUNCTION records.reject_append_only_artifact_change()',
      table_name
    );
  END LOOP;
END
$records_append_only$;

CREATE OR REPLACE FUNCTION records.guard_transcript_content_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF ROW(
    NEW.transcript_number, NEW.student_profile_id, NEW.version_number,
    NEW.supersedes_transcript_id, NEW.locale, NEW.school_name,
    NEW.student_display_name, NEW.gpa_snapshot_id, NEW.course_outcomes,
    NEW.cumulative_gpa, NEW.credits_attempted, NEW.credits_earned,
    NEW.issued_by, NEW.issued_at, NEW.artifact_digest, NEW.correction_reason
  ) IS DISTINCT FROM ROW(
    OLD.transcript_number, OLD.student_profile_id, OLD.version_number,
    OLD.supersedes_transcript_id, OLD.locale, OLD.school_name,
    OLD.student_display_name, OLD.gpa_snapshot_id, OLD.course_outcomes,
    OLD.cumulative_gpa, OLD.credits_attempted, OLD.credits_earned,
    OLD.issued_by, OLD.issued_at, OLD.artifact_digest, OLD.correction_reason
  ) THEN
    RAISE EXCEPTION 'issued transcript content is immutable; reissue a new version';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'issued transcript records cannot be deleted';
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS transcript_content_immutable ON records.transcript_record;
CREATE TRIGGER transcript_content_immutable
  BEFORE UPDATE OR DELETE ON records.transcript_record
  FOR EACH ROW EXECUTE FUNCTION records.guard_transcript_content_mutation();

DO $records_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'reporting_period', 'report_card_template_version', 'report_card_template_section',
    'report_card_snapshot', 'promotion_proposal', 'promotion_decision',
    'credit_policy_version', 'gpa_calculation_snapshot', 'transcript_record',
    'transcript_amendment'
  ]
  LOOP
    EXECUTE format('ALTER TABLE records.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE records.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON records.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON records.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON records.%I TO app_runtime', table_name);
  END LOOP;
END
$records_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280205_ACAD-01_records',
  'ACAD-01',
  'Report cards, promotion decisions, GPA snapshots and immutable transcript version history'
)
ON CONFLICT (migration_id) DO NOTHING;
