# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`
**Updated:** 2026-07-29
**Current repository state:** Wave 2 serial integration is complete and `GATE-WAVE-2-INTEGRATED` passed at reviewed integration SHA `60836a8fe92f64ba581c4bde65005729d1fe14b2`. Exact reviewed `ACAD-01`, `OPS-01` and `CARE-01` candidates are integrated with coordinator-owned shared-file resolutions only. `EXP-01` is ready to execute from this exact reviewed Wave 2 base.

## Gate status

| Gate | Status | Evidence / required condition |
|---|---|---|
| `GATE-DOCUMENTS-APPROVED` | passed | Owner authorized FND-01 execution; `python3 scripts/validate_execution_artifacts.py` passed on 2026-07-28 |
| `GATE-FOUNDATION-READY` | passed | Milestones 1–8 implemented; owner review approved; Neon SQL/RLS proof passed; secret-backed `npm run test:neon` passed 1/1 on 2026-07-28 |
| `GATE-REVIEWED-SHAS-AVAILABLE` | passed | Wave 1: `SIS-01` `5e2499018282d8296abfe093b5dd95b231829379`, `FIN-01` `5f9e1692a8fc19fc2e9789a338d028918acdeaf6`, `INT-01` `bfa95a4a42025213fa7c2090a587ef5304924da7`; Wave 2: `ACAD-01` `1d895afdf51f6d4f6323ada4b93d9ba32b244480`, `OPS-01` `fc749d7c0ece36964da8f923431bb3b7ac925e56`, `CARE-01` `9304bd6c425eca4ec69db90c1f1cab3f7a409b8d` |
| `GATE-INT-COMPLETE` | passed | Seven milestones complete; agent-branch apply `30345998526`, logical replay `30346762735` and fresh Neon branch replay `30347294967` passed |
| `GATE-WAVE-1-INTEGRATED` | passed | Reviewed integration SHA `8cc8ee1562ade672b14c1c44af935fe7e2307976`; CI `30362743336`; integration Neon apply/recovery run `30362743167`; 22 migrations, 139/139 tenant-owned tables protected, finance invariants and six browser journeys passed |
| `GATE-STUDENT-SUPPORT-THREAT-MODEL` | passed | [Student-support high-risk data threat model](../security/student-support-threat-model.md) approved against reviewed Wave 1 integration SHA `8cc8ee1562ade672b14c1c44af935fe7e2307976`; 40 security invariants, role/action matrix, negative tests, RLS/migration guardrails and incident controls recorded |
| `GATE-WAVE-2-INTEGRATED` | passed | Reviewed integration SHA `60836a8fe92f64ba581c4bde65005729d1fe14b2`; root CI `30437010804` passed full verification, fresh 40-migration PostgreSQL replay, live Neon driver and browser suites; Wave 2 Neon apply/recovery run `30437011092` passed exact branch identity, canonical apply, RLS/finance/tenant verification and disposable database replay |
| `GATE-PILOT-READY` | blocked | `EXP-01` integrated and final system/recovery verification passed |

## Multi-agent operating decision

Owner decision recorded on 2026-07-28:

- use separate agents only for complete end-to-end module streams;
- do not create agents for small tasks, bugs, isolated screens, endpoints, migrations, tests or internal milestones;
- after `GATE-FOUNDATION-READY`, start the Wave 1 streams `SIS-01`, `FIN-01` and `INT-01` in parallel from the same exact reviewed foundation SHA;
- each stream must use its declared fixed Git branch/worktree and matching Neon branch;
- the foundation/program coordinator maintains shared documentation, gate state, contract-change decisions and this tracker without writing concurrently inside module-owned paths;
- `INTEG-01` reviews and integrates module SHAs serially after they are recorded here.

Current readiness: `GATE-WAVE-2-INTEGRATED` has passed. `EXP-01` may now start only from reviewed Wave 2 integration SHA `60836a8fe92f64ba581c4bde65005729d1fe14b2`. `INTEG-01` waits for the reviewed `EXP-01` candidate before Wave 3 integration.

## Stream tracker

| Stream | Wave | Status | Base | Current/next milestone | Final/last checkpoint | Blocking condition |
|---|---:|---|---|---|---|---|
| `FND-01` | 0 | complete; gate passed | `4038081bc122c41d4a312bd75d01c784e3f4eee1` | Wave 1 released | `55114f55a375d3d79dba7ea21f984b789b5dbca1` | none |
| `SIS-01` | 1 | complete; integrated to `main` | `55114f55a375d3d79dba7ea21f984b789b5dbca1` | complete | reviewed head `5e2499018282d8296abfe093b5dd95b231829379`; main merge `9b9605aff93901eb1ad9e5b4d9ad9d6517d04aba` | none |
| `FIN-01` | 1 | complete; integrated by `INTEG-01` | `55114f55a375d3d79dba7ea21f984b789b5dbca1` | complete | reviewed head `5f9e1692a8fc19fc2e9789a338d028918acdeaf6`; integration merge `da3d561` | none |
| `INT-01` | 1 | complete; integrated by `INTEG-01` | `55114f55a375d3d79dba7ea21f984b789b5dbca1` | complete | reviewed head `bfa95a4a42025213fa7c2090a587ef5304924da7`; integration merge `0822462` | none |
| `ACAD-01` | 2 | complete; reviewed; integrated by `INTEG-01` | `8cc8ee1562ade672b14c1c44af935fe7e2307976` | complete | reviewed head `1d895afdf51f6d4f6323ada4b93d9ba32b244480`; integration merge `7a6dee6136721801cb5fe0758f5a65adce90da31` | none |
| `OPS-01` | 2 | complete; reviewed; integrated by `INTEG-01` | `8cc8ee1562ade672b14c1c44af935fe7e2307976` | complete | reviewed head `fc749d7c0ece36964da8f923431bb3b7ac925e56`; integration merge `51c714c06c16e15c1ced866980b56b04e1889932` | none |
| `CARE-01` | 2 | complete; reviewed; integrated by `INTEG-01` | `8cc8ee1562ade672b14c1c44af935fe7e2307976` | complete | reviewed head `9304bd6c425eca4ec69db90c1f1cab3f7a409b8d`; integration merge `af8a58d79053882e3e5c41610f68c9e95f5f119c`; recovery passed | none |
| `EXP-01` | 3 | ready | `60836a8fe92f64ba581c4bde65005729d1fe14b2` | persona shells | reviewed Wave 2 gate passed | none |
| `INTEG-01` | gated serial | Wave 2 integrated; gate passed | `ec921ea26f6980017f848bfd6646a77868bd4cb1` | wait for reviewed `EXP-01`, then perform Wave 3 integration | reviewed Wave 2 integration `60836a8fe92f64ba581c4bde65005729d1fe14b2` | `EXP-01` completion |

## Required checkpoint evidence format

For each checkpoint append one record under the stream heading:

```text
Date/time:
Stream:
Milestone completed:
Git branch:
Worktree:
Neon branch:
Starting base:
Checkpoint SHA:
Changed owned paths:
Focused checks and results:
UI/design evidence when applicable: Impeccable version, PRODUCT.md/DESIGN.md SHAs, surface brief, critique/audit, detector, accessibility, responsive/RTL, harden and polish
Gate outcome:
Exact next milestone:
Dirty/uncommitted state:
Production mutation performed: no
```

## FND-01 evidence

Date/time: 2026-07-28T06:06:00+06:00
Stream: FND-01
Milestone completed: 1 — repository and engineering bootstrap
Git branch: `program/foundation-neon-platform`
Worktree: `.worktrees/fnd-01-foundation`
Neon branch: `agent/fnd-01-foundation` (`br-misty-frost-ax8ij4vw`), parent `main` (`br-cool-wildflower-axsot8l1`)
Starting base: `4038081bc122c41d4a312bd75d01c784e3f4eee1`
Checkpoint SHA: `8d328d1cf04e8076bcf705a5198dc4eb8b449ada`
Changed owned paths: root npm/TypeScript/lint/format/test configuration; `.github/workflows/ci.yml`; `apps/platform-api`; `apps/platform-web`; `packages/platform`; `tests/browser`; contribution/security/environment conventions
Focused checks and results: execution artifact validator PASS; focused Vitest 3/3 PASS; TypeScript project build PASS; ESLint PASS; Prettier check PASS; Wrangler dry-run build PASS; Vite production build PASS
Gate outcome: milestone 1 passed; `GATE-DOCUMENTS-APPROVED` passed; foundation gate remains blocked pending milestones 2–8
Exact next milestone: 2 — direct Neon data platform
Dirty/uncommitted state: tracker evidence update only
Production mutation performed: no

### Milestone 2 — direct Neon data platform

Date/time: 2026-07-28T06:15:00+06:00
Checkpoint SHA: `5f7b0d7b669b9ef5882a7dc7cbb883d6b71eaed6`
Neon project/branch: `lingering-brook-52999532` / `br-misty-frost-ax8ij4vw`
PostgreSQL/compute: PostgreSQL 17.10; direct host and pooled host recorded for compute `ep-ancient-sun-axxxyb6c`
Migration: `202607280001_FND-01_foundation`; schemas `platform`, `tenancy`, `iam`, `audit`, `workflow`, `integration_core`; approved `pgcrypto` and `citext`
Focused checks and results: HTTP/WS adapter tests 5/5 PASS; full Vitest 8/8 PASS; typecheck PASS; ESLint PASS; build PASS; migration transaction applied on child branch; RLS no-context count 0; tenant A saw only tenant A; forbidden cross-tenant row count 0
Gate outcome: milestone 2 passed; production/main branch unchanged
Exact next milestone: 3 — tenancy, organization and regional routing

### Milestone 3 — tenancy, organization and regional routing

Date/time: 2026-07-28T06:21:00+06:00
Checkpoint SHA: `ed5a5909d1446eec88e624c854dc53e352e4e551`
Migration: `202607280002_FND-01_tenancy`; tenant directory/domain, home-region/deployment binding, legal entities, campuses and entitlements
Focused checks and results: tenancy/migration tests 7/7 PASS; full Vitest 13/13 PASS; typecheck PASS; ESLint PASS; build PASS; no-context campus count 0; tenant A saw only tenant A campus; forbidden cross-tenant entitlement count 0
Gate outcome: milestone 3 passed; synthetic data only; production/main branch unchanged
Exact next milestone: 4 — identity, policy and privileged access

### Milestone 4 — identity, policy and privileged access

Date/time: 2026-07-28T06:30:00+06:00
Checkpoint SHA: `3be61086375cc7f8d074a05262236125455ec2d7`
Migration: `202607280003_FND-01_identity_policy`; account/person links, tenant/campus roles, assurance requirements and expiring privileged grants
Focused checks and results: policy tests 4/4 PASS; focused policy/migration 8/8 PASS; full Vitest 18/18 PASS; typecheck PASS; ESLint PASS; build PASS; no-context person-link count 0; tenant A saw only tenant A; forbidden cross-tenant role count 0
Gate outcome: milestone 4 passed; deny-by-default and step-up behavior executable; production/main branch unchanged
Exact next milestone: 5 — shared transactional primitives

### Milestone 5 — shared transactional primitives

Date/time: 2026-07-28T06:37:00+06:00
Checkpoint SHA: `b17e6eaf308017f363d61da142f8bb0ac1c30029`
Migration: `202607280004_FND-01_transactional_primitives`; idempotency, versioned outbox, audit and data-access audit
Focused checks and results: event tests 4/4 PASS; full Vitest 23/23 PASS; typecheck PASS; ESLint PASS; build PASS; duplicate idempotency rows 1; outbox rows 1; original response preserved; audit mutation rejected; no-context outbox count 0; forbidden cross-tenant outbox count 0
Gate outcome: milestone 5 passed; append-only and duplicate-safe behavior executable; production/main branch unchanged
Exact next milestone: 6 — localization and shared workflow services

### Milestone 6 — localization and shared workflow services

Date/time: 2026-07-28T06:44:00+06:00
Checkpoint SHA: `7f827e98099fffcc57fd542499295d7aba8967d1`
Migration: `202607280005_FND-01_shared_services`; immutable country packs, tenant activations, workflow definitions/instances/tasks, scanned documents and notification delivery
Focused checks and results: shared-services tests 5/5 PASS; full Vitest 29/29 PASS; typecheck PASS; ESLint PASS; build PASS; pack mutation blocked and default locale remained en; no-context workflow count 0; tenant A saw only its approved workflow and clean document; forbidden cross-tenant notification count 0
Gate outcome: milestone 6 passed; production/main branch unchanged
Exact next milestone: 7 — shared UI and module boundaries

### Milestone 7 — shared UI and module boundaries

Date/time: 2026-07-28T06:59:00+06:00
Checkpoint SHA: `c0b78c66058d5e4161fa7c1decb1c4af249038d9`
Changed owned paths: `packages/ui`, platform module registry, responsive web shell, architecture-boundary checker, Playwright/browser configuration and CI boundary gate
Focused checks and results: UI/module tests 3/3 PASS; full Vitest 32/32 PASS; architecture boundary validation PASS; `npm run verify` PASS; Chromium browser test 1/1 PASS; Worker/Vite/workspace builds PASS
Gate outcome: milestone 7 passed; module ownership and accessible shell are executable
Exact next milestone: 8 — verification, provenance and foundation freeze

### Milestone 8 — verification, provenance and foundation freeze

Date/time: 2026-07-28T07:13:00+06:00
Checkpoint SHA: `6cfa78ae0bb92e5f2ff99e243f3fc61f0b5b1b43`
Changed owned paths: licence policy/checker, deterministic dependency inventory and CycloneDX-style SBOM, third-party notices, recovery/migration runbook, optional direct-Neon integration test, CI audit/provenance/browser gates
Focused checks and results: clean `npm ci` PASS with 0 vulnerabilities; `npm run verify` PASS; Vitest 32 passed and 1 secret-backed test skipped; Chromium 1/1 PASS; licence allowlist 342/342 PASS with no unknown licences; provenance regenerated twice with stable SHA-256 hashes (`c834af27...`, `5680b843...`, `bfee759c...`); execution artifact validator PASS
Neon proof: PostgreSQL 17.10 on `agent/fnd-01-foundation` (`br-misty-frost-ax8ij4vw`); 5/5 migrations applied and replayed idempotently; migration ledger remained 5 distinct rows; 20 tenant-owned tables have RLS enabled and forced; 21 policies target `app_runtime`; role is non-login and non-`BYPASSRLS`; parent `main` application schema count remained 0
Gate outcome: milestone 8 implementation passed and owner review is approved; `GATE-FOUNDATION-READY` remains blocked only for live application-driver evidence because `DATABASE_URL` was not present; no credential was fetched or displayed
Exact next milestone: run `npm run test:neon` using a managed secret scoped to a non-production Neon branch
Dirty/uncommitted state: tracker evidence update only
Production mutation performed: no

### Post-foundation execution-policy checkpoint

Date/time: 2026-07-28T07:20:00+06:00
Checkpoint SHA: `7b70d9c6385786644fe3579450469d34b51cb190`
Decision: owner approved whole-module multi-agent execution; microtask/small-task agents remain prohibited
Parallel plan: after `GATE-FOUNDATION-READY`, start `SIS-01`, `FIN-01` and `INT-01` as three independent whole-module streams from the same reviewed foundation SHA
Coordinator rule: maintain shared documentation, agent board, gate state and contract decisions without concurrent writes inside module-owned paths
Validation: `python3 scripts/validate_execution_artifacts.py` PASS with machine-readable parallel policy enforcement
Gate outcome: policy approved; Wave 1 remains blocked until the existing foundation gate conditions are completed
Production mutation performed: no

### Foundation owner-review checkpoint

Date/time: 2026-07-28T07:39:00+06:00
Decision: owner approved proceeding to the multi-agent-ready foundation state
Verification attempt: `npm run test:neon` executed; test remained explicitly skipped because `DATABASE_URL` and `NEON_API_KEY` were not available in the execution environment
Gate outcome: owner-review condition passed; at this checkpoint `GATE-FOUNDATION-READY` remained blocked only by the secret-backed direct Neon driver check
Multiple-agent eligibility: immediately after that check passes and the reviewed foundation SHA is recorded as the Wave 1 base
Production mutation performed: no

### Foundation live-driver gate checkpoint

Date/time: 2026-07-28T07:54:00+06:00
Stream: FND-01
Checkpoint SHA: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Verification: `npm run test:neon` executed with an ephemeral `DATABASE_URL` supplied through the local clipboard; no credential was written to repository files, documentation or command output
Result: direct Neon serverless driver integration test passed 1/1; parameterized HTTP query returned a database name and the expected `fnd-01` echo value
Gate outcome: `GATE-FOUNDATION-READY` passed
Reviewed Wave 1 base: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Exact next milestone: prepare and start `SIS-01`, `FIN-01` and `INT-01` as separate whole-module streams
Dirty/uncommitted state: gate evidence and agent-board updates only
Production mutation performed: no

### Wave 1 reviewed-SHA freeze checkpoint

Date/time: 2026-07-28T16:00:00+06:00
Coordinator review: current `main` CI PASS at `9b9605aff93901eb1ad9e5b4d9ad9d6517d04aba`; `SIS-01` PR #2 merged with green CI; `FIN-01` head CI PASS and independent `npm run verify` PASS with 135 tests; `INT-01` head CI and Neon gate PASS and independent `npm run verify` PASS with 102 tests
Reviewed stream SHAs: `SIS-01` `5e2499018282d8296abfe093b5dd95b231829379`; `FIN-01` `5f9e1692a8fc19fc2e9789a338d028918acdeaf6`; `INT-01` `bfa95a4a42025213fa7c2090a587ef5304924da7`
Integration preview: `FIN-01` and `INT-01` both conflict with current `main` in shared workspace/package/tracker files; no module branch was rewritten, reset or merged during review
Gate outcome: `GATE-REVIEWED-SHAS-AVAILABLE` passed; `INTEG-01` is ready for Wave 1 serial integration
Production mutation performed: no

### Wave 2 reviewed-SHA freeze checkpoint

Date/time: 2026-07-29T12:29:00+06:00
Coordinator review: current `main` SHA `783be43f734178ec65b4c72b7527f4902fd0f0a6` has green CI run `30418088440`; every reviewed Wave 2 candidate descends from exact reviewed Wave 1 integration SHA `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Reviewed stream SHAs: `ACAD-01` `1d895afdf51f6d4f6323ada4b93d9ba32b244480`; `OPS-01` `fc749d7c0ece36964da8f923431bb3b7ac925e56`; `CARE-01` `9304bd6c425eca4ec69db90c1f1cab3f7a409b8d`
Review evidence: ACAD PR `#7` is green and mergeable; OPS final module-branch CI `30419451935` passed after verification PR `#10`; CARE draft PR `#19` final-head CI `30427728682` passed and changes after verified implementation SHA `d257a9af11b03d573c4bb2165f934397be8e7fbe` are documentation/board/tracker only
Integration preview: CARE PR `#19` conflicts with the advanced integration base by design; ACAD, OPS and CARE must not be merged independently. The CARE fixed local worktree remains at checkpoint `e619555955bdcdd2e6dc63d1880018a553bca581` with preserved uncommitted work and must not be reset, discarded or used as the integration source; the exact remote reviewed SHA above is authoritative
Recovery constraint: Neon is at the 10/10 branch limit, so the fresh disposable FND→SIS→FIN→INT→CARE rehearsal remains an explicit `INTEG-01` responsibility. No existing active or unreviewed Git/Neon branch may be deleted merely to create capacity
Gate outcome: `GATE-REVIEWED-SHAS-AVAILABLE` remains passed with Wave 2 candidates frozen; `INTEG-01` is ready for serial Wave 2 integration
Production mutation performed: no

## SIS-01 evidence

### Milestone 1 — module contract

Date/time: 2026-07-28T08:36:00+06:00
Stream: SIS-01
Milestone completed: 1 — approved requirements and versioned schema/event/API contract
Git branch: `module/core-sis-admissions`
Worktree: `.worktrees/sis-01-core-sis`
Neon branch: `agent/sis-01-core-sis` (`br-ancient-sunset-axuhcmof`), parent `main` (`br-cool-wildflower-axsot8l1`)
Starting base: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Checkpoint SHA: `3eadcdc95439065853042caa753778572ccd45bf`
Changed owned paths: `packages/modules/{people,admissions,student-lifecycle}` contract surfaces; `tests/sis/contracts.test.ts`; `docs/modules/sis/contracts.md`; compatible workspace lock registration
Focused checks and results: SIS contract tests 3/3 PASS; `@school/sis` TypeScript build PASS; dependency install audit 0 vulnerabilities
Gate outcome: milestone 1 passed; frozen foundation contracts unchanged
Exact next milestone: 2 — people, households, guardian authority, consent, duplicate detection and merge
Dirty/uncommitted state: tracker evidence update only
Production mutation performed: no

### Milestone 2 — people, households and guardian authority

Date/time: 2026-07-28T08:45:00+06:00
Stream: SIS-01
Milestone completed: 2 — people, names, identifiers, contacts, addresses, households, relationships, guardian/emergency/pickup authority, consent, duplicate detection and merge
Git branch: `module/core-sis-admissions`
Worktree: `.worktrees/sis-01-core-sis`
Neon branch: `agent/sis-01-core-sis` (`br-ancient-sunset-axuhcmof`), parent `main` (`br-cool-wildflower-axsot8l1`)
Starting base: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Checkpoint SHA: `b6410678d0b27a905f6e71eb78a33794ce798af9`
Changed owned paths: `packages/modules/people/**`; `tests/sis/people-*.test.ts`; `docs/modules/sis/people.md`
Focused checks and results: people domain/migration tests 6/6 PASS; `@school/sis` TypeScript build PASS; foundation migrations 1–5 replayed on SIS Neon child; people migration applied; RLS no-context count 0; Tenant A/B each saw 1 own row and 0 foreign rows
Gate outcome: milestone 2 passed; synthetic data only; parent/production branches unchanged
Exact next milestone: 3 — student/staff profiles, statuses, identifiers, documents and lifecycle access effects
Dirty/uncommitted state: tracker/module documentation update only
Production mutation performed: no

### Milestone 3 — student and staff profiles

Date/time: 2026-07-28T08:52:00+06:00
Stream: SIS-01
Milestone completed: 3 — student/staff profiles, effective statuses, identifiers, documents and lifecycle access effects
Git branch: `module/core-sis-admissions`
Worktree: `.worktrees/sis-01-core-sis`
Neon branch: `agent/sis-01-core-sis` (`br-ancient-sunset-axuhcmof`)
Starting base: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Checkpoint SHA: `8fc3fc0c49dc353b09ab98eed7c1321cb71454c9`
Changed owned paths: `packages/modules/student-lifecycle/{src/profiles.ts,migrations/202607280102_SIS-01_profiles.sql}`; `tests/sis/profiles.test.ts`; `docs/modules/sis/profiles.md`
Focused checks and results: profile domain tests 4/4 PASS; `@school/sis` build PASS; profile migration applied on SIS Neon; RLS no-context count 0; Tenant A visible 1 and foreign 0
Gate outcome: milestone 3 passed; parent/production branches unchanged
Exact next milestone: 4 — enquiries, applications, forms, reviews, interviews, decisions, offers, contracts, deposit references and conversion
Dirty/uncommitted state: tracker/module documentation update only
Production mutation performed: no

### Milestone 4 — admissions workflow

Date/time: 2026-07-28T08:59:00+06:00
Stream: SIS-01
Milestone completed: 4 — enquiries, immutable forms/responses, checklist/documents, reviews, interviews, decisions, offers, contracts, payment references and replay-safe conversion
Git branch: `module/core-sis-admissions`
Worktree: `.worktrees/sis-01-core-sis`
Neon branch: `agent/sis-01-core-sis` (`br-ancient-sunset-axuhcmof`)
Starting base: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Checkpoint SHA: `9a18b809559b945bc506b6a9cb26a38e03ce0b3d`
Changed owned paths: `packages/modules/admissions/**`; `tests/sis/admissions.test.ts`; `docs/modules/sis/admissions.md`
Focused checks and results: admissions tests 4/4 PASS; `@school/sis` build PASS; 18-table admissions migration applied; RLS no-context 0 and Tenant A foreign 0; submitted-response database mutation rejected
Gate outcome: milestone 4 passed; payment data remains opaque finance reference; parent/production branches unchanged
Exact next milestone: 5 — enrollment, transfer, withdrawal, promotion, re-enrollment, previous school and alumni transition
Dirty/uncommitted state: tracker/module documentation update only
Production mutation performed: no

### Milestone 5 — enrollment lifecycle

Date/time: 2026-07-28T09:06:00+06:00
Stream: SIS-01
Milestone completed: 5 — enrollment, status history, transfer, withdrawal, promotion, re-enrollment, prior school, placement/admission history and alumni transition
Git branch: `module/core-sis-admissions`
Worktree: `.worktrees/sis-01-core-sis`
Neon branch: `agent/sis-01-core-sis` (`br-ancient-sunset-axuhcmof`)
Starting base: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Checkpoint SHA: `8a8c0f5e17e49d6ca198cf1875aeca98079128a9`
Changed owned paths: `packages/modules/student-lifecycle/{src/enrollment.ts,migrations/202607280104_SIS-01_enrollment.sql}`; `tests/sis/enrollment.test.ts`; `docs/modules/sis/enrollment.md`
Focused checks and results: enrollment tests 4/4 PASS; `@school/sis` build PASS; ten-table lifecycle migration applied; RLS no-context 0 and Tenant A foreign 0; placement identity rewrite rejected
Gate outcome: milestone 5 passed; historical periods retained; parent/production branches unchanged
Exact next milestone: 6 — admin/family UI, import/export, reconciliation, reports and data-quality queues
Dirty/uncommitted state: tracker/module documentation update only
Production mutation performed: no

### Milestone 6 — imports, reports and user workflows

Date/time: 2026-07-28T09:18:00+06:00
Stream: SIS-01
Milestone completed: 6 — validated imports, privacy-aware exports, data-quality queues, reconciliation, immutable report snapshots and admin/family UI
Git branch: `module/core-sis-admissions`
Worktree: `.worktrees/sis-01-core-sis`
Neon branch: `agent/sis-01-core-sis` (`br-ancient-sunset-axuhcmof`)
Starting base: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Checkpoint SHA: `0e828f84863a2e1111e6ad4d26ad22d0188aa4d4`
Changed owned paths: `packages/modules/people/{src/imports.ts,migrations/202607280105_SIS-01_operations.sql}`; `packages/modules/student-lifecycle/src/reporting.ts`; `apps/web-admin/src/features/sis/**`; `apps/web-family/src/features/admissions/**`; `tests/sis/{imports-reports,operations-migration,ui}.test.*`; SIS module docs
Focused checks and results: milestone tests 11/11 PASS; `@school/sis` build PASS; 5,000-row import staging PASS under 5 seconds; seven-table operations migration applied; import/report RLS no-context 0 and Tenant A foreign 0; report snapshot mutation rejected
Gate outcome: milestone 6 passed; family UI excludes confidential review/restriction content; parent/production branches unchanged
Exact next milestone: 7 — full verification, browser tests, migration replay, runbook and completion evidence
Dirty/uncommitted state: tracker evidence update only
Production mutation performed: no

### Milestone 7 — verification and completion

Date/time: 2026-07-28T09:35:00+06:00
Stream: SIS-01
Milestone completed: 7 — full verification, Chromium browser flows, fresh migration replay, runbook and completion evidence
Git branch: `module/core-sis-admissions`
Worktree: `.worktrees/sis-01-core-sis`
Primary Neon branch: `agent/sis-01-core-sis` (`br-ancient-sunset-axuhcmof`)
Replay Neon branch: `agent/sis-01-core-sis-replay` (`br-aged-flower-axspjezr`)
Starting base: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Final implementation SHA: `c5cd5cb1bd30001433d03cbe23e6b54c7de5e5ff`
Changed owned paths: SIS domain/application-service packages; signer migration `202607280106`; typed admin/family feature workspaces; `tests/sis/**`; CI integration gates; SIS contracts, runbook, verification report and completion checklist
Verification results: repository `npm run verify` PASS; full local Vitest 78 PASS with the read-only Neon test mandatory in same-repository CI; deterministic clean build PASS; artifact validation PASS; Chromium browser flows 3/3 PASS including two SIS flows; V8 coverage 84.58% statements and 85.42% lines; dependency audit zero high-severity vulnerabilities; licence/provenance 342 packages PASS; 5,000-row import load test PASS
Fresh migration replay: isolated Neon replay through SIS 105 remained valid; exact foundation 1–5 plus SIS 101–106 replay passed on a disposable PostgreSQL cluster with ledger 11 total/6 SIS, forced RLS 59/59, signer columns 2 and signer constraints 3
Repository-wide composite note: review added a private, versioned permission-aware application service; authenticated actor derivation; verified guardian submission/signing authority; deterministic project-reference builds; fresh-database migration CI; and same-repository secret-backed read-only Neon CI. No waived repository quality gate remains
Gate outcome: SIS-01 whole-module completion passed; no open SIS blocker; parent/production branches and data unchanged
Exact next milestone: complete
Dirty/uncommitted state: tracker/agent-board completion evidence only
Production mutation performed: no

## FIN-01 evidence

No execution evidence recorded.

## INT-01 evidence

Date/time: 2026-07-28T08:49:54+06:00
Stream: INT-01
Milestone completed: 1 — country-pack engine
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Neon branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`), parent `main` (`br-cool-wildflower-axsot8l1`)
Starting base: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
Checkpoint SHA: `0ac974fd7632079d1dc4f056285cb21e2aa77df4`
Changed owned paths: `packages/modules/country-packs/**`; `tests/integrations/country-packs.test.ts`; `docs/modules/integrations/**`
Focused checks and results: country-pack Vitest 6/6 PASS; full Vitest 38/38 PASS with 1 pre-existing Neon test skipped; module TypeScript PASS; ESLint PASS; targeted Prettier PASS; Neon foundation migrations 1–5 and `202607280101_INT-01_country_pack_engine` replayed successfully; country-pack schema and tenant-override RLS verified; `npm run check:boundaries` BLOCKED because the frozen checker assumes `packages/modules/package.json`, which conflicts with reviewed nested module ownership
Gate outcome: country-pack behavior and database checkpoint passed; stream hard-stopped by `docs/execution/contract-change-requests/INT-01-nested-module-workspaces.md`
Exact next milestone: after an approved foundation/integration SHA resolves nested module discovery and composition, incorporate that reviewed change and begin milestone 2 — integration runtime
Dirty/uncommitted state: none after the contract-request/tracker evidence commit
Production mutation performed: no

Date/time: 2026-07-28T09:03:20+06:00
Stream: INT-01
Milestone completed: owner-approved nested-module workspace compatibility gate
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Neon branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`)
Starting base: `9326bb05ad37f86ec13a74910439da91d72ad4a6`
Checkpoint SHA: `a55d6d7284516395a195da0411ad50fa93a6cc75`
Changed paths under explicit owner approval: root workspace/typecheck configuration; `scripts/check-architecture-boundaries.mjs`; `packages/modules/country-packs/package.json`; nested-workspace regression tests
Focused checks and results: nested workspace tests 4/4 PASS; architecture boundary PASS; full Vitest 42/42 PASS with 1 secret-gated Neon test skipped; root TypeScript PASS including `@school/country-packs`; ESLint PASS; build PASS including nested package
Gate outcome: `INT-01-nested-module-workspaces` approved and resolved; previous hard stop cleared
Exact next milestone: 2 — versioned OpenAPI, scoped integration credentials, external IDs, signed webhooks, inbound deduplication, retry/dead-letter/replay, health and disclosure audit
Dirty/uncommitted state: tracker and decision evidence only
Production mutation performed: no

Date/time: 2026-07-28T09:25:59+06:00
Stream: INT-01
Milestone completed: 2 — integration runtime
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Neon branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`)
Starting base: `3831712`
Checkpoint SHA: `c98c27716f87a94f60a55de97644f4811ae00c1d`
Changed owned paths: `packages/modules/integrations/**`; `tests/integrations/integration-runtime*.test.ts`; `docs/modules/integrations/**`; package lock registration
Focused checks and results: integration runtime tests 8/8 PASS; migration contract test 1/1 PASS; full Vitest 51/51 PASS with 1 secret-gated Neon test skipped; architecture boundary PASS; root/module TypeScript PASS; ESLint PASS; build PASS; execution artefact validation PASS; static OpenAPI artefact equals runtime contract
Gate outcome: milestone 2 application, API, security, replay and schema contracts passed; live Neon migration application evidence remains pending because `DATABASE_URL`, `NEON_API_KEY` and Neon MCP were unavailable in this resumed execution shell
Exact next milestone: 3 — secure CSV/XLSX import/export, mapping, staging, dry-run, row errors, domain-command execution and reconciliation
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

Date/time: 2026-07-28T09:35:00+06:00
Stream: INT-01
Milestone completed: 3 — secure import/export foundation
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Neon branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`)
Starting base: `70f3fe9`
Checkpoint SHA: `f252c8ca4e7d2378514dba457edc91e372e45bce`
Changed owned paths: integration CSV/XLSX adapters, mapping/staging engine, import/export migration, focused tests and module documentation
Focused checks and results: import/export behavior 6/6 PASS; migration contract 1/1 PASS; full Vitest 58/58 PASS with 1 secret-gated Neon test skipped; root/module TypeScript PASS; ESLint PASS; architecture boundary PASS; build PASS; execution artefact validation PASS
Gate outcome: milestone 3 passed; file limits, formula neutralisation, dry-run, row errors, idempotent domain-command execution and reconciliation are implemented
Exact next milestone: 4 — migration studio project/version model, repeatable source templates, checksums and cutover evidence
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

Date/time: 2026-07-28T09:42:18+06:00
Stream: INT-01
Milestone completed: 4 — migration studio
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Neon branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`)
Starting base: `c2e3502`
Checkpoint SHA: `16135cf986304e75a478eb8985fe1ddfff6f6ed4`
Changed owned paths: `packages/modules/migration-studio/**`; migration-studio tests; package registration; integration module documentation
Focused checks and results: migration-studio behavior 5/5 PASS; migration contract 1/1 PASS; full `npm run verify` PASS with 64/64 tests and 1 secret-gated Neon test skipped
Gate outcome: milestone 4 passed; immutable templates, version checksums, file evidence, repeatable runs, reconciliation and cutover sign-off gates are implemented
Exact next milestone: 5 — OneRoster CSV profile, contract tests and REST extension path
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

Date/time: 2026-07-28T09:50:18+06:00
Stream: INT-01
Milestone completed: 5 — OneRoster 1.2 CSV supported profile
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Neon branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`)
Starting base: `d3f6d51`
Checkpoint SHA: `0bcca38a87f5069890abfedd353d5528fbf57c00`
Changed owned paths: OneRoster profile artefact, CSV validator/exporter, domain-command mapping, REST cursor contract, exchange evidence migration, tests and docs
Focused checks and results: OneRoster behavior 8/8 PASS; profile/schema contracts 2/2 PASS; full `npm run verify` PASS with 74/74 tests and 1 secret-gated Neon test skipped
Gate outcome: milestone 5 passed as an explicit supported subset; no full certification or implemented REST-service claim is made
Exact next milestone: 6 — LTI 1.3 registration/launch security, OIDC/SAML SSO and SCIM contract
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

Date/time: 2026-07-28T10:09:06+06:00
Stream: INT-01
Milestone completed: 6 — LTI 1.3 launch security, OIDC/SAML SSO and SCIM contract
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Neon branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`)
Starting base: `21f27b7`
Checkpoint SHA: `0fbb45c50ca5b77801dd43694e3e7f769e8265b5`
Changed owned paths: LTI registration/session/RS256 verifier; OIDC and SAML semantic adapters; SCIM contract; tenant migration; focused security tests and module runbook
Focused checks and results: milestone-focused tests 15/15 PASS including generated-key RS256 success/tamper rejection; full `npm run verify` PASS with 89/89 tests and 1 secret-gated Neon test skipped; format, lint, architecture boundaries, typecheck, build and execution artefact validation PASS
Gate outcome: milestone 6 passed; unsupported LTI Advantage services, full SAML XML processing and deployed SCIM service remain explicitly outside the current claim
Exact next milestone: 7 — tenant administration, connector governance, sandbox, observability, privacy/subprocessor metadata and final verification
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

Date/time: 2026-07-28T10:33:01+06:00
Stream: INT-01
Milestone completed: 7 — connector governance, tenant administration, observability and final local verification
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Neon branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`)
Starting base: `21976f90073794a1588eb5b336b05356b37c339e`
Checkpoint SHA: `ad4ec0789b7760b26123afef39969d36fd538915`
Changed owned paths: immutable connector manifests, independent approval, synthetic sandbox, privacy/subprocessor metadata, metrics/alerts, tenant admin feature, governance migration, browser/accessibility tests, security/performance tests and final runbook
Focused checks and results: `npm run verify` PASS; format, ESLint, boundaries, all workspace TypeScript and builds PASS; Vitest 102/102 PASS with 1 direct-Neon test skipped; module browser test 1/1 PASS; generated-key RS256 and tamper checks PASS; cross-tenant and digest-only credential checks PASS; 10,000 external-ID and webhook-queue operations passed bounded performance tests
Gate outcome: all seven implementation milestones passed locally; `GATE-INT-COMPLETE` remains blocked only by live application of migrations `202607280102`–`202607280107`, tenant/RLS/trigger probes and fresh-Neon-branch replay evidence
Exact next milestone: live Neon database gate and final gate-evidence commit; do not implement additional module scope before that evidence
Dirty/uncommitted state: completion, tracker and agent-board evidence only
Production mutation performed: no

Date/time: 2026-07-28T11:02:42+06:00
Stream: INT-01
Checkpoint completed: guarded live-Neon access investigation and branch-specific gate hardening
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Expected Neon project/branch: `lingering-brook-52999532` / `agent/int-01-integrations` (`br-super-truth-axp0urxi`)
Checkpoint SHA: `70f31d36b946044e67af6703c9ee484ee48cf9d5`
Changed owned paths: CI-safe browser source model; guarded Neon gate workflow and script; completion/tracker evidence
Focused checks and results: GitHub CI `30329479311`, `30329744058` and final `30330768874` PASS; guarded inspection `30329744096` stopped before writes because the generic secret lacked foundation state; guarded inspection `30330061274` proved the generic secret targets project `lingering-brook-52999532`, Neon `main` branch `br-cool-wildflower-axsot8l1`; branch-specific Neon workflow `30330768882` PASS as an explicit pending no-op because `INT01_DATABASE_URL` is not configured; local `npm run verify` PASS with 102/102 tests and one unconfigured Neon test skipped
Gate outcome: no database mutation occurred; workflow now accepts only dedicated `INT01_DATABASE_URL` and rejects any project or branch other than `lingering-brook-52999532` / `br-super-truth-axp0urxi` before migration or replay
Exact next milestone: configure `INT01_DATABASE_URL`, dispatch `inspect`, `apply` and logical `replay-database`, then obtain separate fresh-Neon-branch replay evidence through Neon API/MCP access; only after all pass may `GATE-INT-COMPLETE` be marked passed
Dirty/uncommitted state: tracker and completion evidence only
Production mutation performed: no

Date/time: 2026-07-28T15:40:50+06:00
Stream: INT-01
Checkpoint completed: live Neon application, logical replay, fresh-branch replay and `GATE-INT-COMPLETE`
Git branch: `module/international-integrations`
Worktree: `.worktrees/int-01-integrations`
Neon agent branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`), endpoint `ep-twilight-shape-axn4glx7`
Reviewed Neon parent: `main` (`br-cool-wildflower-axsot8l1`)
Checkpoint SHA: `ae88d8e`
Changed owned paths: API-backed exact-branch Neon workflow; safe migration/replay script; final completion, tracker and agent-board evidence
Focused checks and results: API inspection `30345672557` PASS; agent-branch apply `30345998526` PASS for migrations `202607280102`–`202607280107`; fresh logical database replay `30346762735` PASS and cleanup confirmed; fresh Neon branch replay `30347294967` PASS on temporary branch `br-twilight-lake-ax8ykaey` created from reviewed parent; 31/31 tenant tables forced RLS; required immutable/append-only triggers and cross-tenant negative probes PASS; direct Neon test 1/1 PASS; temporary branch deleted; local `npm run verify` PASS with 102/102 tests and one credential-gated local skip
Gate outcome: `GATE-INT-COMPLETE` passed; all seven milestones, live migration application, logical replay and independent fresh-Neon-branch replay are evidenced
Exact next milestone: freeze the reviewed INT-01 SHA and hand the stream to owner review / `INTEG-01` for serial integration
Dirty/uncommitted state: final gate evidence only
Production mutation performed: no; the generic `DATABASE_URL`/Neon `main` database was not used for schema writes

## ACAD-01 evidence

### Milestone 1 — academic structure

Date/time: 2026-07-28T23:35:09+06:00
Stream: ACAD-01
Milestone completed: 1 — academic years/terms, instructional calendars, bell schedules, curriculum/program/course versions, standards, class sections, staff assignments and rosters
Git branch: `module/academics-attendance-records`
Worktree: `.worktrees/acad-01-academics`
Neon branch: `agent/acad-01-academics` (`br-gentle-waterfall-axcl7l8z`), connector-created parent `main` (`br-cool-wildflower-axsot8l1`); reviewed Wave 1 schema replay remains required before completion
Starting base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Checkpoint SHA: `224ba1c2ec23e0861ac1f432b08d797d90640347`
Changed owned paths: `packages/modules/academics/**`; `tests/academics/academic-structure.test.ts`; `docs/modules/academics/contracts.md`; compatible append-only TypeScript include registration
Focused checks and results: dependency install/audit PASS with 0 vulnerabilities; module TypeScript project-reference build PASS; focused ESLint PASS; academic structure Vitest 5/5 PASS; migration contract asserts 13 tenant-owned tables, forced RLS, opaque SIS/INT references and published-version immutability
Cross-module contract outcome: SIS student/staff/enrollment, tenancy campus and INT country-pack identifiers remain opaque references; no foreign key or write into another module schema; FIN not coupled
UI/design evidence: not applicable to this backend/domain checkpoint; Impeccable 4.0.2 loaded; reviewed base does not contain foundation-owned `PRODUCT.md` or `DESIGN.md`, recorded in module contract without recreating them
Gate outcome: milestone 1 passed; `GATE-ACAD-COMPLETE` remains blocked pending milestones 2–7 and reviewed-base Neon replay
Exact next milestone: 2 — timetable versions, meetings, rooms, conflict detection, substitutions, publish/unpublish and student/teacher schedule views
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

### Milestone 2 — timetable and scheduling

Date/time: 2026-07-28T23:38:55+06:00
Stream: ACAD-01
Milestone completed: 2 — versioned timetables, meeting patterns/instances, teacher-room-student conflict detection, publication, substitutions and schedule views
Git branch/worktree: `module/academics-attendance-records` / `.worktrees/acad-01-academics`
Neon branch: `agent/acad-01-academics` (`br-gentle-waterfall-axcl7l8z`)
Starting base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Checkpoint SHA: `48e17eafba473cae544fbef99e7edf6a7e808d06`
Changed owned paths: `packages/modules/scheduling/**`; `tests/academics/timetable.test.ts`; `docs/modules/academics/timetable.md`; append-only TypeScript include registration
Focused checks and results: focused ESLint PASS; module TypeScript project-reference build PASS; cumulative academic Vitest 10/10 PASS; idempotent materialization, local timezone intent, conflict blocking, immutable publication, dated teacher/room substitution and tenant-scoped student/teacher views verified
Gate outcome: milestone 2 passed; live reviewed-base migration replay remains pending final database gate
Exact next milestone: 3 — attendance policies/codes/sessions, low-latency roster capture, offline sync, amendments, finalization, notices, alerts and reports
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

### Milestone 3 — attendance and offline synchronization

Date/time: 2026-07-28T23:44:29+06:00
Stream: ACAD-01
Milestone completed: 3 — versioned policies/codes, meeting-resolved sessions, roster capture, offline batch idempotency, reconciliation, finalization, approved amendments, guardian notices and attendance summaries/alerts
Git branch/worktree: `module/academics-attendance-records` / `.worktrees/acad-01-academics`
Neon branch: `agent/acad-01-academics` (`br-gentle-waterfall-axcl7l8z`)
Starting base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Checkpoint SHA: `f2005a19fadf4e9149b78aa24c781cbce1736dc4`
Changed owned paths: `packages/modules/attendance/**`; `tests/academics/attendance.test.ts`; `docs/modules/academics/attendance.md`; append-only TypeScript include registration
Focused checks and results: focused ESLint PASS; module TypeScript project-reference build PASS; cumulative academic Vitest 15/15 PASS; identical offline retries replay, changed payload IDs conflict, invalid rows isolate, one-current-result invariant, incomplete finalization guard, approved historical amendment and chronic-absence calculation verified
Gate outcome: milestone 3 passed; live reviewed-base migration replay remains pending final database gate
Exact next milestone: 4 — grading policy/scales/categories, assessments/rubrics, score states, explainable calculations, moderation, locks, publication windows and grade-change approvals
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

### Milestone 4 — gradebook, moderation and publication

Date/time: 2026-07-28T23:50:28+06:00
Stream: ACAD-01
Milestone completed: 4 — versioned grading policies/scales/categories, rubrics/outcomes, assessments, raw result states, explainable calculations, moderation, locks, publication windows and approved grade changes
Git branch/worktree: `module/academics-attendance-records` / `.worktrees/acad-01-academics`
Neon branch: `agent/acad-01-academics` (`br-gentle-waterfall-axcl7l8z`)
Starting base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Checkpoint SHA: `42a354f51b29e4154b56becebf9e4c41f7d171a1`
Changed owned paths: `packages/modules/gradebook/**`; `tests/academics/gradebook.test.ts`; `docs/modules/academics/gradebook.md`; append-only TypeScript include registration
Focused checks and results: focused ESLint PASS; module TypeScript project-reference build PASS; cumulative academic Vitest 20/20 PASS; category/scale validation, raw-score/state separation, standards evidence, weighted calculation inputs/formula, moderation-before-lock, publication windows and approved locked-grade changes verified
Gate outcome: milestone 4 passed; live reviewed-base migration replay remains pending final database gate
Exact next milestone: 5 — reporting periods/templates, report-card snapshots/approval, promotion/retention, credits/GPA and immutable transcript issue/amend/reissue
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

### Milestone 5 — report cards, credits/GPA and transcripts

Date/time: 2026-07-28T23:55:42+06:00
Stream: ACAD-01
Milestone completed: 5 — reporting periods/templates, report-card snapshots/approval/publication, promotion/retention decisions, versioned credit/GPA calculations and immutable transcript issue/amend/reissue history
Git branch/worktree: `module/academics-attendance-records` / `.worktrees/acad-01-academics`
Neon branch: `agent/acad-01-academics` (`br-gentle-waterfall-axcl7l8z`)
Starting base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Checkpoint SHA: `2e8464e95dec7d25841463c922d0ac0b07fa2b78`
Changed owned paths: `packages/modules/records/**`; `tests/academics/records.test.ts`; `docs/modules/academics/records.md`; append-only TypeScript include registration
Focused checks and results: focused ESLint PASS; module TypeScript project-reference build PASS; cumulative academic Vitest 25/25 PASS; closed-period/template validation, approval-separated publication, promotion evidence/decision, explainable credit/GPA snapshot, independent transcript amendment approval and immutable version history verified
Gate outcome: milestone 5 passed; live reviewed-base migration replay remains pending final database gate
Exact next milestone: 6 — permission-scoped application APIs, reports/import-export, admin/teacher academic UI and Impeccable accessibility/responsive/RTL hardening evidence
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

### Milestone 6 — application APIs, reports and academic workspaces

Date/time: 2026-07-29T00:21:15+06:00
Stream: ACAD-01
Milestone completed: 6 — deny-by-default application facade, external SIS/INT reference validation, scoped attendance/grade/records APIs, attendance reporting, safe CSV export, validated import staging, admin control room and teacher academic workspace
Git branch/worktree: `module/academics-attendance-records` / `.worktrees/acad-01-academics`
Neon branch: `agent/acad-01-academics` (`br-gentle-waterfall-axcl7l8z`)
Starting base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Checkpoint SHA: `0950a95222daba35301fde65e31f9dd30b9fc492`
Changed owned paths: `packages/modules/academics/src/application.ts`; academic public export; `apps/web-admin/src/features/academics/**`; `apps/web-teacher/src/features/academics/**`; `tests/academics/application-service.test.ts`; `tests/academics/academic-ui.test.tsx`; application/UI and workflow evidence docs
Focused checks and results: focused Prettier/ESLint PASS; module and admin TypeScript project-reference builds PASS; standalone teacher strict TypeScript PASS; application-service tests 6/6 PASS; SSR UI tests 6/6 PASS; cumulative ACAD Vitest 37/37 PASS; Impeccable detector 0 findings; manual critique/audit resolved skip navigation, locale-aware counts, loading/error recovery, scoped tokens, long-content wrapping and invalid empty grade-state option; responsive/RTL, forced-colour and reduced-motion assertions PASS
Cross-module outcome: SIS/tenancy/INT identifiers validated only through public external contracts; no writes to active Wave 2 branches or other module schemas; ordinary academic flows remain uncoupled from FIN
UI authority note: exact reviewed base lacks foundation-owned `PRODUCT.md` and `DESIGN.md`; ACAD did not recreate them and documented repository-design/Operate workflow substitution
Gate outcome: milestone 6 passed; final complete gate requires root verification, reviewed-base Neon migration replay/isolation probes, recovery evidence, final docs and handoff
Exact next milestone: 7 — full repository verification, migration composition on isolated Neon, RLS/immutability/recovery probes, observability/release documentation and final PR handoff
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

### Milestone 7 — verification, recovery and release handoff

Date/time: 2026-07-29T00:39:35+06:00
Stream: ACAD-01
Milestone completed: 7 — ordered migration manifest, observability/readiness, isolated Neon replay, forced-RLS/immutability/recovery probes, root verification, operational runbook, release handoff and integration PR
Git branch/worktree: `module/academics-attendance-records` / `.worktrees/acad-01-academics`
Neon branch: `agent/acad-01-academics` (`br-gentle-waterfall-axcl7l8z`) in project `lingering-brook-52999532`; PostgreSQL 17.10; no production endpoint used
Starting base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Checkpoint SHA: `baa62b906194deea2cafc3eb43e388c980e78d0b`
Pull request: #7 — https://github.com/rahmatullahboss/international-school-management-platform/pull/7 targeting `integration/international-school-platform-v1`
Database evidence: exact reviewed-base SQL migrations extracted from the reviewed SHA and replayed before ACAD migrations in one `ON_ERROR_STOP` transaction; second full replay retained the same ledger count and exactly 5 ACAD rows; 5 schemas and 53 ACAD tables verified; all 53 tables have RLS enabled, forced RLS and `tenant_policy`; required publication/finalisation/lock/transcript immutability triggers verified
Recovery evidence: rollback-only `app_runtime` probe confirmed tenant A could not see tenant B, an unrelated tenant saw zero rows, published academic-version mutation was rejected, and a post-rollback owner query found zero `ACAD-PROBE-%` rows
Focused/module checks: ACAD Vitest 42/42 PASS; module/admin TypeScript PASS; standalone teacher strict TypeScript PASS; focused ESLint/Prettier PASS; Impeccable detector 0 findings; npm production dependency audit PASS with 0 vulnerabilities; ACAD static hygiene/private-schema dependency checks PASS
Root checks: `format:check` PASS; `lint` PASS; `typecheck` PASS; `test` PASS; `build` PASS; `verify:boundaries` PASS; `verify:artifacts` PASS
Known coordinator-owned blocker: root `verify:migrations` and `verify:rollbacks` fail before verification because reviewed base `package.json` references missing `scripts/verify-migrations.mjs`; ACAD did not recreate shared tooling outside ownership and supplies module manifest, assertion-only schema verifier, rollback-only probe and live Neon evidence
Documentation: contracts, timetable, attendance, gradebook, records, application/UI, Impeccable evidence, operations, runbook, migration evidence and release handoff complete
Gate outcome: ACAD implementation and module-owned verification complete; `GATE-ACAD-COMPLETE` is READY FOR INTEGRATION REVIEW but global migration/rollback gate remains BLOCKED solely on restoration of coordinator-owned root verifier
Exact integration next step: restore the shared migration verifier, replay reviewed-base + ACAD on a fresh equivalent Neon branch, run all root gates, review PR #7 and merge through the integration stream; do not deploy from the module branch
Dirty/uncommitted state: tracker evidence only
Production mutation performed: no

## OPS-01 evidence

No execution evidence recorded.

## CARE-01 evidence

### Student-support threat-model gate

Date/time: 2026-07-29T02:18:00+06:00
Stream: CARE-01 entry-gate prerequisite, maintained by the program coordinator
Milestone completed: `GATE-STUDENT-SUPPORT-THREAT-MODEL` approved; CARE-01 released to milestone `security-contract`
Git branch: `gate/student-support-threat-model`
Worktree: `.worktrees/gate-student-support-threat-model`
Neon branch: no database branch created for this documentation-only gate; CARE-01 must create/verify `agent/care-01-student-support` when implementation starts
Starting base: integrated `origin/main` `11f4536224b1bd31eb1c79bbb7c571e6e7fb470b`, proven descendant of reviewed Wave 1 integration SHA `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Checkpoint SHA: `f97895ce8e2736699b0bd664b8a5a9eec452da3e`
Changed coordinator-owned paths: `docs/security/student-support-threat-model.md`, `docs/execution/03-agent-board.json`, `docs/execution/04-progress-tracker.md`; no CARE-01 implementation path and no active OPS-01 path changed
Threat-model evidence: complete data classification; least-privilege/need-to-know model; guardian/student visibility; consent/legal-basis rules; break-glass and AAL2 approvals; read/disclosure logging and immutable audit; retention/legal hold/deletion; export/integration/notification/offline-device safety; cross-tenant controls; incident response; abuse cases; role/action matrix; 40 security invariants; mandatory negative tests; migration/RLS requirements; CARE-01 implementation guardrails
Focused checks and results: `npm ci` PASS with 0 vulnerabilities; threat-model contract validation PASS with 40 unique invariants and required sections; `python3 scripts/validate_execution_artifacts.py` PASS; full `npm run verify` PASS including formatting, lint, architecture boundaries, typecheck, 254 tests passed with the existing credential-dependent Neon direct test skipped, Worker dry-run build, Vite build and artifact validation
Migration/replay evidence: no schema or database mutation in this gate; CARE-01 migration and fresh-Neon replay requirements are specified as implementation acceptance criteria
Security/tenant outcome: gate requires forced RLS, missing-context denial, case/purpose/relationship authorization, AAL2 separation of duties, fail-closed sensitive read logging, no broad admin/report-builder inheritance and exhaustive negative isolation tests
Documentation authority observation: current integrated repository does not contain the board-referenced `PRODUCT.md` or `DESIGN.md`; factual product-design input was reviewed, and CARE-01 must resolve this drift before UI completion evidence
Gate outcome: `GATE-STUDENT-SUPPORT-THREAT-MODEL` PASS; CARE-01 status is `ready_to_start`
Exact next milestone: create/verify declared CARE-01 Git worktree and Neon branch from exact reviewed Wave 1 SHA, then implement the threat-model security contract before broad domain/UI work
Dirty/uncommitted state: tracker evidence update only after the gate checkpoint commit
Production mutation performed: no

## EXP-01 evidence

### Final module candidate — `GATE-EXP-COMPLETE` passed

Date/time: 2026-07-29T21:19:10+06:00
Stream: EXP-01
Milestones completed: persona foundation; administration experience; teacher experience; guardian experience; student experience; communications/forms; documents/reporting; PWA/offline resilience and final verification
Git branch: `module/experience-portals-reporting`
Worktree: `.worktrees/exp-01-experience`
Neon branch: `agent/exp-01-experience` (`br-billowing-bar-axe2et95`)
Reviewed starting base: `60836a8fe92f64ba581c4bde65005729d1fe14b2`
Candidate implementation SHA: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`
Pull request: `#27` (draft, mergeable, reserved for reviewed Wave 3 serial integration)
Delivered scope: capability-shaped admin/teacher/guardian/student portals; authorised operational ledgers and record workspaces; announcements, secure messaging, multilingual notification templates/adapters/preferences; forms, surveys, consent and acknowledgements; governed dashboards, report catalog/jobs/exports and short-lived document grants; installable PWA shell, low-bandwidth mode, bounded approved offline drafts, privacy-safe telemetry, performance budgets and support runbook
Security/tenant outcome: tenant, principal visibility and capability filtering precede sorting/counting/rendering; restricted care/support context does not inherit broad access; document grants and report formats enforce independent authorization; offline durable state rejects restricted classifications, secrets, banking/medical/safeguarding keys and sensitive online-only operations; service worker bypasses API/auth/download/report/logout/private/no-store traffic
Local verification: full `npm run verify` PASS; 504 tests PASS with one credential-gated local Neon test skipped; all browser suites PASS 15/15 including EXP 6/6; platform-web bundle 201,022-byte JavaScript and 4,054-byte CSS within budget; required PWA assets present; artifact validation and provenance generation PASS
GitHub verification: CI run `30464998020` PASS across all 21 steps, including clean install, format, lint, architecture boundaries, typecheck, all tests, fresh 40-migration PostgreSQL replay, live Neon driver, build, PWA bundle gate, audit, licences, provenance drift, every Chromium suite and artifact validation
Earlier final-stream checkpoints: communications implementation `4b9629fee735c7f6dbcd9561ed14a4207e8ba3ff` / CI `30460170124`; documents-reporting implementation `7a7aa79b278fc25b4cfa9bd93efce80f0d914966` / CI `30461899197`
Documentation: `docs/modules/experience/milestone-1-persona-foundation.md` through `milestone-8-pwa-resilience-experience.md`; `docs/modules/experience/final-handoff.md`; `docs/operations/experience-pwa-offline-runbook.md`
Gate outcome: `GATE-EXP-COMPLETE` PASS; candidate is ready for reviewed INTEG-01 Wave 3 serial integration
Exact next milestone: INTEG-01 reviews and integrates exact candidate SHA `5c952703c24ee9927fcf2cd480d3ce8d0d139847`, then reruns canonical migrations, live Neon, system/browser, performance and recovery verification
Dirty/uncommitted state: final evidence, tracker and board handoff only
Production mutation performed: no

## INTEG-01 evidence

### Wave 1 checkpoint 1 — FIN-01 integrated

Date/time: 2026-07-28T18:40:00+06:00
Stream: INTEG-01
Milestone completed: Wave 1 serial integration — reviewed FIN-01 accepted
Git branch: `integration/international-school-platform-v1`
Worktree: `.worktrees/integ-01-release`
Neon branch: `integration/international-school-platform-v1` (`br-shiny-silence-axznuy37`), parent `main` (`br-cool-wildflower-axsot8l1`)
Starting base: `042b75990f9cd819239c584a370687042393f6a7`
Accepted module SHA: FIN-01 `5f9e1692a8fc19fc2e9789a338d028918acdeaf6`
Checkpoint SHA: `da3d561`
Changed integration paths: shared admin/family manifests and TypeScript references; package lock; composite module package exports; `@school/sis` compatibility facade; architecture-boundary scoped-subpath handling; FIN domain, migrations, UI, tests and docs
Focused checks and results: `npm ci`/install audit 0 vulnerabilities; typecheck PASS; 181 tests PASS with one secret-backed Neon test skipped; deterministic TypeScript/Worker/Vite build PASS; architecture boundaries PASS; full `npm run verify` PASS; execution artifact validator PASS
Conflict resolution: SIS exports and app surfaces retained; FIN root/ledger exports and app surfaces retained; no finance invariant, authorization rule or module-owned semantic behavior redesigned
Gate outcome: FIN checkpoint passed; `GATE-WAVE-1-INTEGRATED` remains blocked pending reviewed INT-01 integration, migration composition and cross-module verification
Exact next milestone: integrate reviewed INT-01 SHA `bfa95a4a42025213fa7c2090a587ef5304924da7`
Dirty/uncommitted state: tracker/agent-board checkpoint evidence only
Production mutation performed: no

### Wave 1 checkpoint 2 — INT-01 integrated and shared contracts composed

Date/time: 2026-07-28T19:09:00+06:00
Stream: INTEG-01
Milestone completed: Wave 1 serial integration — reviewed INT-01 accepted
Git branch: `integration/international-school-platform-v1`
Worktree: `.worktrees/integ-01-release`
Neon branch: `integration/international-school-platform-v1` (`br-shiny-silence-axznuy37`)
Starting base: `042b75990f9cd819239c584a370687042393f6a7`
Accepted module SHA: INT-01 `bfa95a4a42025213fa7c2090a587ef5304924da7`
Checkpoint SHA: `0822462`
Changed integration paths: shared workspace/package manifests; root and app TypeScript references; package lock; admin integration surface; nested module discovery; combined platform/SIS/finance/integration browser scripts; tracker conflict reconciliation
Focused checks and results: typecheck PASS; 251 tests PASS with one secret-backed Neon test skipped; full `npm run verify` PASS; platform/SIS/finance/integration browser suites PASS 6/6
Conflict resolution: SIS and FIN package exports, admin/family surfaces and reviewed behavior were retained while INT country-pack, integration, migration-studio, admin UI, CI and evidence were added; no frozen contract was redesigned
Gate outcome: INT integration checkpoint passed; final migration composition, integration Neon replay and recovery verification remained
Exact next milestone: execute canonical Wave 1 database/recovery and system verification
Dirty/uncommitted state: none after checkpoint commit
Production mutation performed: no

### Wave 1 checkpoint 3 — `GATE-WAVE-1-INTEGRATED` passed

Date/time: 2026-07-28T19:24:32+06:00
Stream: INTEG-01
Milestone completed: Wave 1 integration, database/recovery verification, system verification and release evidence
Git branch: `integration/international-school-platform-v1`
Worktree: `.worktrees/integ-01-release`
Neon branch: `integration/international-school-platform-v1` (`br-shiny-silence-axznuy37`), parent `main` (`br-cool-wildflower-axsot8l1`)
Starting base: `042b75990f9cd819239c584a370687042393f6a7`
Accepted reviewed module SHAs: SIS-01 `5e2499018282d8296abfe093b5dd95b231829379`; FIN-01 `5f9e1692a8fc19fc2e9789a338d028918acdeaf6`; INT-01 `bfa95a4a42025213fa7c2090a587ef5304924da7`
Reviewed Wave 1 integration SHA: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Integration checkpoints: FIN merge `da3d561`; INT merge `0822462`; migration/journey gate `5d5f017`; branch-scoped Neon gate `e380ad5`; RLS verifier correction `8cc8ee1`
Database and recovery evidence: canonical manifest contains 22 migrations in Foundation 5 → SIS 6 → FIN 4 → INT 7 order; integration Neon apply/recovery run `30362743167` PASS; rerun skipped already-applied migrations safely; disposable fresh-database replay PASS; live branch identity independently verified; 139/139 tenant-owned tables have forced RLS and `app_runtime` policies with zero failures
Finance evidence: journal posting function present; posted-entry and posted-line immutability triggers present; no unbalanced posted journals; reconciliation and trial-balance journeys PASS
Cross-module evidence: applicant → reviewed offer/contract → enrollment conversion → family billing account → invoice → settled payment → allocation → receivable reconciliation → safe CSV export journey PASS
System evidence: local full `npm run verify` PASS with 254 tests passed and one secret-backed Neon test skipped; browser suites PASS 6/6; GitHub CI run `30362743336` PASS including clean install, fresh PostgreSQL SIS replay, live Neon serverless driver, audit, licence, provenance, browser and artifact validation
Security/tenant outcome: no unresolved tenant-isolation, authorization, secret-handling or migration failure
Known non-blocking risk: GitHub reports Node.js 20 deprecation for `actions/checkout@v4` and `actions/setup-node@v4`, while runners forced those actions onto Node.js 24; execution passed and this should be upgraded during routine CI maintenance
Safe cleanup outcome: no existing Git branch, worktree or Neon branch was deleted; all active module and integration resources were retained
Gate outcome: `GATE-WAVE-1-INTEGRATED` PASS; Wave 2 reviewed base is `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Exact next milestone: start `ACAD-01` and `OPS-01` from the reviewed Wave 1 integration SHA; complete the required threat model before `CARE-01`
Dirty/uncommitted state: release evidence and board/tracker update only
Production mutation performed: no

## Resume rule

A resumed stream must verify this tracker against Git history, the exact worktree and Neon branch. Git history is authoritative when a stale tracker conflicts with committed evidence; the agent must correct the tracker before continuing. It must resume from the first incomplete milestone, not replay completed milestones.

## Program completion rule

Only `INTEG-01` may mark `GATE-PILOT-READY` passed, and only after all required streams are integrated, migrations/recovery are rehearsed, critical tests pass and a pilot-ready report is committed. Module completion never equals program completion.

## INTEG-01 Wave 2 integration evidence

Date/time: 2026-07-29T14:53:09+06:00
Stream: INTEG-01
Milestone completed: Wave 2 serial integration, database recovery verification and system verification
Git branch: `integration/international-school-platform-v1`
Worktree: `.worktrees/integ-01-release`
Neon branch: `integration/international-school-platform-v1` (`br-shiny-silence-axznuy37`), project `lingering-brook-52999532`
Starting base: reviewed Wave 1 integration branch head `ec921ea26f6980017f848bfd6646a77868bd4cb1`; frozen module base `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Checkpoint SHA: `60836a8fe92f64ba581c4bde65005729d1fe14b2`
Reviewed inputs: ACAD-01 `1d895afdf51f6d4f6323ada4b93d9ba32b244480`; OPS-01 `fc749d7c0ece36964da8f923431bb3b7ac925e56`; CARE-01 `9304bd6c425eca4ec69db90c1f1cab3f7a409b8d`
Changed integration-owned paths: serial merge/conflict resolutions, shared module TypeScript composition, canonical 40-migration manifest and verifier, Wave 2 cross-module journey tests, root CI and Neon recovery gate, release evidence; reviewed module implementations were not casually rewritten
Focused checks and results: root CI `30437010804` PASS — format, lint, architecture boundaries, typecheck, full tests, fresh PostgreSQL replay of all 40 migrations with RLS/policy assertions, secret-backed live Neon driver, build, dependency audit, licence/provenance, Chromium browser suites including restricted student support and execution-artifact validation; cross-module journeys cover academic roster to duplicate-safe attendance, HR contract to balanced finance journal, activity enrolment to idempotent charge and masked/audited safeguarding reads
Database and recovery evidence: Neon run `30437011092` PASS — exact project/branch identity, canonical Wave 2 apply, 40/40 migration ledger verification, tenant RLS/policy and finance invariant checks, tenant isolation probes, fresh disposable database replay from zero and safe cleanup
Gate outcome: `GATE-WAVE-2-INTEGRATED` passed
Exact next milestone: start `EXP-01` from exact reviewed Wave 2 integration SHA `60836a8fe92f64ba581c4bde65005729d1fe14b2`; after its reviewed completion, resume `INTEG-01` for Wave 3 integration
Dirty/uncommitted state: no integration branch changes outside committed evidence; existing local worktrees were not reset, discarded or overwritten
Production mutation performed: no; only the dedicated integration Neon branch and a disposable recovery database were used
