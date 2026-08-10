CREATE TABLE IF NOT EXISTS academics.program_grade_level_identity (
  tenant_id uuid NOT NULL,
  grade_level_id uuid NOT NULL DEFAULT gen_random_uuid(),
  program_version_id uuid NOT NULL,
  grade_level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, grade_level_id),
  UNIQUE (tenant_id, program_version_id, grade_level),
  FOREIGN KEY (tenant_id, program_version_id)
    REFERENCES academics.program_version (tenant_id, program_version_id),
  CHECK (length(btrim(grade_level)) > 0)
);

INSERT INTO academics.program_grade_level_identity (
  tenant_id, program_version_id, grade_level
)
SELECT
  program.tenant_id,
  program.program_version_id,
  grade.grade_level
FROM academics.program_version AS program
CROSS JOIN LATERAL (
  SELECT DISTINCT btrim(value) AS grade_level
  FROM jsonb_array_elements_text(program.grade_levels) AS element(value)
  WHERE length(btrim(value)) > 0
) AS grade
ON CONFLICT (tenant_id, program_version_id, grade_level) DO NOTHING;

CREATE OR REPLACE FUNCTION academics.sync_program_grade_level_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO academics.program_grade_level_identity (
    tenant_id, program_version_id, grade_level
  )
  SELECT NEW.tenant_id, NEW.program_version_id, grade.grade_level
  FROM (
    SELECT DISTINCT btrim(value) AS grade_level
    FROM jsonb_array_elements_text(NEW.grade_levels) AS element(value)
    WHERE length(btrim(value)) > 0
  ) AS grade
  ON CONFLICT (tenant_id, program_version_id, grade_level) DO NOTHING;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS program_grade_level_identity_sync ON academics.program_version;
CREATE TRIGGER program_grade_level_identity_sync
  AFTER INSERT OR UPDATE OF grade_levels ON academics.program_version
  FOR EACH ROW EXECUTE FUNCTION academics.sync_program_grade_level_identity();

ALTER TABLE academics.program_grade_level_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE academics.program_grade_level_identity FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy ON academics.program_grade_level_identity;
CREATE POLICY tenant_policy ON academics.program_grade_level_identity
  FOR ALL TO app_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT ON academics.program_grade_level_identity TO app_runtime;

CREATE OR REPLACE FUNCTION admissions.issue_application_offer_catalog_command(
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
SET search_path = pg_catalog, platform, admissions, academics
AS $function$
DECLARE
  session_context record;
  placement_exists boolean;
BEGIN
  IF p_grade_level_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;

  SELECT * INTO session_context
  FROM platform.resolve_operator_domain_command_session(p_session_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'session-inactive');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM admissions.application_program_choice AS choice
    JOIN academics.program_version AS program
      ON program.tenant_id = choice.tenant_id
     AND program.program_version_id = choice.program_id
     AND program.publication_state = 'published'
    JOIN academics.program_grade_level_identity AS grade
      ON grade.tenant_id = program.tenant_id
     AND grade.program_version_id = program.program_version_id
     AND grade.grade_level_id = p_grade_level_id
    JOIN academics.academic_year AS academic_year
      ON academic_year.tenant_id = program.tenant_id
     AND academic_year.academic_year_id = p_academic_year_id
     AND academic_year.publication_state = 'published'
    WHERE choice.tenant_id = session_context.tenant_id
      AND choice.application_id = p_application_id
      AND choice.program_id = p_program_id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(program.grade_levels) AS current_grade(value)
        WHERE btrim(current_grade.value) = grade.grade_level
      )
  ) INTO placement_exists;

  IF placement_exists IS NOT TRUE THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;

  RETURN admissions.issue_application_offer_command(
    p_session_id,
    p_application_id,
    p_expected_version,
    p_program_id,
    p_academic_year_id,
    p_grade_level_id,
    p_expires_at,
    p_idempotency_key,
    p_correlation_id
  );
END
$function$;

REVOKE ALL ON FUNCTION admissions.issue_application_offer_catalog_command(
  uuid, uuid, bigint, uuid, uuid, uuid, timestamptz, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admissions.issue_application_offer_catalog_command(
  uuid, uuid, bigint, uuid, uuid, uuid, timestamptz, text, uuid
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_admissions_lifecycle_work_queue(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, tenancy, admissions, academics
AS $function$
DECLARE
  selected_tenant_id uuid;
  selected_campus_id uuid;
  selected_role_key text;
  can_review boolean := false;
  can_issue boolean := false;
  can_accept boolean := false;
  can_convert boolean := false;
  selected_items jsonb;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  WITH active_session AS (
    SELECT
      session.tenant_id,
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
    AND role_key = 'admissions';

  IF selected_tenant_id IS NULL OR selected_campus_id IS NULL OR selected_role_key IS NULL THEN
    RETURN NULL;
  END IF;

  can_review := COALESCE((iam.evaluate_browser_permission(
    p_session_id, 'admissions.application.review'
  )->>'allowed')::boolean, false);
  can_issue := COALESCE((iam.evaluate_browser_permission(
    p_session_id, 'admissions.application.offer.issue'
  )->>'allowed')::boolean, false);
  can_accept := COALESCE((iam.evaluate_browser_permission(
    p_session_id, 'admissions.application.offer.accept'
  )->>'allowed')::boolean, false);
  can_convert := COALESCE((iam.evaluate_browser_permission(
    p_session_id, 'admissions.application.applicant.convert'
  )->>'allowed')::boolean, false);

  IF NOT (can_review OR can_issue OR can_accept OR can_convert) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(candidate.item ORDER BY candidate.sort_at DESC, candidate.application_number), '[]'::jsonb)
  INTO selected_items
  FROM (
    SELECT
      staged.updated_at AS sort_at,
      staged.application_number,
      jsonb_build_object(
        'applicationId', staged.application_id,
        'applicationNumber', staged.application_number,
        'status', staged.status,
        'version', staged.version,
        'submittedAt', CASE
          WHEN staged.submitted_at IS NULL THEN NULL
          ELSE to_char(staged.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        END,
        'action', staged.next_action,
        'placementOptions', CASE
          WHEN staged.next_action = 'issue-offer' THEN placement.options
          ELSE '[]'::jsonb
        END,
        'offerExpiresAt', CASE
          WHEN staged.next_action = 'accept-offer' THEN to_char(
            staged.offer_expires_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
          ELSE NULL
        END,
        'suggestedEffectiveFrom', CASE
          WHEN staged.next_action = 'convert-applicant' THEN to_char(
            GREATEST(current_date, staged.created_at::date + 1),
            'YYYY-MM-DD'
          )
          ELSE NULL
        END
      ) AS item
    FROM (
      SELECT
        application.application_id,
        application.application_number::text AS application_number,
        application.status,
        application.version,
        application.submitted_at,
        application.created_at,
        application.updated_at,
        offer.expires_at AS offer_expires_at,
        CASE
          WHEN application.status IN ('submitted', 'under-review')
               AND decision.decision IS NULL
               AND can_review
            THEN 'review'
          WHEN application.status = 'under-review'
               AND decision.decision = 'admit'
               AND offer.offer_id IS NULL
               AND can_issue
            THEN 'issue-offer'
          WHEN application.status = 'offered'
               AND offer.status = 'issued'
               AND offer.expires_at >= clock_timestamp()
               AND can_accept
               AND NOT EXISTS (
                 SELECT 1
                 FROM admissions.application_checklist_item AS checklist
                 WHERE checklist.tenant_id = application.tenant_id
                   AND checklist.application_id = application.application_id
                   AND checklist.required
                   AND checklist.status NOT IN ('verified', 'waived')
               )
               AND NOT EXISTS (
                 SELECT 1
                 FROM admissions.enrollment_contract AS contract
                 WHERE contract.tenant_id = application.tenant_id
                   AND contract.application_id = application.application_id
                   AND contract.status <> 'signed'
               )
            THEN 'accept-offer'
          WHEN application.status = 'accepted'
               AND offer.status = 'accepted'
               AND conversion.conversion_id IS NULL
               AND can_convert
            THEN 'convert-applicant'
          ELSE NULL
        END AS next_action
      FROM admissions.application AS application
      JOIN LATERAL (
        SELECT
          count(DISTINCT scope.campus_id) AS campus_count,
          min(scope.campus_id::text)::uuid AS campus_id
        FROM (
          SELECT scoped_offer.campus_id
          FROM admissions.offer AS scoped_offer
          WHERE scoped_offer.tenant_id = application.tenant_id
            AND scoped_offer.application_id = application.application_id
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
      LEFT JOIN admissions.admissions_decision AS decision
        ON decision.tenant_id = application.tenant_id
       AND decision.application_id = application.application_id
      LEFT JOIN admissions.offer AS offer
        ON offer.tenant_id = application.tenant_id
       AND offer.application_id = application.application_id
      LEFT JOIN admissions.applicant_conversion AS conversion
        ON conversion.tenant_id = application.tenant_id
       AND conversion.application_id = application.application_id
      WHERE application.tenant_id = selected_tenant_id
    ) AS staged
    LEFT JOIN LATERAL (
      SELECT COALESCE(jsonb_agg(option.item ORDER BY option.preference_rank, option.starts_on, option.program_name, option.grade_level), '[]'::jsonb) AS options
      FROM (
        SELECT
          choice.preference_rank,
          academic_year.starts_on,
          program.program_name,
          grade.grade_level,
          jsonb_build_object(
            'programId', program.program_version_id,
            'programName', program.program_name,
            'academicYearId', academic_year.academic_year_id,
            'academicYearName', academic_year.year_name,
            'gradeLevelId', grade.grade_level_id,
            'gradeLevelLabel', grade.grade_level
          ) AS item
        FROM admissions.application_program_choice AS choice
        JOIN academics.program_version AS program
          ON program.tenant_id = choice.tenant_id
         AND program.program_version_id = choice.program_id
         AND program.publication_state = 'published'
        JOIN academics.program_grade_level_identity AS grade
          ON grade.tenant_id = program.tenant_id
         AND grade.program_version_id = program.program_version_id
        CROSS JOIN academics.academic_year AS academic_year
        WHERE choice.tenant_id = selected_tenant_id
          AND choice.application_id = staged.application_id
          AND academic_year.tenant_id = selected_tenant_id
          AND academic_year.publication_state = 'published'
          AND academic_year.ends_on >= current_date
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(program.grade_levels) AS current_grade(value)
            WHERE btrim(current_grade.value) = grade.grade_level
          )
        ORDER BY choice.preference_rank, academic_year.starts_on, program.program_name, grade.grade_level
        LIMIT 50
      ) AS option
    ) AS placement ON true
    WHERE staged.next_action IS NOT NULL
      AND (staged.next_action <> 'issue-offer' OR jsonb_array_length(placement.options) > 0)
    ORDER BY staged.updated_at DESC, staged.application_number
    LIMIT 25
  ) AS candidate;

  RETURN jsonb_build_object(
    'schemaVersion', 2,
    'role', 'admissions',
    'items', COALESCE(selected_items, '[]'::jsonb)
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_admissions_lifecycle_work_queue(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_admissions_lifecycle_work_queue(uuid) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608100201_PROD-05_admissions_lifecycle_work_queue',
  'PROD-05',
  'Authoritative Admissions lifecycle queue with canonical grade identities and catalog-validated offer placement'
)
ON CONFLICT (migration_id) DO NOTHING;
