#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")
TEST_LOGIN="projection_recovery_login_test"

"${PSQL[@]}" <<SQL
DO \$setup\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TEST_LOGIN}') THEN
    RAISE EXCEPTION 'projection recovery credential test login already exists';
  END IF;
  EXECUTE format(
    'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS IN ROLE app_projection_recovery',
    '${TEST_LOGIN}'
  );
END
\$setup\$;
SQL

credential_ready() {
  "${PSQL[@]}" -Atqc "SET SESSION AUTHORIZATION ${TEST_LOGIN}; SELECT platform.projection_recovery_credential_ready()::int; RESET SESSION AUTHORIZATION;"
}

assert_ready() {
  local expected="$1"
  local label="$2"
  local actual
  actual="$(credential_ready)"
  if [[ "$actual" != "$expected" ]]; then
    echo "Projection recovery credential readiness mismatch for ${label}: expected ${expected}, got ${actual}" >&2
    exit 1
  fi
}

assert_ready "1" "exact reviewed login shape"

"${PSQL[@]}" -qc "GRANT app_runtime TO ${TEST_LOGIN};"
assert_ready "0" "broad app_runtime membership drift"
"${PSQL[@]}" -qc "REVOKE app_runtime FROM ${TEST_LOGIN};"

"${PSQL[@]}" -qc "GRANT app_projection_monitor TO ${TEST_LOGIN};"
assert_ready "0" "projection monitor membership drift"
"${PSQL[@]}" -qc "REVOKE app_projection_monitor FROM ${TEST_LOGIN};"

"${PSQL[@]}" -qc "GRANT SELECT ON platform.tenant TO ${TEST_LOGIN};"
assert_ready "0" "direct application relation privilege drift"
"${PSQL[@]}" -qc "REVOKE SELECT ON platform.tenant FROM ${TEST_LOGIN};"

"${PSQL[@]}" -qc "ALTER ROLE ${TEST_LOGIN} CREATEDB;"
assert_ready "0" "elevated CREATEDB attribute drift"
"${PSQL[@]}" -qc "ALTER ROLE ${TEST_LOGIN} NOCREATEDB;"

assert_ready "1" "reviewed login shape after drift removal"

"${PSQL[@]}" <<SQL
REVOKE app_projection_recovery FROM ${TEST_LOGIN};
DROP ROLE ${TEST_LOGIN};
SQL

echo "Projection recovery credential readiness verification passed."
