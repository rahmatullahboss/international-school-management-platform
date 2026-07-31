INSERT INTO iam.permission (permission_key, description, required_assurance)
VALUES (
  'runtime.snapshot.refresh',
  'Request a tenant-scoped runtime snapshot rebuild',
  'aal2'
)
ON CONFLICT (permission_key) DO NOTHING;

DO $permission_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM iam.permission
    WHERE permission_key = 'runtime.snapshot.refresh'
      AND required_assurance = 'aal2'
  ) THEN
    RAISE EXCEPTION 'runtime.snapshot.refresh must require AAL2';
  END IF;
END
$permission_contract$;

CREATE TABLE IF NOT EXISTS platform.runtime_command_receipt (
  command_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL,
  campus_id uuid,
  session_id uuid NOT NULL REFERENCES iam.browser_session_registry (session_id),
  actor_account_id uuid NOT NULL REFERENCES iam.account (account_id),
  command_type text NOT NULL CHECK (command_type = 'runtime.snapshot.refresh'),
  idempotency_key text NOT NULL
    CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  expected_revision bigint NOT NULL CHECK (expected_revision > 0),
  correlation_id uuid NOT NULL,
  response_status integer NOT NULL CHECK (response_status = 202),
  response_body jsonb NOT NULL CHECK (jsonb_typeof(response_body) = 'object'),
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

CREATE INDEX IF NOT EXISTS runtime_command_receipt_scope_idx
  ON platform.runtime_command_receipt (
    tenant_id,
    membership_id,
    campus_id,
    accepted_at DESC
  );

REVOKE ALL ON TABLE platform.runtime_command_receipt FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION platform.submit_runtime_snapshot_refresh(
  p_session_id uuid,
  p_idempotency_key text,
  p_expected_revision bigint,
  p_reason text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, integration_core, audit
AS $function$
DECLARE
  permission_decision jsonb;
  selected_tenant_id uuid;
  selected_membership_id uuid;
  selected_campus_id uuid;
  selected_binding_id uuid;
  selected_account_id uuid;
  current_revision bigint;
  request_hash text;
  selected_command_id uuid := gen_random_uuid();
  selected_accepted_at timestamptz := clock_timestamp();
  receipt jsonb;
  inserted_count integer;
  existing_hash text;
  existing_receipt jsonb;
BEGIN
  IF p_session_id IS NULL
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_expected_revision IS NULL
     OR p_expected_revision <= 0
     OR p_reason IS NULL
     OR length(p_reason) < 1
     OR length(p_reason) > 500
     OR p_reason <> btrim(p_reason)
     OR p_reason ~ '[[:cntrl:]]'
     OR p_correlation_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'permission-not-granted');
  END IF;

  permission_decision := iam.evaluate_browser_permission(
    p_session_id,
    'runtime.snapshot.refresh'
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

  SELECT
    session_row.tenant_id,
    session_row.membership_id,
    session_row.campus_id,
    session_row.binding_id,
    session_row.account_id
  INTO
    selected_tenant_id,
    selected_membership_id,
    selected_campus_id,
    selected_binding_id,
    selected_account_id
  FROM iam.browser_session_registry AS session_row
  JOIN iam.oidc_membership_binding AS binding_row
    ON binding_row.binding_id = session_row.binding_id
   AND binding_row.account_id = session_row.account_id
   AND binding_row.tenant_id = session_row.tenant_id
   AND binding_row.membership_id = session_row.membership_id
   AND binding_row.campus_id IS NOT DISTINCT FROM session_row.campus_id
   AND binding_row.status = 'active'
  JOIN iam.account AS account_row
    ON account_row.account_id = session_row.account_id
   AND account_row.disabled_at IS NULL
  WHERE session_row.session_id = p_session_id
    AND session_row.revoked_at IS NULL
    AND session_row.expires_at > clock_timestamp()
    AND session_row.role_ids = ARRAY(
      SELECT role_binding.role_id
      FROM iam.oidc_membership_role_binding AS role_binding
      WHERE role_binding.binding_id = session_row.binding_id
        AND role_binding.tenant_id = session_row.tenant_id
      ORDER BY role_binding.role_id
    )
  FOR KEY SHARE OF session_row, binding_row, account_row;

  IF selected_tenant_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'session-inactive');
  END IF;

  PERFORM 1
  FROM iam.oidc_membership_role_binding AS role_binding
  JOIN iam.role_permission AS role_permission
    ON role_permission.tenant_id = role_binding.tenant_id
   AND role_permission.role_id = role_binding.role_id
   AND role_permission.permission_key = 'runtime.snapshot.refresh'
  WHERE role_binding.binding_id = selected_binding_id
    AND role_binding.tenant_id = selected_tenant_id
  FOR SHARE OF role_binding, role_permission;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'permission-not-granted');
  END IF;

  request_hash := encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'commandType', 'runtime.snapshot.refresh',
          'expectedRevision', p_expected_revision,
          'reason', p_reason
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  SELECT existing.request_hash, existing.response_body
  INTO existing_hash, existing_receipt
  FROM platform.runtime_command_receipt AS existing
  WHERE existing.tenant_id = selected_tenant_id
    AND existing.membership_id = selected_membership_id
    AND existing.campus_id IS NOT DISTINCT FROM selected_campus_id
    AND existing.command_type = 'runtime.snapshot.refresh'
    AND existing.idempotency_key = p_idempotency_key
  FOR SHARE;

  IF existing_hash IS NOT NULL THEN
    IF existing_hash <> request_hash THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
    END IF;
    RETURN jsonb_build_object(
      'accepted', true,
      'replayed', true,
      'receipt', existing_receipt
    );
  END IF;

  SELECT projection.revision
  INTO current_revision
  FROM platform.runtime_read_model_projection AS projection
  WHERE projection.tenant_id = selected_tenant_id
    AND projection.membership_id = selected_membership_id
    AND projection.campus_id IS NOT DISTINCT FROM selected_campus_id
    AND projection.projection_key = 'home'
  FOR UPDATE;

  IF current_revision IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'projection-not-found');
  END IF;
  IF current_revision <> p_expected_revision THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'revision-conflict',
      'currentRevision', current_revision
    );
  END IF;

  receipt := jsonb_build_object(
    'commandId', selected_command_id,
    'commandType', 'runtime.snapshot.refresh',
    'state', 'accepted',
    'expectedRevision', p_expected_revision,
    'correlationId', p_correlation_id,
    'acceptedAt', to_char(
      selected_accepted_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );

  INSERT INTO platform.runtime_command_receipt (
    command_id,
    tenant_id,
    membership_id,
    campus_id,
    session_id,
    actor_account_id,
    command_type,
    idempotency_key,
    request_hash,
    expected_revision,
    correlation_id,
    response_status,
    response_body,
    accepted_at
  ) VALUES (
    selected_command_id,
    selected_tenant_id,
    selected_membership_id,
    selected_campus_id,
    p_session_id,
    selected_account_id,
    'runtime.snapshot.refresh',
    p_idempotency_key,
    request_hash,
    p_expected_revision,
    p_correlation_id,
    202,
    receipt,
    selected_accepted_at
  )
  ON CONFLICT (
    tenant_id,
    membership_id,
    campus_id,
    command_type,
    idempotency_key
  ) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN
    SELECT existing.request_hash, existing.response_body
    INTO existing_hash, existing_receipt
    FROM platform.runtime_command_receipt AS existing
    WHERE existing.tenant_id = selected_tenant_id
      AND existing.membership_id = selected_membership_id
      AND existing.campus_id IS NOT DISTINCT FROM selected_campus_id
      AND existing.command_type = 'runtime.snapshot.refresh'
      AND existing.idempotency_key = p_idempotency_key;

    IF existing_hash IS NULL OR existing_hash <> request_hash THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
    END IF;
    RETURN jsonb_build_object(
      'accepted', true,
      'replayed', true,
      'receipt', existing_receipt
    );
  END IF;

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
    selected_tenant_id,
    selected_account_id,
    'runtime.snapshot.refresh.accepted',
    'runtime_projection',
    selected_membership_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'commandId', selected_command_id,
      'expectedRevision', p_expected_revision,
      'campusId', selected_campus_id
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
    selected_tenant_id,
    'platform.runtime_snapshot_refresh_requested',
    1,
    'runtime_projection',
    selected_membership_id::text,
    p_expected_revision + 1,
    p_correlation_id::text,
    selected_command_id::text,
    jsonb_build_object(
      'commandId', selected_command_id,
      'membershipId', selected_membership_id,
      'campusId', selected_campus_id,
      'expectedRevision', p_expected_revision,
      'reason', p_reason
    ),
    selected_accepted_at,
    selected_accepted_at
  );

  RETURN jsonb_build_object(
    'accepted', true,
    'replayed', false,
    'receipt', receipt
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.submit_runtime_snapshot_refresh(uuid, text, bigint, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.submit_runtime_snapshot_refresh(uuid, text, bigint, text, uuid)
  TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607311001_PILOT-05_safe_runtime_mutation',
  'PILOT-05',
  'AAL2, idempotent and revision-checked runtime snapshot refresh command with atomic audit and outbox persistence'
)
ON CONFLICT (migration_id) DO NOTHING;
