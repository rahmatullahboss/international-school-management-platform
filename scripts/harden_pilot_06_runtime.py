from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    source = file_path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one marker, got {count}: {old[:100]!r}")
    file_path.write_text(source.replace(old, new), encoding="utf-8")


migration = "infra/database/post-integration-migrations/202607311101_PILOT-06_runtime_projection_worker.sql"
replace_once(
    migration,
    """      IF NOT FOUND
         OR receipt_row.tenant_id IS DISTINCT FROM selected_event.tenant_id
         OR receipt_row.membership_id IS DISTINCT FROM selected_membership_id
         OR receipt_row.campus_id IS DISTINCT FROM selected_campus_id
         OR receipt_row.expected_revision IS DISTINCT FROM selected_expected_revision
         OR receipt_row.correlation_id::text IS DISTINCT FROM selected_event.correlation_id THEN
        RAISE EXCEPTION 'invalid runtime projection event' USING ERRCODE = 'P1001';
      END IF;
      selected_actor_account_id := receipt_row.actor_account_id;
""",
    """      IF NOT FOUND THEN
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
""",
)

verifier = "tests/integration/verify-auth-durable-context.sh"
unknown_command_probe = r'''
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
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000017',
  'platform.runtime_snapshot_refresh_requested',
  1,
  'runtime_projection',
  '30000000-0000-4000-8000-000000000006',
  9,
  '30000000-0000-4000-8000-000000000017',
  '30000000-0000-4000-8000-000000000018',
  jsonb_build_object(
    'commandId', '30000000-0000-4000-8000-000000000018',
    'membershipId', '30000000-0000-4000-8000-000000000006',
    'campusId', '30000000-0000-4000-8000-000000000003',
    'expectedRevision', 8,
    'reason', 'Reject an event that has no durable command receipt.'
  ),
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (tenant_id, event_id) DO NOTHING;

SET ROLE app_runtime;
DO $projection_worker_unknown_command$
DECLARE
  result jsonb;
BEGIN
  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-05',
    20,
    5
  );
  IF result <> '{"claimed": 1, "completed": 0, "retried": 0, "deadLettered": 1}'::jsonb THEN
    RAISE EXCEPTION 'unknown command event must be isolated as invalid: %', result;
  END IF;
END
$projection_worker_unknown_command$;
RESET ROLE;

DO $projection_worker_unknown_command_persistence$
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_dead_letter
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND event_id = '30000000-0000-4000-8000-000000000017'
      AND command_id IS NULL
      AND error_code = 'invalid-event'
      AND attempt_count = 1
  ) <> 1 THEN
    RAISE EXCEPTION 'unknown command event must persist one nullable invalid-event dead letter';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM integration_core.outbox_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND event_id = '30000000-0000-4000-8000-000000000017'
      AND (published_at IS NULL OR attempt_count <> 1 OR last_error <> 'invalid-event')
  ) THEN
    RAISE EXCEPTION 'unknown command event must be terminally published';
  END IF;
END
$projection_worker_unknown_command_persistence$;

'''
replace_once(
    verifier,
    "SET ROLE app_runtime;\nDO $projection_worker_retry_command$",
    unknown_command_probe + "SET ROLE app_runtime;\nDO $projection_worker_retry_command$",
)

print("PILOT-06 unknown-command isolation hardened")
