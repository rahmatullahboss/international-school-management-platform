DO $admin_projection_composer_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_projection_composer') THEN
    CREATE ROLE app_projection_composer NOLOGIN NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT app_projection_composer TO %I', current_user);
END
$admin_projection_composer_role$;

GRANT USAGE ON SCHEMA platform TO app_projection_composer;

CREATE TABLE IF NOT EXISTS platform.runtime_projection_composition_run (
  composition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL,
  campus_id uuid,
  state text NOT NULL CHECK (state IN ('published', 'unchanged')),
  expected_previous_revision bigint NOT NULL CHECK (expected_previous_revision >= 0),
  source_revision bigint NOT NULL CHECK (source_revision > 0),
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  payload_bytes integer NOT NULL CHECK (payload_bytes BETWEEN 2 AND 262144),
  composer_id text NOT NULL CHECK (composer_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'),
  correlation_id uuid NOT NULL,
  composed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, membership_id)
    REFERENCES iam.membership (tenant_id, membership_id),
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE INDEX IF NOT EXISTS runtime_projection_composition_run_scope_idx
  ON platform.runtime_projection_composition_run (
    tenant_id,
    membership_id,
    campus_id,
    composed_at DESC
  );

DROP TRIGGER IF EXISTS runtime_projection_composition_run_append_only
  ON platform.runtime_projection_composition_run;
CREATE TRIGGER runtime_projection_composition_run_append_only
BEFORE UPDATE OR DELETE ON platform.runtime_projection_composition_run
FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

REVOKE ALL ON TABLE platform.runtime_projection_composition_run
  FROM PUBLIC, app_runtime, app_projection_admin, app_projection_publisher,
       app_projection_composer;

CREATE OR REPLACE FUNCTION platform.compose_admin_runtime_projection_source(
  p_tenant_id uuid,
  p_membership_id uuid,
  p_campus_id uuid,
  p_expected_previous_revision bigint,
  p_composer_id text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, tenancy, student_lifecycle,
                  attendance, billing, audit
AS $function$
DECLARE
  selected_account_id uuid;
  selected_persona text;
  persona_count integer;
  selected_legal_entity_id uuid;
  selected_time_zone text := 'UTC';
  selected_local_date date;
  active_student_count bigint;
  open_attendance_count bigint;
  unmatched_bank_line_count bigint;
  open_cashier_session_count bigint;
  current_source_revision bigint := 0;
  current_payload_digest text;
  current_payload_bytes integer;
  composed_payload jsonb;
  composed_payload_digest text;
  composed_payload_bytes integer;
  selected_state text;
  selected_source_revision bigint;
  selected_payload_digest text;
  selected_payload_bytes integer;
  selected_composition_id uuid := gen_random_uuid();
  selected_composed_at timestamptz := clock_timestamp();
  publisher_result jsonb;
  publisher_reason text;
BEGIN
  IF p_tenant_id IS NULL
     OR p_membership_id IS NULL
     OR p_expected_previous_revision IS NULL
     OR p_expected_previous_revision < 0
     OR p_composer_id IS NULL
     OR p_composer_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'
     OR p_correlation_id IS NULL THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'invalid-composition');
  END IF;

  SELECT membership.account_id
  INTO selected_account_id
  FROM iam.membership AS membership
  JOIN iam.account AS account
    ON account.account_id = membership.account_id
   AND account.disabled_at IS NULL
  WHERE membership.tenant_id = p_tenant_id
    AND membership.membership_id = p_membership_id
    AND membership.campus_id IS NOT DISTINCT FROM p_campus_id
    AND membership.status = 'active'
  FOR UPDATE OF membership, account;

  IF selected_account_id IS NULL THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'scope-inactive');
  END IF;

  IF p_campus_id IS NOT NULL THEN
    SELECT campus.legal_entity_id, campus.time_zone
    INTO selected_legal_entity_id, selected_time_zone
    FROM tenancy.campus AS campus
    WHERE campus.tenant_id = p_tenant_id
      AND campus.campus_id = p_campus_id
    FOR SHARE OF campus;
    IF selected_legal_entity_id IS NULL THEN
      RETURN jsonb_build_object('composed', false, 'reason', 'scope-inactive');
    END IF;
  END IF;

  PERFORM 1
  FROM iam.membership_role AS membership_role
  WHERE membership_role.tenant_id = p_tenant_id
    AND membership_role.membership_id = p_membership_id
  FOR SHARE OF membership_role;

  PERFORM 1
  FROM platform.runtime_projection_persona_role AS mapping
  JOIN iam.membership_role AS membership_role
    ON membership_role.tenant_id = mapping.tenant_id
   AND membership_role.role_id = mapping.role_id
  WHERE membership_role.tenant_id = p_tenant_id
    AND membership_role.membership_id = p_membership_id
  FOR SHARE OF mapping;

  SELECT count(DISTINCT mapping.persona), min(mapping.persona)
  INTO persona_count, selected_persona
  FROM iam.membership_role AS membership_role
  JOIN platform.runtime_projection_persona_role AS mapping
    ON mapping.tenant_id = membership_role.tenant_id
   AND mapping.role_id = membership_role.role_id
  WHERE membership_role.tenant_id = p_tenant_id
    AND membership_role.membership_id = p_membership_id;

  IF persona_count <> 1 OR selected_persona <> 'admin' THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'persona-not-admin');
  END IF;

  SELECT source.source_revision, source.payload_digest, source.payload_bytes
  INTO current_source_revision, current_payload_digest, current_payload_bytes
  FROM platform.runtime_projection_source AS source
  WHERE source.tenant_id = p_tenant_id
    AND source.membership_id = p_membership_id
    AND source.campus_id IS NOT DISTINCT FROM p_campus_id
    AND source.projection_key = 'home'
  FOR UPDATE OF source;

  IF NOT FOUND THEN
    current_source_revision := 0;
    current_payload_digest := NULL;
    current_payload_bytes := NULL;
  END IF;

  IF current_source_revision <> p_expected_previous_revision THEN
    RETURN jsonb_build_object(
      'composed', false,
      'reason', 'revision-conflict',
      'currentRevision', current_source_revision
    );
  END IF;

  selected_local_date := (selected_composed_at AT TIME ZONE selected_time_zone)::date;

  SELECT count(DISTINCT enrollment.student_profile_id)
  INTO active_student_count
  FROM student_lifecycle.enrollment AS enrollment
  WHERE enrollment.tenant_id = p_tenant_id
    AND (p_campus_id IS NULL OR enrollment.campus_id = p_campus_id)
    AND enrollment.status = 'active'
    AND enrollment.effective_from <= selected_local_date
    AND (enrollment.effective_to IS NULL OR enrollment.effective_to >= selected_local_date);

  SELECT count(*)
  INTO open_attendance_count
  FROM attendance.attendance_session AS attendance_session
  WHERE attendance_session.tenant_id = p_tenant_id
    AND (p_campus_id IS NULL OR attendance_session.campus_id = p_campus_id)
    AND attendance_session.local_date = selected_local_date
    AND attendance_session.session_state = 'open';

  SELECT count(*)
  INTO unmatched_bank_line_count
  FROM billing.bank_statement_line AS statement_line
  WHERE statement_line.tenant_id = p_tenant_id
    AND (
      selected_legal_entity_id IS NULL
      OR statement_line.legal_entity_id = selected_legal_entity_id
    )
    AND statement_line.status = 'unmatched';

  SELECT count(*)
  INTO open_cashier_session_count
  FROM billing.cashier_session AS cashier_session
  WHERE cashier_session.tenant_id = p_tenant_id
    AND (
      selected_legal_entity_id IS NULL
      OR cashier_session.legal_entity_id = selected_legal_entity_id
    )
    AND cashier_session.status = 'open';

  composed_payload := jsonb_build_object(
    'schemaVersion', 1,
    'view', 'admin-home',
    'summaryLevel', CASE WHEN p_campus_id IS NULL THEN 'tenant' ELSE 'campus' END,
    'localDate', selected_local_date,
    'metrics', jsonb_build_array(
      jsonb_build_object(
        'id', 'active-students',
        'label', 'Active students',
        'value', active_student_count,
        'definition', 'Students with a current active enrollment in the selected scope.',
        'tone', 'stable',
        'href', '/admin/sis',
        'capability', 'sis.read'
      ),
      jsonb_build_object(
        'id', 'open-attendance-sessions',
        'label', 'Open attendance sessions',
        'value', open_attendance_count,
        'definition', 'Attendance sessions for the local date that are not finalized.',
        'tone', CASE WHEN open_attendance_count = 0 THEN 'stable' ELSE 'warning' END,
        'href', '/admin/academics',
        'capability', 'academics.read'
      ),
      jsonb_build_object(
        'id', 'unmatched-bank-lines',
        'label', 'Unmatched bank lines',
        'value', unmatched_bank_line_count,
        'definition', 'Imported bank statement lines that are not matched or reconciled.',
        'tone', CASE WHEN unmatched_bank_line_count = 0 THEN 'stable' ELSE 'error' END,
        'href', '/admin/finance',
        'capability', 'finance.read'
      ),
      jsonb_build_object(
        'id', 'open-cashier-sessions',
        'label', 'Open cashier sessions',
        'value', open_cashier_session_count,
        'definition', 'Cashier sessions that have not been closed or deposited.',
        'tone', CASE WHEN open_cashier_session_count = 0 THEN 'stable' ELSE 'information' END,
        'href', '/admin/finance',
        'capability', 'finance.read'
      )
    ),
    'exceptions',
      CASE WHEN open_attendance_count > 0 THEN
        jsonb_build_array(jsonb_build_object(
          'id', 'attendance-open',
          'area', 'Attendance',
          'title', 'Attendance sessions remain open',
          'summary', open_attendance_count::text || ' session(s) require finalization.',
          'severity', 'warning',
          'status', 'Open',
          'href', '/admin/academics',
          'capability', 'attendance.manage'
        ))
      ELSE '[]'::jsonb END
      || CASE WHEN unmatched_bank_line_count > 0 THEN
        jsonb_build_array(jsonb_build_object(
          'id', 'finance-unmatched',
          'area', 'Finance',
          'title', 'Bank reconciliation requires review',
          'summary', unmatched_bank_line_count::text || ' statement line(s) remain unmatched.',
          'severity', 'error',
          'status', 'Review',
          'href', '/admin/finance',
          'capability', 'finance.read'
        ))
      ELSE '[]'::jsonb END
      || CASE WHEN open_cashier_session_count > 0 THEN
        jsonb_build_array(jsonb_build_object(
          'id', 'cashier-open',
          'area', 'Finance',
          'title', 'Cashier sessions remain open',
          'summary', open_cashier_session_count::text || ' cashier session(s) require closure.',
          'severity', 'information',
          'status', 'Open',
          'href', '/admin/finance',
          'capability', 'finance.read'
        ))
      ELSE '[]'::jsonb END,
    'source', 'database-admin-composer-v1'
  );

  composed_payload_bytes := octet_length(convert_to(composed_payload::text, 'UTF8'));
  composed_payload_digest := encode(
    public.digest(convert_to(composed_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  IF current_payload_digest IS NOT NULL
     AND current_payload_digest = composed_payload_digest THEN
    selected_state := 'unchanged';
    selected_source_revision := current_source_revision;
    selected_payload_digest := current_payload_digest;
    selected_payload_bytes := current_payload_bytes;
  ELSE
    publisher_result := platform.publish_runtime_projection_source(
      p_tenant_id,
      p_membership_id,
      p_campus_id,
      p_expected_previous_revision,
      composed_payload,
      selected_composed_at,
      p_composer_id,
      p_correlation_id
    );

    IF publisher_result->>'published' <> 'true' THEN
      publisher_reason := publisher_result->>'reason';
      IF publisher_reason = 'revision-conflict' THEN
        RETURN jsonb_build_object(
          'composed', false,
          'reason', 'revision-conflict',
          'currentRevision', COALESCE(
            (publisher_result->>'currentRevision')::bigint,
            current_source_revision
          )
        );
      ELSIF publisher_reason = 'scope-inactive' THEN
        RETURN jsonb_build_object('composed', false, 'reason', 'scope-inactive');
      ELSIF publisher_reason IN ('persona-unmapped', 'persona-ambiguous') THEN
        RETURN jsonb_build_object('composed', false, 'reason', 'persona-not-admin');
      END IF;
      RETURN jsonb_build_object('composed', false, 'reason', 'publisher-rejected');
    END IF;

    selected_state := 'published';
    selected_source_revision := (publisher_result->'publication'->>'sourceRevision')::bigint;
    selected_payload_digest := publisher_result->'publication'->>'payloadDigest';
    selected_payload_bytes := (publisher_result->'publication'->>'payloadBytes')::integer;
  END IF;

  INSERT INTO platform.runtime_projection_composition_run (
    composition_id,
    tenant_id,
    membership_id,
    campus_id,
    state,
    expected_previous_revision,
    source_revision,
    payload_digest,
    payload_bytes,
    composer_id,
    correlation_id,
    composed_at
  ) VALUES (
    selected_composition_id,
    p_tenant_id,
    p_membership_id,
    p_campus_id,
    selected_state,
    p_expected_previous_revision,
    selected_source_revision,
    selected_payload_digest,
    selected_payload_bytes,
    p_composer_id,
    p_correlation_id,
    selected_composed_at
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
    selected_account_id,
    'runtime.projection.admin.composed',
    'runtime_projection_source',
    p_membership_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'compositionId', selected_composition_id,
      'campusId', p_campus_id,
      'state', selected_state,
      'sourceRevision', selected_source_revision,
      'payloadDigest', selected_payload_digest,
      'payloadBytes', selected_payload_bytes,
      'composerId', p_composer_id
    ),
    selected_composed_at
  );

  RETURN jsonb_build_object(
    'composed', true,
    'composition', jsonb_build_object(
      'compositionId', selected_composition_id,
      'tenantId', p_tenant_id,
      'membershipId', p_membership_id,
      'campusId', p_campus_id,
      'state', selected_state,
      'sourceRevision', selected_source_revision,
      'payloadDigest', selected_payload_digest,
      'payloadBytes', selected_payload_bytes,
      'correlationId', p_correlation_id,
      'composedAt', to_char(
        selected_composed_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    )
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.compose_admin_runtime_projection_source(
  uuid, uuid, uuid, bigint, text, uuid
) FROM PUBLIC, app_runtime, app_projection_admin, app_projection_publisher;
GRANT EXECUTE ON FUNCTION platform.compose_admin_runtime_projection_source(
  uuid, uuid, uuid, bigint, text, uuid
) TO app_projection_composer;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607311301_PILOT-08_admin_runtime_projection_composer',
  'PILOT-08',
  'Database-owned deterministic admin home composition with unchanged no-op, privileged publication and append-only evidence'
)
ON CONFLICT (migration_id) DO NOTHING;
