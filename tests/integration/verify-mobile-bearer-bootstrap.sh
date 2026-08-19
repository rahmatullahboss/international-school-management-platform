#!/usr/bin/env bash
set -euo pipefail

base_database="${PGDATABASE:-postgres}"
verification_database="mob02_verify_${RANDOM}_${BASHPID}"
container_name="mob02-postgres-${RANDOM}-${BASHPID}"
manifest="infra/database/migration-manifest.json"
auth_migration="infra/database/post-integration-migrations/202607300301_AUTH-03_durable_identity_context.sql"
mobile_migration="infra/database/post-integration-migrations/202608190001_MOB-02_mobile_bearer_bootstrap.sql"
core_read_migration="infra/database/post-integration-migrations/202608190002_MOB-03_mobile_core_read_models.sql"
use_container=false

cleanup() {
  if [[ "$use_container" == "true" ]]; then
    docker rm -f "$container_name" >/dev/null 2>&1 || true
  else
    dropdb --maintenance-db="$base_database" --if-exists "$verification_database" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if command -v psql >/dev/null 2>&1 && command -v createdb >/dev/null 2>&1; then
  createdb --maintenance-db="$base_database" "$verification_database"
else
  command -v docker >/dev/null 2>&1 || {
    echo "psql/createdb or Docker is required for the mobile bootstrap migration verifier" >&2
    exit 1
  }
  use_container=true
  docker run -d --rm --name "$container_name" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
  for _ in $(seq 1 30); do
    if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  docker exec "$container_name" pg_isready -U postgres >/dev/null
fi

run_psql() {
  if [[ "$use_container" == "true" ]]; then
    docker exec -i "$container_name" psql -X --no-psqlrc -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
  else
    psql -X --no-psqlrc -v ON_ERROR_STOP=1 -d "$verification_database" "$@"
  fi
}

apply_file() {
  local migration="$1"
  if [[ "$use_container" == "true" ]]; then
    run_psql < "$migration"
  else
    run_psql -f "$migration"
  fi
}

mapfile -t canonical_migrations < <(
  node --input-type=module - "$manifest" <<'NODE'
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (manifest.gate !== 'GATE-WAVE-2-INTEGRATED') throw new Error('unexpected migration gate');
for (const migration of manifest.migrations) console.log(migration.path);
NODE
)

for migration in "${canonical_migrations[@]}"; do
  apply_file "$migration" >/dev/null
done
apply_file "$auth_migration" >/dev/null

run_psql <<'SQL' >/dev/null
INSERT INTO platform.tenant (
  tenant_id, slug, display_name, home_region, deployment_profile, database_binding, provisioning_status
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  'mobile-verify',
  'Mobile Verification School',
  'test',
  'regional-pooled',
  'mobile-verify',
  'active'
);

INSERT INTO tenancy.legal_entity (
  tenant_id, legal_entity_id, legal_name, country_code, default_currency
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  'Mobile Verification School',
  'BD',
  'BDT'
);

INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000002',
  'MAIN',
  'Main Campus',
  'Asia/Dhaka'
);

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '40000000-0000-4000-8000-000000000004',
  'https://identity.school.test',
  'provider-mobile-user-1',
  'guardian@example.test',
  'aal1'
);

INSERT INTO iam.role (tenant_id, role_id, role_key, display_name, system_role)
VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000005',
    'guardian',
    'Guardian',
    true
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000006',
    'admin',
    'Administrator',
    true
  );

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000007',
  '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id, tenant_id, membership_id, campus_id, status
) VALUES (
  '40000000-0000-4000-8000-000000000008',
  'https://identity.school.test',
  'provider-mobile-user-1',
  '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000007',
  '40000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000008',
    '40000000-0000-4000-8000-000000000005'
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000008',
    '40000000-0000-4000-8000-000000000006'
  );
SQL

apply_file "$mobile_migration" >/dev/null
apply_file "$core_read_migration" >/dev/null

run_psql <<'SQL' >/dev/null
INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000005',
  'attendance.take'
)
ON CONFLICT DO NOTHING;

INSERT INTO people.person (tenant_id, person_id, status)
VALUES
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000009', 'active'),
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000010', 'active');

INSERT INTO people.person_name (
  tenant_id, person_name_id, person_id, usage, given_name, family_name, effective_from
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000011',
    '40000000-0000-4000-8000-000000000009',
    'legal', 'Guardian', 'Tester', current_date - 10
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000012',
    '40000000-0000-4000-8000-000000000010',
    'legal', 'Student', 'Tester', current_date - 10
  );

INSERT INTO iam.person_link (tenant_id, account_id, person_id)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000009'
);

INSERT INTO student_lifecycle.student_profile (
  tenant_id, student_profile_id, person_id, status
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000013',
  '40000000-0000-4000-8000-000000000010',
  'active'
);

INSERT INTO student_lifecycle.enrollment (
  tenant_id, enrollment_id, student_profile_id, campus_id, program_id,
  academic_year_id, status, effective_from, idempotency_key
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000014',
  '40000000-0000-4000-8000-000000000013',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000015',
  '40000000-0000-4000-8000-000000000016',
  'active', current_date - 10, 'mobile-core-read-enrollment'
);

INSERT INTO people.guardian_student_authority (
  tenant_id, authority_id, guardian_person_id, student_person_id,
  education_authority, portal_access, verification_status, effective_from
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000017',
  '40000000-0000-4000-8000-000000000009',
  '40000000-0000-4000-8000-000000000010',
  true, true, 'verified', current_date - 10
);
SQL

run_psql -At <<'SQL'
DO $verify$
DECLARE
  access_count integer;
  capability_count integer;
  leaked_admin_count integer;
BEGIN
  SELECT count(*), max(cardinality(capabilities))
  INTO access_count, capability_count
  FROM iam.resolve_mobile_bootstrap_access(
    'https://identity.school.test',
    'provider-mobile-user-1'
  );

  IF access_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one mobile persona access row, got %', access_count;
  END IF;
  IF capability_count <> 8 THEN
    RAISE EXCEPTION 'expected guardian capability allow-list of 8, got %', capability_count;
  END IF;

  SELECT count(*) INTO leaked_admin_count
  FROM iam.resolve_mobile_bootstrap_access(
    'https://identity.school.test',
    'provider-mobile-user-1'
  )
  WHERE persona = 'admin';
  IF leaked_admin_count <> 0 THEN
    RAISE EXCEPTION 'non-mobile admin role leaked into bootstrap';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM iam.resolve_mobile_bootstrap_access(
      'https://identity.school.test',
      'provider-mobile-user-1'
    )
    WHERE time_zone <> 'Asia/Dhaka'
       OR tenant_name <> 'Mobile Verification School'
       OR campus_name <> 'Main Campus'
  ) THEN
    RAISE EXCEPTION 'tenant/campus bootstrap identity was not preserved';
  END IF;

  IF (platform.resolve_mobile_family_profiles(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian'
  )->>'activeStudentId') <> '40000000-0000-4000-8000-000000000013' THEN
    RAISE EXCEPTION 'guardian mobile profile resolver did not preserve exact authorized student scope';
  END IF;

  IF platform.resolve_mobile_family_profiles(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'foreign tenant mobile family scope must fail closed';
  END IF;

  IF has_function_privilege('public', 'platform.resolve_mobile_family_profiles(text,text,uuid,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC must not execute mobile family profile resolver';
  END IF;
  IF NOT has_function_privilege('app_runtime', 'platform.resolve_mobile_family_profiles(text,text,uuid,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'app_runtime must execute mobile family profile resolver';
  END IF;

  IF has_function_privilege('public', 'iam.resolve_mobile_bootstrap_access(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC must not execute mobile bootstrap resolver';
  END IF;
  IF NOT has_function_privilege('app_runtime', 'iam.resolve_mobile_bootstrap_access(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'app_runtime must execute mobile bootstrap resolver';
  END IF;
END
$verify$;

BEGIN;
SET LOCAL ROLE app_runtime;
DO $runtime$
BEGIN
  IF (SELECT count(*) FROM iam.resolve_mobile_bootstrap_access(
    'https://identity.school.test',
    'provider-mobile-user-1'
  )) <> 1 THEN
    RAISE EXCEPTION 'app_runtime could not resolve tenant-safe mobile bootstrap access';
  END IF;
END
$runtime$;
ROLLBACK;

SELECT 'Mobile bearer bootstrap and core read-model migration verification: PASS';
SQL
