CREATE OR REPLACE FUNCTION platform.resolve_operator_work_queue(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, tenancy, admissions, billing
AS $function$
DECLARE
  selected_tenant_id uuid;
  selected_campus_id uuid;
  selected_role_key text;
  selected_permission_key text;
  selected_permission_decision jsonb;
  selected_legal_entity_id uuid;
  selected_items jsonb;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  WITH active_session AS (
    SELECT
      session.tenant_id,
      session.membership_id,
      session.campus_id,
      session.binding_id,
      session.role_ids
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
  ),
  current_roles AS (
    SELECT
      session.tenant_id,
      session.campus_id,
      session.role_ids,
      array_agg(role_binding.role_id ORDER BY role_binding.role_id) AS current_role_ids,
      min(role.role_key) AS role_key,
      count(DISTINCT role.role_key) AS role_key_count
    FROM active_session AS session
    JOIN iam.oidc_membership_role_binding AS role_binding
      ON role_binding.binding_id = session.binding_id
     AND role_binding.tenant_id = session.tenant_id
    JOIN iam.role AS role
      ON role.tenant_id = role_binding.tenant_id
     AND role.role_id = role_binding.role_id
    GROUP BY session.tenant_id, session.campus_id, session.role_ids
  )
  SELECT tenant_id, campus_id, role_key
  INTO selected_tenant_id, selected_campus_id, selected_role_key
  FROM current_roles
  WHERE role_ids = current_role_ids
    AND role_key_count = 1
    AND role_key IN ('admissions', 'finance');

  IF selected_tenant_id IS NULL OR selected_campus_id IS NULL OR selected_role_key IS NULL THEN
    RETURN NULL;
  END IF;

  selected_permission_key := CASE selected_role_key
    WHEN 'admissions' THEN 'admissions.application.review'
    WHEN 'finance' THEN 'finance.reconciliation.write'
    ELSE NULL
  END;

  selected_permission_decision := iam.evaluate_browser_permission(
    p_session_id,
    selected_permission_key
  );
  IF COALESCE((selected_permission_decision->>'allowed')::boolean, false) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  IF selected_role_key = 'admissions' THEN
    SELECT COALESCE(jsonb_agg(candidate.item ORDER BY candidate.submitted_at DESC, candidate.application_number), '[]'::jsonb)
    INTO selected_items
    FROM (
      SELECT
        application.submitted_at,
        application.application_number::text AS application_number,
        jsonb_build_object(
          'applicationId', application.application_id,
          'applicationNumber', application.application_number::text,
          'status', application.status,
          'version', application.version,
          'submittedAt', CASE
            WHEN application.submitted_at IS NULL THEN NULL
            ELSE to_char(
              application.submitted_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            )
          END
        ) AS item
      FROM admissions.application AS application
      JOIN LATERAL (
        SELECT
          count(DISTINCT scope.campus_id) AS campus_count,
          min(scope.campus_id::text)::uuid AS campus_id
        FROM (
          SELECT offer.campus_id
          FROM admissions.offer AS offer
          WHERE offer.tenant_id = application.tenant_id
            AND offer.application_id = application.application_id
          UNION
          SELECT interview.campus_id
          FROM admissions.interview_event AS interview
          WHERE interview.tenant_id = application.tenant_id
            AND interview.application_id = application.application_id
            AND interview.campus_id IS NOT NULL
            AND interview.status <> 'cancelled'
        ) AS scope
      ) AS application_scope
        ON application_scope.campus_count = 1
       AND application_scope.campus_id = selected_campus_id
      WHERE application.tenant_id = selected_tenant_id
        AND application.status IN ('submitted', 'under-review')
      ORDER BY application.submitted_at DESC NULLS LAST, application.application_number
      LIMIT 25
    ) AS candidate;
  ELSE
    SELECT campus.legal_entity_id
    INTO selected_legal_entity_id
    FROM tenancy.campus AS campus
    WHERE campus.tenant_id = selected_tenant_id
      AND campus.campus_id = selected_campus_id;

    IF selected_legal_entity_id IS NULL THEN
      RETURN NULL;
    END IF;

    SELECT COALESCE(jsonb_agg(candidate.item ORDER BY candidate.booking_date DESC, candidate.received_at DESC), '[]'::jsonb)
    INTO selected_items
    FROM (
      SELECT
        line.booking_date,
        payment.received_at,
        jsonb_build_object(
          'bankStatementLineId', line.bank_statement_line_id,
          'bookingDate', to_char(line.booking_date, 'YYYY-MM-DD'),
          'amountMinor', line.amount_minor,
          'currency', line.currency,
          'paymentId', payment.payment_id,
          'paymentReceivedAt', to_char(
            payment.received_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        ) AS item
      FROM billing.bank_statement_line AS line
      JOIN billing.payment_record AS payment
        ON payment.tenant_id = line.tenant_id
       AND payment.legal_entity_id = line.legal_entity_id
       AND payment.amount_minor = line.amount_minor
       AND payment.currency = line.currency
       AND payment.status IN ('settled', 'partially-refunded')
      WHERE line.tenant_id = selected_tenant_id
        AND line.legal_entity_id = selected_legal_entity_id
        AND line.status = 'unmatched'
        AND line.amount_minor > 0
        AND NOT EXISTS (
          SELECT 1
          FROM billing.bank_statement_line AS other_line
          WHERE other_line.tenant_id = line.tenant_id
            AND other_line.legal_entity_id = line.legal_entity_id
            AND other_line.matched_payment_id = payment.payment_id
            AND other_line.bank_statement_line_id <> line.bank_statement_line_id
            AND other_line.status IN ('matched', 'reconciled')
        )
      ORDER BY line.booking_date DESC, payment.received_at DESC
      LIMIT 25
    ) AS candidate;
  END IF;

  RETURN jsonb_build_object(
    'schemaVersion', 1,
    'role', selected_role_key,
    'items', COALESCE(selected_items, '[]'::jsonb)
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_operator_work_queue(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_operator_work_queue(uuid) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608020002_PROD-02_operator_work_queue',
  'PROD-02',
  'Function-only scoped Admissions and Finance operator work queues'
)
ON CONFLICT (migration_id) DO NOTHING;
