# Production Readiness Backlog

**Program:** `international-school-platform-v1`  
**Date:** 2026-08-01  
**Status:** open; production activation is not authorized

## Purpose

This backlog separates the verified non-production pilot and canonical-CI contracts from the remaining work required before any production promotion. Completing an implementation or E2E checkpoint does not implicitly authorize credentials, real identities, production data, schedules or mutations.

## 1. Real identity-provider staging matrix

Before production-depth E2E can be claimed:

- configure one reviewed external OIDC provider in staging with exact issuer, authorization, token and JWKS origins;
- provision explicit provider subject-to-membership bindings for all seven principal personas;
- verify Authorization Code + PKCE, nonce/state, signing-key rotation, provider cache and fresh-AAL2 step-up against the real provider;
- verify current-session, account-wide and provider back-channel logout with durable registry state;
- verify suspended/revoked memberships, role removal and grant removal invalidate live sessions;
- retain provider tokens server-side and keep browser cookies within the reviewed host-only secure contract.

## 2. Durable deployed authorization for operator personas

Admissions, Finance/Cashier and Platform/Support have explicit non-production pilot identities, canonical PostgreSQL authorization proofs and PILOT-13 database-owned domain command primitives. Production-depth staging must additionally prove that deployed browser sessions resolve through the durable session registry and database permission service for those personas.

Required checks:

- exact tenant/campus scope is server-owned;
- current database role and grant state is revalidated on every protected decision;
- Support break-glass requires reviewed AAL2 and explicit time-bounded authorization;
- no operator receives implicit cross-tenant or tenant-configuration mutation authority;
- denial responses remain bounded and do not disclose sensitive tenancy, identity or policy data.

## 3. Deploy reviewed operator domain commands through a production-grade service boundary

PILOT-13 closes the database-command design gap for three bounded workflows:

- Admissions application review with exact campus lineage, optimistic application versioning and append-only review evidence;
- Finance/Cashier exact bank-line reconciliation against one compatible settled payment in the session legal entity;
- Platform/Support AAL2, time-bounded privileged-access request creation that remains pending until separately approved.

These commands have request-bound idempotency, current durable-session/permission evaluation, exact server-owned scope, atomic domain change plus audit/outbox evidence and negative cross-scope verification. They are intentionally non-HTTP and are not production-enabled.

Remaining work before deployed domain writes are claimed:

- define and review the external service/HTTP boundary that resolves the authenticated durable session and calls only the allowlisted database command;
- add bounded request-body, origin/CORS, rate-limit and failure contracts without accepting caller-supplied tenant/campus/account/persona/capability scope;
- connect the deployed staging Worker to the reviewed database command store using non-browser credentials;
- run real-IdP staging write journeys and assert post-write domain state, command receipts, audit and outbox evidence;
- add any further production-required Admissions transitions and Finance/Cashier receipt/cash-session commands as separately reviewed domain contracts rather than broadening the three PILOT-13 functions;
- keep Support approval, grant use, revocation and expiry as separate reviewed privileged-access workflows; a request command must never self-approve.

## 4. Runtime projection production wiring

PILOT-04 through PILOT-12 prove read models, safe refresh mutation, projection processing, source publication, four database-owned home composers and redacted operations monitoring. Production wiring remains disabled.

Required work:

- provision reviewed mapping, publisher, composer and monitor credentials;
- configure production database and Worker bindings without exposing credentials to browser code;
- approve admin, teacher, guardian and student composition cadence;
- authorize the intended projection worker schedule with least-privilege Cloudflare credentials;
- configure the projection monitor polling cadence, thresholds and alert destinations;
- define source seed/reset/recovery tooling with explicit authorization and immutable audit evidence;
- rehearse retry/dead-letter recovery without destructive queue or projection resets.

## 5. Deployed seven-persona staging E2E

Run a production-like staging matrix against deployed web/API Workers, the reviewed staging database and real external IdP.

The matrix must cover:

- all seven principal personas and all published persona routes;
- real login, session renewal, logout and step-up;
- allow/deny permission boundaries and cross-role replay denial;
- exact tenant/campus isolation;
- safe read-model refresh and approved operator/domain mutations;
- post-write database state, command-receipt, audit, outbox and projection assertions;
- cache/ETag behavior and last-safe-data behavior during API outages;
- responsive, keyboard, RTL/reduced-motion and role-isolation browser journeys where applicable.

## 6. Security, privacy and operational readiness

Before production authorization:

- complete a targeted security review for identity, privileged support access, finance mutations and student/guardian data boundaries;
- confirm log/trace redaction for tokens, payloads, digests, temporary files and sensitive identifiers;
- validate rate limits, bounded request bodies, CORS/origin controls and fail-closed dependency behavior;
- establish alert ownership, escalation and on-call/runbook procedures for projection backlog, dead letters, stale sources and identity-provider failures;
- verify backup retention, restore integrity and rollback procedures on an isolated recovery environment;
- document incident response and evidence-retention requirements.

## 7. Owner UAT and production authorization

Production promotion remains blocked until:

- owner-led UAT covers representative workflows for all seven personas;
- business owners approve admissions, finance/cashier and support operating procedures;
- security sign-off is recorded;
- backup/restore and rollback rehearsal evidence is accepted;
- production domains, origins, secrets, database bindings, IdP configuration, schedules and alert destinations are reviewed;
- explicit production authorization is given.

## Current boundary

PR #77, PR #83, PILOT-04 through PILOT-13 and their governance evidence provide verified non-production implementation and canonical-CI contracts only. PILOT-13 proves database-owned operator domain commands but does not expose or activate them through a deployed production-grade service boundary. Until the gates above are closed, real provider login, production credentials, production source population, production schedules, deployed operator-domain mutation wiring and general production mutations remain disabled.
