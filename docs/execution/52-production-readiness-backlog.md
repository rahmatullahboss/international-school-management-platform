# Production Readiness Backlog

**Program:** `international-school-platform-v1`  
**Date:** 2026-08-01  
**Status:** open; production activation is not authorized

## Purpose

This backlog separates the verified implementation/pilot contracts from the remaining work required before production promotion. Completing an implementation or local/canonical E2E checkpoint does not implicitly authorize real identities, production credentials, real student data, schedules or general mutations.

All planned domain module streams are already complete and integrated. PR #77 is merged to `main` at `18f50ecd252473034e6132cc6e911015c8ceb831`. PR #80 contains the remaining Admissions, Finance/Cashier and Platform/Support E2E V2 implementation and documentation; it still requires integration with the current `main` lineage before the seven-persona checkpoint is considered integrated.

## 0. Integrate PR #80 and re-establish the final main gate

Before starting production-depth staging work:

- sync PR #80 with the current `main` lineage without discarding either the merged PR #77 baseline or the V2 changes;
- resolve any merge conflict caused by the now-merged V1 ancestry;
- merge PR #80 only after review and required checks pass;
- run the complete canonical CI on the resulting `main` SHA;
- record the PR #80 merge SHA, final `main` SHA and canonical CI run ID in the progress/evidence docs;
- confirm the final main tree contains only the canonical E2E V2 docs (`50`, `51`, `52`) and no duplicate backlog file.

**Status:** open. PR #77 is complete; PR #80 is review-ready but currently requires integration with current `main`.

## 1. Real identity-provider staging matrix

Before production-depth E2E can be claimed:

- configure one reviewed external OIDC provider in staging with exact issuer, authorization, token and JWKS origins;
- provision explicit provider subject-to-membership bindings for all seven principal personas;
- verify Authorization Code + PKCE, nonce/state, signing-key rotation, provider cache and fresh-AAL2 step-up against the real provider;
- verify current-session, account-wide and provider back-channel logout with durable registry state;
- verify suspended/revoked memberships, role removal and grant removal invalidate live sessions;
- retain provider tokens server-side and keep browser cookies within the reviewed host-only secure contract.

**Status:** open.

## 2. Durable deployed authorization for operator personas

Admissions, Finance/Cashier and Platform/Support currently have explicit non-production pilot identities plus canonical PostgreSQL authorization proofs. Production-depth staging must additionally prove that deployed browser sessions resolve through the durable session registry and database permission service for those personas.

Required checks:

- exact tenant/campus scope is server-owned;
- current database role and grant state is revalidated on every protected decision;
- revoked/expired sessions fail closed;
- Support break-glass requires reviewed AAL2 and explicit time-bounded authorization;
- no operator receives implicit cross-tenant or tenant-configuration mutation authority;
- denial responses remain bounded and do not disclose sensitive tenancy, identity or policy data.

**Status:** open.

## 3. Replace synthetic operator reads with database-owned staging read models

The V2 operator snapshots are an intentional non-production evidence surface. Production-depth staging needs database-owned read/projection contracts for at least:

- Admissions queues, application/document/checklist/review state;
- Finance/Cashier queues, cashier/reconciliation state and allowed financial summaries;
- Platform/Support deployment/tenant-health diagnostics with sensitive data masked by default.

Each read path must preserve canonical tenant/campus lineage, current-grant revalidation, private/no-store behavior where required and cross-tenant denial.

**Status:** open.

## 4. Replace synthetic operator commands with reviewed domain commands

The PR #80 browser command route records controlled pilot audit evidence. It is not a general production mutation API.

Before domain writes are enabled, define and review separate command contracts for at least:

- Admissions application review/status/document/checklist transitions using canonical admissions invariants;
- Finance/Cashier receipt, cashier-session and reconciliation operations using canonical finance immutability, balancing and approval rules;
- Platform/Support diagnostics and break-glass actions with explicit tenancy ownership boundaries and privileged-access evidence.

Each production-bound command must have exact authorization, assurance, idempotency, optimistic concurrency, validation, audit/outbox evidence, replay behavior, rollback semantics, post-write database assertions and negative cross-tenant tests.

**Status:** open.

## 5. Runtime projection production wiring

PILOT-04 through PILOT-12 prove read models, safe refresh mutation, projection processing, source publication, four database-owned home composers and redacted operations monitoring. Production wiring remains disabled.

Required work:

- provision reviewed mapping, publisher, composer and monitor credentials;
- configure production database and Worker bindings without exposing credentials to browser code;
- approve admin, teacher, guardian and student composition cadence;
- authorize the intended projection worker schedule with least-privilege Cloudflare credentials;
- configure the projection monitor polling cadence, thresholds and alert destinations;
- define source seed/reset/recovery tooling with explicit authorization and immutable audit evidence;
- rehearse retry/dead-letter recovery without destructive queue or projection resets.

**Status:** open.

## 6. Deployed seven-persona staging E2E

Run a production-like staging matrix against deployed web/API Workers, the reviewed staging database and real external IdP.

The matrix must cover:

- all seven principal personas and all published persona routes;
- real login, session renewal, logout and step-up;
- allow/deny permission boundaries and cross-role replay denial;
- exact tenant/campus isolation;
- revoked/expired session denial;
- safe read-model refresh and approved operator/domain mutations;
- post-write database state, audit, outbox and projection assertions;
- cache/ETag behavior and last-safe-data behavior during API outages;
- responsive, keyboard, RTL/reduced-motion and role-isolation browser journeys where applicable.

Authentication, authorization and database-state assertions in this production-depth matrix must not be replaced by browser mocks.

**Status:** open.

## 7. Preserve production-depth E2E failure evidence

CI should retain useful, sanitized failure evidence including:

- Playwright traces;
- screenshots on failure;
- safe browser console/network diagnostics;
- sanitized Worker/request correlation identifiers;
- database verifier output without tokens, secrets or sensitive student data.

**Status:** open.

## 8. Security, privacy and operational readiness

Before production authorization:

- complete a targeted security review for identity, privileged support access, finance mutations and student/guardian data boundaries;
- confirm log/trace redaction for tokens, payloads, digests, temporary files and sensitive identifiers;
- validate rate limits, bounded request bodies, CORS/origin controls and fail-closed dependency behavior;
- establish alert ownership, escalation and on-call/runbook procedures for projection backlog, dead letters, stale sources and identity-provider failures;
- verify backup retention, restore integrity and rollback procedures on an isolated recovery environment;
- document incident response and evidence-retention requirements.

**Status:** open.

## 9. Production credentials, bindings and source population

Before production enablement:

- configure approved production IdP credentials and exact production origins/redirects;
- configure production provider-cache, database and Worker bindings;
- configure reviewed mapping/publisher/composer/monitor credentials;
- populate reviewed runtime projection sources;
- verify secret rotation and recovery procedures;
- verify no production secret is committed to the repository;
- prove fail-closed behavior when a critical production binding is missing or invalid.

**Status:** open.

## 10. Production scheduler/worker/monitor activation

The projection processor/source publication/monitor schedules are not production-active until:

- schedules are explicitly enabled with least-privilege credentials;
- concurrency, retry and dead-letter behavior is verified under production configuration;
- monitor thresholds and alert destinations are verified;
- monitoring/recovery ownership is documented;
- rollback/disable procedures are tested.

**Status:** open.

## 11. Owner UAT and production authorization

Production promotion remains blocked until:

- owner-led UAT covers representative workflows for all seven personas;
- business owners approve admissions, finance/cashier and support operating procedures;
- security sign-off is recorded;
- backup/restore and rollback rehearsal evidence is accepted;
- production domains, origins, secrets, database bindings, IdP configuration, schedules and alert destinations are reviewed;
- explicit production authorization is given before real student data or general production mutations are enabled.

**Status:** open.

## What is already complete

The following should not be treated as remaining module work unless a regression or approved scope change appears:

- `FND-01`, `SIS-01`, `FIN-01`, `INT-01`, `ACAD-01`, `OPS-01`, `CARE-01`, `EXP-01` domain implementation/integration;
- provider-neutral auth hardening through AUTH-08;
- PILOT runtime read/projection/safe-mutation infrastructure through PILOT-12;
- database-owned Admin/Teacher/Guardian/Student home composers;
- merged four-role E2E V1 baseline from PR #77;
- seven-principal-persona E2E V2 implementation checkpoint on PR #80, verified by canonical CI `30693986766`.

## Exit condition

The program may be described as **production-ready** only after the integration item and the production-depth gates required for the intended launch scope have passed explicit review.

Until then, the accurate status is:

> Domain implementation and seven-persona E2E implementation are complete; PR #80 integration, production-depth staging and production activation remain in progress.
