#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")
READINESS_MANIFEST="infra/database/production-readiness-migration-manifest.json"

mapfile -t migrations < <(
  node --input-type=module - "$READINESS_MANIFEST" <<'NODE'
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = process.argv[2];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.gate !== 'GATE-PROD-RUNTIME-PROJECTION-RECOVERY-V1') {
  throw new Error(`unexpected production-readiness gate: ${manifest.gate}`);
}
if (manifest.baseManifest !== 'infra/database/production-migration-manifest.json') {
  throw new Error('projection recovery manifest must extend the reviewed production manifest');
}
const migrations = manifest.migrations ?? [];
if (migrations.length !== 1) {
  throw new Error(`expected one production-readiness migration, got ${migrations.length}`);
}
const migration = migrations[0];
if (migration.order !== 1 || migration.stream !== 'PROD-06') {
  throw new Error('projection recovery migration order/stream is invalid');
}
if (!existsSync(migration.path)) throw new Error(`missing migration: ${migration.path}`);
console.log(migration.path);
NODE
)

base_count="$("${PSQL[@]}" -Atqc "SELECT count(*) FROM platform.schema_migration WHERE stream_id IN ('PROD-01','PROD-02','PROD-03','PROD-04');")"
if [[ "$base_count" != "4" ]]; then
  echo "Production runtime manifest must be applied before projection recovery; found $base_count/4 base production migrations." >&2
  exit 1
fi

for migration in "${migrations[@]}"; do
  "${PSQL[@]}" -f "$migration" >/dev/null
done

"${PSQL[@]}" <<'SQL'
DO $readiness_contract$
BEGIN
  IF (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'PROD-06') <> 1 THEN
    RAISE EXCEPTION 'expected one PROD-06 migration ledger row';
  END IF;
  IF to_regclass('platform.runtime_projection_recovery_receipt') IS NULL
     OR to_regprocedure('platform.recover_runtime_projection_dead_letter(uuid,uuid,uuid,text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'projection recovery database boundary is incomplete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_projection_recovery') THEN
    RAISE EXCEPTION 'projection recovery role is missing';
  END IF;
  IF has_function_privilege('app_runtime', 'platform.recover_runtime_projection_dead_letter(uuid,uuid,uuid,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('app_projection_monitor', 'platform.recover_runtime_projection_dead_letter(uuid,uuid,uuid,text,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('app_projection_recovery', 'platform.recover_runtime_projection_dead_letter(uuid,uuid,uuid,text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'projection recovery function grants are not least-privilege';
  END IF;
END
$readiness_contract$;
SQL

bash tests/integration/verify-runtime-projection-dead-letter-recovery-core.sh
