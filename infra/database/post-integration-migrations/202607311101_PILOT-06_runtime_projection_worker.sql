CREATE TABLE IF NOT EXISTS platform.runtime_projection_source (
  source_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL,
  campus_id uuid,
  projection_key text NOT NULL DEFAULT 'home'
    CHECK (projection_key = 'home'),
  persona text NOT NULL CHECK (persona IN ('admin', 'teacher', 'guardian', 'student')),
  subject_ref text NOT NULL CHECK (subject_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  source_revision bigint NOT NULL CHECK (source_revision > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  source_updated_at timestamptz NOT NULL,
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  payload_bytes integer NOT NULL CHECK (payload_bytes BETWEEN 2 AND 262144),
  UNIQUE NULLS NOT DISTINCT (tenant_id, membership_id, campus_id, projection_key),
  FOREIGN KEY (tenant_id, membership_id)
    REFERENCES iam.membership (tenant_id, membership_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE OR REPLACE FUNCTION platform.maintain_runtime_projection_source_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform
AS $function$
DECLARE
  serialized_payload bytea;
BEGIN
  serialized_payload := convert_to(NEW.payload::text, 'UTF8');
  NEW.payload_bytes := octet_length(serialized_payload);
  IF NEW.payload_bytes < 2 OR NEW.payload_bytes > 262144 THEN
    RAISE EXCEPTION 'runtime projection source payload size is outside policy';
  END IF;
  NEW.payload_digest := encode(public.digest(serialized_payload, 'sha256'), 'hex');
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS runtime_projection_source_integrity
  ON platform.runtime_projection_source;
CREATE TRIGGER runtime_projection_source_integrity
BEFORE INSERT OR UPDATE ON platform.runtime_projection_source
FOR EACH ROW
EXECUTE FUNCTION platform.maintain_runtime_projection_source_integrity();

CREATE TABLE IF NOT EXISTS platform.runtime_projection_applied_command (
  command_id uuid PRIMARY KEY REFERENCES platform.runtime_command_receipt (command_id),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL,
  campus_id uuid,
  event_id uuid NOT NULL,
  source_revision bigint NOT NULL CHECK (source_revision > 0),
  projection_revision bigint NOT NULL CHECK (projection_revision > 0),
  worker_id text NOT NULL CHECK (worker_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, event_id),
  FOREIGN KEY (tenant_id, event_id)
    REFERENCES integration_core.outbox_event (tenant_id, event_id),
  FOREIGN KEY (tenant_id, membership_id)
    REFERENCES iam.membership (tenant_id, membership_id),
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE TABLE IF NOT EXISTS platform.runtime_projection_dead_letter (
  dead_letter_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  event_id uuid NOT NULL,
  command_id uuid,
  error_code text NOT NULL CHECK (
    error_code IN (
      'invalid-event',
      'source-unavailable',
      'projection-state-conflict',
      'processor-error'
    )
  ),
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  worker_id text NOT NULL CHECK (worker_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'),
  failed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, event_id),
  FOREIGN KEY (tenant_id, event_id)
    REFERENCES integration_core.outbox_event (tenant_id, event_id),
  FOREIGN KEY (command_id)
    REFERENCES platform.runtime_command_receipt (command_id)
);

DROP TRIGGER IF EXISTS runtime_projection_applied_command_append_only
  ON platform.runtime_projection_applied_command;
CREATE TRIGGER runtime_projection_applied_command_append_only
BEFORE UPDATE OR DELETE ON platform.runtime_projection_applied_command
FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

DROP TRIGGER IF EXISTS runtime_projection_dead_letter_append_only
  ON platform.runtime_projection_dead_letter;
CREATE TRIGGER runtime_projection_dead_letter_append_only
BEFORE UPDATE OR DELETE ON platform.runtime_projection_dead_letter
FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

CREATE INDEX IF NOT EXISTS runtime_projection_source_scope_idx
  ON platform.runtime_projection_source (
    tenant_id,
    membership_id,
    campus_id,
    projection_key,
    source_revision
  );

CREATE INDEX IF NOT EXISTS runtime_projection_dead_letter_failed_idx
  ON platform.runtime_projection_dead_letter (failed_at DESC, error_code);

REVOKE ALL ON TABLE platform.runtime_projection_source FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE platform.runtime_projection_applied_command FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE platform.runtime_projection_dead_letter FROM PUBLIC, app_runtime;
REVOKE ALL ON FUNCTION platform.maintain_runtime_projection_source_integrity()
  FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION platform.process_runtime_projection_refresh_batch(
  p_worker_id text,
  p_batch_size integer,
  p_max_attempts integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, integration_core, audit
AS $function$
DECLARE
  selected_event record;
  receipt_row record;
  source_row record;
  selected_command_id uuid;
  selected_membership_id uuid;
  selected_campus_id uuid;
  selected_expected_revision bigint;
  selected_actor_account_id uuid;
  current_projection_revision bigint;
  next_attempt integer;
  retry_seconds integer;
  failure_code text;
  permanent_failure boolean;
  claimed_count integer := 0;
  completed_count integer := 0;
  retried_count integer := 0;
  dead_lettered_count integer := 0;
BEGIN
  IF p_worker_id IS NULL
     OR p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'
     OR p_batch_size IS NULL
     OR p_batch_size < 1
     OR p_batch_size > 50
     OR p_max_attempts IS NULL
     OR p_max_attempts < 2
     OR p_max_attempts > 10 THEN
    RAISE EXCEPTION 'invalid runtime projection worker settings';
  END IF;

  FOR selected_event IN
    SELECT
      event.tenant_id,
      event.event_id,
      event.event_type,
      event.schema_version,
      event.aggregate_type,
      event.aggregate_id,
      event.aggregate_version,
      event.correlation_id,
      event.causation_id,
      event.payload,
      event.attempt_count
    FROM integration_core.outbox_event AS event
    WHERE event.published_at IS NULL
      AND event.available_at <= clock_timestamp()
      AND event.event_type = 'platform.runtime_snapshot_refresh_requested'
    ORDER BY event.available_at, event.occurred_at, event.event_id
    LIMIT p_batch_size
    FOR UPDATE OF event SKIP LOCKED
  LOOP
    claimed_count := claimed_count + 1;
    next_attempt := selected_event.attempt_count + 1;
    failure_code := NULL;
    permanent_failure := false;
    selected_command_id := NULL;
    selected_membership_id := NULL;
    selected_campus_id := NULL;
    selected_expected_revision := NULL;
    selected_actor_account_id := NULL;

    BEGIN
      IF selected_event.schema_version <> 1
         OR selected_event.aggregate_type <> 'runtime_projection'
         OR jsonb_typeof(selected_event.payload) <> 'object'
         OR NOT selected_event.payload ?& ARRAY[
           'commandId',
           'membershipId',
           'campusId',
           'expectedRevision',
           'reason'
         ]
         OR selected_event.payload - ARRAY[
           'commandId',
           'membershipId',
           'campusId',
           'expectedRevision',
           'reason'
         ] <> '{}'::jsonb
         OR jsonb_typeof(selected_event.payload->'commandId') <> 'string'
         OR jsonb_typeof(selected_event.payload->'membershipId') <> 'string'
         OR jsonb_typeof(selected_event.payload->'expectedRevision') <> 'number'
         OR jsonb_typeof(selected_event.payload->'reason') <> 'string'
         OR selected_event.payload->>'commandId'
              !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         OR selected_event.payload->>'membershipId'
              !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         OR selected_event.payload->>'expectedRevision' !~ '^[1-9][0-9]{0,18}$'
         OR length(selected_event.payload->>'reason') < 1
         OR length(selected_event.payload->>'reason') > 500
         OR selected_event.payload->>'reason' <> btrim(selected_event.payload->>'reason')
         OR selected_event.payload->>'reason' ~ '[[:cntrl:]]' THEN
        RAISE EXCEPTION 'invalid runtime projection event' USING ERRCODE = 'P1001';
      END IF;

      IF jsonb_typeof(selected_event.payload->'campusId') = 'null' THEN
        selected_campus_id := NULL;
      ELSIF jsonb_typeof(selected_event.payload->'campusId') = 'string'
            AND selected_event.payload->>'campusId'
              ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        selected_campus_id := (selected_event.payload->>'campusId')::uuid;
      ELSE
        RAISE EXCEPTION 'invalid runtime projection event' USING ERRCODE = 'P1001';
      END IF;

      selected_command_id := (selected_event.payload->>'commandId')::uuid;
      selected_membership_id := (selected_event.payload->>'membershipId')::uuid;
      selected_expected_revision := (selected_event.payload->>'expectedRevision')::bigint;

      IF selected_event.causation_id IS DISTINCT FROM selected_command_id::text
         OR selected_event.aggregate_id IS DISTINCT FROM selected_membership_id::text
         OR selected_event.aggregate_version IS DISTINCT FROM selected_expected_revision + 1 THEN
        RAISE EXCEPTION 'invalid runtime projection event' USING ERRCODE = 'P1001';
      END IF;

      SELECT
        receipt.tenant_id,
        receipt.membership_id,
        receipt.campus_id,
        receipt.actor_account_id,
        receipt.expected_revision,
        receipt.correlation_id
      INTO receipt_row
      FROM platform.runtime_command_receipt AS receipt
      WHERE receipt.command_id = selected_command_id
        AND receipt.command_type = 'runtime.snapshot.refresh'
      FOR UPDATE OF receipt;

      IF NOT FOUND THEN
        selected_command_id := NULL;
        RAISE EXCEPTION 'invalid runtime projection event' USING ERRCODE = 'P1001';
      END IF;

      IF receipt_row.tenant_id IS DISTINCT FROM selected_event.tenant_id
         OR receipt_row.membership_id IS DISTINCT FROM selected_membership_id
         OR receipt_row.campus_id IS DISTINCT FROM selected_campus_id
         OR receipt_row.expected_revision IS DISTINCT FROM selected_expected_revision
         OR receipt_row.correlation_id::text IS DISTINCT FROM selected_event.correlation_id THEN
        RAISE EXCEPTION 'invalid runtime projection event' USING ERRCODE = 'P1001';
      END IF;
      selected_actor_account_id := receipt_row.actor_account_id;

      IF EXISTS (
        SELECT 1
        FROM platform.runtime_projection_applied_command AS applied
        WHERE applied.command_id = selected_command_id
      ) THEN
        UPDATE integration_core.outbox_event AS event
        SET published_at = clock_timestamp(),
            attempt_count = next_attempt,
            last_error = NULL
        WHERE event.tenant_id = selected_event.tenant_id
          AND event.event_id = selected_event.event_id;
        completed_count := completed_count + 1;
        CONTINUE;
      END IF;

      SELECT projection.revision
      INTO current_projection_revision
      FROM platform.runtime_read_model_projection AS projection
      WHERE projection.tenant_id = selected_event.tenant_id
        AND projection.membership_id = selected_membership_id
        AND projection.campus_id IS NOT DISTINCT FROM selected_campus_id
        AND projection.projection_key = 'home'
      FOR UPDATE OF projection;

      IF current_projection_revision IS NULL
         OR current_projection_revision <> selected_expected_revision THEN
        RAISE EXCEPTION 'runtime projection state conflict' USING ERRCODE = 'P1003';
      END IF;

      SELECT
        source.persona,
        source.subject_ref,
        source.source_revision,
        source.payload,
        source.source_updated_at,
        source.payload_digest,
        source.payload_bytes
      INTO source_row
      FROM platform.runtime_projection_source AS source
      WHERE source.tenant_id = selected_event.tenant_id
        AND source.membership_id = selected_membership_id
        AND source.campus_id IS NOT DISTINCT FROM selected_campus_id
        AND source.projection_key = 'home'
      FOR SHARE OF source;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'runtime projection source unavailable' USING ERRCODE = 'P1002';
      END IF;

      UPDATE platform.runtime_read_model_projection AS projection
      SET persona = source_row.persona,
          subject_ref = source_row.subject_ref,
          revision = selected_expected_revision + 1,
          payload = source_row.payload,
          source_updated_at = source_row.source_updated_at,
          generated_at = clock_timestamp()
      WHERE projection.tenant_id = selected_event.tenant_id
        AND projection.membership_id = selected_membership_id
        AND projection.campus_id IS NOT DISTINCT FROM selected_campus_id
        AND projection.projection_key = 'home'
        AND projection.revision = selected_expected_revision;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'runtime projection state conflict' USING ERRCODE = 'P1003';
      END IF;

      INSERT INTO platform.runtime_projection_applied_command (
        command_id,
        tenant_id,
        membership_id,
        campus_id,
        event_id,
        source_revision,
        projection_revision,
        worker_id
      ) VALUES (
        selected_command_id,
        selected_event.tenant_id,
        selected_membership_id,
        selected_campus_id,
        selected_event.event_id,
        source_row.source_revision,
        selected_expected_revision + 1,
        p_worker_id
      );

      UPDATE integration_core.outbox_event AS event
      SET published_at = clock_timestamp(),
          attempt_count = next_attempt,
          last_error = NULL
      WHERE event.tenant_id = selected_event.tenant_id
        AND event.event_id = selected_event.event_id;

      INSERT INTO audit.audit_event (
        tenant_id,
        actor_account_id,
        action,
        subject_type,
        subject_id,
        correlation_id,
        metadata
      ) VALUES (
        selected_event.tenant_id,
        selected_actor_account_id,
        'runtime.snapshot.refresh.completed',
        'runtime_projection',
        selected_membership_id::text,
        selected_event.correlation_id,
        jsonb_build_object(
          'commandId', selected_command_id,
          'eventId', selected_event.event_id,
          'projectionRevision', selected_expected_revision + 1,
          'sourceRevision', source_row.source_revision,
          'workerId', p_worker_id
        )
      );

      completed_count := completed_count + 1;
    EXCEPTION
      WHEN SQLSTATE 'P1001' OR invalid_text_representation OR numeric_value_out_of_range THEN
        failure_code := 'invalid-event';
        permanent_failure := true;
      WHEN SQLSTATE 'P1002' THEN
        failure_code := 'source-unavailable';
      WHEN SQLSTATE 'P1003' THEN
        failure_code := 'projection-state-conflict';
        permanent_failure := true;
      WHEN OTHERS THEN
        failure_code := 'processor-error';
    END;

    IF failure_code IS NOT NULL THEN
      IF permanent_failure OR next_attempt >= p_max_attempts THEN
        INSERT INTO platform.runtime_projection_dead_letter (
          tenant_id,
          event_id,
          command_id,
          error_code,
          attempt_count,
          worker_id
        ) VALUES (
          selected_event.tenant_id,
          selected_event.event_id,
          selected_command_id,
          failure_code,
          next_attempt,
          p_worker_id
        )
        ON CONFLICT (tenant_id, event_id) DO NOTHING;

        UPDATE integration_core.outbox_event AS event
        SET published_at = clock_timestamp(),
            attempt_count = next_attempt,
            last_error = failure_code
        WHERE event.tenant_id = selected_event.tenant_id
          AND event.event_id = selected_event.event_id;

        INSERT INTO audit.audit_event (
          tenant_id,
          actor_account_id,
          action,
          subject_type,
          subject_id,
          correlation_id,
          metadata
        ) VALUES (
          selected_event.tenant_id,
          selected_actor_account_id,
          'runtime.snapshot.refresh.dead_lettered',
          'runtime_projection_event',
          selected_event.event_id::text,
          selected_event.correlation_id,
          jsonb_build_object(
            'commandId', selected_command_id,
            'errorCode', failure_code,
            'attemptCount', next_attempt,
            'workerId', p_worker_id
          )
        );

        dead_lettered_count := dead_lettered_count + 1;
      ELSE
        retry_seconds := LEAST(
          900,
          (5 * power(2::numeric, LEAST(next_attempt - 1, 7)))::integer
        );
        UPDATE integration_core.outbox_event AS event
        SET attempt_count = next_attempt,
            last_error = failure_code,
            available_at = clock_timestamp() + make_interval(secs => retry_seconds)
        WHERE event.tenant_id = selected_event.tenant_id
          AND event.event_id = selected_event.event_id;
        retried_count := retried_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'claimed', claimed_count,
    'completed', completed_count,
    'retried', retried_count,
    'deadLettered', dead_lettered_count
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.process_runtime_projection_refresh_batch(text, integer, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.process_runtime_projection_refresh_batch(text, integer, integer)
  TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607311101_PILOT-06_runtime_projection_worker',
  'PILOT-06',
  'Concurrent-safe runtime projection refresh processing with source integrity, deduplication, retry and dead-letter lifecycle'
)
ON CONFLICT (migration_id) DO NOTHING;
