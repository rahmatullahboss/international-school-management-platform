CREATE TABLE IF NOT EXISTS platform.mobile_notification_issuance (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  notification_id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_key text NOT NULL CHECK (notification_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  account_id uuid NOT NULL REFERENCES iam.account (account_id),
  campus_id uuid NOT NULL,
  application text NOT NULL CHECK (application IN ('family', 'staff')),
  persona text NOT NULL CHECK (persona IN ('guardian', 'student', 'teacher')),
  kind text NOT NULL CHECK (
    kind IN (
      'familyHome', 'familyAttendance', 'familyResults', 'familyFees',
      'familyDocuments', 'familyForms', 'familyConsent', 'familyMessages',
      'familyConversation', 'staffToday', 'staffAttendance', 'staffGradebook',
      'staffMessages'
    )
  ),
  resource_id text CHECK (
    resource_id IS NULL
    OR (
      resource_id ~ '^[A-Za-z0-9_.:-]+$'
      AND char_length(resource_id) BETWEEN 1 AND 256
      AND position('://' IN resource_id) = 0
    )
  ),
  notification_environment text NOT NULL CHECK (notification_environment IN ('development', 'production')),
  request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'suppressed')),
  suppression_reason text CHECK (
    suppression_reason IS NULL
    OR suppression_reason IN (
      'no-active-device', 'device-limit-exceeded', 'authority-revoked', 'preference-disabled'
    )
  ),
  target_count integer NOT NULL CHECK (target_count BETWEEN 0 AND 32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, notification_id),
  UNIQUE (tenant_id, notification_key),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id),
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '24 hours'),
  CHECK (
    (status = 'queued' AND target_count BETWEEN 1 AND 32 AND suppression_reason IS NULL)
    OR
    (status = 'suppressed' AND target_count = 0 AND suppression_reason IS NOT NULL)
  ),
  CHECK (
    (application = 'family' AND persona IN ('guardian', 'student') AND kind LIKE 'family%')
    OR
    (application = 'staff' AND persona = 'teacher' AND kind LIKE 'staff%')
  ),
  CHECK (persona = 'guardian' OR kind NOT IN ('familyFees', 'familyForms', 'familyConsent')),
  CHECK (resource_id IS NULL OR kind IN ('familyForms', 'familyConversation'))
);

CREATE INDEX IF NOT EXISTS mobile_notification_issuance_account_idx
  ON platform.mobile_notification_issuance (
    tenant_id, account_id, application, issued_at DESC, notification_id DESC
  );

CREATE TABLE IF NOT EXISTS platform.mobile_notification_outbox (
  tenant_id uuid NOT NULL,
  notification_id uuid NOT NULL,
  target_id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_session_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'suppressed')),
  suppression_reason text CHECK (
    suppression_reason IS NULL OR suppression_reason IN ('device-revoked', 'authority-revoked')
  ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, target_id),
  UNIQUE (tenant_id, notification_id, device_session_id),
  FOREIGN KEY (tenant_id, notification_id)
    REFERENCES platform.mobile_notification_issuance (tenant_id, notification_id)
    ON DELETE CASCADE,
  FOREIGN KEY (device_session_id)
    REFERENCES platform.mobile_device_session (device_session_id),
  CHECK (
    (status = 'pending' AND suppression_reason IS NULL AND device_session_id IS NOT NULL)
    OR
    (status = 'suppressed' AND suppression_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS mobile_notification_outbox_pending_idx
  ON platform.mobile_notification_outbox (tenant_id, notification_id, created_at, target_id)
  WHERE status = 'pending';

REVOKE ALL ON TABLE platform.mobile_notification_issuance FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE platform.mobile_notification_outbox FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION platform.enforce_mobile_notification_issuance_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MOBILE_NOTIFICATION_ISSUANCE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.notification_id IS DISTINCT FROM OLD.notification_id
     OR NEW.notification_key IS DISTINCT FROM OLD.notification_key
     OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.campus_id IS DISTINCT FROM OLD.campus_id
     OR NEW.application IS DISTINCT FROM OLD.application
     OR NEW.persona IS DISTINCT FROM OLD.persona
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
     OR NEW.notification_environment IS DISTINCT FROM OLD.notification_environment
     OR NEW.request_digest IS DISTINCT FROM OLD.request_digest
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'MOBILE_NOTIFICATION_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'suppressed' AND NEW.status <> 'suppressed' THEN
    RAISE EXCEPTION 'MOBILE_NOTIFICATION_SUPPRESSION_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.target_count > OLD.target_count THEN
    RAISE EXCEPTION 'MOBILE_NOTIFICATION_TARGET_COUNT_CANNOT_INCREASE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION platform.enforce_mobile_notification_issuance_state() FROM PUBLIC, app_runtime;

DROP TRIGGER IF EXISTS mobile_notification_issuance_state_guard
  ON platform.mobile_notification_issuance;
CREATE TRIGGER mobile_notification_issuance_state_guard
BEFORE UPDATE OR DELETE ON platform.mobile_notification_issuance
FOR EACH ROW EXECUTE FUNCTION platform.enforce_mobile_notification_issuance_state();

CREATE OR REPLACE FUNCTION platform.enforce_mobile_notification_outbox_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MOBILE_NOTIFICATION_OUTBOX_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.notification_id IS DISTINCT FROM OLD.notification_id
     OR NEW.target_id IS DISTINCT FROM OLD.target_id
     OR NEW.device_session_id IS DISTINCT FROM OLD.device_session_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'MOBILE_NOTIFICATION_OUTBOX_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'suppressed'
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.suppression_reason IS DISTINCT FROM OLD.suppression_reason
     ) THEN
    RAISE EXCEPTION 'MOBILE_NOTIFICATION_OUTBOX_SUPPRESSION_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'MOBILE_NOTIFICATION_OUTBOX_TIMESTAMP_REGRESSION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION platform.enforce_mobile_notification_outbox_state()
  FROM PUBLIC, app_runtime;

DROP TRIGGER IF EXISTS mobile_notification_outbox_state_guard
  ON platform.mobile_notification_outbox;
CREATE TRIGGER mobile_notification_outbox_state_guard
BEFORE UPDATE OR DELETE ON platform.mobile_notification_outbox
FOR EACH ROW EXECUTE FUNCTION platform.enforce_mobile_notification_outbox_state();

CREATE OR REPLACE FUNCTION platform.suppress_mobile_notification_outbox_on_device_revoke()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    UPDATE platform.mobile_notification_outbox
    SET status = 'suppressed',
        suppression_reason = 'device-revoked',
        updated_at = clock_timestamp()
    WHERE device_session_id = NEW.device_session_id
      AND status = 'pending';

    UPDATE platform.mobile_notification_issuance AS issuance
    SET target_count = target.pending_count,
        status = CASE WHEN target.pending_count = 0 THEN 'suppressed' ELSE issuance.status END,
        suppression_reason = CASE
          WHEN target.pending_count = 0 THEN 'no-active-device'
          ELSE issuance.suppression_reason
        END
    FROM (
      SELECT
        outbox.tenant_id,
        outbox.notification_id,
        count(*) FILTER (WHERE outbox.status = 'pending')::integer AS pending_count
      FROM platform.mobile_notification_outbox AS outbox
      WHERE (outbox.tenant_id, outbox.notification_id) IN (
        SELECT related.tenant_id, related.notification_id
        FROM platform.mobile_notification_outbox AS related
        WHERE related.device_session_id = NEW.device_session_id
      )
      GROUP BY outbox.tenant_id, outbox.notification_id
    ) AS target
    WHERE issuance.tenant_id = target.tenant_id
      AND issuance.notification_id = target.notification_id
      AND issuance.status = 'queued';

    UPDATE integration_core.notification_delivery AS delivery
    SET status = 'suppressed',
        updated_at = clock_timestamp()
    FROM platform.mobile_notification_issuance AS issuance
    JOIN platform.mobile_notification_outbox AS related
      ON related.tenant_id = issuance.tenant_id
     AND related.notification_id = issuance.notification_id
    WHERE related.device_session_id = NEW.device_session_id
      AND issuance.status = 'suppressed'
      AND issuance.target_count = 0
      AND delivery.tenant_id = issuance.tenant_id
      AND delivery.notification_key = 'mobile:' || issuance.notification_key;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION platform.suppress_mobile_notification_outbox_on_device_revoke()
  FROM PUBLIC, app_runtime;

DROP TRIGGER IF EXISTS mobile_notification_device_revoke_outbox_guard
  ON platform.mobile_device_session;
CREATE TRIGGER mobile_notification_device_revoke_outbox_guard
AFTER UPDATE OF revoked_at ON platform.mobile_device_session
FOR EACH ROW EXECUTE FUNCTION platform.suppress_mobile_notification_outbox_on_device_revoke();

CREATE OR REPLACE FUNCTION platform.resolve_mobile_notification_person_id(
  p_tenant_id uuid,
  p_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_person_id uuid;
  person_count integer;
BEGIN
  SELECT count(DISTINCT link.person_id), min(link.person_id::text)::uuid
  INTO person_count, selected_person_id
  FROM iam.person_link AS link
  JOIN people.person AS person
    ON person.tenant_id = link.tenant_id
   AND person.person_id = link.person_id
   AND person.status = 'active'
  WHERE link.tenant_id = p_tenant_id
    AND link.account_id = p_account_id;

  IF person_count <> 1 THEN RETURN NULL; END IF;
  RETURN selected_person_id;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_notification_person_id(uuid, uuid)
  FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION platform.mobile_notification_target_is_authorized(
  p_tenant_id uuid,
  p_campus_id uuid,
  p_account_id uuid,
  p_application text,
  p_persona text,
  p_kind text,
  p_resource_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  required_capability text;
  selected_person_id uuid;
  selected_local_date date;
  selected_student_profile_id uuid;
  active_access boolean;
BEGIN
  IF p_tenant_id IS NULL OR p_campus_id IS NULL OR p_account_id IS NULL THEN RETURN false; END IF;
  IF p_application NOT IN ('family', 'staff')
     OR p_persona NOT IN ('guardian', 'student', 'teacher') THEN
    RETURN false;
  END IF;
  IF (p_application = 'family' AND (p_persona NOT IN ('guardian', 'student') OR p_kind NOT LIKE 'family%'))
     OR (p_application = 'staff' AND (p_persona <> 'teacher' OR p_kind NOT LIKE 'staff%')) THEN
    RETURN false;
  END IF;
  IF p_kind IN ('familyFees', 'familyForms', 'familyConsent') AND p_persona <> 'guardian' THEN
    RETURN false;
  END IF;
  IF p_resource_id IS NOT NULL
     AND (
       p_kind NOT IN ('familyForms', 'familyConversation')
       OR p_resource_id !~ '^[A-Za-z0-9_.:-]+$'
       OR char_length(p_resource_id) NOT BETWEEN 1 AND 256
       OR position('://' IN p_resource_id) <> 0
     ) THEN
    RETURN false;
  END IF;

  required_capability := CASE p_kind
    WHEN 'familyAttendance' THEN 'attendance.read'
    WHEN 'familyResults' THEN 'grades.read.published'
    WHEN 'familyFees' THEN 'billing.read'
    WHEN 'familyDocuments' THEN 'documents.read'
    WHEN 'familyForms' THEN 'forms.consent'
    WHEN 'familyConsent' THEN 'forms.consent'
    WHEN 'familyMessages' THEN 'messages.read'
    WHEN 'familyConversation' THEN 'messages.read'
    WHEN 'staffAttendance' THEN 'attendance.take'
    WHEN 'staffGradebook' THEN 'grades.write'
    ELSE NULL
  END;

  SELECT EXISTS (
    SELECT 1
    FROM iam.oidc_membership_binding AS binding
    JOIN iam.account AS account
      ON account.account_id = binding.account_id
     AND account.disabled_at IS NULL
    JOIN iam.membership AS membership
      ON membership.tenant_id = binding.tenant_id
     AND membership.membership_id = binding.membership_id
     AND membership.account_id = binding.account_id
     AND membership.campus_id IS NOT DISTINCT FROM binding.campus_id
     AND membership.status = 'active'
    JOIN platform.tenant AS tenant
      ON tenant.tenant_id = binding.tenant_id
     AND tenant.provisioning_status = 'active'
    JOIN tenancy.campus AS campus
      ON campus.tenant_id = binding.tenant_id
     AND campus.campus_id = binding.campus_id
    JOIN iam.oidc_membership_role_binding AS role_binding
      ON role_binding.tenant_id = binding.tenant_id
     AND role_binding.binding_id = binding.binding_id
    JOIN iam.role AS role
      ON role.tenant_id = role_binding.tenant_id
     AND role.role_id = role_binding.role_id
     AND role.role_key = p_persona
    WHERE binding.account_id = p_account_id
      AND binding.tenant_id = p_tenant_id
      AND binding.campus_id = p_campus_id
      AND binding.status = 'active'
      AND (
        p_kind IN ('familyHome', 'staffToday')
        OR (
          p_kind = 'staffMessages'
          AND EXISTS (
            SELECT 1
            FROM iam.role_permission AS permission
            WHERE permission.tenant_id = role.tenant_id
              AND permission.role_id = role.role_id
              AND permission.permission_key IN ('messages.read', 'messages.send')
          )
        )
        OR (
          required_capability IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM iam.role_permission AS permission
            WHERE permission.tenant_id = role.tenant_id
              AND permission.role_id = role.role_id
              AND permission.permission_key = required_capability
          )
        )
      )
  ) INTO active_access;

  IF NOT active_access THEN RETURN false; END IF;

  selected_person_id := platform.resolve_mobile_notification_person_id(p_tenant_id, p_account_id);
  IF selected_person_id IS NULL THEN RETURN false; END IF;

  SELECT (clock_timestamp() AT TIME ZONE campus.time_zone)::date
  INTO selected_local_date
  FROM tenancy.campus AS campus
  WHERE campus.tenant_id = p_tenant_id
    AND campus.campus_id = p_campus_id;
  IF selected_local_date IS NULL THEN RETURN false; END IF;

  IF p_application = 'staff' THEN
    RETURN EXISTS (
      SELECT 1
      FROM hr.staff_profile AS staff
      WHERE staff.tenant_id = p_tenant_id
        AND staff.campus_id = p_campus_id
        AND staff.person_ref = selected_person_id::text
        AND staff.employment_status = 'active'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM student_lifecycle.student_profile AS profile
    WHERE profile.tenant_id = p_tenant_id
      AND platform.mobile_family_student_is_authorized(
        p_tenant_id,
        p_campus_id,
        p_persona,
        selected_person_id,
        profile.student_profile_id,
        selected_local_date
      )
  ) THEN
    RETURN false;
  END IF;

  IF p_resource_id IS NULL THEN RETURN true; END IF;
  IF p_resource_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  IF p_kind = 'familyForms' THEN
    SELECT request.student_profile_id
    INTO selected_student_profile_id
    FROM platform.mobile_family_form_request AS request
    WHERE request.tenant_id = p_tenant_id
      AND request.form_id = p_resource_id::uuid;
    RETURN selected_student_profile_id IS NOT NULL
      AND platform.mobile_family_student_is_authorized(
        p_tenant_id,
        p_campus_id,
        p_persona,
        selected_person_id,
        selected_student_profile_id,
        selected_local_date
      );
  END IF;

  IF p_kind = 'familyConversation' THEN
    RETURN platform.mobile_family_conversation_is_authorized(
      p_tenant_id,
      p_campus_id,
      p_persona,
      selected_person_id,
      p_resource_id::uuid,
      selected_local_date
    );
  END IF;

  RETURN false;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_notification_target_is_authorized(
  uuid, uuid, uuid, text, text, text, text
) FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION platform.issue_mobile_notification(
  p_tenant_id uuid,
  p_campus_id uuid,
  p_account_id uuid,
  p_application text,
  p_persona text,
  p_kind text,
  p_resource_id text,
  p_notification_environment text,
  p_notification_key text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_now timestamptz := clock_timestamp();
  request_digest text;
  previous_issuance platform.mobile_notification_issuance%ROWTYPE;
  new_notification_id uuid;
  active_device_count integer;
  selected_status text;
  selected_suppression_reason text;
  selected_target_count integer;
BEGIN
  IF p_tenant_id IS NULL
     OR p_campus_id IS NULL
     OR p_account_id IS NULL
     OR p_application NOT IN ('family', 'staff')
     OR p_persona NOT IN ('guardian', 'student', 'teacher')
     OR p_kind NOT IN (
       'familyHome', 'familyAttendance', 'familyResults', 'familyFees',
       'familyDocuments', 'familyForms', 'familyConsent', 'familyMessages',
       'familyConversation', 'staffToday', 'staffAttendance', 'staffGradebook',
       'staffMessages'
     )
     OR p_notification_environment NOT IN ('development', 'production')
     OR p_notification_key IS NULL
     OR p_notification_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
     OR p_expires_at IS NULL
     OR p_expires_at <= selected_now
     OR p_expires_at > selected_now + interval '24 hours'
     OR (p_resource_id IS NOT NULL AND (
       p_resource_id !~ '^[A-Za-z0-9_.:-]+$'
       OR char_length(p_resource_id) NOT BETWEEN 1 AND 256
       OR position('://' IN p_resource_id) <> 0
     )) THEN
    RETURN NULL;
  END IF;

  IF (p_application = 'family' AND (p_persona NOT IN ('guardian', 'student') OR p_kind NOT LIKE 'family%'))
     OR (p_application = 'staff' AND (p_persona <> 'teacher' OR p_kind NOT LIKE 'staff%'))
     OR (p_kind IN ('familyFees', 'familyForms', 'familyConsent') AND p_persona <> 'guardian')
     OR (p_resource_id IS NOT NULL AND p_kind NOT IN ('familyForms', 'familyConversation')) THEN
    RETURN NULL;
  END IF;

  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          p_tenant_id::text,
          p_campus_id::text,
          p_account_id::text,
          p_application,
          p_persona,
          p_kind,
          coalesce(p_resource_id, ''),
          p_notification_environment,
          p_notification_key,
          to_char(p_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended('mobile-notification:' || p_tenant_id::text || ':' || p_notification_key, 0)
  );

  SELECT issuance.*
  INTO previous_issuance
  FROM platform.mobile_notification_issuance AS issuance
  WHERE issuance.tenant_id = p_tenant_id
    AND issuance.notification_key = p_notification_key
  FOR UPDATE;

  IF previous_issuance.notification_id IS NOT NULL THEN
    IF previous_issuance.request_digest <> request_digest
       OR previous_issuance.account_id <> p_account_id THEN
      RETURN jsonb_build_object('status', 'idempotency-conflict');
    END IF;

    IF NOT platform.mobile_notification_target_is_authorized(
      p_tenant_id,
      p_campus_id,
      p_account_id,
      p_application,
      p_persona,
      p_kind,
      p_resource_id
    ) THEN
      UPDATE platform.mobile_notification_outbox
      SET status = 'suppressed',
          suppression_reason = 'authority-revoked',
          updated_at = selected_now
      WHERE tenant_id = p_tenant_id
        AND notification_id = previous_issuance.notification_id
        AND status = 'pending';

      IF previous_issuance.status = 'queued' THEN
        UPDATE platform.mobile_notification_issuance
        SET status = 'suppressed',
            suppression_reason = 'authority-revoked',
            target_count = 0
        WHERE tenant_id = p_tenant_id
          AND notification_id = previous_issuance.notification_id;
        previous_issuance.status := 'suppressed';
        previous_issuance.suppression_reason := 'authority-revoked';
        previous_issuance.target_count := 0;
      END IF;

      UPDATE integration_core.notification_delivery
      SET status = 'suppressed',
          updated_at = selected_now
      WHERE tenant_id = p_tenant_id
        AND notification_key = 'mobile:' || p_notification_key;
    END IF;

    RETURN jsonb_build_object(
      'notificationId', previous_issuance.notification_id,
      'status', previous_issuance.status,
      'targetCount', previous_issuance.target_count,
      'issuedAt', to_char(previous_issuance.issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'expiresAt', to_char(previous_issuance.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  END IF;

  IF NOT platform.mobile_notification_target_is_authorized(
    p_tenant_id,
    p_campus_id,
    p_account_id,
    p_application,
    p_persona,
    p_kind,
    p_resource_id
  ) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM integration_core.notification_preference AS preference
    WHERE preference.tenant_id = p_tenant_id
      AND preference.recipient_id = p_account_id::text
      AND preference.channel = 'push'
      AND preference.enabled = false
  ) THEN
    selected_status := 'suppressed';
    selected_suppression_reason := 'preference-disabled';
    selected_target_count := 0;
  ELSE
    SELECT count(*)
    INTO active_device_count
    FROM platform.mobile_device_session AS device
    WHERE device.account_id = p_account_id
      AND device.application = p_application
      AND device.notification_environment = p_notification_environment
      AND device.revoked_at IS NULL;

    IF active_device_count = 0 THEN
      selected_status := 'suppressed';
      selected_suppression_reason := 'no-active-device';
      selected_target_count := 0;
    ELSIF active_device_count > 32 THEN
      selected_status := 'suppressed';
      selected_suppression_reason := 'device-limit-exceeded';
      selected_target_count := 0;
    ELSE
      selected_status := 'queued';
      selected_suppression_reason := NULL;
      selected_target_count := active_device_count;
    END IF;
  END IF;

  new_notification_id := gen_random_uuid();
  INSERT INTO platform.mobile_notification_issuance (
    tenant_id,
    notification_id,
    notification_key,
    account_id,
    campus_id,
    application,
    persona,
    kind,
    resource_id,
    notification_environment,
    request_digest,
    issued_at,
    expires_at,
    status,
    suppression_reason,
    target_count
  ) VALUES (
    p_tenant_id,
    new_notification_id,
    p_notification_key,
    p_account_id,
    p_campus_id,
    p_application,
    p_persona,
    p_kind,
    p_resource_id,
    p_notification_environment,
    request_digest,
    selected_now,
    p_expires_at,
    selected_status,
    selected_suppression_reason,
    selected_target_count
  );

  INSERT INTO integration_core.notification_delivery (
    tenant_id,
    notification_key,
    recipient_id,
    channel,
    template_key,
    locale,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    'mobile:' || p_notification_key,
    p_account_id::text,
    'push',
    'mobile.data-only.' || p_application,
    'und',
    CASE WHEN selected_status = 'queued' THEN 'pending' ELSE 'suppressed' END,
    selected_now,
    selected_now
  );

  IF selected_status = 'queued' THEN
    INSERT INTO platform.mobile_notification_outbox (
      tenant_id,
      notification_id,
      device_session_id,
      status
    )
    SELECT
      p_tenant_id,
      new_notification_id,
      device.device_session_id,
      'pending'
    FROM platform.mobile_device_session AS device
    WHERE device.account_id = p_account_id
      AND device.application = p_application
      AND device.notification_environment = p_notification_environment
      AND device.revoked_at IS NULL
    ORDER BY device.updated_at DESC, device.device_session_id;
  END IF;

  RETURN jsonb_build_object(
    'notificationId', new_notification_id,
    'status', selected_status,
    'targetCount', selected_target_count,
    'issuedAt', to_char(selected_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt', to_char(p_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.issue_mobile_notification(
  uuid, uuid, uuid, text, text, text, text, text, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.issue_mobile_notification(
  uuid, uuid, uuid, text, text, text, text, text, text, timestamptz
) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608210005_MOB-07_mobile_notification_issuance',
  'MOB-07',
  'Provider-neutral mobile notification issuance and per-device outbox authority'
)
ON CONFLICT (migration_id) DO NOTHING;
