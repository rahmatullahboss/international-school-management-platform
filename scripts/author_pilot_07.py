from __future__ import annotations

import json
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"expected one marker in {path}, got {count}: {old[:120]!r}")
    path.write_text(source.replace(old, new), encoding="utf-8")


migration = Path(
    "infra/database/post-integration-migrations/"
    "202607311201_PILOT-07_runtime_projection_source_publisher.sql"
)
replace_once(
    migration,
    "     OR p_persona NOT IN ('admin', 'teacher', 'guardian', 'student')",
    "     OR p_persona IS NULL\n"
    "     OR p_persona NOT IN ('admin', 'teacher', 'guardian', 'student')",
)
replace_once(
    migration,
    "  PERFORM 1\n"
    "  FROM iam.membership_role AS membership_role\n"
    "  LEFT JOIN platform.runtime_projection_persona_role AS mapping\n"
    "    ON mapping.tenant_id = membership_role.tenant_id\n"
    "   AND mapping.role_id = membership_role.role_id\n"
    "  WHERE membership_role.tenant_id = p_tenant_id\n"
    "    AND membership_role.membership_id = p_membership_id\n"
    "  FOR SHARE OF membership_role, mapping;",
    "  PERFORM 1\n"
    "  FROM iam.membership_role AS membership_role\n"
    "  WHERE membership_role.tenant_id = p_tenant_id\n"
    "    AND membership_role.membership_id = p_membership_id\n"
    "  FOR SHARE OF membership_role;\n\n"
    "  PERFORM 1\n"
    "  FROM iam.membership_role AS membership_role\n"
    "  JOIN platform.runtime_projection_persona_role AS mapping\n"
    "    ON mapping.tenant_id = membership_role.tenant_id\n"
    "   AND mapping.role_id = membership_role.role_id\n"
    "  WHERE membership_role.tenant_id = p_tenant_id\n"
    "    AND membership_role.membership_id = p_membership_id\n"
    "  FOR SHARE OF membership_role, mapping;",
)

manifest_path = Path("infra/database/post-integration-migration-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["gate"] = "GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1"
if len(manifest["migrations"]) != 6:
    raise SystemExit("expected six pre-PILOT-07 post-integration migrations")
manifest["migrations"].append(
    {
        "order": 7,
        "id": "202607311201_PILOT-07_runtime_projection_source_publisher",
        "stream": "PILOT-07",
        "path": (
            "infra/database/post-integration-migrations/"
            "202607311201_PILOT-07_runtime_projection_source_publisher.sql"
        ),
    }
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

index_path = Path("apps/platform-api/src/index.ts")
replace_once(
    index_path,
    "export * from './database-projection-worker-store.js';",
    "export * from './database-projection-worker-store.js';\n"
    "export * from './runtime-projection-source-publisher.js';\n"
    "export * from './database-projection-source-publisher-store.js';",
)

verifier = Path("tests/integration/verify-auth-durable-context.sh")
replace_once(
    verifier,
    "if (manifest.gate !== 'GATE-PILOT-RUNTIME-PROJECTION-WORKER-V1') {",
    "if (manifest.gate !== 'GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1') {",
)
replace_once(
    verifier,
    "if (migrations.length !== 6) {\n"
    "  throw new Error(`expected six post-integration migrations, got ${migrations.length}`);\n"
    "}",
    "if (migrations.length !== 7) {\n"
    "  throw new Error(`expected seven post-integration migrations, got ${migrations.length}`);\n"
    "}",
)
replace_once(
    verifier,
    "if (!['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06'].includes(migration.stream)) throw new Error(`unexpected stream: ${migration.stream}`);",
    "if (!['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07'].includes(migration.stream)) throw new Error(`unexpected stream: ${migration.stream}`);",
)
replace_once(
    verifier,
    "IF (SELECT count(*) FROM platform.schema_migration) <> 46 THEN\n"
    "    RAISE EXCEPTION 'expected 46 total migration ledger rows';",
    "IF (SELECT count(*) FROM platform.schema_migration) <> 47 THEN\n"
    "    RAISE EXCEPTION 'expected 47 total migration ledger rows';",
)
replace_once(
    verifier,
    "     OR to_regclass('platform.runtime_projection_dead_letter') IS NULL THEN",
    "     OR to_regclass('platform.runtime_projection_dead_letter') IS NULL\n"
    "     OR to_regclass('platform.runtime_projection_persona_role') IS NULL\n"
    "     OR to_regclass('platform.runtime_projection_persona_role_event') IS NULL\n"
    "     OR to_regclass('platform.runtime_projection_source_publication') IS NULL THEN",
)

probe = r"""
DO $projection_source_privilege_contract$
BEGIN
  IF has_function_privilege(
       'app_runtime',
       'platform.publish_runtime_projection_source(uuid,uuid,uuid,bigint,jsonb,timestamptz,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.publish_runtime_projection_source(uuid,uuid,uuid,bigint,jsonb,timestamptz,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.configure_runtime_projection_persona_role(uuid,uuid,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'projection source role separation is not least privilege';
  END IF;

  IF NOT has_function_privilege(
       'app_projection_admin',
       'platform.configure_runtime_projection_persona_role(uuid,uuid,text,text)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'app_projection_publisher',
       'platform.publish_runtime_projection_source(uuid,uuid,uuid,bigint,jsonb,timestamptz,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'projection source role grants are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['app_runtime', 'app_projection_admin', 'app_projection_publisher']) AS role_name
    CROSS JOIN unnest(ARRAY[
      'platform.runtime_projection_persona_role',
      'platform.runtime_projection_persona_role_event',
      'platform.runtime_projection_source_publication'
    ]) AS protected_table
    WHERE has_table_privilege(role_name, protected_table, 'SELECT')
       OR has_table_privilege(role_name, protected_table, 'INSERT')
       OR has_table_privilege(role_name, protected_table, 'UPDATE')
       OR has_table_privilege(role_name, protected_table, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'projection source roles must retain function-only table access';
  END IF;
END
$projection_source_privilege_contract$;

SET ROLE app_projection_admin;
DO $projection_source_persona_configuration$
DECLARE
  result jsonb;
BEGIN
  result := platform.configure_runtime_projection_persona_role(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000005',
    'admin',
    'governance:pilot-07'
  );
  IF result->>'configured' <> 'true' OR result->>'persona' <> 'admin' THEN
    RAISE EXCEPTION 'reviewed admin persona mapping must configure: %', result;
  END IF;
END
$projection_source_persona_configuration$;
RESET ROLE;

SET ROLE app_projection_publisher;
DO $projection_source_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    0,
    '{"metrics":[{"id":"students","value":43}],"source":"database-composer"}'::jsonb,
    clock_timestamp() - interval '30 seconds',
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000020'
  );
  IF result->>'published' <> 'true'
     OR result->'publication'->>'persona' <> 'admin'
     OR result->'publication'->>'subjectRef'
          <> 'account:30000000-0000-4000-8000-000000000004'
     OR (result->'publication'->>'sourceRevision')::bigint <> 1
     OR length(result->'publication'->>'payloadDigest') <> 64
     OR (result->'publication'->>'payloadBytes')::integer < 2 THEN
    RAISE EXCEPTION 'first controlled source publication failed: %', result;
  END IF;
END
$projection_source_first_publication$;

DO $projection_source_negative_contracts$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    0,
    '{"metrics":[]}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000021'
  );
  IF result <> '{"published": false, "reason": "revision-conflict", "currentRevision": 1}'::jsonb THEN
    RAISE EXCEPTION 'stale source revision must be rejected exactly: %', result;
  END IF;

  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    1,
    '{"scope":{"tenantId":"browser-selected"}}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000022'
  );
  IF result <> '{"published": false, "reason": "invalid-publication"}'::jsonb THEN
    RAISE EXCEPTION 'browser-like scope injection must be rejected: %', result;
  END IF;

  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    1,
    '{"metrics":[]}'::jsonb,
    clock_timestamp() - interval '5 minutes',
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000023'
  );
  IF result <> '{"published": false, "reason": "source-stale"}'::jsonb THEN
    RAISE EXCEPTION 'older source timestamps must be rejected: %', result;
  END IF;
END
$projection_source_negative_contracts$;

DO $projection_source_second_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    1,
    '{"metrics":[{"id":"students","value":44}],"source":"database-composer-v2"}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000024'
  );
  IF result->>'published' <> 'true'
     OR (result->'publication'->>'sourceRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'second controlled source publication failed: %', result;
  END IF;
END
$projection_source_second_publication$;
RESET ROLE;

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000025',
  'auth-test-teacher',
  'AUTH Test Teacher',
  false
);
INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000025'
);

SET ROLE app_projection_admin;
SELECT platform.configure_runtime_projection_persona_role(
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000025',
  'teacher',
  'governance:pilot-07'
);
RESET ROLE;

SET ROLE app_projection_publisher;
DO $projection_source_ambiguous_persona$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    2,
    '{"metrics":[]}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000026'
  );
  IF result <> '{"published": false, "reason": "persona-ambiguous"}'::jsonb THEN
    RAISE EXCEPTION 'conflicting mapped personas must fail closed: %', result;
  END IF;
END
$projection_source_ambiguous_persona$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006'
  AND role_id = '30000000-0000-4000-8000-000000000025';
DELETE FROM iam.role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND role_id = '30000000-0000-4000-8000-000000000025';

UPDATE iam.membership
SET status = 'suspended'
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006';

SET ROLE app_projection_publisher;
DO $projection_source_inactive_scope$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    2,
    '{"metrics":[]}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000027'
  );
  IF result <> '{"published": false, "reason": "scope-inactive"}'::jsonb THEN
    RAISE EXCEPTION 'inactive memberships must not publish sources: %', result;
  END IF;
END
$projection_source_inactive_scope$;
RESET ROLE;

UPDATE iam.membership
SET status = 'active'
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006';

SET ROLE app_runtime;
DO $projection_source_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0006',
    8,
    'Apply the reviewed database-owned source publication.',
    '30000000-0000-4000-8000-000000000028'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'published source refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-05',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'published source must apply through the durable worker: %', result;
  END IF;
END
$projection_source_end_to_end_refresh$;
RESET ROLE;

DO $projection_source_persistence$
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
  ) <> 2 THEN
    RAISE EXCEPTION 'exactly two successful source publications must persist';
  END IF;
  IF (
    SELECT source_revision
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 2 THEN
    RAISE EXCEPTION 'current source must retain the second monotonic revision';
  END IF;
  IF (
    SELECT revision
    FROM platform.runtime_read_model_projection
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 9 THEN
    RAISE EXCEPTION 'published source must advance the projection from revision 8 to 9';
  END IF;
  IF (
    SELECT payload
    FROM platform.runtime_read_model_projection
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> '{"metrics":[{"id":"students","value":44}],"source":"database-composer-v2"}'::jsonb THEN
    RAISE EXCEPTION 'projection payload must equal the second database-owned source';
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.source.published'
  ) <> 2 THEN
    RAISE EXCEPTION 'every successful source publication must have atomic audit evidence';
  END IF;
END
$projection_source_persistence$;

"""
replace_once(
    verifier,
    "SET ROLE app_runtime;\nDO $account_revoke_verification$",
    probe + "SET ROLE app_runtime;\nDO $account_revoke_verification$",
)
replace_once(
    verifier,
    "WHERE stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06')",
    "WHERE stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07')",
)
replace_once(
    verifier,
    "WHERE stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06')",
    "WHERE stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07')",
)
replace_once(
    verifier,
    "      'platform.runtime_projection_dead_letter'\n",
    "      'platform.runtime_projection_dead_letter',\n"
    "      'platform.runtime_projection_persona_role',\n"
    "      'platform.runtime_projection_persona_role_event',\n"
    "      'platform.runtime_projection_source_publication'\n",
)
