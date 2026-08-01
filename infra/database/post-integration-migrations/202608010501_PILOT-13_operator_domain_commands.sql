INSERT INTO iam.permission (permission_key, description, required_assurance)
VALUES
  ('admissions.application.review', 'Record an admissions application review', 'aal1'),
  ('finance.reconciliation.write', 'Reconcile verified finance statement lines', 'aal1'),
  ('support.break-glass.request', 'Request time-bounded privileged support access', 'aal2')
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description,
    required_assurance = EXCLUDED.required_assurance;

CREATE TABLE IF NOT EXISTS platform.operator_domain_command_receipt (
  command_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL,
  campus_id uuid,
  session_id uuid NOT NULL REFERENCES iam.browser_session_registry (session_id),
  actor_account_id uuid NOT NULL REFERENCES iam.account (account_id),
  command_type text NOT NULL CHECK (
    command_type IN (
      'admissions.application.review.record',
      'finance.bank-line.reconcile',
      'support.break-glass.request'
    )
  ),
  idempotency_key text NOT NULL
    CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  domain_evidence_id uuid NOT NULL,
  response_body jsonb NOT NULL CHECK (jsonb_typeof(response_body) = 'object'),
  correlation_id uuid NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE NULLS NOT DISTINCT (
    tenant_id,
    membership_id,
    campus_id,
    command_type,
    idempotency_key
  ),
  FOREIGN KEY (tenant_id, membership_id)
    REFERENCES iam.membership (tenant_id, membership_id),
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE INDEX IF NOT EXISTS operator_domain_command_receipt_scope_idx
  ON platform.operator_domain_command_receipt (
    tenant_id,
    membership_id,
    campus_id,
    accepted_at DESC
  );

DROP TRIGGER IF EXISTS operator_domain_command_receipt_append_only
  ON platform.operator_domain_command_receipt;
CREATE TRIGGER operator_domain_command_receipt_append_only
BEFORE UPDATE OR DELETE ON platform.operator_domain_command_receipt
FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

REVOKE ALL ON TABLE platform.operator_domain_command_receipt FROM PUBLIC, app_runtime;
REVOKE INSERT, UPDATE, DELETE ON TABLE iam.privileged_access_grant FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_operator_domain_command_session(
  p_session_id uuid
)
RETURNS TABLE (
  tenant_id uuid,
  membership_id uuid,
  campus_id uuid,
  account_id uuid,
  assurance_level text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam, platform
AS $function$
DECLARE
  selected_binding_id uuid;
  selected_tenant_id uuid;
  selected_membership_id uuid;
  selected_campus_id uuid;
  selected_account_id uuid;
  selected_assurance_level text;
  selected_role_ids uuid[];
  current_role_ids uuid[];
BEGIN
  IF p_session_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    session.binding_id,
    session.tenant_id,
    session.membership_id,
    session.campus_id,
    session.account_id,
    session.assurance_level,
    session.role_ids
  INTO
    selected_binding_id,
    selected_tenant_id,
    selected_membership_id,
    selected_campus_id,
    selected_account_id,
    selected_assurance_level,
    selected_role_ids
  FROM iam.browser_session_registry AS session
  JOIN iam.oidc_membership_binding AS binding
    ON binding.binding_id = session.binding_id
   AND binding.account_id = session.account_id
   AND binding.tenant_id = session.tenant_id
   AND binding.membership_id = session.membership_id
   AND binding.campus_id IS NOT DISTINCT FROM session.campus_id
   AND binding.status = 'active'
  JOIN iam.account AS account
    ON account.account_id = session.account_id
   AND account.disabled_at IS NULL
  JOIN iam.membership AS membership
    ON membership.tenant_id = session.tenant_id
   AND membership.membership_id = session.membership_id
   AND membership.account_id = session.account_id
   AND membership.campus_id IS NOT DISTINCT FROM session.campus_id
   AND membership.status = 'active'
  WHERE session.session_id = p_session_id
    AND session.revoked_at IS NULL
    AND session.expires_at > clock_timestamp()
  FOR UPDATE OF session, binding, account, membership;

  IF selected_binding_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM 1
  FROM iam.oidc_membership_role_binding AS role_binding
  WHERE role_binding.binding_id = selected_binding_id
    AND role_binding.tenant_id = selected_tenant_id
  FOR SHARE OF role_binding;

  SELECT array_agg(role_binding.role_id ORDER BY role_binding.role_id)
  INTO current_role_ids
  FROM iam.oidc_membership_role_binding AS role_binding
  WHERE role_binding.binding_id = selected_binding_id
    AND role_binding.tenant_id = selected_tenant_id;

  IF current_role_ids IS NULL OR selected_role_ids IS DISTINCT FROM current_role_ids THEN
    RETURN;
  END IF;

  tenant_id := selected_tenant_id;
  membership_id := selected_membership_id;
  campus_id := selected_campus_id;
  account_id := selected_account_id;
  assurance_level := selected_assurance_level;
  RETURN NEXT;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_operator_domain_command_session(uuid)
  FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION admissions.record_application_review_command(
  p_session_id uuid,
  p_application_id uuid,
  p_expected_version bigint,
  p_recommendation text,
  p_score numeric,
  p_notes text,
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
  selected_request_hash text;
  existing_request_hash text;
  existing_receipt jsonb;
  selected_review_id uuid := gen_random_uuid();
  selected_command_id uuid := gen_random_uuid();
  selected_accepted_at timestamptz := clock_timestamp();
  selected_receipt jsonb;
BEGIN
  IF p_session_id IS NULL
     OR p_application_id IS NULL
     OR p_expected_version IS NULL
     OR p_expected_version < 1
     OR p_recommendation IS NULL
     OR p_recommendation NOT IN ('admit', 'waitlist', 'decline', 'more-information')
     OR (p_score IS NOT NULL AND (p_score < 0 OR p_score > 100))
     OR (p_notes IS NOT NULL AND (
       p_notes <> btrim(p_notes)
       OR length(p_notes) < 1
       OR length(p_notes) > 2000
     ))
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
    'admissions.application.review'
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
          'command', 'admissions.application.review.record',
          'applicationId', p_application_id,
          'expectedVersion', p_expected_version,
          'recommendation', p_recommendation,
          'score', p_score,
          'notes', p_notes
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
      session_context.campus_id::text || '|admissions.application.review.record|' ||
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
    AND receipt.command_type = 'admissions.application.review.record'
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
  IF selected_application_status NOT IN ('submitted', 'under-review') THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;

  INSERT INTO admissions.application_review (
    tenant_id,
    review_id,
    application_id,
    reviewer_account_id,
    recommendation,
    score,
    notes,
    confidential,
    recorded_at
  ) VALUES (
    session_context.tenant_id,
    selected_review_id,
    p_application_id,
    session_context.account_id,
    p_recommendation,
    p_score,
    p_notes,
    true,
    selected_accepted_at
  );

  UPDATE admissions.application
  SET status = 'under-review',
      version = version + 1,
      updated_at = selected_accepted_at
  WHERE tenant_id = session_context.tenant_id
    AND application_id = p_application_id
    AND version = p_expected_version;

  selected_receipt := jsonb_build_object(
    'commandId', selected_command_id,
    'command', 'admissions.application.review.record',
    'domainEvidenceId', selected_review_id,
    'idempotencyKey', p_idempotency_key,
    'correlationId', p_correlation_id,
    'acceptedAt', to_char(
      selected_accepted_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );

  INSERT INTO platform.operator_domain_command_receipt (
    command_id,
    tenant_id,
    membership_id,
    campus_id,
    session_id,
    actor_account_id,
    command_type,
    idempotency_key,
    request_hash,
    domain_evidence_id,
    response_body,
    correlation_id,
    accepted_at
  ) VALUES (
    selected_command_id,
    session_context.tenant_id,
    session_context.membership_id,
    session_context.campus_id,
    p_session_id,
    session_context.account_id,
    'admissions.application.review.record',
    p_idempotency_key,
    selected_request_hash,
    selected_review_id,
    selected_receipt,
    p_correlation_id,
    selected_accepted_at
  );

  INSERT INTO audit.audit_event (
    tenant_id,
    actor_account_id,
    action,
    subject_type,
    subject_id,
    correlation_id,
    metadata,
    occurred_at
  ) VALUES (
    session_context.tenant_id,
    session_context.account_id,
    'admissions.application.review.recorded',
    'admissions_application',
    p_application_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'commandId', selected_command_id,
      'reviewId', selected_review_id,
      'campusId', session_context.campus_id,
      'applicationVersion', p_expected_version + 1,
      'recommendation', p_recommendation
    ),
    selected_accepted_at
  );

  INSERT INTO integration_core.outbox_event (
    tenant_id,
    event_type,
    schema_version,
    aggregate_type,
    aggregate_id,
    aggregate_version,
    correlation_id,
    causation_id,
    payload,
    occurred_at,
    available_at
  ) VALUES (
    session_context.tenant_id,
    'admissions.application_review_recorded',
    1,
    'admissions_application',
    p_application_id::text,
    p_expected_version + 1,
    p_correlation_id::text,
    selected_command_id::text,
    jsonb_build_object(
      'reviewId', selected_review_id,
      'campusId', session_context.campus_id,
      'recommendation', p_recommendation
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

CREATE OR REPLACE FUNCTION billing.reconcile_bank_statement_line_command(
  p_session_id uuid,
  p_bank_statement_line_id uuid,
  p_payment_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, tenancy, billing, audit, integration_core
AS $function$
DECLARE
  session_context record;
  permission_decision jsonb;
  selected_legal_entity_id uuid;
  selected_line_status text;
  selected_line_amount bigint;
  selected_line_currency text;
  selected_payment_status text;
  selected_payment_amount bigint;
  selected_payment_currency text;
  selected_request_hash text;
  existing_request_hash text;
  existing_receipt jsonb;
  selected_command_id uuid := gen_random_uuid();
  selected_accepted_at timestamptz := clock_timestamp();
  selected_receipt jsonb;
BEGIN
  IF p_session_id IS NULL
     OR p_bank_statement_line_id IS NULL
     OR p_payment_id IS NULL
     OR p_reason IS NULL
     OR p_reason <> btrim(p_reason)
     OR length(p_reason) < 8
     OR length(p_reason) > 500
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
    'finance.reconciliation.write'
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

  SELECT campus.legal_entity_id
  INTO selected_legal_entity_id
  FROM tenancy.campus AS campus
  WHERE campus.tenant_id = session_context.tenant_id
    AND campus.campus_id = session_context.campus_id
  FOR SHARE OF campus;
  IF selected_legal_entity_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;

  selected_request_hash := encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'command', 'finance.bank-line.reconcile',
          'bankStatementLineId', p_bank_statement_line_id,
          'paymentId', p_payment_id,
          'reason', p_reason
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
      session_context.campus_id::text || '|finance.bank-line.reconcile|' ||
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
    AND receipt.command_type = 'finance.bank-line.reconcile'
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

  SELECT line.status, line.amount_minor, line.currency
  INTO selected_line_status, selected_line_amount, selected_line_currency
  FROM billing.bank_statement_line AS line
  WHERE line.tenant_id = session_context.tenant_id
    AND line.legal_entity_id = selected_legal_entity_id
    AND line.bank_statement_line_id = p_bank_statement_line_id
  FOR UPDATE OF line;
  IF selected_line_status IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;

  SELECT payment.status, payment.amount_minor, payment.currency
  INTO selected_payment_status, selected_payment_amount, selected_payment_currency
  FROM billing.payment_record AS payment
  WHERE payment.tenant_id = session_context.tenant_id
    AND payment.legal_entity_id = selected_legal_entity_id
    AND payment.payment_id = p_payment_id
  FOR SHARE OF payment;
  IF selected_payment_status IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'scope-not-found');
  END IF;

  IF selected_line_status <> 'unmatched'
     OR selected_payment_status NOT IN ('settled', 'partially-refunded')
     OR selected_line_amount <= 0
     OR selected_line_amount <> selected_payment_amount
     OR selected_line_currency <> selected_payment_currency
     OR EXISTS (
       SELECT 1
       FROM billing.bank_statement_line AS other_line
       WHERE other_line.tenant_id = session_context.tenant_id
         AND other_line.legal_entity_id = selected_legal_entity_id
         AND other_line.matched_payment_id = p_payment_id
         AND other_line.bank_statement_line_id <> p_bank_statement_line_id
         AND other_line.status IN ('matched', 'reconciled')
     ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;

  UPDATE billing.bank_statement_line
  SET status = 'reconciled',
      matched_payment_id = p_payment_id,
      matched_by = 'account:' || session_context.account_id::text,
      matched_at = selected_accepted_at
  WHERE tenant_id = session_context.tenant_id
    AND legal_entity_id = selected_legal_entity_id
    AND bank_statement_line_id = p_bank_statement_line_id;

  selected_receipt := jsonb_build_object(
    'commandId', selected_command_id,
    'command', 'finance.bank-line.reconcile',
    'domainEvidenceId', p_bank_statement_line_id,
    'idempotencyKey', p_idempotency_key,
    'correlationId', p_correlation_id,
    'acceptedAt', to_char(
      selected_accepted_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );

  INSERT INTO platform.operator_domain_command_receipt (
    command_id,
    tenant_id,
    membership_id,
    campus_id,
    session_id,
    actor_account_id,
    command_type,
    idempotency_key,
    request_hash,
    domain_evidence_id,
    response_body,
    correlation_id,
    accepted_at
  ) VALUES (
    selected_command_id,
    session_context.tenant_id,
    session_context.membership_id,
    session_context.campus_id,
    p_session_id,
    session_context.account_id,
    'finance.bank-line.reconcile',
    p_idempotency_key,
    selected_request_hash,
    p_bank_statement_line_id,
    selected_receipt,
    p_correlation_id,
    selected_accepted_at
  );

  INSERT INTO audit.audit_event (
    tenant_id,
    actor_account_id,
    action,
    subject_type,
    subject_id,
    correlation_id,
    metadata,
    occurred_at
  ) VALUES (
    session_context.tenant_id,
    session_context.account_id,
    'finance.bank-line.reconciled',
    'bank_statement_line',
    p_bank_statement_line_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'commandId', selected_command_id,
      'paymentId', p_payment_id,
      'campusId', session_context.campus_id,
      'legalEntityId', selected_legal_entity_id,
      'reason', p_reason
    ),
    selected_accepted_at
  );

  INSERT INTO integration_core.outbox_event (
    tenant_id,
    event_type,
    schema_version,
    aggregate_type,
    aggregate_id,
    aggregate_version,
    correlation_id,
    causation_id,
    payload,
    occurred_at,
    available_at
  ) VALUES (
    session_context.tenant_id,
    'billing.bank_statement_line_reconciled',
    1,
    'bank_statement_line',
    p_bank_statement_line_id::text,
    1,
    p_correlation_id::text,
    selected_command_id::text,
    jsonb_build_object(
      'paymentId', p_payment_id,
      'legalEntityId', selected_legal_entity_id,
      'reason', p_reason
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

CREATE OR REPLACE FUNCTION iam.request_privileged_support_access_command(
  p_session_id uuid,
  p_reason text,
  p_requested_minutes integer,
  p_idempotency_key text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, audit, integration_core
AS $function$
DECLARE
  session_context record;
  permission_decision jsonb;
  selected_request_hash text;
  existing_request_hash text;
  existing_receipt jsonb;
  selected_grant_id uuid := gen_random_uuid();
  selected_command_id uuid := gen_random_uuid();
  selected_accepted_at timestamptz := clock_timestamp();
  selected_receipt jsonb;
BEGIN
  IF p_session_id IS NULL
     OR p_reason IS NULL
     OR p_reason <> btrim(p_reason)
     OR length(p_reason) < 8
     OR length(p_reason) > 500
     OR p_requested_minutes IS NULL
     OR p_requested_minutes < 5
     OR p_requested_minutes > 30
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
    'support.break-glass.request'
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

  selected_request_hash := encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'command', 'support.break-glass.request',
          'reason', p_reason,
          'requestedMinutes', p_requested_minutes
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
      COALESCE(session_context.campus_id::text, '') || '|support.break-glass.request|' ||
      p_idempotency_key,
      0
    )
  );

  SELECT receipt.request_hash, receipt.response_body
  INTO existing_request_hash, existing_receipt
  FROM platform.operator_domain_command_receipt AS receipt
  WHERE receipt.tenant_id = session_context.tenant_id
    AND receipt.membership_id = session_context.membership_id
    AND receipt.campus_id IS NOT DISTINCT FROM session_context.campus_id
    AND receipt.command_type = 'support.break-glass.request'
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

  INSERT INTO iam.privileged_access_grant (
    tenant_id,
    grant_id,
    principal_account_id,
    reason,
    requested_at,
    expires_at
  ) VALUES (
    session_context.tenant_id,
    selected_grant_id,
    session_context.account_id,
    p_reason,
    selected_accepted_at,
    selected_accepted_at + make_interval(mins => p_requested_minutes)
  );

  selected_receipt := jsonb_build_object(
    'commandId', selected_command_id,
    'command', 'support.break-glass.request',
    'domainEvidenceId', selected_grant_id,
    'idempotencyKey', p_idempotency_key,
    'correlationId', p_correlation_id,
    'acceptedAt', to_char(
      selected_accepted_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );

  INSERT INTO platform.operator_domain_command_receipt (
    command_id,
    tenant_id,
    membership_id,
    campus_id,
    session_id,
    actor_account_id,
    command_type,
    idempotency_key,
    request_hash,
    domain_evidence_id,
    response_body,
    correlation_id,
    accepted_at
  ) VALUES (
    selected_command_id,
    session_context.tenant_id,
    session_context.membership_id,
    session_context.campus_id,
    p_session_id,
    session_context.account_id,
    'support.break-glass.request',
    p_idempotency_key,
    selected_request_hash,
    selected_grant_id,
    selected_receipt,
    p_correlation_id,
    selected_accepted_at
  );

  INSERT INTO audit.audit_event (
    tenant_id,
    actor_account_id,
    action,
    subject_type,
    subject_id,
    correlation_id,
    metadata,
    occurred_at
  ) VALUES (
    session_context.tenant_id,
    session_context.account_id,
    'support.break-glass.requested',
    'privileged_access_grant',
    selected_grant_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'commandId', selected_command_id,
      'campusId', session_context.campus_id,
      'requestedMinutes', p_requested_minutes,
      'approvalState', 'pending'
    ),
    selected_accepted_at
  );

  INSERT INTO integration_core.outbox_event (
    tenant_id,
    event_type,
    schema_version,
    aggregate_type,
    aggregate_id,
    aggregate_version,
    correlation_id,
    causation_id,
    payload,
    occurred_at,
    available_at
  ) VALUES (
    session_context.tenant_id,
    'iam.privileged_support_access_requested',
    1,
    'privileged_access_grant',
    selected_grant_id::text,
    1,
    p_correlation_id::text,
    selected_command_id::text,
    jsonb_build_object(
      'requestedMinutes', p_requested_minutes,
      'approvalState', 'pending'
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

REVOKE ALL ON FUNCTION admissions.record_application_review_command(
  uuid, uuid, bigint, text, numeric, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admissions.record_application_review_command(
  uuid, uuid, bigint, text, numeric, text, text, uuid
) TO app_runtime;

REVOKE ALL ON FUNCTION billing.reconcile_bank_statement_line_command(
  uuid, uuid, uuid, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.reconcile_bank_statement_line_command(
  uuid, uuid, uuid, text, text, uuid
) TO app_runtime;

REVOKE ALL ON FUNCTION iam.request_privileged_support_access_command(
  uuid, text, integer, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.request_privileged_support_access_command(
  uuid, text, integer, text, uuid
) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608010501_PILOT-13_operator_domain_commands',
  'PILOT-13',
  'Database-owned Admissions review, Finance reconciliation and AAL2 pending Support access request commands'
)
ON CONFLICT (migration_id) DO NOTHING;
