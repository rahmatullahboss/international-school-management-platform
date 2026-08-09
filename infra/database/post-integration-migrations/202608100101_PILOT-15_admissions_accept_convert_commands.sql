INSERT INTO iam.permission (permission_key, description, required_assurance)
VALUES
  ('admissions.application.offer.accept', 'Record acceptance of a valid admissions offer', 'aal1'),
  ('admissions.application.applicant.convert', 'Convert an accepted applicant into an active student enrollment', 'aal1')
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description,
    required_assurance = EXCLUDED.required_assurance;

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
SELECT role_permission.tenant_id, role_permission.role_id, permission.permission_key
FROM iam.role_permission AS role_permission
JOIN iam.role AS role
  ON role.tenant_id = role_permission.tenant_id
 AND role.role_id = role_permission.role_id
CROSS JOIN (
  VALUES
    ('admissions.application.offer.accept'::text),
    ('admissions.application.applicant.convert'::text)
) AS permission(permission_key)
WHERE role_permission.permission_key = 'admissions.application.offer.issue'
  AND role.role_key = 'admissions'
ON CONFLICT DO NOTHING;

ALTER TABLE platform.operator_domain_command_receipt
  DROP CONSTRAINT IF EXISTS operator_domain_command_receipt_command_type_check;
ALTER TABLE platform.operator_domain_command_receipt
  ADD CONSTRAINT operator_domain_command_receipt_command_type_check CHECK (
    command_type IN (
      'admissions.application.review.record',
      'admissions.application.offer.issue',
      'admissions.application.offer.accept',
      'admissions.application.applicant.convert',
      'finance.bank-line.reconcile',
      'support.break-glass.request'
    )
  );

CREATE OR REPLACE FUNCTION admissions.accept_application_offer_command(
  p_session_id uuid,
  p_application_id uuid,
  p_expected_version bigint,
  p_idempotency_key text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, tenancy, admissions, audit, integration_core
AS $function$
DECLARE
  session_context record;
  permission_decision jsonb;
  selected_application_version bigint;
  selected_application_status text;
  selected_offer_id uuid;
  selected_offer_campus_id uuid;
  selected_offer_status text;
  selected_offer_expires_at timestamptz;
  selected_request_hash text;
  existing_request_hash text;
  existing_receipt jsonb;
  selected_command_id uuid := gen_random_uuid();
  selected_accepted_at timestamptz := clock_timestamp();
  selected_receipt jsonb;
  resulting_version bigint;
  changed_offer boolean := false;
BEGIN
  IF p_session_id IS NULL
     OR p_application_id IS NULL
     OR p_expected_version IS NULL
     OR p_expected_version < 1
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_correlation_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'invalid-command');
  END IF;

  SELECT * INTO session_context
  FROM platform.resolve_operator_domain_command_session(p_session_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'session-inactive');
  END IF;

  permission_decision := iam.evaluate_browser_permission(
    p_session_id,
    'admissions.application.offer.accept'
  );
  IF permission_decision->>'reason' = 'session-inactive' THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'session-inactive');
  END IF;
  IF permission_decision->>'reason' = 'step-up-required' THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'step-up-required',
      'requiredAssurance', 'aal2'
    );
  END IF;
  IF COALESCE((permission_decision->>'allowed')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'permission-not-granted');
  END IF;
  IF session_context.campus_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;

  selected_request_hash := encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'command', 'admissions.application.offer.accept',
          'applicationId', p_application_id,
          'expectedVersion', p_expected_version
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      session_context.tenant_id::text || '|' ||
      session_context.membership_id::text || '|' ||
      session_context.campus_id::text || '|admissions.application.offer.accept|' ||
      p_idempotency_key,
      0
    )
  );

  SELECT receipt.request_hash, receipt.response_body
  INTO existing_request_hash, existing_receipt
  FROM platform.operator_domain_command_receipt AS receipt
  WHERE receipt.tenant_id = session_context.tenant_id
    AND receipt.membership_id = session_context.membership_id
    AND receipt.campus_id = session_context.campus_id
    AND receipt.command_type = 'admissions.application.offer.accept'
    AND receipt.idempotency_key = p_idempotency_key
  FOR SHARE OF receipt;

  IF existing_request_hash IS NOT NULL THEN
    IF existing_request_hash <> selected_request_hash THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
    END IF;
    RETURN jsonb_build_object(
      'accepted', true,
      'replayed', true,
      'receipt', existing_receipt
    );
  END IF;

  SELECT application.version, application.status
  INTO selected_application_version, selected_application_status
  FROM admissions.application AS application
  WHERE application.tenant_id = session_context.tenant_id
    AND application.application_id = p_application_id
  FOR UPDATE OF application;

  IF selected_application_version IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;

  SELECT offer.offer_id, offer.campus_id, offer.status, offer.expires_at
  INTO selected_offer_id, selected_offer_campus_id, selected_offer_status, selected_offer_expires_at
  FROM admissions.offer AS offer
  WHERE offer.tenant_id = session_context.tenant_id
    AND offer.application_id = p_application_id
  FOR UPDATE OF offer;

  IF selected_offer_id IS NULL
     OR selected_offer_campus_id IS DISTINCT FROM session_context.campus_id THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;
  IF selected_application_version <> p_expected_version THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'revision-conflict',
      'currentVersion', selected_application_version
    );
  END IF;

  IF selected_offer_status = 'accepted' AND selected_application_status = 'accepted' THEN
    resulting_version := selected_application_version;
  ELSE
    IF selected_application_status <> 'offered'
       OR selected_offer_status <> 'issued'
       OR selected_offer_expires_at < selected_accepted_at THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
    END IF;
    IF EXISTS (
      SELECT 1
      FROM admissions.application_checklist_item AS checklist
      WHERE checklist.tenant_id = session_context.tenant_id
        AND checklist.application_id = p_application_id
        AND checklist.required
        AND checklist.status NOT IN ('verified', 'waived')
    ) THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
    END IF;
    IF EXISTS (
      SELECT 1
      FROM admissions.enrollment_contract AS contract
      WHERE contract.tenant_id = session_context.tenant_id
        AND contract.application_id = p_application_id
        AND contract.status <> 'signed'
    ) THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
    END IF;

    UPDATE admissions.offer
    SET status = 'accepted',
        accepted_at = selected_accepted_at
    WHERE tenant_id = session_context.tenant_id
      AND offer_id = selected_offer_id;

    UPDATE admissions.application
    SET status = 'accepted',
        version = version + 1,
        updated_at = selected_accepted_at
    WHERE tenant_id = session_context.tenant_id
      AND application_id = p_application_id
      AND version = p_expected_version;

    resulting_version := p_expected_version + 1;
    changed_offer := true;
  END IF;

  selected_receipt := jsonb_build_object(
    'commandId', selected_command_id,
    'command', 'admissions.application.offer.accept',
    'domainEvidenceId', selected_offer_id,
    'idempotencyKey', p_idempotency_key,
    'correlationId', p_correlation_id,
    'acceptedAt', to_char(
      selected_accepted_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );

  INSERT INTO platform.operator_domain_command_receipt (
    command_id, tenant_id, membership_id, campus_id, session_id, actor_account_id,
    command_type, idempotency_key, request_hash, domain_evidence_id,
    response_body, correlation_id, accepted_at
  ) VALUES (
    selected_command_id, session_context.tenant_id, session_context.membership_id,
    session_context.campus_id, p_session_id, session_context.account_id,
    'admissions.application.offer.accept', p_idempotency_key, selected_request_hash,
    selected_offer_id, selected_receipt, p_correlation_id, selected_accepted_at
  );

  INSERT INTO audit.audit_event (
    tenant_id, actor_account_id, action, subject_type, subject_id,
    correlation_id, metadata, occurred_at
  ) VALUES (
    session_context.tenant_id,
    session_context.account_id,
    'admissions.application.offer.accepted',
    'admissions_application',
    p_application_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'commandId', selected_command_id,
      'offerId', selected_offer_id,
      'campusId', session_context.campus_id,
      'applicationVersion', resulting_version,
      'changedOffer', changed_offer
    ),
    selected_accepted_at
  );

  IF changed_offer THEN
    INSERT INTO integration_core.outbox_event (
      tenant_id, event_type, schema_version, aggregate_type, aggregate_id,
      aggregate_version, correlation_id, causation_id, payload,
      occurred_at, available_at
    ) VALUES (
      session_context.tenant_id,
      'sis.admissions.offer-accepted.v1',
      1,
      'application',
      p_application_id::text,
      resulting_version,
      p_correlation_id::text,
      selected_command_id::text,
      jsonb_build_object(
        'applicationId', p_application_id,
        'offerId', selected_offer_id
      ),
      selected_accepted_at,
      selected_accepted_at
    );
  END IF;

  RETURN jsonb_build_object(
    'accepted', true,
    'replayed', false,
    'receipt', selected_receipt
  );
END
$function$;

CREATE OR REPLACE FUNCTION admissions.convert_accepted_applicant_command(
  p_session_id uuid,
  p_application_id uuid,
  p_expected_version bigint,
  p_effective_from date,
  p_idempotency_key text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, tenancy, admissions, student_lifecycle, audit, integration_core
AS $function$
DECLARE
  session_context record;
  permission_decision jsonb;
  selected_application_version bigint;
  selected_application_status text;
  selected_application_created_at timestamptz;
  selected_applicant_person_id uuid;
  selected_offer_id uuid;
  selected_offer_campus_id uuid;
  selected_offer_program_id uuid;
  selected_offer_academic_year_id uuid;
  selected_offer_grade_level_id uuid;
  selected_offer_status text;
  selected_request_hash text;
  existing_request_hash text;
  existing_receipt jsonb;
  selected_conversion_id uuid;
  selected_conversion_profile_id uuid;
  selected_conversion_enrollment_id uuid;
  selected_conversion_mapping jsonb;
  selected_conversion_effective_from date;
  canonical_field_mapping jsonb := jsonb_build_object(
    'applicantPersonId', 'studentProfile.personId',
    'offer', 'enrollment.placement'
  );
  selected_profile_id uuid;
  selected_profile_status text;
  selected_current_profile_status_from date;
  selected_enrollment_id uuid;
  selected_command_id uuid := gen_random_uuid();
  selected_accepted_at timestamptz := clock_timestamp();
  selected_receipt jsonb;
  resulting_version bigint;
  profile_created boolean := false;
  profile_activated boolean := false;
BEGIN
  IF p_session_id IS NULL
     OR p_application_id IS NULL
     OR p_expected_version IS NULL
     OR p_expected_version < 1
     OR p_effective_from IS NULL
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_correlation_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'invalid-command');
  END IF;

  SELECT * INTO session_context
  FROM platform.resolve_operator_domain_command_session(p_session_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'session-inactive');
  END IF;

  permission_decision := iam.evaluate_browser_permission(
    p_session_id,
    'admissions.application.applicant.convert'
  );
  IF permission_decision->>'reason' = 'session-inactive' THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'session-inactive');
  END IF;
  IF permission_decision->>'reason' = 'step-up-required' THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'step-up-required',
      'requiredAssurance', 'aal2'
    );
  END IF;
  IF COALESCE((permission_decision->>'allowed')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'permission-not-granted');
  END IF;
  IF session_context.campus_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;

  selected_request_hash := encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'command', 'admissions.application.applicant.convert',
          'applicationId', p_application_id,
          'expectedVersion', p_expected_version,
          'effectiveFrom', p_effective_from
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      session_context.tenant_id::text || '|' ||
      session_context.membership_id::text || '|' ||
      session_context.campus_id::text || '|admissions.application.applicant.convert|' ||
      p_idempotency_key,
      0
    )
  );

  SELECT receipt.request_hash, receipt.response_body
  INTO existing_request_hash, existing_receipt
  FROM platform.operator_domain_command_receipt AS receipt
  WHERE receipt.tenant_id = session_context.tenant_id
    AND receipt.membership_id = session_context.membership_id
    AND receipt.campus_id = session_context.campus_id
    AND receipt.command_type = 'admissions.application.applicant.convert'
    AND receipt.idempotency_key = p_idempotency_key
  FOR SHARE OF receipt;

  IF existing_request_hash IS NOT NULL THEN
    IF existing_request_hash <> selected_request_hash THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
    END IF;
    RETURN jsonb_build_object(
      'accepted', true,
      'replayed', true,
      'receipt', existing_receipt
    );
  END IF;

  SELECT
    application.version,
    application.status,
    application.created_at,
    application.applicant_person_id
  INTO
    selected_application_version,
    selected_application_status,
    selected_application_created_at,
    selected_applicant_person_id
  FROM admissions.application AS application
  WHERE application.tenant_id = session_context.tenant_id
    AND application.application_id = p_application_id
  FOR UPDATE OF application;

  IF selected_application_version IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;

  SELECT
    offer.offer_id,
    offer.campus_id,
    offer.program_id,
    offer.academic_year_id,
    offer.grade_level_id,
    offer.status
  INTO
    selected_offer_id,
    selected_offer_campus_id,
    selected_offer_program_id,
    selected_offer_academic_year_id,
    selected_offer_grade_level_id,
    selected_offer_status
  FROM admissions.offer AS offer
  WHERE offer.tenant_id = session_context.tenant_id
    AND offer.application_id = p_application_id
  FOR UPDATE OF offer;

  IF selected_offer_id IS NULL
     OR selected_offer_campus_id IS DISTINCT FROM session_context.campus_id THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;
  IF selected_application_version <> p_expected_version THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'revision-conflict',
      'currentVersion', selected_application_version
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM admissions.applicant_conversion AS conversion
    WHERE conversion.tenant_id = session_context.tenant_id
      AND conversion.idempotency_key = p_idempotency_key
      AND conversion.application_id <> p_application_id
  ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
  END IF;

  SELECT
    conversion.conversion_id,
    conversion.student_profile_id,
    conversion.enrollment_id,
    conversion.field_mapping,
    enrollment.effective_from
  INTO
    selected_conversion_id,
    selected_conversion_profile_id,
    selected_conversion_enrollment_id,
    selected_conversion_mapping,
    selected_conversion_effective_from
  FROM admissions.applicant_conversion AS conversion
  JOIN student_lifecycle.enrollment AS enrollment
    ON enrollment.tenant_id = conversion.tenant_id
   AND enrollment.enrollment_id = conversion.enrollment_id
  WHERE conversion.tenant_id = session_context.tenant_id
    AND conversion.application_id = p_application_id
  FOR SHARE OF conversion, enrollment;

  IF selected_conversion_id IS NOT NULL THEN
    IF selected_application_status <> 'converted'
       OR selected_conversion_effective_from IS DISTINCT FROM p_effective_from
       OR selected_conversion_mapping IS DISTINCT FROM canonical_field_mapping THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
    END IF;
    selected_receipt := jsonb_build_object(
      'commandId', selected_command_id,
      'command', 'admissions.application.applicant.convert',
      'domainEvidenceId', selected_conversion_id,
      'idempotencyKey', p_idempotency_key,
      'correlationId', p_correlation_id,
      'acceptedAt', to_char(
        selected_accepted_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    );
    INSERT INTO platform.operator_domain_command_receipt (
      command_id, tenant_id, membership_id, campus_id, session_id, actor_account_id,
      command_type, idempotency_key, request_hash, domain_evidence_id,
      response_body, correlation_id, accepted_at
    ) VALUES (
      selected_command_id, session_context.tenant_id, session_context.membership_id,
      session_context.campus_id, p_session_id, session_context.account_id,
      'admissions.application.applicant.convert', p_idempotency_key, selected_request_hash,
      selected_conversion_id, selected_receipt, p_correlation_id, selected_accepted_at
    );
    RETURN jsonb_build_object(
      'accepted', true,
      'replayed', false,
      'receipt', selected_receipt
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM admissions.applicant_conversion AS conversion
    WHERE conversion.tenant_id = session_context.tenant_id
      AND conversion.idempotency_key = p_idempotency_key
      AND conversion.application_id <> p_application_id
  ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM student_lifecycle.enrollment AS enrollment
    WHERE enrollment.tenant_id = session_context.tenant_id
      AND enrollment.idempotency_key = p_idempotency_key || ':enrollment'
  ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
  END IF;

  IF selected_application_status <> 'accepted' OR selected_offer_status <> 'accepted' THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;
  IF p_effective_from <= selected_application_created_at::date THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;

  SELECT profile.student_profile_id, profile.status
  INTO selected_profile_id, selected_profile_status
  FROM student_lifecycle.student_profile AS profile
  WHERE profile.tenant_id = session_context.tenant_id
    AND profile.person_id = selected_applicant_person_id
  FOR UPDATE OF profile;

  IF selected_profile_id IS NOT NULL AND selected_profile_status <> 'active' THEN
    SELECT history.effective_from
    INTO selected_current_profile_status_from
    FROM student_lifecycle.student_status_history AS history
    WHERE history.tenant_id = session_context.tenant_id
      AND history.student_profile_id = selected_profile_id
      AND history.effective_to IS NULL
    FOR UPDATE OF history;

    IF selected_current_profile_status_from IS NULL
       OR p_effective_from <= selected_current_profile_status_from THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
    END IF;
  END IF;

  IF selected_profile_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM student_lifecycle.enrollment AS enrollment
    WHERE enrollment.tenant_id = session_context.tenant_id
      AND enrollment.student_profile_id = selected_profile_id
      AND enrollment.program_id = selected_offer_program_id
      AND enrollment.academic_year_id = selected_offer_academic_year_id
      AND enrollment.effective_to IS NULL
      AND enrollment.status IN ('pending', 'active')
  ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;

  IF selected_profile_id IS NULL THEN
    selected_profile_id := gen_random_uuid();
    INSERT INTO student_lifecycle.student_profile (
      tenant_id, student_profile_id, person_id, status, version, created_at, updated_at
    ) VALUES (
      session_context.tenant_id,
      selected_profile_id,
      selected_applicant_person_id,
      'prospective',
      1,
      selected_accepted_at,
      selected_accepted_at
    );
    INSERT INTO student_lifecycle.student_status_history (
      tenant_id, status_history_id, student_profile_id, status,
      reason_code, effective_from, recorded_at
    ) VALUES (
      session_context.tenant_id,
      gen_random_uuid(),
      selected_profile_id,
      'prospective',
      'profile-created',
      selected_application_created_at::date,
      selected_accepted_at
    );
    selected_profile_status := 'prospective';
    selected_current_profile_status_from := selected_application_created_at::date;
    profile_created := true;
  END IF;

  IF selected_profile_status <> 'active' THEN
    UPDATE student_lifecycle.student_status_history
    SET effective_to = p_effective_from
    WHERE tenant_id = session_context.tenant_id
      AND student_profile_id = selected_profile_id
      AND effective_to IS NULL;

    INSERT INTO student_lifecycle.student_status_history (
      tenant_id, status_history_id, student_profile_id, status,
      reason_code, effective_from, recorded_at
    ) VALUES (
      session_context.tenant_id,
      gen_random_uuid(),
      selected_profile_id,
      'active',
      'admissions-conversion',
      p_effective_from,
      selected_accepted_at
    );

    UPDATE student_lifecycle.student_profile
    SET status = 'active',
        version = version + 1,
        updated_at = selected_accepted_at
    WHERE tenant_id = session_context.tenant_id
      AND student_profile_id = selected_profile_id;
    profile_activated := true;
  END IF;

  selected_enrollment_id := gen_random_uuid();
  INSERT INTO student_lifecycle.enrollment (
    tenant_id, enrollment_id, student_profile_id, campus_id, program_id,
    academic_year_id, grade_level_id, status, effective_from, source_application_id,
    idempotency_key, version, created_at, updated_at
  ) VALUES (
    session_context.tenant_id,
    selected_enrollment_id,
    selected_profile_id,
    selected_offer_campus_id,
    selected_offer_program_id,
    selected_offer_academic_year_id,
    selected_offer_grade_level_id,
    'active',
    p_effective_from,
    p_application_id,
    p_idempotency_key || ':enrollment',
    1,
    selected_accepted_at,
    selected_accepted_at
  );

  INSERT INTO student_lifecycle.enrollment_status_history (
    tenant_id, status_history_id, enrollment_id, status,
    effective_from, reason_code, recorded_at
  ) VALUES (
    session_context.tenant_id,
    gen_random_uuid(),
    selected_enrollment_id,
    'active',
    p_effective_from,
    'admissions-conversion',
    selected_accepted_at
  );

  INSERT INTO student_lifecycle.placement_history (
    tenant_id, placement_history_id, enrollment_id, campus_id, program_id,
    academic_year_id, grade_level_id, effective_from, reason_code, created_at
  ) VALUES (
    session_context.tenant_id,
    gen_random_uuid(),
    selected_enrollment_id,
    selected_offer_campus_id,
    selected_offer_program_id,
    selected_offer_academic_year_id,
    selected_offer_grade_level_id,
    p_effective_from,
    'enrollment-created',
    selected_accepted_at
  );

  INSERT INTO student_lifecycle.admission_history (
    tenant_id, admission_history_id, student_profile_id, application_id,
    admitted_at, admission_type, created_at
  ) VALUES (
    session_context.tenant_id,
    gen_random_uuid(),
    selected_profile_id,
    p_application_id,
    p_effective_from,
    'new',
    selected_accepted_at
  );

  selected_conversion_id := gen_random_uuid();
  INSERT INTO admissions.applicant_conversion (
    tenant_id, conversion_id, application_id, idempotency_key,
    student_profile_id, enrollment_id, field_mapping,
    converted_by_account_id, converted_at
  ) VALUES (
    session_context.tenant_id,
    selected_conversion_id,
    p_application_id,
    p_idempotency_key,
    selected_profile_id,
    selected_enrollment_id,
    canonical_field_mapping,
    session_context.account_id,
    selected_accepted_at
  );

  UPDATE admissions.application
  SET status = 'converted',
      version = version + 1,
      updated_at = selected_accepted_at
  WHERE tenant_id = session_context.tenant_id
    AND application_id = p_application_id
    AND version = p_expected_version;
  resulting_version := p_expected_version + 1;

  selected_receipt := jsonb_build_object(
    'commandId', selected_command_id,
    'command', 'admissions.application.applicant.convert',
    'domainEvidenceId', selected_conversion_id,
    'idempotencyKey', p_idempotency_key,
    'correlationId', p_correlation_id,
    'acceptedAt', to_char(
      selected_accepted_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );

  INSERT INTO platform.operator_domain_command_receipt (
    command_id, tenant_id, membership_id, campus_id, session_id, actor_account_id,
    command_type, idempotency_key, request_hash, domain_evidence_id,
    response_body, correlation_id, accepted_at
  ) VALUES (
    selected_command_id, session_context.tenant_id, session_context.membership_id,
    session_context.campus_id, p_session_id, session_context.account_id,
    'admissions.application.applicant.convert', p_idempotency_key, selected_request_hash,
    selected_conversion_id, selected_receipt, p_correlation_id, selected_accepted_at
  );

  INSERT INTO audit.audit_event (
    tenant_id, actor_account_id, action, subject_type, subject_id,
    correlation_id, metadata, occurred_at
  ) VALUES (
    session_context.tenant_id,
    session_context.account_id,
    'admissions.application.applicant.converted',
    'admissions_application',
    p_application_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'commandId', selected_command_id,
      'conversionId', selected_conversion_id,
      'studentProfileId', selected_profile_id,
      'enrollmentId', selected_enrollment_id,
      'campusId', selected_offer_campus_id,
      'applicationVersion', resulting_version,
      'profileCreated', profile_created,
      'profileActivated', profile_activated
    ),
    selected_accepted_at
  );

  IF profile_created THEN
    INSERT INTO integration_core.outbox_event (
      tenant_id, event_type, schema_version, aggregate_type, aggregate_id,
      aggregate_version, correlation_id, causation_id, payload,
      occurred_at, available_at
    ) VALUES (
      session_context.tenant_id,
      'sis.lifecycle.student-profile-created.v1',
      1,
      'student-profile',
      selected_profile_id::text,
      1,
      p_correlation_id::text,
      selected_command_id::text,
      jsonb_build_object(
        'studentProfileId', selected_profile_id,
        'personId', selected_applicant_person_id
      ),
      selected_accepted_at,
      selected_accepted_at
    );
  END IF;

  INSERT INTO integration_core.outbox_event (
    tenant_id, event_type, schema_version, aggregate_type, aggregate_id,
    aggregate_version, correlation_id, causation_id, payload,
    occurred_at, available_at
  ) VALUES
  (
    session_context.tenant_id,
    'sis.lifecycle.enrollment-created.v1',
    1,
    'enrollment',
    selected_enrollment_id::text,
    1,
    p_correlation_id::text,
    selected_command_id::text,
    jsonb_build_object(
      'enrollmentId', selected_enrollment_id,
      'studentProfileId', selected_profile_id,
      'campusId', selected_offer_campus_id,
      'programId', selected_offer_program_id
    ),
    selected_accepted_at,
    selected_accepted_at
  ),
  (
    session_context.tenant_id,
    'sis.admissions.applicant-converted.v1',
    1,
    'application',
    p_application_id::text,
    resulting_version,
    p_correlation_id::text,
    selected_command_id::text,
    jsonb_build_object(
      'applicationId', p_application_id,
      'studentProfileId', selected_profile_id,
      'enrollmentId', selected_enrollment_id
    ),
    selected_accepted_at,
    selected_accepted_at
  );

  RETURN jsonb_build_object(
    'accepted', true,
    'replayed', false,
    'receipt', selected_receipt
  );
END
$function$;

REVOKE ALL ON FUNCTION admissions.accept_application_offer_command(
  uuid, uuid, bigint, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admissions.accept_application_offer_command(
  uuid, uuid, bigint, text, uuid
) TO app_runtime;

REVOKE ALL ON FUNCTION admissions.convert_accepted_applicant_command(
  uuid, uuid, bigint, date, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admissions.convert_accepted_applicant_command(
  uuid, uuid, bigint, date, text, uuid
) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608100101_PILOT-15_admissions_accept_convert_commands',
  'PILOT-15',
  'Database-owned Admissions offer acceptance and accepted-applicant conversion with canonical student lifecycle records'
)
ON CONFLICT (migration_id) DO NOTHING;
