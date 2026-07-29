# ACAD-01 Release Handoff

## Delivery identity

- Stream: `ACAD-01 — Academics, Attendance and Records`
- Reviewed starting SHA: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
- Git branch: `module/academics-attendance-records`
- Fixed worktree: `.worktrees/acad-01-academics`
- Current implementation HEAD before final handoff docs: `dafb6f849c107fe9901eb6e85e8243c6a14984e1`
- Integration base: `integration/international-school-platform-v1`
- Pull request: `#7` — `https://github.com/rahmatullahboss/international-school-management-platform/pull/7`
- Neon project: `lingering-brook-52999532`
- Neon branch: `agent/acad-01-academics` (`br-gentle-waterfall-axcl7l8z`)

No production deployment, production data mutation or destructive database operation was performed.

## Delivered scope

ACAD-01 now owns the complete versioned lifecycle for:

- academic years, terms, instructional calendars and bell schedules;
- curriculum/programme/course versions, standards, classes/sections, staff assignments and rosters;
- timetable versions, meeting materialisation, conflict evidence, publication and substitutions;
- attendance policies/codes, scheduled sessions, offline synchronization, finalisation, amendments, notices and interventions;
- grading policies/scales/categories, rubrics, assessments, raw/outcome results, explainable calculations, moderation, locks, publication and grade changes;
- reporting periods/templates, report cards, promotion decisions, credits/GPA and immutable transcript issue/reissue;
- permission-scoped application APIs, reports, safe CSV export and staged imports;
- accessible responsive/RTL admin and teacher academic workspaces;
- structured observability, readiness, runbook and database recovery evidence.

## Public dependency contract

- SIS validates opaque student, staff and enrollment/student identifiers.
- Foundation/tenancy validates opaque campus identifiers.
- INT validates country-pack references.
- Ordinary ACAD flows do not depend on FIN.
- ACAD does not write another module's private schema and does not import unmerged active Wave 2 code.

## Database delivery

Ordered ACAD migration manifest:

1. `202607280201_ACAD-01_academic_structure`
2. `202607280202_ACAD-01_timetable`
3. `202607280203_ACAD-01_attendance`
4. `202607280204_ACAD-01_gradebook`
5. `202607280205_ACAD-01_records`

Live isolated-branch evidence confirms:

- five ACAD ledger entries;
- five ACAD schemas;
- 53 ACAD-owned tables;
- forced RLS and tenant policy on all 53 tables;
- required publication/finalisation/lock/transcript immutability triggers;
- reviewed-base + ACAD replay idempotency;
- `app_runtime` tenant isolation;
- published academic-version immutability;
- rollback recovery with zero persisted probe rows.

## Verification outcome

Passed:

- ACAD focused tests: 42/42;
- root format check;
- root ESLint;
- root TypeScript project build;
- root test suite;
- root production build;
- architecture boundary verification;
- artifact verification;
- npm production-dependency audit with zero vulnerabilities;
- ACAD static hygiene and private-schema dependency checks;
- Impeccable detector with zero findings;
- admin project TypeScript and standalone teacher strict TypeScript;
- responsive, RTL, focus, forced-colour and reduced-motion SSR/CSS assertions.

## Known integration-level blocker

The reviewed base root scripts point both `verify:migrations` and `verify:rollbacks` to coordinator-owned `scripts/verify-migrations.mjs`, but the exact reviewed base contains no such file or `scripts` directory. Both root commands therefore fail before inspecting ACAD migrations.

ACAD did not recreate shared tooling outside its ownership. Module-local coverage is supplied by:

- `packages/modules/academics/migrations/manifest.json`;
- `packages/modules/academics/verification/verify_acad_schema.sql`;
- `packages/modules/academics/verification/probe_acad_rls_and_recovery.sql`;
- live Neon replay/idempotency/RLS/immutability/rollback evidence.

The integration/coordinator stream must restore the shared verifier before declaring the global migration/rollback gate green. This is the only known completion-gate blocker and is not an ACAD domain/test/build failure.

## Integration sequence

1. Restore or supply the coordinator-owned root migration verifier.
2. Review the ACAD manifest order and public contracts.
3. Run the full reviewed-base + ACAD migration composition on a fresh equivalent isolated Neon branch.
4. Run the module schema verifier and rollback-only recovery probe.
5. Run all root gates including restored migration/rollback verification.
6. Review and merge the pull request into `integration/international-school-platform-v1` through the normal integration process.
7. Do not deploy directly from the module branch.

## Operational references

- contracts: `docs/modules/academics/contracts.md`
- timetable: `docs/modules/academics/timetable.md`
- attendance: `docs/modules/academics/attendance.md`
- gradebook: `docs/modules/academics/gradebook.md`
- records: `docs/modules/academics/records.md`
- application/UI: `docs/modules/academics/application-and-ui.md`
- UI evidence: `docs/modules/academics/ui-evidence.md`
- observability: `docs/modules/academics/operations.md`
- runbook: `docs/modules/academics/runbook.md`
- migration evidence: `docs/modules/academics/migration-evidence.md`
