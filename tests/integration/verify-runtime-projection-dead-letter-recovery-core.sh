#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")

"${PSQL[@]}" <<'SQL'
INSERT INTO platform.tenant (
  tenant_id, slug, display_name, home_region, deployment_profile,
  database_binding, provisioning_status
) VALUES (
  '97000000-0000-4000-8000-000000000001',
  'projection-recovery-test',
  'Projection Recovery Test School',
  'test',
  'regional-pooled',
  'test',
  'active'
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenancy.legal_entity (
  tenant_id, legal_entity_id, legal_name, country_code, default_currency
) VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000002',
  'Projection Recovery Test School',
  'BD',
  'BDT'
)
ON CONFLICT (tenant_id, legal_entity_id) DO NOTHING;

INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000003',
  '97000000-0000-4000-8000-000000000002',
  'RECOVERY',
  'Recovery Campus',
  'Asia/Dhaka'
)
ON CONFLICT (tenant_id, campus_id) DO NOTHING;

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '97000000-0000-4000-8000-000000000004',
  'https://identity.recovery.test',
  'projection-recovery-operator',
  'recovery-operator@school.test',
  'aal2'
)
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000005',
  'projection-recovery-operator',
  'Projection Recovery Operator',
  false
)
ON CONFLICT (tenant_id, role_id) DO NOTHING;

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000006',
  '97000000-0000-4000-8000-000000000004',
  '97000000-0000-4000-8000-000000000003',
  'active'
)
ON CONFLICT (tenant_id, membership_id) DO NOTHING;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000006',
  '97000000-0000-4000-8000-000000000005'
)
ON CONFLICT DO NOTHING;

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES (
  '97000000-0000-4000-8000-000000000007',
  'https://identity.recovery.test',
  'projection-recovery-operator',
  '97000000-0000-4000-8000-000000000004',
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000006',
  '97000000-0000-4000-8000-000000000003',
  'active'
)
ON CONFLICT (binding_id) DO NOTHING;

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000007',
  '97000000-0000-4000-8000-000000000005'
)
ON CONFLICT DO NOTHING;

DO $session$
BEGIN
  IF NOT iam.register_browser_session(
    '97000000-0000-4000-8000-000000000008',
    '97000000-0000-4000-8000-000000000004',
    '97000000-0000-4000-8000-000000000001',
    '97000000-0000-4000-8000-000000000006',
    '97000000-0000-4000-8000-000000000003',
    'projection-recovery-provider-session',
    ARRAY['97000000-0000-4000-8000-000000000005'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'projection recovery verifier session was not registered';
  END IF;
END
$session$;

INSERT INTO platform.runtime_read_model_projection (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, revision, payload, source_updated_at, generated_at
) VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000006',
  '97000000-0000-4000-8000-000000000003',
  'home',
  'admin',
  'recovery-dashboard',
  3,
  '{"state":"before-recovery"}'::jsonb,
  clock_timestamp() - interval '1 minute',
  clock_timestamp()
)
ON CONFLICT (tenant_id, membership_id, campus_id, projection_key) DO UPDATE
SET persona = EXCLUDED.persona,
    subject_ref = EXCLUDED.subject_ref,
    revision = EXCLUDED.revision,
    payload = EXCLUDED.payload,
    source_updated_at = EXCLUDED.source_updated_at,
    generated_at = EXCLUDED.generated_at;

INSERT INTO platform.runtime_command_receipt (
  command_id, tenant_id, membership_id, campus_id, session_id,
  actor_account_id, command_type, idempotency_key, request_hash,
  expected_revision, correlation_id, response_status, response_body, accepted_at
) VALUES (
  '97000000-0000-4000-8000-000000000009',
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000006',
  '97000000-0000-4000-8000-000000000003',
  '97000000-0000-4000-8000-000000000008',
  '97000000-0000-4000-8000-000000000004',
  'runtime.snapshot.refresh',
  'original-refresh-0001',
  repeat('a', 64),
  3,
  '97000000-0000-4000-8000-00000000000a',
  202,
  '{"commandId":"97000000-0000-4000-8000-000000000009","state":"accepted"}'::jsonb,
  clock_timestamp() - interval '5 minutes'
)
ON CONFLICT (command_id) DO NOTHING;

INSERT INTO integration_core.outbox_event (
  tenant_id, event_id, event_type, schema_version, aggregate_type,
  aggregate_id, aggregate_version, correlation_id, causation_id,
  payload, occurred_at, available_at, published_at, attempt_count, last_error
) VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-00000000000b',
  'platform.runtime_snapshot_refresh_requested',
  1,
  'runtime_projection',
  '97000000-0000-4000-8000-000000000006',
  4,
  '97000000-0000-4000-8000-00000000000a',
  '97000000-0000-4000-8000-000000000009',
  jsonb_build_object(
    'commandId', '97000000-0000-4000-8000-000000000009',
    'membershipId', '97000000-0000-4000-8000-000000000006',
    'campusId', '97000000-0000-4000-8000-000000000003',
    'expectedRevision', 3,
    'reason', 'Original projection refresh for recovery verification.'
  ),
  clock_timestamp() - interval '5 minutes',
  clock_timestamp() - interval '5 minutes',
  clock_timestamp() - interval '4 minutes',
  5,
  'source-unavailable'
)
ON CONFLICT (tenant_id, event_id) DO NOTHING;

INSERT INTO platform.runtime_projection_dead_letter (
  dead_letter_id, tenant_id, event_id, command_id,
  error_code, attempt_count, worker_id, failed_at
) VALUES (
  '97000000-0000-4000-8000-00000000000c',
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-00000000000b',
  '97000000-0000-4000-8000-000000000009',
  'source-unavailable',
  5,
  'recovery-worker-01',
  clock_timestamp() - interval '4 minutes'
)
ON CONFLICT (dead_letter_id) DO NOTHING;
SQL

permission_denied="$("${PSQL[@]}" -Atqc "SET ROLE app_projection_recovery; SELECT platform.recover_runtime_projection_dead_letter('97000000-0000-4000-8000-000000000001'::uuid,'97000000-0000-4000-8000-00000000000c'::uuid,'97000000-0000-4000-8000-000000000004'::uuid,'recovery-request-0001','Source repaired after upstream publication completed.','97000000-0000-4000-8000-00000000000d'::uuid)->>'reason';")"
if [[ "$permission_denied" != "permission-not-granted" ]]; then
  echo "Expected permission-not-granted before operator permission assignment, got: $permission_denied" >&2
  exit 1
fi

"${PSQL[@]}" <<'SQL'
INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000005',
  'runtime.projection.dead-letter.recover'
)
ON CONFLICT DO NOTHING;
SQL

missing_source="$("${PSQL[@]}" -Atqc "SET ROLE app_projection_recovery; SELECT platform.recover_runtime_projection_dead_letter('97000000-0000-4000-8000-000000000001'::uuid,'97000000-0000-4000-8000-00000000000c'::uuid,'97000000-0000-4000-8000-000000000004'::uuid,'recovery-request-0001','Source repaired after upstream publication completed.','97000000-0000-4000-8000-00000000000d'::uuid)->>'reason';")"
if [[ "$missing_source" != "source-unavailable" ]]; then
  echo "Expected source-unavailable before source repair, got: $missing_source" >&2
  exit 1
fi

"${PSQL[@]}" <<'SQL'
INSERT INTO platform.runtime_projection_source (
  source_id, tenant_id, membership_id, campus_id, projection_key,
  persona, subject_ref, source_revision, payload, source_updated_at,
  payload_digest, payload_bytes
) VALUES (
  '97000000-0000-4000-8000-00000000000e',
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000006',
  '97000000-0000-4000-8000-000000000003',
  'home',
  'admin',
  'recovery-dashboard',
  4,
  '{"state":"after-source-repair"}'::jsonb,
  clock_timestamp(),
  repeat('0', 64),
  2
)
ON CONFLICT (source_id) DO NOTHING;
SQL

accepted="$("${PSQL[@]}" -Atqc "SET ROLE app_projection_recovery; SELECT platform.recover_runtime_projection_dead_letter('97000000-0000-4000-8000-000000000001'::uuid,'97000000-0000-4000-8000-00000000000c'::uuid,'97000000-0000-4000-8000-000000000004'::uuid,'recovery-request-0001','Source repaired after upstream publication completed.','97000000-0000-4000-8000-00000000000d'::uuid);")"
if [[ "$(jq -r '.accepted' <<<"$accepted")" != "true" || "$(jq -r '.replayed' <<<"$accepted")" != "false" ]]; then
  echo "Expected accepted recovery request, got: $accepted" >&2
  exit 1
fi
replacement_event_id="$(jq -r '.receipt.replacementEventId' <<<"$accepted")"
if [[ -z "$replacement_event_id" || "$replacement_event_id" == "null" ]]; then
  echo "Recovery did not return a replacement event id" >&2
  exit 1
fi

replayed="$("${PSQL[@]}" -Atqc "SET ROLE app_projection_recovery; SELECT platform.recover_runtime_projection_dead_letter('97000000-0000-4000-8000-000000000001'::uuid,'97000000-0000-4000-8000-00000000000c'::uuid,'97000000-0000-4000-8000-000000000004'::uuid,'recovery-request-0001','Source repaired after upstream publication completed.','97000000-0000-4000-8000-00000000000d'::uuid);")"
if [[ "$(jq -r '.accepted' <<<"$replayed")" != "true" || "$(jq -r '.replayed' <<<"$replayed")" != "true" || "$(jq -r '.receipt.replacementEventId' <<<"$replayed")" != "$replacement_event_id" ]]; then
  echo "Recovery idempotency replay failed: $replayed" >&2
  exit 1
fi

already_recovered="$("${PSQL[@]}" -Atqc "SET ROLE app_projection_recovery; SELECT platform.recover_runtime_projection_dead_letter('97000000-0000-4000-8000-000000000001'::uuid,'97000000-0000-4000-8000-00000000000c'::uuid,'97000000-0000-4000-8000-000000000004'::uuid,'recovery-request-0002','Source repaired after upstream publication completed.','97000000-0000-4000-8000-00000000000f'::uuid)->>'reason';")"
if [[ "$already_recovered" != "already-recovered" ]]; then
  echo "Expected already-recovered for a second recovery identity, got: $already_recovered" >&2
  exit 1
fi

"${PSQL[@]}" -v replacement_event_id="$replacement_event_id" <<'SQL'
DO $verification$
DECLARE
  replacement uuid := :'replacement_event_id'::uuid;
BEGIN
  IF has_function_privilege('app_runtime', 'platform.recover_runtime_projection_dead_letter(uuid,uuid,uuid,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('app_projection_monitor', 'platform.recover_runtime_projection_dead_letter(uuid,uuid,uuid,text,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('app_projection_recovery', 'platform.recover_runtime_projection_dead_letter(uuid,uuid,uuid,text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'projection recovery function privileges are not least-privilege';
  END IF;

  IF (SELECT count(*) FROM platform.runtime_projection_dead_letter WHERE dead_letter_id = '97000000-0000-4000-8000-00000000000c') <> 1 THEN
    RAISE EXCEPTION 'original dead-letter evidence changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM integration_core.outbox_event
    WHERE tenant_id = '97000000-0000-4000-8000-000000000001'
      AND event_id = '97000000-0000-4000-8000-00000000000b'
      AND published_at IS NOT NULL
      AND attempt_count = 5
      AND last_error = 'source-unavailable'
  ) THEN
    RAISE EXCEPTION 'original outbox terminal evidence changed';
  END IF;
  IF (SELECT count(*) FROM platform.runtime_projection_recovery_receipt WHERE tenant_id = '97000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'expected exactly one append-only recovery receipt';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM integration_core.outbox_event
    WHERE tenant_id = '97000000-0000-4000-8000-000000000001'
      AND event_id = replacement
      AND published_at IS NULL
      AND attempt_count = 0
      AND last_error IS NULL
      AND correlation_id = '97000000-0000-4000-8000-00000000000a'
      AND causation_id = '97000000-0000-4000-8000-000000000009'
  ) THEN
    RAISE EXCEPTION 'replacement event did not preserve the original command envelope';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM audit.audit_event
    WHERE tenant_id = '97000000-0000-4000-8000-000000000001'
      AND actor_account_id = '97000000-0000-4000-8000-000000000004'
      AND action = 'runtime.snapshot.refresh.dead_letter.recovery_requested'
      AND subject_id = '97000000-0000-4000-8000-00000000000c'
  ) THEN
    RAISE EXCEPTION 'recovery audit evidence is missing';
  END IF;
END
$verification$;
SQL

worker_result="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT platform.process_runtime_projection_refresh_batch('recovery-worker-02', 10, 5);")"
if [[ "$(jq -r '.completed' <<<"$worker_result")" != "1" ]]; then
  echo "Expected recovered event to complete exactly once, got: $worker_result" >&2
  exit 1
fi

"${PSQL[@]}" <<'SQL'
DO $post_recovery$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM platform.runtime_read_model_projection
    WHERE tenant_id = '97000000-0000-4000-8000-000000000001'
      AND membership_id = '97000000-0000-4000-8000-000000000006'
      AND campus_id = '97000000-0000-4000-8000-000000000003'
      AND revision = 4
      AND payload = '{"state":"after-source-repair"}'::jsonb
  ) THEN
    RAISE EXCEPTION 'recovered projection was not applied at the expected revision';
  END IF;
  IF (SELECT count(*) FROM platform.runtime_projection_applied_command WHERE command_id = '97000000-0000-4000-8000-000000000009') <> 1 THEN
    RAISE EXCEPTION 'recovered command was not deduplicated exactly once';
  END IF;

  BEGIN
    UPDATE platform.runtime_projection_recovery_receipt
    SET reason = 'mutation must fail'
    WHERE dead_letter_id = '97000000-0000-4000-8000-00000000000c';
    RAISE EXCEPTION 'recovery receipt mutation unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'audit records are append-only' THEN
        RAISE;
      END IF;
  END;
END
$post_recovery$;

INSERT INTO integration_core.outbox_event (
  tenant_id, event_id, event_type, schema_version, aggregate_type,
  aggregate_id, aggregate_version, correlation_id, causation_id,
  payload, occurred_at, available_at, published_at, attempt_count, last_error
) VALUES (
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000010',
  'platform.runtime_snapshot_refresh_requested',
  1,
  'runtime_projection',
  '97000000-0000-4000-8000-000000000006',
  4,
  '97000000-0000-4000-8000-00000000000a',
  '97000000-0000-4000-8000-000000000009',
  jsonb_build_object(
    'commandId', '97000000-0000-4000-8000-000000000009',
    'membershipId', '97000000-0000-4000-8000-000000000006',
    'campusId', '97000000-0000-4000-8000-000000000003',
    'expectedRevision', 3,
    'reason', 'Permanent conflict must not be replayed.'
  ),
  clock_timestamp(), clock_timestamp(), clock_timestamp(), 1,
  'projection-state-conflict'
)
ON CONFLICT (tenant_id, event_id) DO NOTHING;

INSERT INTO platform.runtime_projection_dead_letter (
  dead_letter_id, tenant_id, event_id, command_id,
  error_code, attempt_count, worker_id
) VALUES (
  '97000000-0000-4000-8000-000000000011',
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000010',
  '97000000-0000-4000-8000-000000000009',
  'projection-state-conflict',
  1,
  'recovery-worker-03'
)
ON CONFLICT (dead_letter_id) DO NOTHING;
SQL

permanent_rejection="$("${PSQL[@]}" -Atqc "SET ROLE app_projection_recovery; SELECT platform.recover_runtime_projection_dead_letter('97000000-0000-4000-8000-000000000001'::uuid,'97000000-0000-4000-8000-000000000011'::uuid,'97000000-0000-4000-8000-000000000004'::uuid,'recovery-request-0003','Permanent conflict should stay terminal.','97000000-0000-4000-8000-000000000012'::uuid)->>'reason';")"
if [[ "$permanent_rejection" != "dead-letter-not-recoverable" ]]; then
  echo "Expected permanent dead letter to remain non-recoverable, got: $permanent_rejection" >&2
  exit 1
fi

echo "Runtime projection dead-letter recovery verification passed."
