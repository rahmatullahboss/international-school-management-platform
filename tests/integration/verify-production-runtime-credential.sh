#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")
TEST_LOGIN_ROLE='prod_runtime_login_test'

owner_ready="$("${PSQL[@]}" -Atqc "SELECT platform.production_runtime_credential_ready();")"
if [[ "$owner_ready" != "f" ]]; then
  echo 'Database owner unexpectedly passed the production runtime credential readiness check.' >&2
  exit 1
fi

"${PSQL[@]}" <<'SQL'
DO $login$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prod_runtime_login_test') THEN
    RAISE EXCEPTION 'test production login role already exists';
  END IF;
  CREATE ROLE prod_runtime_login_test
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS
    INHERIT;
END
$login$;
GRANT app_production_runtime TO prod_runtime_login_test;
SQL

readiness_as_login() {
  "${PSQL[@]}" -Atq <<'SQL'
SET SESSION AUTHORIZATION prod_runtime_login_test;
SELECT platform.production_runtime_credential_ready();
RESET SESSION AUTHORIZATION;
SQL
}

ready="$(readiness_as_login)"
if [[ "$ready" != "t" ]]; then
  echo 'Reviewed production login role did not pass credential readiness.' >&2
  exit 1
fi

"${PSQL[@]}" -qc 'GRANT SELECT ON platform.tenant TO prod_runtime_login_test;'
direct_table_ready="$(readiness_as_login)"
if [[ "$direct_table_ready" != "f" ]]; then
  echo 'Direct application-table access did not invalidate production credential readiness.' >&2
  exit 1
fi
"${PSQL[@]}" -qc 'REVOKE SELECT ON platform.tenant FROM prod_runtime_login_test;'

"${PSQL[@]}" -qc 'GRANT app_runtime TO prod_runtime_login_test;'
broad_runtime_ready="$(readiness_as_login)"
if [[ "$broad_runtime_ready" != "f" ]]; then
  echo 'Broad app_runtime membership did not invalidate production credential readiness.' >&2
  exit 1
fi
"${PSQL[@]}" -qc 'REVOKE app_runtime FROM prod_runtime_login_test;'

restored_ready="$(readiness_as_login)"
if [[ "$restored_ready" != "t" ]]; then
  echo 'Reviewed production login role did not recover after privilege drift was removed.' >&2
  exit 1
fi

"${PSQL[@]}" <<'SQL'
REVOKE app_production_runtime FROM prod_runtime_login_test;
DROP ROLE prod_runtime_login_test;
SQL

echo 'Production runtime login identity and privilege-drift readiness verification passed.'
