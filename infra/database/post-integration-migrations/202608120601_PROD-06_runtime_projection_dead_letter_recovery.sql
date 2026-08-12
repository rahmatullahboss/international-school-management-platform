INSERT INTO iam.permission (permission_key, description, required_assurance)
VALUES (
  'runtime.projection.dead-letter.recover',
  'Request a controlled retry for an eligible runtime projection dead letter',
  'aal2'
)
ON CONFLICT (permission_key) DO NOTHING;

DO $permission_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM iam.permission
    WHERE permission_key = 'runtime.projection.dead-letter.recover'
      AND required_assurance = 'aal2'
  ) THEN
    RAISE EXCEPTION 'runtime.projection.dead-letter.recover must require AAL2';
  END IF;
END
$permission_contract$;

DO $projection_recovery_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_projection_recovery') THEN
    CREATE ROLE app_projection_recovery NOLOGIN NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT app_projection_recovery TO %I', current_user);
END
$projection_recovery_role$;

GRANT USAGE ON SCHEMA platform TO app_projection_recovery;

CREATE TABLE IF NOT EXISTS platform.runtime_projection_recovery_receipt (
  recovery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  dead_letter_id uuid NOT NULL REFERENCES platform.runtime_projection_dead_letter (dead_letter_id),
  original_event_id uuid NOT NULL,
  replacement_event_id uuid NOT NULL,
  command_id uuid NOT NULL REFERENCES platform.runtime_command_receipt (command_id),
  actor_account_id uuid NOT NULL REFERENCES iam.account (account_id),
  idempotency_key text NOT NULL
    CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  reason text NOT NULL CHECK (
    length(reason) BETWEEN 1 AND 500
    AND reason = btrim(reason)
    AND reason !~ '[[:cntrl:]]'
  ),
  correlation_id uuid NOT NULL,
  response_body jsonb NOT NULL CHECK (jsonb_typeof(response_body) = 'object'),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, dead_letter_id),
  UNIQUE (tenant_id, replacement_event_id),
  FOREIGN KEY (tenant_id, original_event_id)
    REFERENCES integration_core.outbox_event (tenant_id, event_id),
  FOREIGN KEY (tenant_id, replacement_event_id)
    REFERENCES integration_core.outbox_event (tenant_id, event_id)
);

DROP TRIGGER IF EXISTS runtime_projection_recovery_receipt_append_only
  ON platform.runtime_projection_recovery_receipt;
CREATE TRIGGER runtime_projection_recovery_receipt_append_only
BEFORE UPDATE OR DELETE ON platform.runtime_projection_recovery_receipt
FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

CREATE INDEX IF NOT EXISTS runtime_projection_recovery_requested_idx
  ON platform.runtime_projection_recovery_receipt (tenant_id, requested_at DESC);

REVOKE ALL ON TABLE platform.runtime_projection_recovery_receipt
  FROM PUBLIC, app_runtime, app_projection_monitor, app_projection_recovery;

CREATE OR REPLACE FUNCTION platform.recover_runtime_projection_dead_letter(
  p_tenant_id uuid,
  p_dead_letter_id uuid,
  p_actor_account_id uuid,
  p_idempotency_key text,
  p_reason text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, integration_core, audit
AS $function$
DECLARE
  dead_letter_row record;
  original_event_row record;
  receipt_row record;
  existing_recovery record;
  selected_projection_revision bigint;
  selected_recovery_id uuid := gen_random_uuid();
  selected_replacement_event_id uuid := gen_random_uuid();
  selected_requested_at timestamptz := clock_timestamp();
  selected_request_hash text;
  selected_response jsonb;
BEGIN
  IF p_tenant_id IS NULL
     OR p_dead_letter_id IS NULL
     OR p_actor_account_id IS NULL
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_reason IS NULL
     OR length(p_reason) < 1
     OR length(p_reason) > 500
     OR p_reason <> btrim(p_reason)
     OR p_reason ~ '[[:cntrl:]]'
     OR p_correlation_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'invalid-recovery-request');
  END IF;

  PERFORM 1
  FROM platform.tenant AS tenant
  WHERE tenant.tenant_id = p_tenant_id
    AND tenant.provisioning_status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'dead-letter-unavailable');
  END IF;

  PERFORM 1
  FROM iam.account AS account
  JOIN iam.oidc_membership_binding AS binding
    ON binding.account_id = account.account_id
   AND binding.tenant_id = p_tenant_id
   AND binding.status = 'active'
  JOIN iam.oidc_membership_role_binding AS role_binding
    ON role_binding.binding_id = binding.binding_id
   AND role_binding.tenant_id = binding.tenant_id
  JOIN iam.role_permission AS role_permission
    ON role_permission.tenant_id = role_binding.tenant_id
   AND role_permission.role_id = role_binding.role_id
   AND role_permission.permission_key = 'runtime.projection.dead-letter.recover'
  WHERE account.account_id = p_actor_account_id
    AND account.disabled_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'permission-not-granted');
  END IF;

  selected_request_hash := encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'deadLetterId', p_dead_letter_id,
          'actorAccountId', p_actor_account_id,
          'reason', p_reason
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  SELECT
    dead_letter.dead_letter_id,
    dead_letter.tenant_id,
    dead_letter.event_id,
    dead_letter.command_id,
    dead_letter.error_code,
    dead_letter.attempt_count,
    dead_letter.failed_at
  INTO dead_letter_row
  FROM platform.runtime_projection_dead_letter AS dead_letter
  WHERE dead_letter.tenant_id = p_tenant_id
    AND dead_letter.dead_letter_id = p_dead_letter_id
  FOR UPDATE OF dead_letter;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'dead-letter-unavailable');
  END IF;

  SELECT
    recovery.idempotency_key,
    recovery.request_hash,
    recovery.response_body
  INTO existing_recovery
  FROM platform.runtime_projection_recovery_receipt AS recovery
  WHERE recovery.tenant_id = p_tenant_id
    AND recovery.dead_letter_id = p_dead_letter_id;

  IF FOUND THEN
    IF existing_recovery.idempotency_key = p_idempotency_key
       AND existing_recovery.request_hash = selected_request_hash THEN
      RETURN jsonb_build_object(
        'accepted', true,
        'replayed', true,
        'receipt', existing_recovery.response_body
      );
    END IF;
    RETURN jsonb_build_object('accepted', false, 'reason', 'already-recovered');
  END IF;

  IF dead_letter_row.command_id IS NULL
     OR dead_letter_row.error_code NOT IN ('source-unavailable', 'processor-error') THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'dead-letter-not-recoverable');
  END IF;

  SELECT
    event.event_id,
    event.event_type,
    event.schema_version,
    event.aggregate_type,
    event.aggregate_id,
    event.aggregate_version,
    event.correlation_id,
    event.causation_id,
    event.payload,
    event.published_at,
    event.last_error
  INTO original_event_row
  FROM integration_core.outbox_event AS event
  WHERE event.tenant_id = p_tenant_id
    AND event.event_id = dead_letter_row.event_id
  FOR UPDATE OF event;

  IF NOT FOUND
     OR original_event_row.event_type <> 'platform.runtime_snapshot_refresh_requested'
     OR original_event_row.schema_version <> 1
     OR original_event_row.aggregate_type <> 'runtime_projection'
     OR original_event_row.published_at IS NULL
     OR original_event_row.last_error IS DISTINCT FROM dead_letter_row.error_code
     OR jsonb_typeof(original_event_row.payload) <> 'object'
     OR original_event_row.payload->>'commandId' IS DISTINCT FROM dead_letter_row.command_id::text THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'dead-letter-not-recoverable');
  END IF;

  SELECT
    receipt.command_id,
    receipt.tenant_id,
    receipt.membership_id,
    receipt.campus_id,
    receipt.command_type,
    receipt.expected_revision,
    receipt.correlation_id
  INTO receipt_row
  FROM platform.runtime_command_receipt AS receipt
  WHERE receipt.command_id = dead_letter_row.command_id
    AND receipt.tenant_id = p_tenant_id
    AND receipt.command_type = 'runtime.snapshot.refresh'
  FOR UPDATE OF receipt;

  IF NOT FOUND
     OR original_event_row.causation_id IS DISTINCT FROM receipt_row.command_id::text
     OR original_event_row.aggregate_id IS DISTINCT FROM receipt_row.membership_id::text
     OR original_event_row.aggregate_version IS DISTINCT FROM receipt_row.expected_revision + 1
     OR original_event_row.correlation_id IS DISTINCT FROM receipt_row.correlation_id::text
     OR original_event_row.payload->>'membershipId' IS DISTINCT FROM receipt_row.membership_id::text
     OR original_event_row.payload->>'expectedRevision' IS DISTINCT FROM receipt_row.expected_revision::text
     OR (
       (receipt_row.campus_id IS NULL AND jsonb_typeof(original_event_row.payload->'campusId') <> 'null')
       OR (
         receipt_row.campus_id IS NOT NULL
         AND original_event_row.payload->>'campusId' IS DISTINCT FROM receipt_row.campus_id::text
       )
     ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'dead-letter-not-recoverable');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM platform.runtime_projection_applied_command AS applied
    WHERE applied.command_id = dead_letter_row.command_id
  ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'already-applied');
  END IF;

  SELECT projection.revision
  INTO selected_projection_revision
  FROM platform.runtime_read_model_projection AS projection
  WHERE projection.tenant_id = p_tenant_id
    AND projection.membership_id = receipt_row.membership_id
    AND projection.campus_id IS NOT DISTINCT FROM receipt_row.campus_id
    AND projection.projection_key = 'home'
  FOR UPDATE OF projection;

  IF selected_projection_revision IS NULL
     OR selected_projection_revision <> receipt_row.expected_revision THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'projection-state-changed');
  END IF;

  PERFORM 1
  FROM platform.runtime_projection_source AS source
  WHERE source.tenant_id = p_tenant_id
    AND source.membership_id = receipt_row.membership_id
    AND source.campus_id IS NOT DISTINCT FROM receipt_row.campus_id
    AND source.projection_key = 'home'
  FOR SHARE OF source;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'source-unavailable');
  END IF;

  selected_response := jsonb_build_object(
    'recoveryId', selected_recovery_id,
    'state', 'accepted',
    'deadLetterId', p_dead_letter_id,
    'originalEventId', dead_letter_row.event_id,
    'replacementEventId', selected_replacement_event_id,
    'commandId', dead_letter_row.command_id,
    'errorCode', dead_letter_row.error_code,
    'requestedAt', to_char(
      selected_requested_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );

  INSERT INTO integration_core.outbox_event (
    tenant_id,
    event_id,
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
    p_tenant_id,
    selected_replacement_event_id,
    original_event_row.event_type,
    original_event_row.schema_version,
    original_event_row.aggregate_type,
    original_event_row.aggregate_id,
    original_event_row.aggregate_version,
    original_event_row.correlation_id,
    original_event_row.causation_id,
    original_event_row.payload,
    selected_requested_at,
    selected_requested_at
  );

  INSERT INTO platform.runtime_projection_recovery_receipt (
    recovery_id,
    tenant_id,
    dead_letter_id,
    original_event_id,
    replacement_event_id,
    command_id,
    actor_account_id,
    idempotency_key,
    request_hash,
    reason,
    correlation_id,
    response_body,
    requested_at
  ) VALUES (
    selected_recovery_id,
    p_tenant_id,
    p_dead_letter_id,
    dead_letter_row.event_id,
    selected_replacement_event_id,
    dead_letter_row.command_id,
    p_actor_account_id,
    p_idempotency_key,
    selected_request_hash,
    p_reason,
    p_correlation_id,
    selected_response,
    selected_requested_at
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
    p_tenant_id,
    p_actor_account_id,
    'runtime.snapshot.refresh.dead_letter.recovery_requested',
    'runtime_projection_dead_letter',
    p_dead_letter_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'recoveryId', selected_recovery_id,
      'originalEventId', dead_letter_row.event_id,
      'replacementEventId', selected_replacement_event_id,
      'commandId', dead_letter_row.command_id,
      'errorCode', dead_letter_row.error_code,
      'originalAttemptCount', dead_letter_row.attempt_count
    ),
    selected_requested_at
  );

  RETURN jsonb_build_object(
    'accepted', true,
    'replayed', false,
    'receipt', selected_response
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.recover_runtime_projection_dead_letter(
  uuid, uuid, uuid, text, text, uuid
) FROM PUBLIC, app_runtime, app_projection_monitor, app_projection_admin,
       app_projection_publisher, app_projection_composer;
GRANT EXECUTE ON FUNCTION platform.recover_runtime_projection_dead_letter(
  uuid, uuid, uuid, text, text, uuid
) TO app_projection_recovery;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608120601_PROD-06_runtime_projection_dead_letter_recovery',
  'PROD-06',
  'Function-only audited transient projection dead-letter recovery with immutable evidence and one-time replacement events'
)
ON CONFLICT (migration_id) DO NOTHING;
