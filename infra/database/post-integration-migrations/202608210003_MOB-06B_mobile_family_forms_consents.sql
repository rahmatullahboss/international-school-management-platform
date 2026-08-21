CREATE OR REPLACE FUNCTION platform.mobile_family_form_fields_are_valid(p_fields jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  field jsonb;
  field_id text;
  field_label text;
  field_type text;
  options jsonb;
  seen_ids text[] := ARRAY[]::text[];
  option_count integer;
  distinct_option_count integer;
BEGIN
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'array' THEN
    RETURN false;
  END IF;
  IF jsonb_array_length(p_fields) NOT BETWEEN 1 AND 128 THEN
    RETURN false;
  END IF;

  FOR field IN SELECT value FROM jsonb_array_elements(p_fields)
  LOOP
    IF jsonb_typeof(field) <> 'object' THEN
      RETURN false;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(field)) <> 5
       OR NOT (field ?& ARRAY['fieldId', 'label', 'type', 'required', 'options']) THEN
      RETURN false;
    END IF;

    field_id := field->>'fieldId';
    field_label := field->>'label';
    field_type := field->>'type';
    options := field->'options';

    IF jsonb_typeof(field->'fieldId') <> 'string'
       OR jsonb_typeof(field->'label') <> 'string'
       OR jsonb_typeof(field->'type') <> 'string'
       OR field_id !~ '^[A-Za-z0-9_.-]{1,128}$'
       OR field_id = ANY(seen_ids)
       OR btrim(field_label) = ''
       OR char_length(field_label) > 512
       OR field_type NOT IN ('text', 'boolean', 'singleChoice', 'date')
       OR jsonb_typeof(field->'required') <> 'boolean' THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(options) <> 'array' THEN
      RETURN false;
    END IF;
    IF jsonb_array_length(options) > 100 THEN
      RETURN false;
    END IF;
    seen_ids := array_append(seen_ids, field_id);

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(options) AS option_value(value)
      WHERE jsonb_typeof(value) <> 'string'
    ) THEN
      RETURN false;
    END IF;

    SELECT count(*), count(DISTINCT value)
    INTO option_count, distinct_option_count
    FROM jsonb_array_elements_text(options);

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(options) AS option_value(value)
      WHERE btrim(value) = '' OR char_length(value) > 512
    ) THEN
      RETURN false;
    END IF;

    IF field_type = 'singleChoice' THEN
      IF option_count < 1 OR option_count <> distinct_option_count THEN RETURN false; END IF;
    ELSIF option_count <> 0 THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_family_form_fields_are_valid(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_family_form_fields_are_valid(jsonb) FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.mobile_family_form_answers_are_valid(
  p_fields jsonb,
  p_answers jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  field jsonb;
  field_id text;
  field_type text;
  is_required boolean;
  answer jsonb;
  answer_text text;
BEGIN
  IF NOT platform.mobile_family_form_fields_are_valid(p_fields)
     OR p_answers IS NULL
     OR jsonb_typeof(p_answers) <> 'object' THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_answers)) > 128 THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_answers) AS answer_key(key)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_fields) AS form_field(value)
      WHERE value->>'fieldId' = answer_key.key
    )
  ) THEN
    RETURN false;
  END IF;

  FOR field IN SELECT value FROM jsonb_array_elements(p_fields)
  LOOP
    field_id := field->>'fieldId';
    field_type := field->>'type';
    is_required := (field->>'required')::boolean;

    IF NOT (p_answers ? field_id) THEN
      IF is_required THEN RETURN false; END IF;
      CONTINUE;
    END IF;

    answer := p_answers->field_id;
    IF answer = 'null'::jsonb THEN
      IF is_required THEN RETURN false; END IF;
      CONTINUE;
    END IF;

    IF field_type = 'text' THEN
      IF jsonb_typeof(answer) <> 'string' THEN RETURN false; END IF;
      answer_text := answer #>> '{}';
      IF char_length(answer_text) > 4000 OR (is_required AND btrim(answer_text) = '') THEN
        RETURN false;
      END IF;
    ELSIF field_type = 'boolean' THEN
      IF jsonb_typeof(answer) <> 'boolean' THEN RETURN false; END IF;
    ELSIF field_type = 'singleChoice' THEN
      IF jsonb_typeof(answer) <> 'string' THEN RETURN false; END IF;
      answer_text := answer #>> '{}';
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(field->'options') AS option_value(value)
        WHERE option_value.value = answer_text
      ) THEN
        RETURN false;
      END IF;
    ELSIF field_type = 'date' THEN
      IF jsonb_typeof(answer) <> 'string' THEN RETURN false; END IF;
      answer_text := answer #>> '{}';
      IF answer_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         OR to_char(answer_text::date, 'YYYY-MM-DD') <> answer_text THEN
        RETURN false;
      END IF;
    ELSE
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
EXCEPTION
  WHEN others THEN RETURN false;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_family_form_answers_are_valid(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_family_form_answers_are_valid(jsonb, jsonb) FROM app_runtime;

CREATE TABLE IF NOT EXISTS platform.mobile_family_form_request (
  tenant_id uuid NOT NULL,
  form_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  title text NOT NULL CHECK (btrim(title) <> '' AND char_length(title) <= 512),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'closed')),
  due_at timestamptz,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  fields jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, form_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  CHECK (
    (status = 'open' AND submitted_at IS NULL AND closed_at IS NULL)
    OR (status = 'submitted' AND submitted_at IS NOT NULL AND closed_at IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS mobile_family_form_request_student_idx
  ON platform.mobile_family_form_request (tenant_id, student_profile_id, status, due_at, form_id);

CREATE OR REPLACE FUNCTION platform.enforce_mobile_family_form_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT platform.mobile_family_form_fields_are_valid(NEW.fields) THEN
    RAISE EXCEPTION 'MOBILE_FAMILY_FORM_SCHEMA_INVALID' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.fields IS DISTINCT FROM OLD.fields
     AND NEW.schema_version <= OLD.schema_version THEN
    RAISE EXCEPTION 'MOBILE_FAMILY_FORM_SCHEMA_VERSION_NOT_ADVANCED' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status <> 'open'
     AND (
       NEW.student_profile_id IS DISTINCT FROM OLD.student_profile_id
       OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
       OR NEW.fields IS DISTINCT FROM OLD.fields
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     ) THEN
    RAISE EXCEPTION 'MOBILE_FAMILY_FORM_COMPLETED_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status <> 'open'
     AND NEW.status = 'open' THEN
    RAISE EXCEPTION 'MOBILE_FAMILY_FORM_STATUS_REGRESSION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION platform.enforce_mobile_family_form_request() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.enforce_mobile_family_form_request() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_family_form_request_guard ON platform.mobile_family_form_request;
CREATE TRIGGER mobile_family_form_request_guard
BEFORE INSERT OR UPDATE ON platform.mobile_family_form_request
FOR EACH ROW EXECUTE FUNCTION platform.enforce_mobile_family_form_request();

CREATE TABLE IF NOT EXISTS platform.mobile_family_form_submission (
  tenant_id uuid NOT NULL,
  submission_id uuid NOT NULL DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL,
  student_profile_id uuid NOT NULL,
  submitted_by_person_id uuid NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  accepted_revision bigint NOT NULL CHECK (accepted_revision > 0),
  answers jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, submission_id),
  UNIQUE (tenant_id, form_id),
  FOREIGN KEY (tenant_id, form_id)
    REFERENCES platform.mobile_family_form_request (tenant_id, form_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  FOREIGN KEY (tenant_id, submitted_by_person_id)
    REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS platform.mobile_family_form_command (
  tenant_id uuid NOT NULL,
  account_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  form_id uuid NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  accepted_revision bigint NOT NULL CHECK (accepted_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, account_id, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES iam.account (account_id),
  FOREIGN KEY (tenant_id, form_id)
    REFERENCES platform.mobile_family_form_request (tenant_id, form_id)
);

CREATE TABLE IF NOT EXISTS platform.mobile_family_consent_request (
  tenant_id uuid NOT NULL,
  consent_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  title text NOT NULL CHECK (btrim(title) <> '' AND char_length(title) <= 512),
  policy_version text NOT NULL CHECK (btrim(policy_version) <> '' AND char_length(policy_version) <= 128),
  purpose text NOT NULL CHECK (btrim(purpose) <> '' AND char_length(purpose) <= 1024),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'declined')),
  due_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  canonical_consent_id uuid,
  decided_by_person_id uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, consent_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  FOREIGN KEY (tenant_id, canonical_consent_id)
    REFERENCES people.consent_record (tenant_id, consent_id),
  FOREIGN KEY (tenant_id, decided_by_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (
    (status = 'pending' AND canonical_consent_id IS NULL AND decided_by_person_id IS NULL AND decided_at IS NULL)
    OR
    (status = 'granted' AND canonical_consent_id IS NOT NULL AND decided_by_person_id IS NOT NULL AND decided_at IS NOT NULL)
    OR
    (status = 'declined' AND canonical_consent_id IS NULL AND decided_by_person_id IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS mobile_family_consent_request_student_idx
  ON platform.mobile_family_consent_request (tenant_id, student_profile_id, status, due_at, consent_id);

CREATE OR REPLACE FUNCTION platform.enforce_mobile_family_consent_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status <> 'pending'
     AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'MOBILE_FAMILY_CONSENT_DECIDED_REQUEST_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'pending'
     AND NEW.purpose IS DISTINCT FROM OLD.purpose
     AND NEW.policy_version IS NOT DISTINCT FROM OLD.policy_version THEN
    RAISE EXCEPTION 'MOBILE_FAMILY_CONSENT_PURPOSE_REQUIRES_POLICY_VERSION' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'pending'
     AND NEW.student_profile_id IS DISTINCT FROM OLD.student_profile_id
     AND NEW.version <= OLD.version THEN
    RAISE EXCEPTION 'MOBILE_FAMILY_CONSENT_REASSIGNMENT_REQUIRES_VERSION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION platform.enforce_mobile_family_consent_request() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.enforce_mobile_family_consent_request() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_family_consent_request_guard ON platform.mobile_family_consent_request;
CREATE TRIGGER mobile_family_consent_request_guard
BEFORE UPDATE ON platform.mobile_family_consent_request
FOR EACH ROW EXECUTE FUNCTION platform.enforce_mobile_family_consent_request();

CREATE TABLE IF NOT EXISTS platform.mobile_family_consent_command (
  tenant_id uuid NOT NULL,
  account_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  consent_id uuid NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  accepted_revision bigint NOT NULL CHECK (accepted_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, account_id, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES iam.account (account_id),
  FOREIGN KEY (tenant_id, consent_id)
    REFERENCES platform.mobile_family_consent_request (tenant_id, consent_id)
);

REVOKE ALL ON TABLE platform.mobile_family_form_request FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_family_form_request FROM app_runtime;
REVOKE ALL ON TABLE platform.mobile_family_form_submission FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_family_form_submission FROM app_runtime;
REVOKE ALL ON TABLE platform.mobile_family_form_command FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_family_form_command FROM app_runtime;
REVOKE ALL ON TABLE platform.mobile_family_consent_request FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_family_consent_request FROM app_runtime;
REVOKE ALL ON TABLE platform.mobile_family_consent_command FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_family_consent_command FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_interaction_authority(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text
)
RETURNS TABLE (
  account_id uuid,
  viewer_person_id uuid,
  local_date date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_time_zone text;
  selected_capabilities text[];
  selected_person_id uuid;
  linked_person_count bigint;
BEGIN
  IF p_persona <> 'guardian' THEN RETURN; END IF;

  SELECT scope.account_id, scope.time_zone, scope.capabilities
  INTO selected_account_id, selected_time_zone, selected_capabilities
  FROM platform.resolve_mobile_request_scope(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS scope;

  IF selected_account_id IS NULL
     OR selected_time_zone IS NULL
     OR NOT ('forms.consent' = ANY(coalesce(selected_capabilities, ARRAY[]::text[]))) THEN
    RETURN;
  END IF;

  SELECT count(*), min(link.person_id::text)::uuid
  INTO linked_person_count, selected_person_id
  FROM iam.person_link AS link
  JOIN people.person AS person
    ON person.tenant_id = link.tenant_id
   AND person.person_id = link.person_id
   AND person.status = 'active'
  WHERE link.tenant_id = p_tenant_id
    AND link.account_id = selected_account_id;

  IF linked_person_count <> 1 OR selected_person_id IS NULL THEN RETURN; END IF;

  account_id := selected_account_id;
  viewer_person_id := selected_person_id;
  local_date := (clock_timestamp() AT TIME ZONE selected_time_zone)::date;
  RETURN NEXT;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_interaction_authority(
  text, text, uuid, uuid, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.resolve_mobile_family_interaction_authority(
  text, text, uuid, uuid, text
) FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_forms(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_student_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_viewer_person_id uuid;
  selected_local_date date;
  payload jsonb;
BEGIN
  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_interaction_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_local_date IS NULL
     OR NOT platform.mobile_family_student_is_authorized(
       p_tenant_id,
       p_campus_id,
       'guardian',
       selected_viewer_person_id,
       p_student_profile_id,
       selected_local_date
     ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'forms',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'formId', request.form_id,
          'title', request.title,
          'status', CASE
            WHEN request.status = 'open' AND request.due_at IS NOT NULL AND request.due_at <= clock_timestamp()
              THEN 'closed'
            ELSE request.status
          END,
          'dueAt', CASE
            WHEN request.due_at IS NULL THEN NULL
            ELSE to_char(request.due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          END
        ) ORDER BY request.created_at DESC, request.form_id DESC
      ),
      '[]'::jsonb
    )
  )
  INTO payload
  FROM platform.mobile_family_form_request AS request
  WHERE request.tenant_id = p_tenant_id
    AND request.student_profile_id = p_student_profile_id;

  RETURN payload;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_forms(
  text, text, uuid, uuid, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_family_forms(
  text, text, uuid, uuid, text, uuid
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_form(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_form_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_viewer_person_id uuid;
  selected_local_date date;
  selected_request platform.mobile_family_form_request%ROWTYPE;
BEGIN
  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_interaction_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS authority;

  IF selected_account_id IS NULL OR selected_viewer_person_id IS NULL OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT request.*
  INTO selected_request
  FROM platform.mobile_family_form_request AS request
  WHERE request.tenant_id = p_tenant_id
    AND request.form_id = p_form_id;

  IF selected_request.form_id IS NULL
     OR NOT platform.mobile_family_student_is_authorized(
       p_tenant_id,
       p_campus_id,
       'guardian',
       selected_viewer_person_id,
       selected_request.student_profile_id,
       selected_local_date
     ) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'formId', selected_request.form_id,
    'title', selected_request.title,
    'status', CASE
      WHEN selected_request.status = 'open'
           AND selected_request.due_at IS NOT NULL
           AND selected_request.due_at <= clock_timestamp() THEN 'closed'
      ELSE selected_request.status
    END,
    'dueAt', CASE
      WHEN selected_request.due_at IS NULL THEN NULL
      ELSE to_char(selected_request.due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    END,
    'baseVersion', selected_request.version,
    'schemaVersion', selected_request.schema_version,
    'fields', selected_request.fields
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_form(
  text, text, uuid, uuid, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_family_form(
  text, text, uuid, uuid, text, uuid
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.submit_mobile_family_form(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_form_id uuid,
  p_student_profile_id uuid,
  p_schema_version integer,
  p_base_version bigint,
  p_answers jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_viewer_person_id uuid;
  selected_local_date date;
  selected_request platform.mobile_family_form_request%ROWTYPE;
  previous_command platform.mobile_family_form_command%ROWTYPE;
  request_digest text;
  accepted_revision bigint;
  selected_now timestamptz := clock_timestamp();
BEGIN
  IF p_form_id IS NULL
     OR p_student_profile_id IS NULL
     OR p_schema_version IS NULL OR p_schema_version < 1
     OR p_base_version IS NULL OR p_base_version < 0
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' THEN
    RETURN NULL;
  END IF;

  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_interaction_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_local_date IS NULL
     OR NOT platform.mobile_family_student_is_authorized(
       p_tenant_id,
       p_campus_id,
       'guardian',
       selected_viewer_person_id,
       p_student_profile_id,
       selected_local_date
     ) THEN
    RETURN NULL;
  END IF;

  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          p_tenant_id::text,
          p_campus_id::text,
          p_persona,
          p_form_id::text,
          p_student_profile_id::text,
          p_schema_version::text,
          p_base_version::text,
          coalesce(p_answers::text, 'null')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'mobile-family-form:' || selected_account_id::text || ':' || p_idempotency_key,
      0
    )
  );

  SELECT request.*
  INTO selected_request
  FROM platform.mobile_family_form_request AS request
  WHERE request.tenant_id = p_tenant_id
    AND request.form_id = p_form_id
    AND request.student_profile_id = p_student_profile_id
  FOR UPDATE;

  IF selected_request.form_id IS NULL THEN RETURN NULL; END IF;

  SELECT command.*
  INTO previous_command
  FROM platform.mobile_family_form_command AS command
  WHERE command.tenant_id = p_tenant_id
    AND command.account_id = selected_account_id
    AND command.idempotency_key = p_idempotency_key;

  IF previous_command.idempotency_key IS NOT NULL THEN
    IF previous_command.request_digest <> request_digest THEN
      RETURN jsonb_build_object('status', 'idempotency-conflict');
    END IF;
    RETURN jsonb_build_object('acceptedRevision', previous_command.accepted_revision);
  END IF;
  IF selected_request.status <> 'open'
     OR (selected_request.due_at IS NOT NULL AND selected_request.due_at <= selected_now) THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;
  IF selected_request.schema_version <> p_schema_version THEN
    RETURN jsonb_build_object('status', 'schema-mismatch');
  END IF;
  IF selected_request.version <> p_base_version THEN
    RETURN jsonb_build_object('status', 'stale');
  END IF;
  IF NOT platform.mobile_family_form_answers_are_valid(selected_request.fields, p_answers) THEN
    RETURN jsonb_build_object('status', 'invalid-answers');
  END IF;

  accepted_revision := selected_request.version + 1;

  INSERT INTO platform.mobile_family_form_submission (
    tenant_id,
    form_id,
    student_profile_id,
    submitted_by_person_id,
    schema_version,
    accepted_revision,
    answers,
    submitted_at
  ) VALUES (
    p_tenant_id,
    selected_request.form_id,
    selected_request.student_profile_id,
    selected_viewer_person_id,
    selected_request.schema_version,
    accepted_revision,
    p_answers,
    selected_now
  );

  UPDATE platform.mobile_family_form_request
  SET status = 'submitted',
      version = accepted_revision,
      submitted_at = selected_now
  WHERE tenant_id = p_tenant_id
    AND form_id = selected_request.form_id;

  INSERT INTO platform.mobile_family_form_command (
    tenant_id,
    account_id,
    idempotency_key,
    form_id,
    request_digest,
    accepted_revision
  ) VALUES (
    p_tenant_id,
    selected_account_id,
    p_idempotency_key,
    selected_request.form_id,
    request_digest,
    accepted_revision
  );

  RETURN jsonb_build_object('acceptedRevision', accepted_revision);
END
$function$;

REVOKE ALL ON FUNCTION platform.submit_mobile_family_form(
  text, text, uuid, uuid, text, uuid, uuid, integer, bigint, jsonb, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.submit_mobile_family_form(
  text, text, uuid, uuid, text, uuid, uuid, integer, bigint, jsonb, text
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_consents(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_student_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_viewer_person_id uuid;
  selected_local_date date;
  payload jsonb;
BEGIN
  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_interaction_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_local_date IS NULL
     OR NOT platform.mobile_family_student_is_authorized(
       p_tenant_id,
       p_campus_id,
       'guardian',
       selected_viewer_person_id,
       p_student_profile_id,
       selected_local_date
     ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'consents',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'consentId', request.consent_id,
          'studentId', request.student_profile_id,
          'title', request.title,
          'policyVersion', request.policy_version,
          'status', CASE
            WHEN request.status = 'pending' AND request.due_at IS NOT NULL AND request.due_at <= clock_timestamp()
              THEN 'expired'
            ELSE request.status
          END,
          'dueAt', CASE
            WHEN request.due_at IS NULL THEN NULL
            ELSE to_char(request.due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          END
        ) ORDER BY request.created_at DESC, request.consent_id DESC
      ),
      '[]'::jsonb
    )
  )
  INTO payload
  FROM platform.mobile_family_consent_request AS request
  WHERE request.tenant_id = p_tenant_id
    AND request.student_profile_id = p_student_profile_id;

  RETURN payload;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_consents(
  text, text, uuid, uuid, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_family_consents(
  text, text, uuid, uuid, text, uuid
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.decide_mobile_family_consent(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_consent_id uuid,
  p_student_profile_id uuid,
  p_policy_version text,
  p_decision text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_viewer_person_id uuid;
  selected_local_date date;
  selected_request platform.mobile_family_consent_request%ROWTYPE;
  previous_command platform.mobile_family_consent_command%ROWTYPE;
  request_digest text;
  accepted_revision bigint;
  new_canonical_consent_id uuid;
  subject_person_id uuid;
  selected_now timestamptz := clock_timestamp();
BEGIN
  IF p_consent_id IS NULL
     OR p_student_profile_id IS NULL
     OR p_policy_version IS NULL
     OR btrim(p_policy_version) = ''
     OR char_length(p_policy_version) > 128
     OR p_decision NOT IN ('grant', 'decline')
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' THEN
    RETURN NULL;
  END IF;

  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_interaction_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_local_date IS NULL
     OR NOT platform.mobile_family_student_is_authorized(
       p_tenant_id,
       p_campus_id,
       'guardian',
       selected_viewer_person_id,
       p_student_profile_id,
       selected_local_date
     ) THEN
    RETURN NULL;
  END IF;

  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          p_tenant_id::text,
          p_campus_id::text,
          p_persona,
          p_consent_id::text,
          p_student_profile_id::text,
          p_policy_version,
          p_decision
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'mobile-family-consent:' || selected_account_id::text || ':' || p_idempotency_key,
      0
    )
  );

  SELECT request.*
  INTO selected_request
  FROM platform.mobile_family_consent_request AS request
  WHERE request.tenant_id = p_tenant_id
    AND request.consent_id = p_consent_id
    AND request.student_profile_id = p_student_profile_id
  FOR UPDATE;

  IF selected_request.consent_id IS NULL THEN RETURN NULL; END IF;

  SELECT command.*
  INTO previous_command
  FROM platform.mobile_family_consent_command AS command
  WHERE command.tenant_id = p_tenant_id
    AND command.account_id = selected_account_id
    AND command.idempotency_key = p_idempotency_key;

  IF previous_command.idempotency_key IS NOT NULL THEN
    IF previous_command.request_digest <> request_digest THEN
      RETURN jsonb_build_object('status', 'idempotency-conflict');
    END IF;
    RETURN jsonb_build_object('acceptedRevision', previous_command.accepted_revision);
  END IF;
  IF selected_request.policy_version <> p_policy_version THEN
    RETURN jsonb_build_object('status', 'policy-mismatch');
  END IF;
  IF selected_request.status <> 'pending'
     OR (selected_request.due_at IS NOT NULL AND selected_request.due_at <= selected_now) THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;

  accepted_revision := selected_request.version + 1;

  IF p_decision = 'grant' THEN
    SELECT profile.person_id
    INTO subject_person_id
    FROM student_lifecycle.student_profile AS profile
    WHERE profile.tenant_id = p_tenant_id
      AND profile.student_profile_id = selected_request.student_profile_id;

    IF subject_person_id IS NULL THEN RETURN NULL; END IF;

    INSERT INTO people.consent_record (
      tenant_id,
      subject_person_id,
      granted_by_person_id,
      purpose,
      status,
      effective_from,
      version,
      recorded_at
    ) VALUES (
      p_tenant_id,
      subject_person_id,
      selected_viewer_person_id,
      selected_request.purpose,
      'granted',
      selected_now,
      1,
      selected_now
    )
    RETURNING consent_id INTO new_canonical_consent_id;

    UPDATE platform.mobile_family_consent_request
    SET status = 'granted',
        version = accepted_revision,
        canonical_consent_id = new_canonical_consent_id,
        decided_by_person_id = selected_viewer_person_id,
        decided_at = selected_now
    WHERE tenant_id = p_tenant_id
      AND consent_id = selected_request.consent_id;
  ELSE
    UPDATE platform.mobile_family_consent_request
    SET status = 'declined',
        version = accepted_revision,
        decided_by_person_id = selected_viewer_person_id,
        decided_at = selected_now
    WHERE tenant_id = p_tenant_id
      AND consent_id = selected_request.consent_id;
  END IF;

  INSERT INTO platform.mobile_family_consent_command (
    tenant_id,
    account_id,
    idempotency_key,
    consent_id,
    request_digest,
    accepted_revision
  ) VALUES (
    p_tenant_id,
    selected_account_id,
    p_idempotency_key,
    selected_request.consent_id,
    request_digest,
    accepted_revision
  );

  RETURN jsonb_build_object('acceptedRevision', accepted_revision);
END
$function$;

REVOKE ALL ON FUNCTION platform.decide_mobile_family_consent(
  text, text, uuid, uuid, text, uuid, uuid, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.decide_mobile_family_consent(
  text, text, uuid, uuid, text, uuid, uuid, text, text, text
) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608210003_MOB-06B_mobile_family_forms_consents',
  'MOB-06B',
  'Authoritative guardian Family forms and consent decisions with canonical granted-consent evidence'
)
ON CONFLICT (migration_id) DO NOTHING;
