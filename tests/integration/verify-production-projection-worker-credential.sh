#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")
MIGRATION='infra/database/post-integration-migrations/202608140001_PROD-09_projection_worker_credential.sql'
TEST_LOGIN_ROLE='projection_worker_login_test'

if grep -Eq '^[[:space:]]*ALTER ROLE app_projection_worker' "$MIGRATION"; then
  echo 'PROD-09 must not ALTER the managed projection worker role; Neon blocks that path.' >&2
  exit 1
fi

for requirement in \
  'CREATE ROLE app_projection_worker' \
  'NOLOGIN' \
  'NOSUPERUSER' \
  'NOCREATEDB' \
  'NOCREATEROLE' \
  'NOREPLICATION' \
  'NOBYPASSRLS' \
  'NOINHERIT' \
  "RAISE EXCEPTION 'PROJECTION_WORKER_ROLE_FLAGS_INVALID'"
do
  if ! grep -Fq "$requirement" "$MIGRATION"; then
    echo "PROD-09 Neon-portable role contract is missing: $requirement" >&2
    exit 1
  fi
done

"${PSQL[@]}" -f "$MIGRATION" >/dev/null
"${PSQL[@]}" -f "$MIGRATION" >/dev/null

ledger_count="$("${PSQL[@]}" -Atqc "SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'PROD-09';")"
if [[ "$ledger_count" != "1" ]]; then
  echo 'PROD-09 projection worker credential migration ledger entry is missing or duplicated.' >&2
  exit 1
fi

owner_ready="$("${PSQL[@]}" -Atqc 'SELECT platform.projection_worker_credential_ready();')"
if [[ "$owner_ready" != "f" ]]; then
  echo 'Database owner unexpectedly passed the projection worker credential readiness check.' >&2
  exit 1
fi

api_batch_execute="$("${PSQL[@]}" -Atqc "SELECT has_function_privilege('app_production_runtime', 'platform.process_runtime_projection_refresh_batch(text,integer,integer)', 'EXECUTE');")"
if [[ "$api_batch_execute" != "f" ]]; then
  echo 'Production API capability role unexpectedly executes the projection worker batch boundary.' >&2
  exit 1
fi

api_readiness_execute="$("${PSQL[@]}" -Atqc "SELECT has_function_privilege('app_production_runtime', 'platform.projection_worker_credential_ready()', 'EXECUTE');")"
if [[ "$api_readiness_execute" != "f" ]]; then
  echo 'Production API capability role unexpectedly executes projection worker credential readiness.' >&2
  exit 1
fi

"${PSQL[@]}" <<'SQL'
DO $login$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'projection_worker_login_test') THEN
    RAISE EXCEPTION 'test projection worker login role already exists';
  END IF;
  CREATE ROLE projection_worker_login_test
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS
    INHERIT;
END
$login$;
GRANT app_projection_worker TO projection_worker_login_test;
SQL

readiness_as_login() {
  "${PSQL[@]}" -Atq <<'SQL'
SET SESSION AUTHORIZATION projection_worker_login_test;
SELECT platform.projection_worker_credential_ready();
RESET SESSION AUTHORIZATION;
SQL
}

ready="$(readiness_as_login)"
if [[ "$ready" != "t" ]]; then
  echo 'Reviewed dedicated projection worker login did not pass credential readiness.' >&2
  exit 1
fi

"${PSQL[@]}" -qc 'GRANT SELECT ON platform.tenant TO projection_worker_login_test;'
direct_table_ready="$(readiness_as_login)"
if [[ "$direct_table_ready" != "f" ]]; then
  echo 'Direct application-table access did not invalidate projection worker credential readiness.' >&2
  exit 1
fi
"${PSQL[@]}" -qc 'REVOKE SELECT ON platform.tenant FROM projection_worker_login_test;'

"${PSQL[@]}" -qc 'GRANT app_runtime TO projection_worker_login_test;'
broad_runtime_ready="$(readiness_as_login)"
if [[ "$broad_runtime_ready" != "f" ]]; then
  echo 'Broad app_runtime membership did not invalidate projection worker credential readiness.' >&2
  exit 1
fi
"${PSQL[@]}" -qc 'REVOKE app_runtime FROM projection_worker_login_test;'

"${PSQL[@]}" -qc 'GRANT app_production_runtime TO projection_worker_login_test;'
shared_api_ready="$(readiness_as_login)"
if [[ "$shared_api_ready" != "f" ]]; then
  echo 'Production API role contamination did not invalidate projection worker credential readiness.' >&2
  exit 1
fi
"${PSQL[@]}" -qc 'REVOKE app_production_runtime FROM projection_worker_login_test;'

restored_ready="$(readiness_as_login)"
if [[ "$restored_ready" != "t" ]]; then
  echo 'Dedicated projection worker login did not recover after privilege drift was removed.' >&2
  exit 1
fi

"${PSQL[@]}" <<'SQL'
REVOKE app_projection_worker FROM projection_worker_login_test;
DROP ROLE projection_worker_login_test;
SQL

echo 'Production projection worker login identity, Neon portability and privilege-drift readiness verification passed.'
