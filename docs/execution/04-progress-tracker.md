# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`
**Updated:** 2026-07-28
**Current repository state:** `FND-01` milestones 1–8, owner review and the secret-backed direct Neon driver check have passed on `program/foundation-neon-platform`; `GATE-FOUNDATION-READY` is passed and Wave 1 is eligible to start from the reviewed foundation SHA.

## Gate status

| Gate | Status | Evidence / required condition |
|---|---|---|
| `GATE-DOCUMENTS-APPROVED` | passed | Owner authorized FND-01 execution; `python3 scripts/validate_execution_artifacts.py` passed on 2026-07-28 |
| `GATE-FOUNDATION-READY` | passed | Milestones 1–8 implemented; owner review approved; Neon SQL/RLS proof passed; secret-backed `npm run test:neon` passed 1/1 on 2026-07-28 |
| `GATE-WAVE-1-INTEGRATED` | blocked | `SIS-01`, `FIN-01`, `INT-01` reviewed and serially integrated |
| `GATE-STUDENT-SUPPORT-THREAT-MODEL` | blocked | Wave 1 integrated plus approved student-support threat model |
| `GATE-WAVE-2-INTEGRATED` | blocked | `ACAD-01`, `OPS-01`, `CARE-01` reviewed and integrated |
| `GATE-PILOT-READY` | blocked | `EXP-01` integrated and final system/recovery verification passed |

## Multi-agent operating decision

Owner decision recorded on 2026-07-28:

- use separate agents only for complete end-to-end module streams;
- do not create agents for small tasks, bugs, isolated screens, endpoints, migrations, tests or internal milestones;
- after `GATE-FOUNDATION-READY`, start the Wave 1 streams `SIS-01`, `FIN-01` and `INT-01` in parallel from the same exact reviewed foundation SHA;
- each stream must use its declared fixed Git branch/worktree and matching Neon branch;
- the foundation/program coordinator maintains shared documentation, gate state, contract-change decisions and this tracker without writing concurrently inside module-owned paths;
- `INTEG-01` reviews and integrates module SHAs serially after they are recorded here.

Current readiness: `GATE-FOUNDATION-READY` is passed. `SIS-01`, `FIN-01` and `INT-01` may now start as separate whole-module agents from the same exact reviewed foundation SHA.

## Stream tracker

| Stream | Wave | Status | Base | Current/next milestone | Final/last checkpoint | Blocking condition |
|---|---:|---|---|---|---|---|
| `FND-01` | 0 | complete; gate passed | `4038081bc122c41d4a312bd75d01c784e3f4eee1` | freeze reviewed foundation SHA | pending gate-evidence commit | none |
| `SIS-01` | 1 | ready to start | reviewed foundation SHA | module contract | none | none |
| `FIN-01` | 1 | ready to start | reviewed foundation SHA | finance contract | none | none |
| `INT-01` | 1 | in progress | `55114f55a375d3d79dba7ea21f984b789b5dbca1` | migration studio | `f252c8ca4e7d2378514dba457edc91e372e45bce` | none |
| `ACAD-01` | 2 | blocked | reviewed Wave 1 integration SHA | academic structure | none | `GATE-WAVE-1-INTEGRATED` |
| `OPS-01` | 2 | blocked | reviewed Wave 1 integration SHA | HR/staff | none | `GATE-WAVE-1-INTEGRATED` |
| `CARE-01` | 2 | blocked | reviewed Wave 1 integration SHA | security contract | none | threat-model and Wave 1 gates |
| `EXP-01` | 3 | blocked | reviewed Wave 2 integration SHA | persona shells | none | `GATE-WAVE-2-INTEGRATED` |
| `INTEG-01` | gated serial | blocked | reviewed stream SHAs | foundation integration | none | reviewed SHA set unavailable |

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
Verification: `npm run test:neon` executed with an ephemeral `DATABASE_URL` supplied through the local clipboard; no credential was written to repository files, documentation or command output
Result: direct Neon serverless driver integration test passed 1/1; parameterized HTTP query returned a database name and the expected `fnd-01` echo value
Gate outcome: `GATE-FOUNDATION-READY` passed
Exact next milestone: freeze this gate-evidence commit as the reviewed Wave 1 foundation base, then prepare the three module streams
Dirty/uncommitted state: gate evidence and agent-board updates only
Production mutation performed: no

## SIS-01 evidence

No execution evidence recorded.

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

## ACAD-01 evidence

No execution evidence recorded.

## OPS-01 evidence

No execution evidence recorded.

## CARE-01 evidence

No execution evidence recorded.

## EXP-01 evidence

No execution evidence recorded.

## INTEG-01 evidence

No execution evidence recorded.

## Resume rule

A resumed stream must verify this tracker against Git history, the exact worktree and Neon branch. Git history is authoritative when a stale tracker conflicts with committed evidence; the agent must correct the tracker before continuing. It must resume from the first incomplete milestone, not replay completed milestones.

## Program completion rule

Only `INTEG-01` may mark `GATE-PILOT-READY` passed, and only after all required streams are integrated, migrations/recovery are rehearsed, critical tests pass and a pilot-ready report is committed. Module completion never equals program completion.
