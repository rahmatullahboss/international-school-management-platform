CREATE SCHEMA IF NOT EXISTS admissions;
GRANT USAGE ON SCHEMA admissions TO app_runtime;

CREATE TABLE IF NOT EXISTS admissions.admissions_cycle (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  cycle_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, cycle_id),
  CHECK (closes_at > opens_at)
);

CREATE TABLE IF NOT EXISTS admissions.enquiry (
  tenant_id uuid NOT NULL,
  enquiry_id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_person_id uuid NOT NULL,
  prospective_student_person_id uuid,
  cycle_id uuid,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, enquiry_id),
  FOREIGN KEY (tenant_id, contact_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, prospective_student_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, cycle_id) REFERENCES admissions.admissions_cycle (tenant_id, cycle_id)
);

CREATE TABLE IF NOT EXISTS admissions.applicant (
  tenant_id uuid NOT NULL,
  applicant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, applicant_id),
  UNIQUE (tenant_id, person_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS admissions.application_form_version (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  form_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  form_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  schema jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, form_version_id),
  UNIQUE (tenant_id, form_key, version)
);

CREATE TABLE IF NOT EXISTS admissions.application (
  tenant_id uuid NOT NULL,
  application_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_number citext NOT NULL,
  cycle_id uuid NOT NULL,
  applicant_person_id uuid NOT NULL,
  submitting_guardian_person_id uuid NOT NULL,
  form_version_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'under-review', 'waitlisted', 'offered', 'accepted', 'declined', 'withdrawn', 'converted')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, application_id),
  UNIQUE (tenant_id, application_number),
  FOREIGN KEY (tenant_id, cycle_id) REFERENCES admissions.admissions_cycle (tenant_id, cycle_id),
  FOREIGN KEY (tenant_id, applicant_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, submitting_guardian_person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, form_version_id) REFERENCES admissions.application_form_version (tenant_id, form_version_id)
);

CREATE TABLE IF NOT EXISTS admissions.application_program_choice (
  tenant_id uuid NOT NULL,
  program_choice_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  program_id uuid NOT NULL,
  preference_rank integer NOT NULL CHECK (preference_rank > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, program_choice_id),
  UNIQUE (tenant_id, application_id, preference_rank),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admissions.application_response (
  tenant_id uuid NOT NULL,
  response_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  response_version integer NOT NULL CHECK (response_version > 0),
  answers jsonb NOT NULL,
  submitted boolean NOT NULL DEFAULT false,
  supersedes_response_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, response_version_id),
  UNIQUE (tenant_id, application_id, response_version),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, supersedes_response_version_id) REFERENCES admissions.application_response (tenant_id, response_version_id)
);

CREATE OR REPLACE FUNCTION admissions.prevent_submitted_response_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.submitted THEN
    RAISE EXCEPTION 'submitted application responses are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS application_response_immutable ON admissions.application_response;
CREATE TRIGGER application_response_immutable
  BEFORE UPDATE OR DELETE ON admissions.application_response
  FOR EACH ROW EXECUTE FUNCTION admissions.prevent_submitted_response_mutation();

CREATE TABLE IF NOT EXISTS admissions.application_document_requirement (
  tenant_id uuid NOT NULL,
  requirement_id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  requirement_key text NOT NULL,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tenant_id, requirement_id),
  UNIQUE (tenant_id, cycle_id, requirement_key),
  FOREIGN KEY (tenant_id, cycle_id) REFERENCES admissions.admissions_cycle (tenant_id, cycle_id)
);

CREATE TABLE IF NOT EXISTS admissions.application_document (
  tenant_id uuid NOT NULL,
  application_document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  requirement_key text NOT NULL,
  document_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'verified', 'rejected', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, application_document_id),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES integration_core.document_object (tenant_id, document_id)
);

CREATE TABLE IF NOT EXISTS admissions.application_checklist_item (
  tenant_id uuid NOT NULL,
  checklist_item_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  requirement_key text NOT NULL,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'verified', 'waived', 'rejected')),
  document_id uuid,
  verified_at timestamptz,
  PRIMARY KEY (tenant_id, checklist_item_id),
  UNIQUE (tenant_id, application_id, requirement_key),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES integration_core.document_object (tenant_id, document_id)
);

CREATE TABLE IF NOT EXISTS admissions.application_review (
  tenant_id uuid NOT NULL,
  review_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  reviewer_account_id uuid NOT NULL,
  recommendation text NOT NULL CHECK (recommendation IN ('admit', 'waitlist', 'decline', 'more-information')),
  score numeric(7,2),
  notes text,
  confidential boolean NOT NULL DEFAULT true,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, review_id),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id)
);

CREATE TABLE IF NOT EXISTS admissions.interview_event (
  tenant_id uuid NOT NULL,
  interview_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  campus_id uuid,
  interviewer_account_ids jsonb NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
  outcome text,
  PRIMARY KEY (tenant_id, interview_id),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE TABLE IF NOT EXISTS admissions.reference_request (
  tenant_id uuid NOT NULL,
  reference_request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  recipient_contact text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received', 'expired', 'cancelled')),
  confidential boolean NOT NULL DEFAULT true,
  response_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, reference_request_id),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id),
  FOREIGN KEY (tenant_id, response_document_id) REFERENCES integration_core.document_object (tenant_id, document_id)
);

CREATE TABLE IF NOT EXISTS admissions.admissions_decision (
  tenant_id uuid NOT NULL,
  decision_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('admit', 'waitlist', 'decline')),
  reason_code text NOT NULL,
  decided_by_account_id uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, decision_id),
  UNIQUE (tenant_id, application_id),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id)
);

CREATE TABLE IF NOT EXISTS admissions.offer (
  tenant_id uuid NOT NULL,
  offer_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  program_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  grade_level_id uuid,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'accepted', 'declined', 'expired', 'withdrawn')),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, offer_id),
  UNIQUE (tenant_id, application_id),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE TABLE IF NOT EXISTS admissions.enrollment_contract (
  tenant_id uuid NOT NULL,
  contract_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  template_version text NOT NULL,
  document_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'signed', 'void')),
  signed_at timestamptz,
  PRIMARY KEY (tenant_id, contract_id),
  UNIQUE (tenant_id, application_id),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES integration_core.document_object (tenant_id, document_id)
);

CREATE TABLE IF NOT EXISTS admissions.application_payment_reference (
  tenant_id uuid NOT NULL,
  payment_reference_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('application-fee', 'deposit')),
  external_billing_reference text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'waived', 'refunded')),
  amount_minor bigint,
  currency char(3),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, payment_reference_id),
  UNIQUE (tenant_id, application_id, payment_type),
  UNIQUE (tenant_id, external_billing_reference),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id),
  CHECK (amount_minor IS NULL OR amount_minor >= 0)
);

CREATE TABLE IF NOT EXISTS admissions.applicant_conversion (
  tenant_id uuid NOT NULL,
  conversion_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  student_profile_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  converted_by_account_id uuid NOT NULL,
  converted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, conversion_id),
  UNIQUE (tenant_id, application_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, application_id) REFERENCES admissions.application (tenant_id, application_id),
  FOREIGN KEY (tenant_id, student_profile_id) REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id)
);

DO $sis_admissions_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admissions_cycle', 'enquiry', 'applicant', 'application_form_version', 'application',
    'application_program_choice', 'application_response', 'application_document_requirement',
    'application_document', 'application_checklist_item', 'application_review', 'interview_event',
    'reference_request', 'admissions_decision', 'offer', 'enrollment_contract',
    'application_payment_reference', 'applicant_conversion'
  ]
  LOOP
    EXECUTE format('ALTER TABLE admissions.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE admissions.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON admissions.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON admissions.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON admissions.%I TO app_runtime', table_name);
  END LOOP;
END
$sis_admissions_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280103_SIS-01_admissions',
  'SIS-01',
  'Admissions enquiries, immutable applications, reviews, decisions, offers, contracts and conversion'
)
ON CONFLICT (migration_id) DO NOTHING;
