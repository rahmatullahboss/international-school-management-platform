# Production Readiness Backlog

**Program:** `international-school-platform-v1`  
**Updated:** 2026-08-02  
**Status:** open; production activation is not authorized

## Purpose

This backlog separates verified production-support implementation from the remaining work required before any real production promotion. Code, database schema or demo-data readiness does not authorize real identities, production credentials, schedules, mutations or customer data.

## Completed production-support baseline

PR #88 was merged to `main` as `cd1031b9c397020d87bb752bdfd1cfbee2be2793` after clean CI `30725691727` passed. PR #89 was merged as `49673ffec01bac2c2f7d92a1d7c8823dbdfe6e1e` after clean CI `30727829848` passed.

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
- `PROD-01` adds function-only current-workspace resolution through `iam.resolve_browser_workspace(uuid)` without granting `app_runtime` direct durable-session table reads;
- canonical CI verifies production migration/runtime boundaries, revoked-session denial, operator command request validation, API/web builds and both Cloudflare production Wrangler dry-runs;
- the reviewed Neon integration branch contains the 53-migration pilot baseline plus `PROD-01`, for 54 ledger entries total;
- one Bangladesh demo tenant, one Dhaka campus, seven IAM roles/accounts/memberships and seven placeholder OIDC membership bindings are seeded;
- Teacher staff linkage, Student profile/enrolment and verified Guardian authority are seeded;
- Admin, Teacher, Guardian and Student have canonical persona mappings, source payloads and materialized runtime projections at revision 1;
- deterministic Admissions and Finance command-QA fixtures are seeded without resetting existing demo data;
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

## 2. Production database credential and bindings — open

The internal `app_runtime` database role is function-only and intentionally not a password-bearing login credential.

Required before deployment:

- provision a reviewed login-capable least-privilege application credential that inherits only the approved runtime function authority;
- bind its exact production `DATABASE_URL` to the API Worker as a secret;
- do not use the Neon owner connection as the application runtime credential;
- configure the reviewed production provider-cache, session, permission, read-model and mutation bindings;
- verify the deployed Worker cannot directly read restricted IAM/runtime tables outside reviewed functions.

## 3. Operator production writes — partially complete

PILOT-13 provides reviewed database-owned domain command contracts for bounded Admissions review, Finance reconciliation and AAL2 Support access requests, with authorization, idempotency, optimistic concurrency where applicable, receipt/audit/outbox evidence and negative tests. PR #89 connected the authenticated production Admissions/Finance/Support browser surfaces to these exact command contracts through a same-origin, durable-session API; browser-selected tenancy/session/correlation scope and cross-role command replay are denied.

Still required:

- replace raw operator record identifiers with bounded database-owned work queues/context so authorized users select only current scoped candidates;
- verify post-write database state, audit and outbox evidence through the deployed production-like path with a real IdP/session;
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
- cache/ETag behavior and last-safe-data behavior during API outages;
- responsive, keyboard, RTL/reduced-motion and role-isolation browser journeys where applicable.

## 6. Security, privacy and operational readiness — open

Before production authorization:

- complete a targeted security review for identity, privileged support access, finance mutations and student/guardian data boundaries;
- confirm log/trace redaction for tokens, payloads, digests, temporary files and sensitive identifiers;
- validate rate limits, bounded request bodies, CORS/origin controls and fail-closed dependency behavior on the deployed environment;
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

`main` now contains the fail-closed production-support code plus authenticated operator command wiring, and the reviewed Neon integration branch contains the demo-school and command-QA database baseline. This does **not** mean production is active.

Real provider login, real provider-subject mappings, production secrets, a login-capable least-privilege runtime database credential, production schedules/alerts, deployed seven-persona production-like E2E, recovery sign-off and explicit production authorization remain outstanding. Synthetic pilot identities and `/pilot/*` APIs remain unavailable in production by design.
