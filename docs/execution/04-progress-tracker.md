# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`
**Updated:** 2026-07-28
**Current repository state:** `FND-01` milestones 1–8 are implemented on `program/foundation-neon-platform`; final owner review and a secret-backed direct Neon driver check remain before the foundation gate can pass.

## Gate status

| Gate | Status | Evidence / required condition |
|---|---|---|
| `GATE-DOCUMENTS-APPROVED` | passed | Owner authorized FND-01 execution; `python3 scripts/validate_execution_artifacts.py` passed on 2026-07-28 |
| `GATE-FOUNDATION-READY` | blocked | Milestones 1–8 implemented and Neon SQL/RLS proof passed; requires owner review plus `npm run test:neon` in a secret-enabled non-production environment |
| `GATE-WAVE-1-INTEGRATED` | blocked | `SIS-01`, `FIN-01`, `INT-01` reviewed and serially integrated |
| `GATE-STUDENT-SUPPORT-THREAT-MODEL` | blocked | Wave 1 integrated plus approved student-support threat model |
| `GATE-WAVE-2-INTEGRATED` | blocked | `ACAD-01`, `OPS-01`, `CARE-01` reviewed and integrated |
| `GATE-PILOT-READY` | blocked | `EXP-01` integrated and final system/recovery verification passed |

## Stream tracker

| Stream | Wave | Status | Base | Current/next milestone | Final/last checkpoint | Blocking condition |
|---|---:|---|---|---|---|---|
| `FND-01` | 0 | implementation complete; gate review pending | `4038081bc122c41d4a312bd75d01c784e3f4eee1` | owner review and secret-backed direct Neon driver evidence | `6cfa78ae0bb92e5f2ff99e243f3fc61f0b5b1b43` | `GATE-FOUNDATION-READY` |
| `SIS-01` | 1 | blocked | reviewed foundation SHA | module contract | none | `GATE-FOUNDATION-READY` |
| `FIN-01` | 1 | blocked | reviewed foundation SHA | finance contract | none | `GATE-FOUNDATION-READY` |
| `INT-01` | 1 | blocked | reviewed foundation SHA | country-pack engine | none | `GATE-FOUNDATION-READY` |
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
Gate outcome: milestone 8 implementation passed; `GATE-FOUNDATION-READY` remains blocked only for owner review and live application-driver evidence because `DATABASE_URL` was not present; no credential was fetched or displayed
Exact next milestone: owner review and run `npm run test:neon` using a managed secret scoped to a non-production Neon branch
Dirty/uncommitted state: tracker evidence update only
Production mutation performed: no

## SIS-01 evidence

No execution evidence recorded.

## FIN-01 evidence

No execution evidence recorded.

## INT-01 evidence

No execution evidence recorded.

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
