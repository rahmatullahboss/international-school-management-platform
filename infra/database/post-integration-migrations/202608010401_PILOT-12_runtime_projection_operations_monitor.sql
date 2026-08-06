DO $projection_monitor_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_projection_monitor') THEN
    CREATE ROLE app_projection_monitor NOLOGIN NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT app_projection_monitor TO %I', current_user);
END
$projection_monitor_role$;

GRANT USAGE ON SCHEMA platform TO app_projection_monitor;

CREATE OR REPLACE FUNCTION platform.read_runtime_projection_operations_snapshot(
  p_tenant_id uuid,
  p_warning_age_seconds integer,
  p_stale_source_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, integration_core
AS $function$
DECLARE
  snapshot_time timestamptz := statement_timestamp();
  eligible_count bigint := 0;
  retry_scheduled_count bigint := 0;
  oldest_eligible_seconds bigint := 0;
  applied_last_hour_count bigint := 0;
  dead_letter_total_count bigint := 0;
  dead_letter_last_day_count bigint := 0;
  invalid_event_count bigint := 0;
  source_unavailable_count bigint := 0;
  projection_conflict_count bigint := 0;
  processor_error_count bigint := 0;
  current_source_count bigint := 0;
  stale_source_count bigint := 0;
  unapplied_source_count bigint := 0;
  missing_source_count bigint := 0;
  active_unique_mapping_count bigint := 0;
  unmapped_membership_count bigint := 0;
  ambiguous_membership_count bigint := 0;
  selected_health text;
BEGIN
  IF p_tenant_id IS NULL
     OR p_warning_age_seconds IS NULL
     OR p_warning_age_seconds NOT BETWEEN 60 AND 86400
     OR p_stale_source_seconds IS NULL
     OR p_stale_source_seconds NOT BETWEEN 300 AND 604800 THEN
    RAISE EXCEPTION 'invalid runtime projection monitor settings';
  END IF;

  PERFORM 1
  FROM platform.tenant AS tenant
  WHERE tenant.tenant_id = p_tenant_id
    AND tenant.provisioning_status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'runtime projection monitor tenant is unavailable';
  END IF;

  SELECT
    count(*) FILTER (WHERE event.available_at <= snapshot_time),
    count(*) FILTER (
      WHERE event.attempt_count > 0
        AND event.available_at > snapshot_time
    ),
    COALESCE(
      GREATEST(
        0::bigint,
        floor(
          extract(
            epoch FROM snapshot_time - min(event.occurred_at)
              FILTER (WHERE event.available_at <= snapshot_time)
          )
        )::bigint
      ),
      0
    )
  INTO eligible_count, retry_scheduled_count, oldest_eligible_seconds
  FROM integration_core.outbox_event AS event
  WHERE event.tenant_id = p_tenant_id
    AND event.event_type = 'platform.runtime_snapshot_refresh_requested'
    AND event.published_at IS NULL;

  SELECT count(*)
  INTO applied_last_hour_count
  FROM platform.runtime_projection_applied_command AS applied
  WHERE applied.tenant_id = p_tenant_id
    AND applied.applied_at >= snapshot_time - interval '1 hour';

  SELECT
    count(*),
    count(*) FILTER (WHERE dead_letter.failed_at >= snapshot_time - interval '24 hours'),
    count(*) FILTER (
      WHERE dead_letter.failed_at >= snapshot_time - interval '24 hours'
        AND dead_letter.error_code = 'invalid-event'
    ),
    count(*) FILTER (
      WHERE dead_letter.failed_at >= snapshot_time - interval '24 hours'
        AND dead_letter.error_code = 'source-unavailable'
    ),
    count(*) FILTER (
      WHERE dead_letter.failed_at >= snapshot_time - interval '24 hours'
        AND dead_letter.error_code = 'projection-state-conflict'
    ),
    count(*) FILTER (
      WHERE dead_letter.failed_at >= snapshot_time - interval '24 hours'
        AND dead_letter.error_code = 'processor-error'
    )
  INTO
    dead_letter_total_count,
    dead_letter_last_day_count,
    invalid_event_count,
    source_unavailable_count,
    projection_conflict_count,
    processor_error_count
  FROM platform.runtime_projection_dead_letter AS dead_letter
  WHERE dead_letter.tenant_id = p_tenant_id;

  SELECT
    count(*),
    count(*) FILTER (
      WHERE source.source_updated_at
        < snapshot_time - make_interval(secs => p_stale_source_seconds)
    ),
    count(*) FILTER (
      WHERE NOT EXISTS (
        SELECT 1
        FROM platform.runtime_projection_applied_command AS applied
        WHERE applied.tenant_id = source.tenant_id
          AND applied.membership_id = source.membership_id
          AND applied.campus_id IS NOT DISTINCT FROM source.campus_id
          AND applied.source_revision >= source.source_revision
      )
    )
  INTO current_source_count, stale_source_count, unapplied_source_count
  FROM platform.runtime_projection_source AS source
  WHERE source.tenant_id = p_tenant_id;

  WITH membership_mapping AS (
    SELECT
      membership.tenant_id,
      membership.membership_id,
      membership.campus_id,
      count(DISTINCT mapping.persona) AS persona_count
    FROM iam.membership AS membership
    LEFT JOIN iam.membership_role AS membership_role
      ON membership_role.tenant_id = membership.tenant_id
     AND membership_role.membership_id = membership.membership_id
    LEFT JOIN platform.runtime_projection_persona_role AS mapping
      ON mapping.tenant_id = membership_role.tenant_id
     AND mapping.role_id = membership_role.role_id
    WHERE membership.tenant_id = p_tenant_id
      AND membership.status = 'active'
    GROUP BY membership.tenant_id, membership.membership_id, membership.campus_id
  )
  SELECT
    count(*) FILTER (WHERE membership_mapping.persona_count = 1),
    count(*) FILTER (WHERE membership_mapping.persona_count = 0),
    count(*) FILTER (WHERE membership_mapping.persona_count > 1),
    count(*) FILTER (
      WHERE membership_mapping.persona_count = 1
        AND NOT EXISTS (
          SELECT 1
          FROM platform.runtime_projection_source AS source
          WHERE source.tenant_id = membership_mapping.tenant_id
            AND source.membership_id = membership_mapping.membership_id
            AND source.campus_id IS NOT DISTINCT FROM membership_mapping.campus_id
            AND source.projection_key = 'home'
        )
    )
  INTO
    active_unique_mapping_count,
    unmapped_membership_count,
    ambiguous_membership_count,
    missing_source_count
  FROM membership_mapping;

  selected_health := CASE
    WHEN dead_letter_last_day_count > 0
      OR ambiguous_membership_count > 0
      OR oldest_eligible_seconds >= p_warning_age_seconds::bigint * 4
      THEN 'critical'
    WHEN eligible_count > 0
      OR retry_scheduled_count > 0
      OR oldest_eligible_seconds >= p_warning_age_seconds
      OR stale_source_count > 0
      OR unapplied_source_count > 0
      OR missing_source_count > 0
      OR unmapped_membership_count > 0
      THEN 'warning'
    ELSE 'healthy'
  END;

  RETURN jsonb_build_object(
    'schemaVersion', 1,
    'tenantId', p_tenant_id,
    'health', selected_health,
    'generatedAt', to_char(
      snapshot_time AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'controls', jsonb_build_object(
      'exactEventAllowlist', true,
      'tenantScoped', true,
      'payloadRedacted', true,
      'functionOnlyAccess', true
    ),
    'backlog', jsonb_build_object(
      'eligible', eligible_count,
      'retryScheduled', retry_scheduled_count,
      'oldestEligibleSeconds', oldest_eligible_seconds
    ),
    'delivery', jsonb_build_object(
      'appliedLastHour', applied_last_hour_count,
      'deadLetterTotal', dead_letter_total_count,
      'deadLettersLast24Hours', dead_letter_last_day_count,
      'byCode', jsonb_build_object(
        'invalidEvent', invalid_event_count,
        'sourceUnavailable', source_unavailable_count,
        'projectionStateConflict', projection_conflict_count,
        'processorError', processor_error_count
      )
    ),
    'sources', jsonb_build_object(
      'current', current_source_count,
      'stale', stale_source_count,
      'unapplied', unapplied_source_count,
      'missingForMappedMemberships', missing_source_count
    ),
    'mappings', jsonb_build_object(
      'activeUnique', active_unique_mapping_count,
      'unmapped', unmapped_membership_count,
      'ambiguous', ambiguous_membership_count
    )
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.read_runtime_projection_operations_snapshot(
  uuid, integer, integer
) FROM PUBLIC, app_runtime, app_projection_admin, app_projection_publisher,
       app_projection_composer;
GRANT EXECUTE ON FUNCTION platform.read_runtime_projection_operations_snapshot(
  uuid, integer, integer
) TO app_projection_monitor;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608010401_PILOT-12_runtime_projection_operations_monitor',
  'PILOT-12',
  'Tenant-scoped redacted projection backlog, delivery, source and mapping operations snapshot'
)
ON CONFLICT (migration_id) DO NOTHING;
