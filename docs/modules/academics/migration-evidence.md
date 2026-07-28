# ACAD-01 Migration and Recovery Evidence

## Target

- Git reviewed base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
- Git branch: `module/academics-attendance-records`
- Neon project: `lingering-brook-52999532`
- Neon branch: `agent/acad-01-academics`
- Neon branch ID: `br-gentle-waterfall-axcl7l8z`
- Database: `neondb`
- Engine observed: PostgreSQL 17.10

This is an isolated development branch. No production endpoint or production deployment was used.

## Parent-lineage constraint

The available Neon branch connector created `agent/acad-01-academics` from Neon `main` because it did not expose a parent selector. The branch initially contained only `public`, no `app_runtime` role and no `platform.schema_migration` table.

To preserve the Git-reviewed Wave 1 authority, the database replay did not consume another active Wave 2 branch. Instead it extracted every SQL migration present at the exact reviewed Git SHA, then appended the five ACAD migrations in the module-local manifest order.

## Transactional replay

The replay used:

- migration files extracted with `git show <reviewed-sha>:<path>`;
- `psql -X -v ON_ERROR_STOP=1 --single-transaction`;
- the exact reviewed-base migration set first;
- ACAD migrations `201` through `205` second.

The transaction completed successfully. The same complete replay was then executed a second time. The schema-migration ledger count was unchanged and the ACAD stream remained exactly five rows, demonstrating replay idempotency for the reviewed-base + ACAD composition.

## Schema verification

`packages/modules/academics/verification/verify_acad_schema.sql` passed and asserted:

- five expected ACAD ledger rows;
- schemas `academics`, `scheduling`, `attendance`, `gradebook` and `records` exist;
- 53 ACAD-owned tables exist;
- all 53 tables have row-level security enabled;
- all 53 tables force row-level security;
- all 53 tables have the `tenant_policy` policy;
- required publication/finalization/lock/transcript immutability triggers exist.

## RLS, immutability and recovery probe

`packages/modules/academics/verification/probe_acad_rls_and_recovery.sql` ran with `ON_ERROR_STOP` and:

1. began a transaction;
2. assumed `app_runtime`;
3. created one academic-year probe row for tenant A and one for tenant B;
4. confirmed tenant A could see only its row and no tenant-B row;
5. published tenant A's version;
6. confirmed a later content mutation failed with `published academic versions are immutable`;
7. switched to an unrelated tenant and confirmed zero probe rows were visible;
8. reset the role;
9. ended with `ROLLBACK;`.

A follow-up owner query confirmed zero `ACAD-PROBE-%` rows persisted. This is recovery evidence, not production data seeding.

## Tooling boundary

The root `package.json` references `scripts/verify-migrations.mjs`, but the exact reviewed base contains no such script or `scripts` directory. Shared migration verification tooling is coordinator-owned under the ownership contract, so ACAD did not recreate or modify it. The module supplies its own manifest, assertion-only schema verifier and rollback-only live probe while reporting the missing root verifier as an integration-level baseline defect.
