CREATE TABLE IF NOT EXISTS platform.mobile_family_document_publication (
  tenant_id uuid NOT NULL,
  publication_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  document_id uuid NOT NULL,
  title text NOT NULL CHECK (btrim(title) <> '' AND char_length(title) <= 512),
  file_name text NOT NULL CHECK (btrim(file_name) <> '' AND char_length(file_name) <= 512),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
  issued_at timestamptz NOT NULL,
  classification text NOT NULL CHECK (classification IN ('general', 'personal', 'restricted')),
  cache_policy text NOT NULL CHECK (cache_policy IN ('noStore', 'encryptedTemporary')),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  publication_state text NOT NULL DEFAULT 'published'
    CHECK (publication_state IN ('published', 'withdrawn')),
  published_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, publication_id),
  UNIQUE (tenant_id, student_profile_id, document_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  CHECK (classification <> 'restricted' OR cache_policy = 'noStore'),
  CHECK (
    (publication_state = 'published' AND withdrawn_at IS NULL)
    OR
    (publication_state = 'withdrawn' AND withdrawn_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS mobile_family_document_publication_page_idx
  ON platform.mobile_family_document_publication
  (tenant_id, student_profile_id, publication_state, issued_at DESC, document_id DESC);

CREATE OR REPLACE FUNCTION platform.enforce_mobile_family_document_publication_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM student_lifecycle.profile_document AS profile_document
    WHERE profile_document.tenant_id = NEW.tenant_id
      AND profile_document.profile_kind = 'student'
      AND profile_document.profile_id = NEW.student_profile_id
      AND profile_document.document_id = NEW.document_id
      AND profile_document.visibility IN ('standard', 'guardian-visible')
  ) THEN
    RAISE EXCEPTION 'MOBILE_FAMILY_DOCUMENT_PUBLICATION_AUTHORITY_INVALID'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION platform.enforce_mobile_family_document_publication_authority() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.enforce_mobile_family_document_publication_authority() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_family_document_publication_authority_guard
  ON platform.mobile_family_document_publication;
CREATE TRIGGER mobile_family_document_publication_authority_guard
BEFORE INSERT OR UPDATE OF tenant_id, student_profile_id, document_id
ON platform.mobile_family_document_publication
FOR EACH ROW
EXECUTE FUNCTION platform.enforce_mobile_family_document_publication_authority();

CREATE TABLE IF NOT EXISTS platform.mobile_family_document_download_grant (
  tenant_id uuid NOT NULL,
  grant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  persona text NOT NULL CHECK (persona IN ('guardian', 'student')),
  student_profile_id uuid NOT NULL,
  publication_id uuid NOT NULL,
  document_id uuid NOT NULL,
  idempotency_key text NOT NULL
    CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  requires_step_up boolean NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  claim_idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, grant_id),
  UNIQUE (account_id, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES iam.account (account_id),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  FOREIGN KEY (tenant_id, publication_id)
    REFERENCES platform.mobile_family_document_publication (tenant_id, publication_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  CHECK (expires_at > created_at),
  CHECK (
    claim_idempotency_key IS NULL
    OR claim_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
  )
);

CREATE INDEX IF NOT EXISTS mobile_family_document_grant_account_idx
  ON platform.mobile_family_document_download_grant
  (account_id, tenant_id, campus_id, expires_at DESC);

REVOKE ALL ON TABLE platform.mobile_family_document_publication FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_family_document_publication FROM app_runtime;
REVOKE ALL ON TABLE platform.mobile_family_document_download_grant FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_family_document_download_grant FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_document_identity_authority(
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
  IF p_persona NOT IN ('guardian', 'student') THEN RETURN; END IF;

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
     OR NOT ('documents.read' = ANY(coalesce(selected_capabilities, ARRAY[]::text[]))) THEN
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

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_document_identity_authority(
  text, text, uuid, uuid, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.resolve_mobile_family_document_identity_authority(
  text, text, uuid, uuid, text
) FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.mobile_family_student_is_authorized(
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_viewer_person_id uuid,
  p_student_profile_id uuid,
  p_local_date date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM student_lifecycle.student_profile AS student_profile
    JOIN student_lifecycle.enrollment AS enrollment
      ON enrollment.tenant_id = student_profile.tenant_id
     AND enrollment.student_profile_id = student_profile.student_profile_id
     AND enrollment.campus_id = p_campus_id
     AND enrollment.status = 'active'
     AND enrollment.effective_from <= p_local_date
     AND (enrollment.effective_to IS NULL OR enrollment.effective_to >= p_local_date)
    WHERE student_profile.tenant_id = p_tenant_id
      AND student_profile.student_profile_id = p_student_profile_id
      AND student_profile.status = 'active'
      AND (
        (p_persona = 'student' AND student_profile.person_id = p_viewer_person_id)
        OR
        (
          p_persona = 'guardian'
          AND EXISTS (
            SELECT 1
            FROM people.guardian_student_authority AS authority
            WHERE authority.tenant_id = p_tenant_id
              AND authority.guardian_person_id = p_viewer_person_id
              AND authority.student_person_id = student_profile.person_id
              AND authority.portal_access = true
              AND authority.verification_status = 'verified'
              AND authority.effective_from <= p_local_date
              AND (authority.effective_to IS NULL OR authority.effective_to >= p_local_date)
          )
        )
      )
  )
$function$;

REVOKE ALL ON FUNCTION platform.mobile_family_student_is_authorized(
  uuid, uuid, text, uuid, uuid, date
) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_family_student_is_authorized(
  uuid, uuid, text, uuid, uuid, date
) FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_documents(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_student_profile_id uuid,
  p_cursor_document_id uuid,
  p_limit integer
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
  cursor_issued_at timestamptz;
  documents_payload jsonb;
  next_cursor uuid;
BEGIN
  IF p_tenant_id IS NULL
     OR p_campus_id IS NULL
     OR p_student_profile_id IS NULL
     OR p_limit IS NULL
     OR p_limit NOT BETWEEN 1 AND 100 THEN
    RETURN NULL;
  END IF;

  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_document_identity_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT platform.mobile_family_student_is_authorized(
    p_tenant_id,
    p_campus_id,
    p_persona,
    selected_viewer_person_id,
    p_student_profile_id,
    selected_local_date
  ) THEN
    RETURN NULL;
  END IF;

  IF p_cursor_document_id IS NOT NULL THEN
    SELECT publication.issued_at
    INTO cursor_issued_at
    FROM platform.mobile_family_document_publication AS publication
    JOIN student_lifecycle.profile_document AS profile_document
      ON profile_document.tenant_id = publication.tenant_id
     AND profile_document.profile_kind = 'student'
     AND profile_document.profile_id = publication.student_profile_id
     AND profile_document.document_id = publication.document_id
    JOIN integration_core.document_object AS document
      ON document.tenant_id = publication.tenant_id
     AND document.document_id = publication.document_id
     AND document.scan_status = 'clean'
    WHERE publication.tenant_id = p_tenant_id
      AND publication.student_profile_id = p_student_profile_id
      AND publication.document_id = p_cursor_document_id
      AND publication.publication_state = 'published'
      AND profile_document.visibility IN ('standard', 'guardian-visible')
      AND (profile_document.valid_from IS NULL OR profile_document.valid_from <= selected_local_date)
      AND (profile_document.valid_to IS NULL OR profile_document.valid_to >= selected_local_date)
    LIMIT 1;

    IF cursor_issued_at IS NULL THEN RETURN NULL; END IF;
  END IF;

  WITH available AS (
    SELECT
      publication.document_id,
      publication.title,
      publication.file_name,
      publication.size_bytes,
      publication.issued_at,
      publication.classification,
      publication.cache_policy
    FROM platform.mobile_family_document_publication AS publication
    JOIN student_lifecycle.profile_document AS profile_document
      ON profile_document.tenant_id = publication.tenant_id
     AND profile_document.profile_kind = 'student'
     AND profile_document.profile_id = publication.student_profile_id
     AND profile_document.document_id = publication.document_id
    JOIN integration_core.document_object AS document
      ON document.tenant_id = publication.tenant_id
     AND document.document_id = publication.document_id
     AND document.scan_status = 'clean'
    WHERE publication.tenant_id = p_tenant_id
      AND publication.student_profile_id = p_student_profile_id
      AND publication.publication_state = 'published'
      AND profile_document.visibility IN ('standard', 'guardian-visible')
      AND (profile_document.valid_from IS NULL OR profile_document.valid_from <= selected_local_date)
      AND (profile_document.valid_to IS NULL OR profile_document.valid_to >= selected_local_date)
      AND (
        p_cursor_document_id IS NULL
        OR publication.issued_at < cursor_issued_at
        OR (
          publication.issued_at = cursor_issued_at
          AND publication.document_id < p_cursor_document_id
        )
      )
    ORDER BY publication.issued_at DESC, publication.document_id DESC
    LIMIT p_limit + 1
  ), page AS (
    SELECT *
    FROM available
    ORDER BY issued_at DESC, document_id DESC
    LIMIT p_limit
  )
  SELECT
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'documentId', page.document_id,
            'title', page.title,
            'fileName', page.file_name,
            'sizeBytes', page.size_bytes,
            'issuedAt', to_char(
              page.issued_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'classification', page.classification,
            'cachePolicy', page.cache_policy
          ) ORDER BY page.issued_at DESC, page.document_id DESC
        )
        FROM page
      ),
      '[]'::jsonb
    ),
    CASE
      WHEN (SELECT count(*) FROM available) > p_limit THEN
        (SELECT page.document_id FROM page ORDER BY page.issued_at, page.document_id LIMIT 1)
      ELSE NULL
    END
  INTO documents_payload, next_cursor;

  RETURN jsonb_build_object('documents', documents_payload, 'nextCursor', next_cursor);
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_documents(
  text, text, uuid, uuid, text, uuid, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_family_documents(
  text, text, uuid, uuid, text, uuid, uuid, integer
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.issue_mobile_family_document_download_grant(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_document_id uuid,
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
  selected_publication platform.mobile_family_document_publication%ROWTYPE;
  previous_grant platform.mobile_family_document_download_grant%ROWTYPE;
  request_digest text;
  grant_expires_at timestamptz;
BEGIN
  IF p_tenant_id IS NULL
     OR p_campus_id IS NULL
     OR p_document_id IS NULL
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' THEN
    RETURN NULL;
  END IF;

  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_document_identity_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_local_date IS NULL THEN
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
          p_document_id::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'mobile-family-document-grant:' || selected_account_id::text || ':' || p_idempotency_key,
      0
    )
  );

  SELECT document_grant.*
  INTO previous_grant
  FROM platform.mobile_family_document_download_grant AS document_grant
  WHERE document_grant.account_id = selected_account_id
    AND document_grant.idempotency_key = p_idempotency_key
  LIMIT 1;

  IF previous_grant.grant_id IS NOT NULL THEN
    IF previous_grant.request_digest <> request_digest THEN
      RETURN jsonb_build_object('status', 'idempotency-conflict');
    END IF;
    RETURN jsonb_build_object(
      'documentId', previous_grant.document_id,
      'expiresAt', to_char(
        previous_grant.expires_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'grantId', previous_grant.grant_id,
      'requiresStepUp', previous_grant.requires_step_up,
      'singleUse', true
    );
  END IF;

  SELECT publication.*
  INTO selected_publication
  FROM platform.mobile_family_document_publication AS publication
  JOIN student_lifecycle.profile_document AS profile_document
    ON profile_document.tenant_id = publication.tenant_id
   AND profile_document.profile_kind = 'student'
   AND profile_document.profile_id = publication.student_profile_id
   AND profile_document.document_id = publication.document_id
  JOIN integration_core.document_object AS document
    ON document.tenant_id = publication.tenant_id
   AND document.document_id = publication.document_id
   AND document.scan_status = 'clean'
  WHERE publication.tenant_id = p_tenant_id
    AND publication.document_id = p_document_id
    AND publication.publication_state = 'published'
    AND profile_document.visibility IN ('standard', 'guardian-visible')
    AND (profile_document.valid_from IS NULL OR profile_document.valid_from <= selected_local_date)
    AND (profile_document.valid_to IS NULL OR profile_document.valid_to >= selected_local_date)
    AND platform.mobile_family_student_is_authorized(
      p_tenant_id,
      p_campus_id,
      p_persona,
      selected_viewer_person_id,
      publication.student_profile_id,
      selected_local_date
    )
  ORDER BY
    CASE publication.classification WHEN 'restricted' THEN 0 WHEN 'personal' THEN 1 ELSE 2 END,
    publication.student_profile_id,
    publication.publication_id
  LIMIT 1;

  IF selected_publication.publication_id IS NULL THEN RETURN NULL; END IF;

  grant_expires_at := clock_timestamp() + interval '5 minutes';

  INSERT INTO platform.mobile_family_document_download_grant (
    tenant_id,
    account_id,
    campus_id,
    persona,
    student_profile_id,
    publication_id,
    document_id,
    idempotency_key,
    request_digest,
    requires_step_up,
    expires_at
  ) VALUES (
    p_tenant_id,
    selected_account_id,
    p_campus_id,
    p_persona,
    selected_publication.student_profile_id,
    selected_publication.publication_id,
    selected_publication.document_id,
    p_idempotency_key,
    request_digest,
    selected_publication.classification = 'restricted',
    grant_expires_at
  )
  RETURNING * INTO previous_grant;

  RETURN jsonb_build_object(
    'documentId', previous_grant.document_id,
    'expiresAt', to_char(
      previous_grant.expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'grantId', previous_grant.grant_id,
    'requiresStepUp', previous_grant.requires_step_up,
    'singleUse', true
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.issue_mobile_family_document_download_grant(
  text, text, uuid, uuid, text, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.issue_mobile_family_document_download_grant(
  text, text, uuid, uuid, text, uuid, text
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.claim_mobile_family_document_download_grant(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_grant_id uuid,
  p_assurance text,
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
  selected_grant platform.mobile_family_document_download_grant%ROWTYPE;
  selected_object_key text;
  selected_content_type text;
  selected_size_bytes bigint;
  selected_sha256 text;
  selected_now timestamptz := clock_timestamp();
BEGIN
  IF p_tenant_id IS NULL
     OR p_campus_id IS NULL
     OR p_grant_id IS NULL
     OR p_assurance NOT IN ('aal1', 'aal2')
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' THEN
    RETURN NULL;
  END IF;

  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_document_identity_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'mobile-family-document-claim:' || p_tenant_id::text || ':' || p_grant_id::text,
      0
    )
  );

  SELECT document_grant.*
  INTO selected_grant
  FROM platform.mobile_family_document_download_grant AS document_grant
  WHERE document_grant.tenant_id = p_tenant_id
    AND document_grant.grant_id = p_grant_id
    AND document_grant.account_id = selected_account_id
    AND document_grant.campus_id = p_campus_id
    AND document_grant.persona = p_persona
  FOR UPDATE;

  IF selected_grant.grant_id IS NULL THEN RETURN NULL; END IF;

  IF selected_grant.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already-consumed');
  END IF;

  IF selected_grant.expires_at <= selected_now THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF selected_grant.requires_step_up AND p_assurance <> 'aal2' THEN
    RETURN jsonb_build_object('status', 'step-up-required');
  END IF;

  IF NOT platform.mobile_family_student_is_authorized(
    p_tenant_id,
    p_campus_id,
    p_persona,
    selected_viewer_person_id,
    selected_grant.student_profile_id,
    selected_local_date
  ) THEN
    RETURN NULL;
  END IF;

  SELECT
    document.object_key,
    document.content_type,
    publication.size_bytes,
    publication.content_sha256
  INTO
    selected_object_key,
    selected_content_type,
    selected_size_bytes,
    selected_sha256
  FROM platform.mobile_family_document_publication AS publication
  JOIN student_lifecycle.profile_document AS profile_document
    ON profile_document.tenant_id = publication.tenant_id
   AND profile_document.profile_kind = 'student'
   AND profile_document.profile_id = publication.student_profile_id
   AND profile_document.document_id = publication.document_id
  JOIN integration_core.document_object AS document
    ON document.tenant_id = publication.tenant_id
   AND document.document_id = publication.document_id
   AND document.scan_status = 'clean'
  WHERE publication.tenant_id = p_tenant_id
    AND publication.publication_id = selected_grant.publication_id
    AND publication.student_profile_id = selected_grant.student_profile_id
    AND publication.document_id = selected_grant.document_id
    AND publication.publication_state = 'published'
    AND profile_document.visibility IN ('standard', 'guardian-visible')
    AND (profile_document.valid_from IS NULL OR profile_document.valid_from <= selected_local_date)
    AND (profile_document.valid_to IS NULL OR profile_document.valid_to >= selected_local_date)
  LIMIT 1;

  IF selected_object_key IS NULL
     OR selected_content_type IS NULL
     OR selected_size_bytes IS NULL
     OR selected_sha256 IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE platform.mobile_family_document_download_grant
  SET consumed_at = selected_now,
      claim_idempotency_key = p_idempotency_key
  WHERE tenant_id = p_tenant_id
    AND grant_id = p_grant_id;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'documentId', selected_grant.document_id,
    'objectKey', selected_object_key,
    'contentType', selected_content_type,
    'sizeBytes', selected_size_bytes,
    'sha256Hex', selected_sha256
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.claim_mobile_family_document_download_grant(
  text, text, uuid, uuid, text, uuid, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.claim_mobile_family_document_download_grant(
  text, text, uuid, uuid, text, uuid, text, text
) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608210002_MOB-06A_mobile_family_documents',
  'MOB-06A',
  'Authoritative Family document publication, metadata reads and single-use secure download grants'
)
ON CONFLICT (migration_id) DO NOTHING;
