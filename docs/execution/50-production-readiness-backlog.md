# Production Readiness Backlog

**Program:** `international-school-platform-v1`  
**Date:** 2026-08-01  
**Scope:** work remaining after the seven-persona E2E V2 implementation checkpoint

## Current status

All planned domain module streams are complete and integrated, and the browser/pilot authorization surface now covers all seven principal product personas at the non-production pilot/canonical-CI level.

The remaining work is therefore **production-depth and rollout work**, not another broad domain-module build.

This document is the canonical short backlog for reaching a production go-live decision.

## P0 — integrate the E2E checkpoint

### 1. Merge the prerequisite E2E PRs in order

Required order:

1. PR #77 — full route/live-Worker coverage for Admin, Teacher, Guardian and Student.
2. PR #80 — Admissions, Finance/Cashier and Platform/Support V2.

After both merges:

- run canonical CI on `main`;
- verify the final `main` SHA is clean;
- confirm no regression in migration, auth, Neon, build or browser gates;
- record the final merge SHAs and CI run IDs in the progress tracker/release evidence.

**Status:** open until merged to `main`.

## P0 — real staging identity and session lifecycle

### 2. Real external IdP login for all seven personas

The current CI proves OIDC/PKCE/session contracts and the V2 pilot proves role behavior, but the final production-depth matrix must authenticate every principal persona through the configured staging identity provider.

Required proof:

- Admin login/logout/revocation;
- Admissions login/logout/revocation;
- Finance/Cashier login/logout/revocation;
- Teacher login/logout/revocation;
- Guardian login/logout/revocation;
- Student login/logout/revocation;
- Platform/Support login/logout/revocation;
- forced fresh authentication for AAL2 operations;
- back-channel logout and expired/revoked session denial.

**Status:** open.

### 3. Database-backed browser session and permission path for the three new operator personas

Admissions, Finance/Cashier and Platform/Support currently have explicit pilot identities and canonical PostgreSQL authorization proof. Production-depth staging must connect their browser lifecycle to the same durable session registry and database-backed permission evaluator used by the production auth boundary.

Required proof:

- browser cookie/session registry persistence;
- role/membership resolution from durable database state;
- current-grant revalidation on every privileged request;
- revoked/expired session denial;
- tenant/campus scope derived server-side;
- no browser-controlled privilege escalation.

**Status:** open.

## P0 — real staging data and mutation journeys

### 4. Replace synthetic operator snapshots with database-owned staging read models

The new operator pilot snapshots are intentionally non-production evidence surfaces. Production-depth staging needs database-owned projections/read models for:

- Admissions work queue and application state;
- Finance/Cashier queue, cashier/reconciliation state and permitted financial summaries;
- Platform/Support deployment/tenant-health view with sensitive data masked by default.

Required properties:

- canonical tenant/campus lineage;
- current-grant revalidation;
- deterministic scope;
- private/no-store behavior where required;
- no cross-tenant data leakage.

**Status:** open.

### 5. Real domain writes from operator browser surfaces

The current browser command path records controlled pilot audit evidence; it is not a general production write channel.

Production-depth staging must verify real domain mutations through the existing safe mutation envelope and domain services.

Minimum journeys:

#### Admissions

- application review/update according to granted capability;
- document/checklist transition where permitted;
- offer/enrolment conversion only under the correct authority;
- post-write database state assertion;
- audit + outbox/event assertion;
- denied finance/grade/restricted-care mutations.

#### Finance / Cashier

- cashier/payment/reconciliation operation according to granted capability;
- duplicate/idempotent replay safety;
- immutable financial evidence;
- post-write ledger/billing state assertion;
- denied refund/waiver/approval without explicit grant;
- audit + outbox/event assertion.

#### Platform / Support

- time-bound support access request;
- AAL2 break-glass path;
- expiry/revocation of privileged access;
- tenant-owned mutations denied by default;
- any explicitly approved support mutation produces complete audit evidence.

**Status:** open.

## P0 — deployed staging E2E matrix

### 6. Run all seven personas against the deployed staging stack

The final staging matrix must run against:

- deployed Cloudflare web application;
- deployed Cloudflare Worker;
- staging Neon/database bindings;
- real staging identity provider;
- real secrets/credentials configured through the approved secret path.

The matrix must not rely on browser API mocks for authentication, permission or database state.

Required negatives:

- cross-role token replay;
- cross-tenant access;
- cross-campus access;
- revoked/expired sessions;
- AAL2-required operation at AAL1;
- direct URL access to unauthorized capabilities;
- hidden-resource existence masking where required.

**Status:** open.

### 7. Preserve failed-run artifacts

For production-depth E2E, CI should retain useful failure evidence such as:

- Playwright traces;
- screenshots on failure;
- browser console/network evidence where safe;
- sanitized Worker/request correlation identifiers;
- database verification output without secrets or sensitive student data.

**Status:** open.

## P1 — production runtime activation

### 8. Production credentials and source population

Before production enablement:

- configure approved production IdP credentials;
- configure production mapping/publisher/composer credentials;
- populate reviewed runtime projection sources;
- verify secret rotation and recovery procedures;
- verify no production secret is committed to the repository.

**Status:** open.

### 9. Production database/Worker bindings

Production environment must have reviewed:

- database bindings;
- Worker bindings;
- environment variables;
- origin/redirect allowlists;
- tenant/campus configuration;
- queue/scheduler bindings if used;
- monitoring and alerting.

A production smoke run must prove fail-closed behavior when any critical binding is absent or invalid.

**Status:** open.

### 10. Production scheduler/worker activation

The projection processor/source publication schedules are not treated as production-active until:

- schedules are explicitly enabled;
- concurrency/retry/dead-letter behavior is verified under production configuration;
- monitoring and recovery ownership are documented;
- rollback/disable procedures are tested.

**Status:** open.

### 11. General production mutations

Only reviewed, allowlisted production mutations should be enabled.

Before expanding beyond the existing tightly controlled mutation envelope:

- each mutation requires permission and assurance mapping;
- server-owned tenant/campus/object scope;
- idempotency/revision behavior;
- atomic audit/outbox evidence;
- negative authorization tests;
- rollback/recovery behavior;
- production observability.

**Status:** open.

## P1 — release governance

### 12. Final production readiness review

A go-live decision should require one final evidence package containing:

- final `main` SHA;
- all canonical CI run IDs;
- deployed staging E2E results for seven personas;
- production configuration review;
- backup/recovery evidence;
- security and authorization negative-test summary;
- data migration/source-population reconciliation;
- monitoring/alerting ownership;
- rollback plan;
- explicit approval to enable real production mutations and student data.

**Status:** open.

## What is not considered remaining module work

The following are already complete at the implementation/integration level and should not be reopened without a regression or approved scope change:

- foundation and tenancy primitives;
- SIS/admissions domain implementation;
- finance domain implementation;
- academics/attendance/records implementation;
- operations implementation;
- student support/care implementation;
- integrations/country packs;
- experience/persona shells;
- current pilot auth hardening through database permission evaluation;
- current runtime read/projection/mutation infrastructure;
- four original runtime persona composers;
- seven-principal-persona browser/authorization E2E implementation checkpoint.

## Exit condition

The program may be described as **production-ready** only after all P0 items are closed and the production activation/release-governance items required for the intended launch scope have passed explicit review.

Until then, the accurate status is:

> Domain implementation and seven-persona E2E implementation are complete; production-depth staging and production activation remain in progress.
