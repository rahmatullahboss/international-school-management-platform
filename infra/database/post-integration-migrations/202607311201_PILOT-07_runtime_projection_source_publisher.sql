DO $projection_publisher_roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_projection_admin') THEN
    CREATE ROLE app_projection_admin NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_projection_publisher') THEN
    CREATE ROLE app_projection_publisher NOLOGIN NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT app_projection_admin, app_projection_publisher TO %I', current_user);
END
$projection_publisher_roles$;

GRANT USAGE ON SCHEMA platform, iam, audit TO app_projection_admin;
GRANT USAGE ON SCHEMA platform, iam, audit TO app_projection_publisher;

CREATE TABLE IF NOT EXISTS platform.runtime_projection_persona_role (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  role_id uuid NOT NULL,
  persona text NOT NULL CHECK (persona IN ('admin', 'teacher', 'guardian', 'student')),
  configured_by text NOT NULL
    CHECK (configured_by ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{7,127}$'),
  configured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, role_id),
  FOREIGN KEY (tenant_id, role_id)
    REFERENCES iam.role (tenant_id, role_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS platform.runtime_projection_persona_role_event (
  configuration_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  role_id uuid NOT NULL,
  persona text NOT NULL CHECK (persona IN ('admin', 'teacher', 'guardian', 'student')),
  configured_by text NOT NULL
    CHECK (configured_by ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{7,127}$'),
  configured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, role_id)
    REFERENCES iam.role (tenant_id, role_id)
);

CREATE TABLE IF NOT EXISTS platform.runtime_projection_source_publication (
  publication_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL,
  campus_id uuid,
  persona text NOT NULL CHECK (persona IN ('admin', 'teacher', 'guardian', 'student')),
  subject_ref text NOT NULL CHECK (subject_ref ~ '^(account|person):[0-9a-f-]{36}$'),
  source_revision bigint NOT NULL CHECK (source_revision > 0),
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  payload_bytes integer NOT NULL CHECK (payload_bytes BETWEEN 2 AND 262144),
  publisher_id text NOT NULL CHECK (publisher_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'),
  correlation_id uuid NOT NULL,
  source_updated_at timestamptz NOT NULL,
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE NULLS NOT DISTINCT (
    tenant_id,
    membership_id,
    campus_id,
    source_revision
  ),
  FOREIGN KEY (tenant_id, membership_id)
    REFERENCES iam.membership (tenant_id, membership_id),
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE INDEX IF NOT EXISTS runtime_projection_source_publication_scope_idx
  ON platform.runtime_projection_source_publication (
    tenant_id,
    membership_id,
    campus_id,
    published_at DESC
  );

DROP TRIGGER IF EXISTS runtime_projection_persona_role_event_append_only
  ON platform.runtime_projection_persona_role_event;
CREATE TRIGGER runtime_projection_persona_role_event_append_only
BEFORE UPDATE OR DELETE ON platform.runtime_projection_persona_role_event
FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

DROP TRIGGER IF EXISTS runtime_projection_source_publication_append_only
  ON platform.runtime_projection_source_publication;
CREATE TRIGGER runtime_projection_source_publication_append_only
BEFORE UPDATE OR DELETE ON platform.runtime_projection_source_publication
FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

REVOKE ALL ON TABLE platform.runtime_projection_persona_role
  FROM PUBLIC, app_runtime, app_projection_admin, app_projection_publisher;
REVOKE ALL ON TABLE platform.runtime_projection_persona_role_event
  FROM PUBLIC, app_runtime, app_projection_admin, app_projection_publisher;
REVOKE ALL ON TABLE platform.runtime_projection_source_publication
  FROM PUBLIC, app_runtime, app_projection_admin, app_projection_publisher;

CREATE OR REPLACE FUNCTION platform.configure_runtime_projection_persona_role(
  p_tenant_id uuid,
  p_role_id uuid,
  p_persona text,
  p_configured_by text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam
AS $function$
DECLARE
  configured_at_value timestamptz := clock_timestamp();
BEGIN
  IF p_tenant_id IS NULL
     OR p_role_id IS NULL
     OR p_persona IS NULL
     OR p_persona NOT IN ('admin', 'teacher', 'guardian', 'student')
     OR p_configured_by IS NULL
     OR p_configured_by !~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{7,127}$' THEN
    RETURN jsonb_build_object('configured', false, 'reason', 'invalid-configuration');
  END IF;

  PERFORM 1
  FROM iam.role AS role_row
  WHERE role_row.tenant_id = p_tenant_id
    AND role_row.role_id = p_role_id
  FOR SHARE OF role_row;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('configured', false, 'reason', 'role-not-found');
  END IF;

  INSERT INTO platform.runtime_projection_persona_role (
    tenant_id,
    role_id,
    persona,
    configured_by,
    configured_at
  ) VALUES (
    p_tenant_id,
    p_role_id,
    p_persona,
    p_configured_by,
    configured_at_value
  )
  ON CONFLICT (tenant_id, role_id) DO UPDATE
  SET persona = EXCLUDED.persona,
      configured_by = EXCLUDED.configured_by,
      configured_at = EXCLUDED.configured_at;

  INSERT INTO platform.runtime_projection_persona_role_event (
    tenant_id,
    role_id,
    persona,
    configured_by,
    configured_at
  ) VALUES (
    p_tenant_id,
    p_role_id,
    p_persona,
    p_configured_by,
    configured_at_value
  );

  RETURN jsonb_build_object(
    'configured', true,
    'tenantId', p_tenant_id,
    'roleId', p_role_id,
    'persona', p_persona,
    'configuredAt', to_char(
      configured_at_value AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );
END
$function$;

CREATE OR REPLACE FUNCTION platform.publish_runtime_projection_source(
  p_tenant_id uuid,
  p_membership_id uuid,
  p_campus_id uuid,
  p_expected_previous_revision bigint,
  p_payload jsonb,
  p_source_updated_at timestamptz,
  p_publisher_id text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, audit
AS $function$
DECLARE
  selected_account_id uuid;
  selected_person_id uuid;
  selected_persona text;
  persona_count integer;
  selected_subject_ref text;
  current_source_revision bigint := 0;
  current_source_updated_at timestamptz;
  next_source_revision bigint;
  selected_payload_digest text;
  selected_payload_bytes integer;
  selected_publication_id uuid := gen_random_uuid();
  selected_published_at timestamptz := clock_timestamp();
BEGIN
  IF p_tenant_id IS NULL
     OR p_membership_id IS NULL
     OR p_expected_previous_revision IS NULL
     OR p_expected_previous_revision < 0
     OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object'
     OR p_payload = '{}'::jsonb
     OR p_payload ?| ARRAY[
       'scope',
       'tenantId',
       'membershipId',
       'campusId',
       'role',
       'persona',
       'subjectId',
       'subjectRef',
       'capabilities'
     ]
     OR octet_length(convert_to(p_payload::text, 'UTF8')) NOT BETWEEN 2 AND 262144
     OR p_source_updated_at IS NULL
     OR p_source_updated_at > clock_timestamp() + interval '1 minute'
     OR p_publisher_id IS NULL
     OR p_publisher_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'
     OR p_correlation_id IS NULL THEN
    RETURN jsonb_build_object('published', false, 'reason', 'invalid-publication');
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
    RETURN jsonb_build_object('published', false, 'reason', 'scope-inactive');
  END IF;

  PERFORM 1
  FROM iam.membership_role AS membership_role
  WHERE membership_role.tenant_id = p_tenant_id
    AND membership_role.membership_id = p_membership_id
  FOR SHARE OF membership_role;

  PERFORM 1
  FROM iam.membership_role AS membership_role
  JOIN platform.runtime_projection_persona_role AS mapping
    ON mapping.tenant_id = membership_role.tenant_id
   AND mapping.role_id = membership_role.role_id
  WHERE membership_role.tenant_id = p_tenant_id
    AND membership_role.membership_id = p_membership_id
  FOR SHARE OF membership_role, mapping;

  SELECT count(DISTINCT mapping.persona), min(mapping.persona)
  INTO persona_count, selected_persona
  FROM iam.membership_role AS membership_role
  JOIN platform.runtime_projection_persona_role AS mapping
    ON mapping.tenant_id = membership_role.tenant_id
   AND mapping.role_id = membership_role.role_id
  WHERE membership_role.tenant_id = p_tenant_id
    AND membership_role.membership_id = p_membership_id;

  IF persona_count = 0 THEN
    RETURN jsonb_build_object('published', false, 'reason', 'persona-unmapped');
  END IF;
  IF persona_count > 1 THEN
    RETURN jsonb_build_object('published', false, 'reason', 'persona-ambiguous');
  END IF;

  SELECT person_link.person_id
  INTO selected_person_id
  FROM iam.person_link AS person_link
  WHERE person_link.tenant_id = p_tenant_id
    AND person_link.account_id = selected_account_id;

  selected_subject_ref := CASE
    WHEN selected_person_id IS NULL THEN 'account:' || selected_account_id::text
    ELSE 'person:' || selected_person_id::text
  END;

  SELECT source.source_revision, source.source_updated_at
  INTO current_source_revision, current_source_updated_at
  FROM platform.runtime_projection_source AS source
  WHERE source.tenant_id = p_tenant_id
    AND source.membership_id = p_membership_id
    AND source.campus_id IS NOT DISTINCT FROM p_campus_id
    AND source.projection_key = 'home'
  FOR UPDATE OF source;

  IF NOT FOUND THEN
    current_source_revision := 0;
    current_source_updated_at := NULL;
  END IF;

  IF current_source_revision <> p_expected_previous_revision THEN
    RETURN jsonb_build_object(
      'published', false,
      'reason', 'revision-conflict',
      'currentRevision', current_source_revision
    );
  END IF;
  IF current_source_updated_at IS NOT NULL
     AND p_source_updated_at < current_source_updated_at THEN
    RETURN jsonb_build_object('published', false, 'reason', 'source-stale');
  END IF;

  next_source_revision := current_source_revision + 1;

  INSERT INTO platform.runtime_projection_source (
    tenant_id,
    membership_id,
    campus_id,
    projection_key,
    persona,
    subject_ref,
    source_revision,
    payload,
    source_updated_at,
    payload_digest,
    payload_bytes
  ) VALUES (
    p_tenant_id,
    p_membership_id,
    p_campus_id,
    'home',
    selected_persona,
    selected_subject_ref,
    next_source_revision,
    p_payload,
    p_source_updated_at,
    repeat('0', 64),
    2
  )
  ON CONFLICT (tenant_id, membership_id, campus_id, projection_key) DO UPDATE
  SET persona = EXCLUDED.persona,
      subject_ref = EXCLUDED.subject_ref,
      source_revision = EXCLUDED.source_revision,
      payload = EXCLUDED.payload,
      source_updated_at = EXCLUDED.source_updated_at;

  SELECT source.payload_digest, source.payload_bytes
  INTO selected_payload_digest, selected_payload_bytes
  FROM platform.runtime_projection_source AS source
  WHERE source.tenant_id = p_tenant_id
    AND source.membership_id = p_membership_id
    AND source.campus_id IS NOT DISTINCT FROM p_campus_id
    AND source.projection_key = 'home';

  INSERT INTO platform.runtime_projection_source_publication (
    publication_id,
    tenant_id,
    membership_id,
    campus_id,
    persona,
    subject_ref,
    source_revision,
    payload_digest,
    payload_bytes,
    publisher_id,
    correlation_id,
    source_updated_at,
    published_at
  ) VALUES (
    selected_publication_id,
    p_tenant_id,
    p_membership_id,
    p_campus_id,
    selected_persona,
    selected_subject_ref,
    next_source_revision,
    selected_payload_digest,
    selected_payload_bytes,
    p_publisher_id,
    p_correlation_id,
    p_source_updated_at,
    selected_published_at
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
    'runtime.projection.source.published',
    'runtime_projection_source',
    p_membership_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'publicationId', selected_publication_id,
      'campusId', p_campus_id,
      'persona', selected_persona,
      'sourceRevision', next_source_revision,
      'payloadDigest', selected_payload_digest,
      'payloadBytes', selected_payload_bytes,
      'publisherId', p_publisher_id
    ),
    selected_published_at
  );

  RETURN jsonb_build_object(
    'published', true,
    'publication', jsonb_build_object(
      'publicationId', selected_publication_id,
      'tenantId', p_tenant_id,
      'membershipId', p_membership_id,
      'campusId', p_campus_id,
      'persona', selected_persona,
      'subjectRef', selected_subject_ref,
      'sourceRevision', next_source_revision,
      'payloadDigest', selected_payload_digest,
      'payloadBytes', selected_payload_bytes,
      'correlationId', p_correlation_id,
      'publishedAt', to_char(
        selected_published_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    )
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.configure_runtime_projection_persona_role(uuid, uuid, text, text)
  FROM PUBLIC, app_runtime, app_projection_publisher;
GRANT EXECUTE ON FUNCTION platform.configure_runtime_projection_persona_role(uuid, uuid, text, text)
  TO app_projection_admin;

REVOKE ALL ON FUNCTION platform.publish_runtime_projection_source(
  uuid, uuid, uuid, bigint, jsonb, timestamptz, text, uuid
) FROM PUBLIC, app_runtime, app_projection_admin;
GRANT EXECUTE ON FUNCTION platform.publish_runtime_projection_source(
  uuid, uuid, uuid, bigint, jsonb, timestamptz, text, uuid
) TO app_projection_publisher;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607311201_PILOT-07_runtime_projection_source_publisher',
  'PILOT-07',
  'Controlled database-owned runtime projection source publication with reviewed persona mapping, monotonic revisions and append-only evidence'
)
ON CONFLICT (migration_id) DO NOTHING;
