BEGIN;

CREATE TABLE IF NOT EXISTS safeguarding.concern_intake (
  tenant_id uuid NOT NULL,
  concern_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_person_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  concern_category text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('routine','priority','immediate')),
  concern_narrative text NOT NULL,
  reporter_principal_id uuid NOT NULL,
  reporter_relationship text NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('received','triaged','linked-to-case','closed-no-action')),
  PRIMARY KEY (tenant_id, concern_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE TABLE IF NOT EXISTS safeguarding.concern_status_event (
  tenant_id uuid NOT NULL,
  concern_status_event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  concern_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('triaged','linked-to-case','closed-no-action')),
  occurred_by_principal_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, concern_status_event_id),
  FOREIGN KEY (tenant_id, concern_id)
    REFERENCES safeguarding.concern_intake (tenant_id, concern_id)
);

CREATE TABLE IF NOT EXISTS safeguarding.case_file (
  tenant_id uuid NOT NULL,
  case_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_person_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  lead_principal_id uuid NOT NULL,
  opened_from_concern_id uuid NOT NULL,
  risk_band text NOT NULL CHECK (risk_band IN ('standard','elevated','critical')),
  status text NOT NULL CHECK (status IN ('open','monitoring','closed')),
  opened_at timestamptz NOT NULL,
  closed_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, case_id),
  UNIQUE (tenant_id, opened_from_concern_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id),
  FOREIGN KEY (tenant_id, opened_from_concern_id)
    REFERENCES safeguarding.concern_intake (tenant_id, concern_id),
  CHECK ((status = 'closed' AND closed_at IS NOT NULL) OR status <> 'closed')
);

CREATE TABLE IF NOT EXISTS safeguarding.chronology_entry (
  tenant_id uuid NOT NULL,
  chronology_entry_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  entry_category text NOT NULL,
  restricted_narrative text NOT NULL,
  source_reference text,
  recorded_by_principal_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, chronology_entry_id),
  FOREIGN KEY (tenant_id, case_id)
    REFERENCES safeguarding.case_file (tenant_id, case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id)
);

CREATE INDEX IF NOT EXISTS safeguarding_chronology_case_idx
  ON safeguarding.chronology_entry (tenant_id, case_id, occurred_at, recorded_at);

CREATE TABLE IF NOT EXISTS safeguarding.assessment (
  tenant_id uuid NOT NULL,
  assessment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('standard','elevated','critical','immediate')),
  controlled_factors jsonb NOT NULL CHECK (jsonb_typeof(controlled_factors) = 'array'),
  required_actions jsonb NOT NULL CHECK (jsonb_typeof(required_actions) = 'array'),
  assessed_by_principal_id uuid NOT NULL,
  independently_reviewed_by_principal_id uuid NOT NULL,
  assessed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active','superseded','closed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_assessment_id uuid,
  PRIMARY KEY (tenant_id, assessment_id),
  FOREIGN KEY (tenant_id, case_id)
    REFERENCES safeguarding.case_file (tenant_id, case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_assessment_id)
    REFERENCES safeguarding.assessment (tenant_id, assessment_id),
  CHECK (assessed_by_principal_id <> independently_reviewed_by_principal_id)
);

CREATE TABLE IF NOT EXISTS safeguarding.safety_plan (
  tenant_id uuid NOT NULL,
  safety_plan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  actions jsonb NOT NULL CHECK (jsonb_typeof(actions) = 'array'),
  responsible_role_codes jsonb NOT NULL CHECK (jsonb_typeof(responsible_role_codes) = 'array'),
  review_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','active','superseded','closed')),
  prepared_by_principal_id uuid NOT NULL,
  approved_by_principal_id uuid,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_safety_plan_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, safety_plan_id),
  FOREIGN KEY (tenant_id, case_id)
    REFERENCES safeguarding.case_file (tenant_id, case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_safety_plan_id)
    REFERENCES safeguarding.safety_plan (tenant_id, safety_plan_id),
  CHECK (status <> 'active' OR approved_by_principal_id IS NOT NULL),
  CHECK (approved_by_principal_id IS NULL OR prepared_by_principal_id <> approved_by_principal_id)
);

CREATE TABLE IF NOT EXISTS safeguarding.mandatory_report (
  tenant_id uuid NOT NULL,
  mandatory_report_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  authority_code text NOT NULL,
  report_category text NOT NULL,
  exact_field_categories text[] NOT NULL CHECK (cardinality(exact_field_categories) > 0),
  recipient_reference text NOT NULL CHECK (length(trim(recipient_reference)) > 0),
  requested_by_principal_id uuid NOT NULL,
  approved_by_principal_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('approved','submitted','acknowledged','failed')),
  submitted_at timestamptz,
  acknowledgment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, mandatory_report_id),
  FOREIGN KEY (tenant_id, case_id)
    REFERENCES safeguarding.case_file (tenant_id, case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (requested_by_principal_id <> approved_by_principal_id),
  CHECK ((status = 'approved' AND submitted_at IS NULL) OR status <> 'approved')
);

CREATE TABLE IF NOT EXISTS safeguarding.mandatory_report_status_event (
  tenant_id uuid NOT NULL,
  mandatory_report_status_event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  mandatory_report_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('submitted','acknowledged','failed')),
  acknowledgment_reference text,
  occurred_by_principal_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, mandatory_report_status_event_id),
  FOREIGN KEY (tenant_id, mandatory_report_id)
    REFERENCES safeguarding.mandatory_report (tenant_id, mandatory_report_id),
  CHECK (status <> 'acknowledged' OR acknowledgment_reference IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS safeguarding.external_disclosure (
  tenant_id uuid NOT NULL,
  disclosure_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  legal_basis text NOT NULL CHECK (legal_basis IN ('legal-obligation','vital-interests','court-order')),
  exact_field_categories text[] NOT NULL CHECK (cardinality(exact_field_categories) > 0),
  recipient_reference text NOT NULL CHECK (length(trim(recipient_reference)) > 0),
  purpose_code text NOT NULL CHECK (purpose_code IN ('mandatory-reporting','approved-data-transfer')),
  requested_by_principal_id uuid NOT NULL,
  approved_by_principal_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('approved','generated','delivered','revoked','expired')),
  object_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, disclosure_id),
  FOREIGN KEY (tenant_id, case_id)
    REFERENCES safeguarding.case_file (tenant_id, case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (requested_by_principal_id <> approved_by_principal_id),
  CHECK (expires_at > created_at),
  CHECK ((status IN ('generated','delivered')) = (object_reference IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS safeguarding.disclosure_status_event (
  tenant_id uuid NOT NULL,
  disclosure_status_event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  disclosure_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('generated','delivered','revoked','expired')),
  object_reference text,
  occurred_by_principal_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, disclosure_status_event_id),
  FOREIGN KEY (tenant_id, disclosure_id)
    REFERENCES safeguarding.external_disclosure (tenant_id, disclosure_id),
  CHECK ((status IN ('generated','delivered')) = (object_reference IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS safeguarding.restricted_document (
  tenant_id uuid NOT NULL,
  restricted_document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_type text NOT NULL,
  classification text NOT NULL DEFAULT 'CARE-C4' CHECK (classification = 'CARE-C4'),
  source_classification text NOT NULL DEFAULT 'CARE-C4' CHECK (source_classification = 'CARE-C4'),
  status text NOT NULL CHECK (status IN ('active','superseded','quarantined')),
  recorded_by_principal_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  supersedes_restricted_document_id uuid,
  PRIMARY KEY (tenant_id, restricted_document_id),
  FOREIGN KEY (tenant_id, case_id)
    REFERENCES safeguarding.case_file (tenant_id, case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  FOREIGN KEY (tenant_id, supersedes_restricted_document_id)
    REFERENCES safeguarding.restricted_document (tenant_id, restricted_document_id)
);

CREATE TABLE IF NOT EXISTS safeguarding.closure_review (
  tenant_id uuid NOT NULL,
  closure_review_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('close','continue-monitoring','reopen-assessment')),
  reason_category text NOT NULL,
  reviewed_by_principal_id uuid NOT NULL,
  independently_approved_by_principal_id uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, closure_review_id),
  FOREIGN KEY (tenant_id, case_id)
    REFERENCES safeguarding.case_file (tenant_id, case_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (reviewed_by_principal_id <> independently_approved_by_principal_id)
);

CREATE OR REPLACE FUNCTION safeguarding.prevent_domain_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'CARE_SAFEGUARDING_APPEND_ONLY_RECORD';
END
$function$;

DO $care_safeguarding_append_only$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'concern_intake','concern_status_event','chronology_entry','assessment','mandatory_report',
    'mandatory_report_status_event','external_disclosure','disclosure_status_event',
    'restricted_document','closure_review'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS append_only ON safeguarding.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON safeguarding.%I FOR EACH ROW EXECUTE FUNCTION safeguarding.prevent_domain_append_only_mutation()',
      table_name
    );
  END LOOP;
END
$care_safeguarding_append_only$;

CREATE OR REPLACE FUNCTION safeguarding.prevent_case_identity_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.student_person_id <> NEW.student_person_id
    OR OLD.campus_id <> NEW.campus_id
    OR OLD.lead_principal_id <> NEW.lead_principal_id
    OR OLD.opened_from_concern_id <> NEW.opened_from_concern_id
    OR OLD.opened_at <> NEW.opened_at THEN
    RAISE EXCEPTION 'CARE_SAFEGUARDING_CASE_IDENTITY_IMMUTABLE';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'CARE_SAFEGUARDING_CASE_VERSION_REQUIRED';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS case_identity_immutable ON safeguarding.case_file;
CREATE TRIGGER case_identity_immutable
  BEFORE UPDATE ON safeguarding.case_file
  FOR EACH ROW EXECUTE FUNCTION safeguarding.prevent_case_identity_rewrite();

CREATE OR REPLACE FUNCTION safeguarding.has_active_case_membership(
  requested_tenant_id uuid,
  requested_case_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM safeguarding.case_memberships membership
    WHERE membership.tenant_id = requested_tenant_id
      AND membership.case_id = requested_case_id
      AND membership.principal_id = NULLIF(current_setting('app.principal_id', true), '')::uuid
      AND membership.purpose_code = NULLIF(current_setting('app.purpose_code', true), '')
      AND membership.status = 'active'
      AND membership.effective_from <= clock_timestamp()
      AND (membership.expires_at IS NULL OR membership.expires_at > clock_timestamp())
  )
$function$;

REVOKE ALL ON FUNCTION safeguarding.has_active_case_membership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION safeguarding.has_active_case_membership(uuid, uuid) TO app_runtime;

DO $care_safeguarding_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'concern_intake','concern_status_event','case_file','chronology_entry','assessment',
    'safety_plan','mandatory_report','mandatory_report_status_event','external_disclosure',
    'disclosure_status_event','restricted_document','closure_review'
  ] LOOP
    EXECUTE format('ALTER TABLE safeguarding.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE safeguarding.%I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END
$care_safeguarding_rls$;

DROP POLICY IF EXISTS concern_intake_insert ON safeguarding.concern_intake;
CREATE POLICY concern_intake_insert ON safeguarding.concern_intake
  FOR INSERT TO app_runtime
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS concern_intake_lead_select ON safeguarding.concern_intake;
CREATE POLICY concern_intake_lead_select ON safeguarding.concern_intake
  FOR SELECT TO app_runtime
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND NULLIF(current_setting('app.persona', true), '') = 'safeguarding-lead'
    AND NULLIF(current_setting('app.assurance', true), '') = 'aal2'
    AND NULLIF(current_setting('app.purpose_code', true), '') = 'safeguarding-assessment'
  );

DROP POLICY IF EXISTS concern_status_lead ON safeguarding.concern_status_event;
CREATE POLICY concern_status_lead ON safeguarding.concern_status_event
  FOR ALL TO app_runtime
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND NULLIF(current_setting('app.persona', true), '') = 'safeguarding-lead'
    AND NULLIF(current_setting('app.assurance', true), '') = 'aal2'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND NULLIF(current_setting('app.persona', true), '') = 'safeguarding-lead'
    AND NULLIF(current_setting('app.assurance', true), '') = 'aal2'
  );

DROP POLICY IF EXISTS case_file_member_select ON safeguarding.case_file;
CREATE POLICY case_file_member_select ON safeguarding.case_file
  FOR SELECT TO app_runtime
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND safeguarding.has_active_case_membership(tenant_id, case_id)
  );

DROP POLICY IF EXISTS case_file_bootstrap_insert ON safeguarding.case_file;
CREATE POLICY case_file_bootstrap_insert ON safeguarding.case_file
  FOR INSERT TO app_runtime
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND NULLIF(current_setting('app.persona', true), '') = 'safeguarding-lead'
    AND NULLIF(current_setting('app.assurance', true), '') = 'aal2'
    AND NULLIF(current_setting('app.permission', true), '') = 'care.safeguarding.case.open'
  );

DROP POLICY IF EXISTS case_file_member_update ON safeguarding.case_file;
CREATE POLICY case_file_member_update ON safeguarding.case_file
  FOR UPDATE TO app_runtime
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND safeguarding.has_active_case_membership(tenant_id, case_id)
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND safeguarding.has_active_case_membership(tenant_id, case_id)
  );

DO $care_safeguarding_case_policies$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'chronology_entry','assessment','safety_plan','mandatory_report',
    'external_disclosure','restricted_document','closure_review'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS case_membership_policy ON safeguarding.%I', table_name);
    EXECUTE format(
      'CREATE POLICY case_membership_policy ON safeguarding.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid AND safeguarding.has_active_case_membership(tenant_id, case_id)) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid AND safeguarding.has_active_case_membership(tenant_id, case_id))',
      table_name
    );
  END LOOP;
END
$care_safeguarding_case_policies$;

DROP POLICY IF EXISTS mandatory_report_status_membership ON safeguarding.mandatory_report_status_event;
CREATE POLICY mandatory_report_status_membership ON safeguarding.mandatory_report_status_event
  FOR ALL TO app_runtime
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM safeguarding.mandatory_report report
      WHERE report.tenant_id = mandatory_report_status_event.tenant_id
        AND report.mandatory_report_id = mandatory_report_status_event.mandatory_report_id
        AND safeguarding.has_active_case_membership(report.tenant_id, report.case_id)
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM safeguarding.mandatory_report report
      WHERE report.tenant_id = mandatory_report_status_event.tenant_id
        AND report.mandatory_report_id = mandatory_report_status_event.mandatory_report_id
        AND safeguarding.has_active_case_membership(report.tenant_id, report.case_id)
    )
  );

DROP POLICY IF EXISTS disclosure_status_membership ON safeguarding.disclosure_status_event;
CREATE POLICY disclosure_status_membership ON safeguarding.disclosure_status_event
  FOR ALL TO app_runtime
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM safeguarding.external_disclosure disclosure
      WHERE disclosure.tenant_id = disclosure_status_event.tenant_id
        AND disclosure.disclosure_id = disclosure_status_event.disclosure_id
        AND safeguarding.has_active_case_membership(disclosure.tenant_id, disclosure.case_id)
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM safeguarding.external_disclosure disclosure
      WHERE disclosure.tenant_id = disclosure_status_event.tenant_id
        AND disclosure.disclosure_id = disclosure_status_event.disclosure_id
        AND safeguarding.has_active_case_membership(disclosure.tenant_id, disclosure.case_id)
    )
  );

GRANT SELECT, INSERT ON safeguarding.concern_intake TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.concern_status_event TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON safeguarding.case_file TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.chronology_entry TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.assessment TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON safeguarding.safety_plan TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.mandatory_report TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.mandatory_report_status_event TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.external_disclosure TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.disclosure_status_event TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.restricted_document TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.closure_review TO app_runtime;

CREATE OR REPLACE VIEW safeguarding.operational_quarterly_counts_v
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  campus_id,
  date_trunc('quarter', opened_at) AS opened_quarter,
  risk_band,
  status,
  count(*)::bigint AS case_count
FROM safeguarding.case_file
GROUP BY tenant_id, campus_id, date_trunc('quarter', opened_at), risk_band, status
HAVING count(*) >= 10;

GRANT SELECT ON safeguarding.operational_quarterly_counts_v TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607290205_CARE-01_safeguarding_domain',
  'CARE-01',
  'Write-only concern intake, existence-masked safeguarding cases, chronology, assessment, safety plans and exact disclosures'
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
