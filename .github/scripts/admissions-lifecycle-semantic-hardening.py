from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    target.write_text(text.replace(old, new, count))


sql = "infra/database/post-integration-migrations/202608100201_PROD-05_admissions_lifecycle_work_queue.sql"

replace(
    sql,
    """    JOIN academics.academic_year AS academic_year
      ON academic_year.tenant_id = program.tenant_id
     AND academic_year.academic_year_id = p_academic_year_id
     AND academic_year.publication_state = 'published'
    WHERE choice.tenant_id = session_context.tenant_id
""",
    """    JOIN academics.academic_year AS academic_year
      ON academic_year.tenant_id = program.tenant_id
     AND academic_year.academic_year_id = p_academic_year_id
     AND academic_year.publication_state = 'published'
     AND academic_year.ends_on >= current_date
    JOIN academics.instructional_calendar AS calendar
      ON calendar.tenant_id = academic_year.tenant_id
     AND calendar.academic_year_id = academic_year.academic_year_id
     AND calendar.campus_id = session_context.campus_id
     AND calendar.publication_state = 'published'
    WHERE choice.tenant_id = session_context.tenant_id
""",
)

marker = "CREATE OR REPLACE FUNCTION platform.resolve_admissions_lifecycle_work_queue(p_session_id uuid)\n"
wrapper = """CREATE OR REPLACE FUNCTION admissions.convert_accepted_applicant_catalog_command(
  p_session_id uuid,
  p_application_id uuid,
  p_expected_version bigint,
  p_effective_from date,
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
  placement_date_valid boolean;
BEGIN
  IF p_effective_from IS NULL THEN
    RETURN admissions.convert_accepted_applicant_command(
      p_session_id,
      p_application_id,
      p_expected_version,
      p_effective_from,
      p_idempotency_key,
      p_correlation_id
    );
  END IF;

  SELECT * INTO session_context
  FROM platform.resolve_operator_domain_command_session(p_session_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'session-inactive');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM admissions.offer AS offer
    JOIN academics.academic_year AS academic_year
      ON academic_year.tenant_id = offer.tenant_id
     AND academic_year.academic_year_id = offer.academic_year_id
     AND academic_year.publication_state = 'published'
    JOIN academics.instructional_calendar AS calendar
      ON calendar.tenant_id = academic_year.tenant_id
     AND calendar.academic_year_id = academic_year.academic_year_id
     AND calendar.campus_id = session_context.campus_id
     AND calendar.publication_state = 'published'
    WHERE offer.tenant_id = session_context.tenant_id
      AND offer.application_id = p_application_id
      AND offer.campus_id = session_context.campus_id
      AND offer.status = 'accepted'
      AND p_effective_from BETWEEN academic_year.starts_on AND academic_year.ends_on
  ) INTO placement_date_valid;

  IF placement_date_valid IS NOT TRUE THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'domain-conflict');
  END IF;

  RETURN admissions.convert_accepted_applicant_command(
    p_session_id,
    p_application_id,
    p_expected_version,
    p_effective_from,
    p_idempotency_key,
    p_correlation_id
  );
END
$function$;

REVOKE ALL ON FUNCTION admissions.convert_accepted_applicant_catalog_command(
  uuid, uuid, bigint, date, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admissions.convert_accepted_applicant_catalog_command(
  uuid, uuid, bigint, date, text, uuid
) TO app_runtime;

"""
replace(sql, marker, wrapper + marker)

replace(
    sql,
    """        'suggestedEffectiveFrom', CASE
          WHEN staged.next_action = 'convert-applicant' THEN to_char(
            GREATEST(current_date, staged.created_at::date + 1),
            'YYYY-MM-DD'
          )
          ELSE NULL
        END
""",
    """        'suggestedEffectiveFrom', CASE
          WHEN staged.next_action = 'convert-applicant' THEN to_char(
            GREATEST(current_date, staged.created_at::date + 1, staged.academic_year_starts_on),
            'YYYY-MM-DD'
          )
          ELSE NULL
        END,
        'effectiveFromMax', CASE
          WHEN staged.next_action = 'convert-applicant' THEN to_char(
            staged.academic_year_ends_on,
            'YYYY-MM-DD'
          )
          ELSE NULL
        END
""",
)

replace(
    sql,
    """        application.updated_at,
        offer.expires_at AS offer_expires_at,
        CASE
""",
    """        application.updated_at,
        offer.expires_at AS offer_expires_at,
        offered_year.starts_on AS academic_year_starts_on,
        offered_year.ends_on AS academic_year_ends_on,
        CASE
""",
)

replace(
    sql,
    """          WHEN application.status = 'accepted'
               AND offer.status = 'accepted'
               AND conversion.conversion_id IS NULL
               AND can_convert
            THEN 'convert-applicant'
""",
    """          WHEN application.status = 'accepted'
               AND offer.status = 'accepted'
               AND offered_year.academic_year_id IS NOT NULL
               AND offered_calendar.calendar_id IS NOT NULL
               AND GREATEST(
                 current_date,
                 application.created_at::date + 1,
                 offered_year.starts_on
               ) <= offered_year.ends_on
               AND conversion.conversion_id IS NULL
               AND can_convert
            THEN 'convert-applicant'
""",
)

replace(
    sql,
    """      LEFT JOIN admissions.offer AS offer
        ON offer.tenant_id = application.tenant_id
       AND offer.application_id = application.application_id
      LEFT JOIN admissions.applicant_conversion AS conversion
""",
    """      LEFT JOIN admissions.offer AS offer
        ON offer.tenant_id = application.tenant_id
       AND offer.application_id = application.application_id
      LEFT JOIN academics.academic_year AS offered_year
        ON offered_year.tenant_id = offer.tenant_id
       AND offered_year.academic_year_id = offer.academic_year_id
       AND offered_year.publication_state = 'published'
      LEFT JOIN academics.instructional_calendar AS offered_calendar
        ON offered_calendar.tenant_id = offered_year.tenant_id
       AND offered_calendar.academic_year_id = offered_year.academic_year_id
       AND offered_calendar.campus_id = selected_campus_id
       AND offered_calendar.publication_state = 'published'
      LEFT JOIN admissions.applicant_conversion AS conversion
""",
)

replace(
    sql,
    """        CROSS JOIN academics.academic_year AS academic_year
        WHERE choice.tenant_id = selected_tenant_id
          AND choice.application_id = staged.application_id
          AND academic_year.tenant_id = selected_tenant_id
          AND academic_year.publication_state = 'published'
          AND academic_year.ends_on >= current_date
""",
    """        JOIN academics.academic_year AS academic_year
          ON academic_year.tenant_id = selected_tenant_id
         AND academic_year.publication_state = 'published'
         AND academic_year.ends_on >= current_date
        JOIN academics.instructional_calendar AS calendar
          ON calendar.tenant_id = academic_year.tenant_id
         AND calendar.academic_year_id = academic_year.academic_year_id
         AND calendar.campus_id = selected_campus_id
         AND calendar.publication_state = 'published'
        WHERE choice.tenant_id = selected_tenant_id
          AND choice.application_id = staged.application_id
""",
)

replace(
    "apps/platform-api/src/database-operator-domain-command-store.ts",
    "admissions.convert_accepted_applicant_command(",
    "admissions.convert_accepted_applicant_catalog_command(",
)
replace(
    "apps/platform-api/src/database-operator-domain-command-store.test.ts",
    "expect.stringContaining('admissions.convert_accepted_applicant_command')",
    "expect.stringContaining('admissions.convert_accepted_applicant_catalog_command')",
)

api_queue = "apps/platform-api/src/database-operator-work-queue-store.ts"
replace(
    api_queue,
    "  readonly suggestedEffectiveFrom: string | null;\n}",
    "  readonly suggestedEffectiveFrom: string | null;\n  readonly effectiveFromMax: string | null;\n}",
)
replace(
    api_queue,
    """    offerExpiresAt,
    suggestedEffectiveFrom,
  } = value;
""",
    """    offerExpiresAt,
    suggestedEffectiveFrom,
    effectiveFromMax,
  } = value;
""",
)
replace(
    api_queue,
    """    !(
      suggestedEffectiveFrom === null ||
      (typeof suggestedEffectiveFrom === 'string' && validDateOnly(suggestedEffectiveFrom))
    )
""",
    """    !(
      suggestedEffectiveFrom === null ||
      (typeof suggestedEffectiveFrom === 'string' && validDateOnly(suggestedEffectiveFrom))
    ) ||
    !(
      effectiveFromMax === null ||
      (typeof effectiveFromMax === 'string' && validDateOnly(effectiveFromMax))
    )
""",
)
replace(
    api_queue,
    """      offerExpiresAt === null &&
      suggestedEffectiveFrom === null) ||
""",
    """      offerExpiresAt === null &&
      suggestedEffectiveFrom === null &&
      effectiveFromMax === null) ||
""",
    2,
)
replace(
    api_queue,
    """      typeof offerExpiresAt === 'string' &&
      suggestedEffectiveFrom === null) ||
""",
    """      typeof offerExpiresAt === 'string' &&
      suggestedEffectiveFrom === null &&
      effectiveFromMax === null) ||
""",
)
replace(
    api_queue,
    """      offerExpiresAt === null &&
      typeof suggestedEffectiveFrom === 'string');
""",
    """      offerExpiresAt === null &&
      typeof suggestedEffectiveFrom === 'string' &&
      typeof effectiveFromMax === 'string' &&
      suggestedEffectiveFrom <= effectiveFromMax);
""",
)
replace(
    api_queue,
    """    offerExpiresAt,
    suggestedEffectiveFrom,
  };
""",
    """    offerExpiresAt,
    suggestedEffectiveFrom,
    effectiveFromMax,
  };
""",
)

web_queue = "apps/platform-web/src/production-operator-work-queue.ts"
replace(
    web_queue,
    "  readonly suggestedEffectiveFrom: string | null;\n}",
    "  readonly suggestedEffectiveFrom: string | null;\n  readonly effectiveFromMax: string | null;\n}",
)
replace(
    web_queue,
    """    !(
      value.suggestedEffectiveFrom === null ||
      (typeof value.suggestedEffectiveFrom === 'string' && validDate(value.suggestedEffectiveFrom))
    )
""",
    """    !(
      value.suggestedEffectiveFrom === null ||
      (typeof value.suggestedEffectiveFrom === 'string' && validDate(value.suggestedEffectiveFrom))
    ) ||
    !(
      value.effectiveFromMax === null ||
      (typeof value.effectiveFromMax === 'string' && validDate(value.effectiveFromMax))
    )
""",
)
replace(
    web_queue,
    """      value.offerExpiresAt === null &&
      value.suggestedEffectiveFrom === null) ||
""",
    """      value.offerExpiresAt === null &&
      value.suggestedEffectiveFrom === null &&
      value.effectiveFromMax === null) ||
""",
    2,
)
replace(
    web_queue,
    """      typeof value.offerExpiresAt === 'string' &&
      value.suggestedEffectiveFrom === null) ||
""",
    """      typeof value.offerExpiresAt === 'string' &&
      value.suggestedEffectiveFrom === null &&
      value.effectiveFromMax === null) ||
""",
)
replace(
    web_queue,
    """      value.offerExpiresAt === null &&
      typeof value.suggestedEffectiveFrom === 'string');
""",
    """      value.offerExpiresAt === null &&
      typeof value.suggestedEffectiveFrom === 'string' &&
      typeof value.effectiveFromMax === 'string' &&
      value.suggestedEffectiveFrom <= value.effectiveFromMax);
""",
)
replace(
    web_queue,
    """    offerExpiresAt: value.offerExpiresAt,
    suggestedEffectiveFrom: value.suggestedEffectiveFrom,
  };
""",
    """    offerExpiresAt: value.offerExpiresAt,
    suggestedEffectiveFrom: value.suggestedEffectiveFrom,
    effectiveFromMax: value.effectiveFromMax,
  };
""",
)

replace(
    "apps/platform-web/src/production-admissions-lifecycle.tsx",
    """                    min={candidate.suggestedEffectiveFrom ?? undefined}
                    defaultValue={candidate.suggestedEffectiveFrom ?? undefined}
""",
    """                    min={candidate.suggestedEffectiveFrom ?? undefined}
                    max={candidate.effectiveFromMax ?? undefined}
                    defaultValue={candidate.suggestedEffectiveFrom ?? undefined}
""",
)

print("semantic hardening source patch applied")
