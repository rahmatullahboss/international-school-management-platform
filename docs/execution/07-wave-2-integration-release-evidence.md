# Wave 2 Integration Release Evidence

**Program:** `international-school-platform-v1`
**Gate:** `GATE-WAVE-2-INTEGRATED` — passed
**Reviewed integration SHA:** `60836a8fe92f64ba581c4bde65005729d1fe14b2`
**Evidence commit:** `c9bedf491429c05dabfa12e7f5c1adceb4caa8c1`
**Integration PR:** `#25`
**Date:** 2026-07-29

## Reviewed inputs

- ACAD-01: `1d895afdf51f6d4f6323ada4b93d9ba32b244480`
- OPS-01: `fc749d7c0ece36964da8f923431bb3b7ac925e56`
- CARE-01: `9304bd6c425eca4ec69db90c1f1cab3f7a409b8d`
- Shared Wave 1 module base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`

The candidates were integrated serially in ACAD, OPS, CARE order. Conflict handling was limited to coordinator-owned execution files and shared TypeScript/migration composition. Reviewed module implementation paths were preserved.

## System verification

Root CI run `30437010804` passed:

- formatting, lint and architecture boundaries;
- TypeScript typecheck and full test suite;
- cross-module academic attendance, staff/finance, activity charging and restricted CARE authorization/read-audit journeys;
- fresh PostgreSQL replay of the canonical 40-migration manifest with ledger, schema, forced-RLS and policy assertions;
- secret-backed live Neon serverless-driver test;
- build, high-severity dependency audit, licence checks and deterministic provenance;
- Chromium browser suites, including restricted student-support UI;
- execution-artifact validation.

## Neon apply and recovery

Neon gate run `30437011092` passed against project `lingering-brook-52999532`, integration branch `br-shiny-silence-axznuy37`:

- exact project and branch identity verification;
- canonical Wave 2 apply and 40/40 migration-ledger verification;
- forced tenant RLS and `app_runtime` policy verification;
- finance posting-function, immutability-trigger and balanced-journal checks;
- rollback-only cross-tenant read/write probes;
- fresh disposable database replay from zero, repeat verification and safe database cleanup.

No production deployment, production database mutation, active branch deletion, worktree reset or destructive cleanup was performed.

## Gate decision

`GATE-WAVE-2-INTEGRATED` is passed at `60836a8fe92f64ba581c4bde65005729d1fe14b2`. `EXP-01` is released and must use this exact reviewed SHA as its base. `GATE-PILOT-READY` remains blocked until EXP-01, Wave 3 integration and final system/recovery verification complete.
