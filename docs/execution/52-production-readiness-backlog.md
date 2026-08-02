# Production Readiness Backlog

**Program:** `international-school-platform-v1`  
**Updated:** 2026-08-02  
**Status:** open; production activation is not authorized

## Purpose

This backlog separates verified production-support implementation from the remaining work required before any real production promotion. Code, database schema or demo-data readiness does not authorize real identities, production credentials, schedules, mutations or customer data.

## Completed production-support baseline

Reviewed production-support checkpoints now on `main`:

- PR #88: `cd1031b9c397020d87bb752bdfd1cfbee2be2793` — fail-closed production OIDC/workspace/runtime foundation;
- PR #89: `49673ffec01bac2c2f7d92a1d7c8823dbdfe6e1e` — authenticated production operator command path;
- PR #90: `d84d17fff38d27abc589703386e8395bba9f0746` — database-owned Admissions/Finance operator work queues;
- PR #91: `63fe4e32eee398f49ace9954b9cc089e955cae1a` — least-privilege production runtime capability boundary;
- PR #92: `3175c81aaa5359febe393bd7942fd4588adc9fd9` — fail-closed production database login credential self-check;
- PR #93: `2810fc6f88f5178f70a6d548962672836f9be6cf` — fail-closed Cloudflare pre-authentication rate limiting.

Completed and verified:

- distinct Cloudflare `production` environments exist for the API and web Workers;
- production browser authentication uses the reviewed OIDC Authorization Code + PKCE primitives and durable browser-session contracts;
- `/auth/v1/login`, `/auth/v1/callback` and `/auth/v1/workspace` are wired fail-closed;
- the web Worker proxies `/auth/*` to the API Worker through a private Service Binding so host-only secure cookies stay on one browser origin;
- every synthetic `/pilot` and `/pilot/*` route returns `404` when `APP_ENV=production`;
- Admin, Teacher, Guardian and Student production surfaces consume database-owned runtime read models instead of synthetic pilot sessions;
- Admissions, Finance/Cashier and Platform/Support have authenticated production shells driven by current database capabilities rather than synthetic operator metrics;
- production Admissions review, Finance reconciliation and Support privileged-access request forms submit only to the reviewed PILOT-13 database-owned command contracts;
- the production operator command API derives session, tenant/campus/account scope and correlation server-side, revalidates current database workspace, denies cross-role replay and preserves database-owned permission/AAL2/idempotency/concurrency enforcement;
- `PROD-01` adds current-workspace resolution through `iam.resolve_browser_workspace(uuid)` without granting direct protected IAM session-table reads;
- `PROD-02` adds bounded, session-scoped Admissions/Finance work queues so production browser forms select database-owned current candidates instead of accepting raw domain UUIDs;
- `PROD-03` adds `app_production_runtime` as a NOLOGIN capability role with zero application relation CRUD and the reviewed production SECURITY DEFINER execution surface;
- `app_production_runtime` does not inherit the broader legacy/internal `app_runtime` role;
- PUBLIC execution is revoked from privileged billing document-number allocation, ledger close/post/reopen helpers and the optional noncanonical database-tree debug helper;
- `PROD-04` adds database-owned login-identity readiness through `platform.production_runtime_credential_ready()` and production `/auth/*` requests now fail closed when the bound `DATABASE_URL` uses an owner, broad or otherwise overprivileged credential;
- the runtime credential readiness contract rejects direct application relation/sequence authority, broad `app_runtime` membership and Neon `neon_superuser` membership, while requiring a real LOGIN principal bound to `app_production_runtime`;
- `/auth/v1/database-credential/readiness` exposes only redacted ready/not-ready diagnostics and the base `/auth/v1/readiness` remains available for configuration diagnosis;
- production `/auth/v1/login` and `/auth/v1/callback` now use a Cloudflare Rate Limiting binding before database/provider work; the reviewed limit is 30 requests per 60 seconds per route/client key;
- the pre-auth limiter derives the client actor from Cloudflare-provided client identity, stores only a SHA-256 route-scoped key, returns bounded `429`/`Retry-After` responses, and fails closed if the limiter or trusted client identity is unavailable;
- canonical CI verifies production migrations/runtime boundaries, revoked-session denial, operator command validation, work-queue scope/precision, least-privilege role invariants, runtime login credential privilege-drift behavior, pre-auth limiter behavior, API/web builds and both Cloudflare production Wrangler dry-runs;
- the reviewed Neon integration branch contains the 53-migration pilot baseline plus `PROD-01` through `PROD-04`, for **57** ledger entries total;
- live Neon verification shows zero application relations with CRUD authority for `app_production_runtime`, exactly **19** reviewed SECURITY DEFINER functions executable, no `app_runtime` inheritance, owner credential readiness `false` and all privileged helper denials active;
- one Bangladesh demo tenant, one Dhaka campus, seven IAM roles/accounts/memberships and seven placeholder OIDC membership bindings are seeded;
- Teacher staff linkage, Student profile/enrolment and verified Guardian authority are seeded;
- Admin, Teacher, Guardian and Student have canonical persona mappings, source payloads and materialized runtime projections at revision 1;
- deterministic Admissions and Finance command/work-queue QA fixtures are seeded without resetting existing demo data;
- demo projection bootstrap retains append-only audit evidence;
- verification left zero active demo browser sessions.

## 1. Real identity-provider activation — open

Before real production login can be enabled:

- configure one reviewed external OIDC provider with exact issuer, authorization, token and JWKS origins;
- configure the real client identifier and client secret outside repository source;
- replace/bind the seven `demo-seed` placeholder provider subjects with real provider `iss`/`sub` identities;
- configure strong transaction and browser-session signing secrets;
- verify Authorization Code + PKCE, nonce/state, signing-key rotation, provider cache and fresh-AAL2 step-up against that real provider;
- verify current-session, account-wide and provider back-channel logout with durable registry state;
- verify suspended/revoked memberships, role removal and grant removal invalidate live sessions.

Until these are configured, production login intentionally remains fail-closed.

## 2. Production database credential and bindings — partially complete

The broad legacy/internal `app_runtime` role is **not** an approved production credential. `PROD-03` provides the reviewed NOLOGIN capability role `app_production_runtime`, and `PROD-04` now causes production auth paths to reject any bound database login that does not satisfy the reviewed least-privilege identity contract.

Still required before deployment:

- provision a password-bearing login principal outside repository source and grant it only `app_production_runtime` membership;
- bind that principal's exact production `DATABASE_URL` to the API Worker as a secret;
- confirm deployed `/auth/v1/database-credential/readiness` returns ready using that exact secret-bound connection;
- do not use the Neon owner connection or the broader `app_runtime` role as the application runtime credential;
- configure the reviewed production provider-cache, session, permission, read-model and mutation bindings;
- verify the deployed Worker connects as the intended login principal and cannot directly read or mutate restricted application/IAM/runtime tables outside reviewed functions;
- establish credential rotation/revocation ownership and rehearse rotation without widening database privileges.

## 3. Operator production writes — partially complete

PILOT-13 provides reviewed database-owned domain command contracts for bounded Admissions review, Finance reconciliation and AAL2 Support access requests, with authorization, idempotency, optimistic concurrency where applicable, receipt/audit/outbox evidence and negative tests. PR #89 connected the authenticated production Admissions/Finance/Support browser surfaces to these exact command contracts through a same-origin, durable-session API. PR #90 replaced raw Admissions/Finance record identifiers with bounded database-owned work queues/context so browser users select only current scoped candidates.

Still required:

- verify post-write database state, receipt, audit and outbox evidence through the deployed production-like path with a real IdP/session;
- verify fresh AAL2 step-up end-to-end for privileged finance/support actions against the real provider;
- retain exact tenant/campus ownership and keep synthetic pilot command endpoints unavailable in production.

## 4. Runtime projection operations — partially complete

Database read models, source publication, four database-owned home composers, projection processing and redacted operations monitoring are implemented and verified. Demo source/read-model bootstrap now exists on the reviewed Neon integration branch.

Still required before activation:

- provision reviewed publisher, composer, projection-worker and monitor credentials/bindings;
- approve Admin, Teacher, Guardian and Student composition cadence;
- authorize the intended production Cron Trigger with least-privilege Cloudflare credentials;
- configure monitor polling cadence, thresholds, alert destinations and escalation ownership;
- formalize source seed/reset/recovery tooling for production use;
- rehearse retry/dead-letter recovery without destructive queue or projection resets.

## 5. Deployed seven-persona production-like E2E — open

After real IdP and production secrets are available, run the deployed matrix across all seven principal personas.

The matrix must cover:

- real login, session renewal, logout and step-up;
- database-owned workspace resolution and wrong-role URL denial;
- positive and negative permission boundaries;
- tenant/campus isolation and cross-role replay denial;
- database read-model refresh and approved operator/domain mutations;
- post-write state, receipt, audit, outbox and projection assertions;
- connection identity proving the deployed API uses only the reviewed production runtime login principal/capability role;
- cache/ETag behavior and last-safe-data behavior during API outages;
- responsive, keyboard, RTL/reduced-motion and role-isolation browser journeys where applicable.

## 6. Security, privacy and operational readiness — open

Code/config verification now covers pre-authentication rate limiting, bounded operator mutation bodies, reviewed origin checks, fail-closed database credential validation and redacted dependency failures. Deployed-environment verification is still required.

Before production authorization:

- complete a targeted security review for identity, privileged support access, finance mutations and student/guardian data boundaries;
- confirm log/trace redaction for tokens, payloads, digests, temporary files and sensitive identifiers;
- verify the pre-auth rate limiter, bounded request bodies, CORS/origin controls and fail-closed dependency behavior through the deployed production-like environment;
- establish alert ownership, escalation and on-call/runbook procedures for projection backlog, dead letters, stale sources and identity-provider failures;
- verify backup retention, restore integrity and rollback procedures on an isolated recovery environment;
- document incident response and evidence-retention requirements.

## 7. Owner UAT and explicit production authorization — open

Production promotion remains blocked until:

- owner-led UAT covers representative workflows for all seven personas;
- business owners approve Admissions, Finance/Cashier and Support operating procedures;
- security sign-off is recorded;
- backup/restore and rollback rehearsal evidence is accepted;
- production domains, origins, secrets, database credentials/bindings, IdP configuration, schedules and alert destinations are reviewed;
- explicit production authorization is given.

## Current boundary

`main` now contains the fail-closed production-support code, authenticated operator command/work-queue wiring, least-privilege production database capability role, database-login self-check and Cloudflare pre-authentication rate limiting. The reviewed Neon integration branch contains the demo-school baseline through PROD-04 with **57** migration ledger entries. This does **not** mean production is active.

Real provider login, real provider-subject mappings, production secrets, a password-bearing login principal bound only to `app_production_runtime`, production schedules/alerts, deployed seven-persona production-like E2E, recovery/security sign-off and explicit production authorization remain outstanding. Synthetic pilot identities and `/pilot/*` APIs remain unavailable in production by design.
