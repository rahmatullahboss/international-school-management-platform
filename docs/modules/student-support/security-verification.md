# CARE-01 Security Verification — Checkpoint 1

## Scope

Checkpoint: `security-contract`

Git base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`

Approved threat-model source read-only SHA: `1ee5ef8dd5c38234cf67acfda5b73df4602f64d4`

Neon project: `lingering-brook-52999532`

Neon branch: `agent/care-01-student-support` (`br-raspy-smoke-ax0msb57`)

No production or Neon `main` schema mutation was performed.

## Automated source checks

- `npm exec vitest run tests/student-support/security-contract.test.ts tests/student-support/security-migration.test.ts`
  - result: 2 files passed, 14 tests passed.
- `npm exec -- tsc -p tests/student-support/tsconfig.json`
  - result: passed with no diagnostics.

The suite publishes all 40 identifiers `SS-TM-001` through `SS-TM-040` and exercises deny-by-default authorization, tenant mismatch, broad-role denial, machine-credential denial, relationship and explicit case membership, guardian authority plus CARE publication, AAL2, break-glass restrictions, fail-closed read logging, immutable evidence, exact export and connector approval, safe notifications, offline bundle expiry/device binding, legal-hold-aware destruction and incident isolation.

## Neon migration and RLS evidence

The connector could only create the named branch from Neon `main`, while the reviewed integration database is on `integration/international-school-platform-v1` (`br-shiny-silence-axznuy37`). Before CARE writes, the new branch was verified to contain no `app_runtime` role and no integrated schema. CARE migration was not applied to that empty state.

The canonical repository migration manifest was then replayed on the CARE branch. Foundation migrations 5/5 and SIS migrations 6/6 were successfully replayed before the CARE security migration. The security migration was applied only to the CARE branch and recorded as `202607290201_CARE-01_security_contract` in `platform.schema_migration`.

Runtime probes used synthetic tenants only:

- no tenant context under `SET LOCAL ROLE app_runtime`: `0` visible rows;
- tenant A context: `1` tenant-A row visible and `0` tenant-B rows visible;
- tenant-A context attempting a tenant-B insert: rejected with `new row violates row-level security policy`;
- `app_runtime` attempting to update `safeguarding.access_evidence`: rejected with `permission denied`;
- all four security tables have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`;
- access evidence uses separate valid PostgreSQL SELECT and INSERT policies and grants no UPDATE or DELETE.

## Recovery status

The repository's complete reviewed Wave 1 manifest contains 22 migrations: FND 5, SIS 6, FIN 4 and INT 7. This checkpoint proves the CARE security migration against the FND/SIS prerequisite lineage needed by the schema. FIN and INT canonical replay plus a fresh disposable replay remain scheduled for the final restricted-interface-verification checkpoint. CARE code consumes FIN and INT only through frozen public contracts and does not mutate their tables.

## Data handling

All fixtures, identifiers and narratives used in tests are synthetic. No real student, health, counselling, safeguarding or family information was copied into source, logs, screenshots or the Neon branch.
