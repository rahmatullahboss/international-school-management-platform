#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Expected one marker in {path}, found {count}: {old[:120]!r}')
    path.write_text(source.replace(old, new), encoding='utf-8')


staging = Path('.github/workflows/deploy-cloudflare-staging.yml')
replace_once(
    staging,
    " || github.head_ref == 'auth/database-permission-evaluation-v1'",
    " || github.head_ref == 'auth/database-permission-evaluation-v1' || github.head_ref == 'pilot/database-read-models-v1'",
)
replace_once(
    staging,
    """          test "$authorize_status" = '503'
          logout_status=$(curl --silent --show-error --output auth-logout-error.json --write-out '%{http_code}' \\
""",
    """          test "$authorize_status" = '503'
          snapshot_status=$(curl --silent --show-error \\
            --dump-header snapshot-headers.txt \\
            --output auth-snapshot-error.json \\
            --write-out '%{http_code}' \\
            -H "Origin: $staging_origin" \\
            "$API_URL/auth/v1/snapshot")
          test "$snapshot_status" = '503'
          logout_status=$(curl --silent --show-error --output auth-logout-error.json --write-out '%{http_code}' \\
""",
)
replace_once(
    staging,
    """              'databasePermissionEvaluation', 'currentRoleRevalidation',
              'assuranceAwarePermissionDecision', 'serverOwnedAuthorizationScope'
""",
    """              'databasePermissionEvaluation', 'currentRoleRevalidation',
              'assuranceAwarePermissionDecision', 'serverOwnedAuthorizationScope',
              'databaseReadModels', 'tenantSafeReadModelScope', 'revisionBoundEtags',
              'boundedServerSnapshotCache', 'currentGrantSnapshotRevalidation'
""",
)
replace_once(
    staging,
    """              'membership-source', 'permission-source', 'allowed-web-origins'
""",
    """              'membership-source', 'permission-source', 'runtime-read-model-source',
              'allowed-web-origins'
""",
)
replace_once(
    staging,
    """          assert 'cache-control: no-store' in authorize_headers, authorize_headers

          logout_error = json.loads(Path('auth-logout-error.json').read_text(encoding='utf-8'))
""",
    """          assert 'cache-control: no-store' in authorize_headers, authorize_headers

          snapshot_error = json.loads(Path('auth-snapshot-error.json').read_text(encoding='utf-8'))
          assert snapshot_error.get('error', {}).get('code') == 'runtime_read_model_configuration_invalid', snapshot_error
          snapshot_headers = Path('snapshot-headers.txt').read_text(encoding='utf-8').lower()
          assert 'set-cookie:' not in snapshot_headers, snapshot_headers
          assert 'access-control-allow-origin:' not in snapshot_headers, snapshot_headers
          assert 'cache-control: no-store' in snapshot_headers, snapshot_headers

          logout_error = json.loads(Path('auth-logout-error.json').read_text(encoding='utf-8'))
""",
)
replace_once(
    staging,
    """            echo "- Database permission decision: $API_URL/auth/v1/authorize"
            echo "- Browser logout: $API_URL/auth/v1/logout"
""",
    """            echo "- Database permission decision: $API_URL/auth/v1/authorize"
            echo "- Database runtime snapshot: $API_URL/auth/v1/snapshot"
            echo "- Browser logout: $API_URL/auth/v1/logout"
""",
)
replace_once(
    staging,
    """            echo '- Scope: database-backed permission evaluation, current-role revalidation, assurance-aware step-up decisions, server-owned authorization scope, bounded request streaming, typed Logout Tokens and provider session revocation are verified; real provider login and production data access remain disabled until approved production bindings are configured.'
""",
    """            echo '- Scope: database-backed permission evaluation and tenant-safe runtime projections, current-role/current-grant revalidation, revision-and-capability-bound private ETags, bounded isolate caching, assurance-aware step-up decisions, typed Logout Tokens and provider session revocation are verified; real provider login, production projections and production data access remain disabled until approved bindings are configured.'
""",
)

canonical_ci = """name: CI

on:
  pull_request:
  push:
    branches:
      - main
      - 'program/**'
      - 'module/**'
      - 'integration/**'

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_HOST_AUTH_METHOD: trust
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.22.2'
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run check:boundaries
      - run: npm run typecheck
      - run: npm run test
      - name: Verify all Wave 2 migrations on fresh PostgreSQL
        env:
          PGHOST: 127.0.0.1
          PGPORT: 5432
          PGUSER: postgres
          PGDATABASE: postgres
        run: npm run verify:migrations
      - name: Verify AUTH post-integration migrations and revocation contracts
        env:
          PGHOST: 127.0.0.1
          PGPORT: 5432
          PGUSER: postgres
          PGDATABASE: postgres
        run: npm run verify:auth-migrations
      - name: Verify live Neon serverless driver
        if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          test -n "$DATABASE_URL"
          npm run test:neon
      - run: npm run build
      - run: npm run check:experience-budget
      - run: npm audit --audit-level=high
      - run: npm run licenses:check
      - run: npm run provenance:generate
      - run: git diff --exit-code -- artifacts THIRD_PARTY_NOTICES.md
      - run: npx playwright install --with-deps chromium
      - run: npm run test:browser
      - run: python3 scripts/validate_execution_artifacts.py
"""
Path('.github/workflows/ci.yml').write_text(canonical_ci, encoding='utf-8')
