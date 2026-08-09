INSERT INTO iam.permission (permission_key, description, required_assurance)
VALUES ('admissions.application.offer.issue', 'Issue an admissions offer for a reviewed application', 'aal1')
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description,
    required_assurance = EXCLUDED.required_assurance;

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
SELECT role_permission.tenant_id, role_permission.role_id, 'admissions.application.offer.issue'
FROM iam.role_permission AS role_permission
JOIN iam.role AS role
  ON role.tenant_id = role_permission.tenant_id
 AND role.role_id = role_permission.role_id
WHERE role_permission.permission_key = 'admissions.application.review'
  AND role.role_key = 'admissions'
ON CONFLICT DO NOTHING;

ALTER TABLE platform.operator_domain_command_receipt
  DROP CONSTRAINT IF EXISTS operator_domain_command_receipt_command_type_check;
ALTER TABLE platform.operator_domain_command_receipt
  ADD CONSTRAINT operator_domain_command_receipt_command_type_check CHECK (
    command_type IN (
      'admissions.application.review.record',
      'admissions.application.offer.issue',
      'finance.bank-line.reconcile',
      'support.break-glass.request'
    )
  );

CREATE OR REPLACE FUNCTION admissions.issue_application_offer_command(
  p_session_id uuid,
  p_application_id uuid,
  p_expected_version bigint,
  p_program_id uuid,
  p_academic_year_id uuid,
  p_grade_level_id uuid,
  p_expires_at timestamptz,
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
  selected_campus_count integer;
  selected_application_campus_id uuid;
  selected_decision text;
  selected_request_hash text;
  existing_request_hash text;
  existing_receipt jsonb;
  selected_offer_id uuid;
  selected_offer_program_id uuid;
  selected_offer_campus_id uuid;
  selected_offer_academic_year_id uuid;
  selected_offer_grade_level_id uuid;
  selected_offer_expires_at timestamptz;
  selected_offer_status text;
  selected_command_id uuid := gen_random_uuid();
  selected_accepted_at timestamptz := clock_timestamp();
  selected_receipt jsonb;
  created_offer boolean := false;
  resulting_version bigint;
BEGIN
  IF p_session_id IS NULL
     OR p_application_id IS NULL
     OR p_expected_version IS NULL
     OR p_expected_version < 1
     OR p_program_id IS NULL
     OR p_academic_year_id IS NULL
     OR p_expires_at IS NULL
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
    'admissions.application.offer.issue'
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
          'command', 'admissions.application.offer.issue',
          'applicationId', p_application_id,
          'expectedVersion', p_expected_version,
          'programId', p_program_id,
          'academicYearId', p_academic_year_id,
          'gradeLevelId', p_grade_level_id,
          'expiresAt', to_char(p_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
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
      session_context.campus_id::text || '|admissions.application.offer.issue|' ||
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
    AND receipt.command_type = 'admissions.application.offer.issue'
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

  SELECT count(DISTINCT campus_scope.campus_id), min(campus_scope.campus_id::text)::uuid
  INTO selected_campus_count, selected_application_campus_id
  FROM (
    SELECT offer.campus_id
    FROM admissions.offer AS offer
    WHERE offer.tenant_id = session_context.tenant_id
      AND offer.application_id = p_application_id
    UNION
    SELECT interview.campus_id
    FROM admissions.interview_event AS interview
    WHERE interview.tenant_id = session_context.tenant_id
      AND interview.application_id = p_application_id
      AND interview.campus_id IS NOT NULL
      AND interview.status <> 'cancelled'
  ) AS campus_scope;

  IF selected_campus_count <> 1
     OR selected_application_campus_id IS DISTINCT FROM session_context.campus_id THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;
  IF selected_application_version <> p_expected_version THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'revision-conflict',
      'currentVersion', selected_application_version
    );
  END IF;

  SELECT decision.decision
  INTO selected_decision
  FROM admissions.admissions_decision AS decision
  WHERE decision.tenant_id = session_context.tenant_id
    AND decision.application_id = p_application_id;
  IF selected_decision IS DISTINCT FROM 'admit' THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;
  IF p_expires_at <= selected_accepted_at THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM admissions.application_program_choice AS choice
    WHERE choice.tenant_id = session_context.tenant_id
      AND choice.application_id = p_application_id
      AND choice.program_id = p_program_id
  ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;

  SELECT
    offer.offer_id,
    offer.program_id,
    offer.campus_id,
    offer.academic_year_id,
    offer.grade_level_id,
    offer.expires_at,
    offer.status
  INTO
    selected_offer_id,
    selected_offer_program_id,
    selected_offer_campus_id,
    selected_offer_academic_year_id,
    selected_offer_grade_level_id,
    selected_offer_expires_at,
    selected_offer_status
  FROM admissions.offer AS offer
  WHERE offer.tenant_id = session_context.tenant_id
    AND offer.application_id = p_application_id
  FOR UPDATE OF offer;

  IF selected_offer_id IS NULL THEN
    IF selected_application_status <> 'under-review' THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
    END IF;
    selected_offer_id := gen_random_uuid();
    INSERT INTO admissions.offer (
      tenant_id, offer_id, application_id, program_id, campus_id,
      academic_year_id, grade_level_id, expires_at, status, created_at
    ) VALUES (
      session_context.tenant_id, selected_offer_id, p_application_id, p_program_id,
      session_context.campus_id, p_academic_year_id, p_grade_level_id,
      p_expires_at, 'issued', selected_accepted_at
    );
    UPDATE admissions.application
    SET status = 'offered',
        version = version + 1,
        updated_at = selected_accepted_at
    WHERE tenant_id = session_context.tenant_id
      AND application_id = p_application_id
      AND version = p_expected_version;
    resulting_version := p_expected_version + 1;
    created_offer := true;
  ELSE
    IF selected_application_status <> 'offered'
       OR selected_offer_status <> 'issued'
       OR selected_offer_program_id IS DISTINCT FROM p_program_id
       OR selected_offer_campus_id IS DISTINCT FROM session_context.campus_id
       OR selected_offer_academic_year_id IS DISTINCT FROM p_academic_year_id
       OR selected_offer_grade_level_id IS DISTINCT FROM p_grade_level_id
       OR selected_offer_expires_at IS DISTINCT FROM p_expires_at THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
    END IF;
    resulting_version := p_expected_version;
  END IF;

  selected_receipt := jsonb_build_object(
    'commandId', selected_command_id,
    'command', 'admissions.application.offer.issue',
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
    'admissions.application.offer.issue', p_idempotency_key, selected_request_hash,
    selected_offer_id, selected_receipt, p_correlation_id, selected_accepted_at
  );

  INSERT INTO audit.audit_event (
    tenant_id, actor_account_id, action, subject_type, subject_id,
    correlation_id, metadata, occurred_at
  ) VALUES (
    session_context.tenant_id,
    session_context.account_id,
    'admissions.application.offer.issued',
    'admissions_application',
    p_application_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'commandId', selected_command_id,
      'offerId', selected_offer_id,
      'campusId', session_context.campus_id,
      'applicationVersion', resulting_version,
      'createdOffer', created_offer
    ),
    selected_accepted_at
  );

  IF created_offer THEN
    INSERT INTO integration_core.outbox_event (
      tenant_id, event_type, schema_version, aggregate_type, aggregate_id,
      aggregate_version, correlation_id, causation_id, payload,
      occurred_at, available_at
    ) VALUES (
      session_context.tenant_id,
      'admissions.offer_issued',
      1,
      'admissions_application',
      p_application_id::text,
      resulting_version,
      p_correlation_id::text,
      selected_command_id::text,
      jsonb_build_object(
        'offerId', selected_offer_id,
        'campusId', session_context.campus_id,
        'programId', p_program_id,
        'academicYearId', p_academic_year_id,
        'gradeLevelId', p_grade_level_id,
        'expiresAt', p_expires_at
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

REVOKE ALL ON FUNCTION admissions.issue_application_offer_command(
  uuid, uuid, bigint, uuid, uuid, uuid, timestamptz, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admissions.issue_application_offer_command(
  uuid, uuid, bigint, uuid, uuid, uuid, timestamptz, text, uuid
) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608090901_PILOT-14_admissions_offer_command',
  'PILOT-14',
  'Database-owned admissions offer issuance with scoped authorization, idempotency, audit and outbox evidence'
)
ON CONFLICT (migration_id) DO NOTHING;
