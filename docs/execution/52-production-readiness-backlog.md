# Production Readiness Backlog

**Program:** `international-school-platform-v1`  
**Updated:** 2026-08-02  
**Status:** open; production activation is not authorized

## Purpose

This backlog separates verified production-support implementation from the remaining work required before any real production promotion. Code, database schema or demo-data readiness does not authorize real identities, production credentials, schedules, mutations or customer data.

## Completed production-support baseline

PR #88 was merged to `main` as `cd1031b9c397020d87bb752bdfd1cfbee2be2793` after clean CI `30725691727` passed.

Completed and verified:

- distinct Cloudflare `production` environments exist for the API and web Workers;
- production browser authentication uses the reviewed OIDC Authorization Code + PKCE primitives and durable browser-session contracts;
- `/auth/v1/login`, `/auth/v1/callback` and `/auth/v1/workspace` are wired fail-closed;
- the web Worker proxies `/auth/*` to the API Worker through a private Service Binding so host-only secure cookies stay on one browser origin;
- every synthetic `/pilot` and `/pilot/*` route returns `404` when `APP_ENV=production`;
- Admin, Teacher, Guardian and Student production surfaces consume database-owned runtime read models instead of synthetic pilot sessions;
- Admissions, Finance/Cashier and Platform/Support have authenticated production shells driven by current database capabilities rather than synthetic operator metrics;
- `PROD-01` adds function-only current-workspace resolution through `iam.resolve_browser_workspace(uuid)` without granting `app_runtime` direct durable-session table reads;
- canonical CI verifies the production migration, function-only resolution, revoked-session denial, API/web builds and both Cloudflare production Wrangler dry-runs;
- the reviewed Neon integration branch contains the 53-migration pilot baseline plus `PROD-01`, for 54 ledger entries total;
- one Bangladesh demo tenant, one Dhaka campus, seven IAM roles/accounts/memberships and seven placeholder OIDC membership bindings are seeded;
- Teacher staff linkage, Student profile/enrolment and verified Guardian authority are seeded;
- Admin, Teacher, Guardian and Student have canonical persona mappings, source payloads and materialized runtime projections at revision 1;
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

PILOT-13 provides reviewed database-owned domain command contracts for bounded Admissions review, Finance reconciliation and AAL2 Support access requests, with authorization, idempotency, optimistic concurrency where applicable, receipt/audit/outbox evidence and negative tests.

Still required:

- connect the authenticated production Admissions/Finance/Support browser surfaces to those reviewed domain command contracts;
- keep synthetic pilot command endpoints unavailable in production;
- verify post-write database state, audit and outbox evidence through the deployed production-like path;
- retain AAL2 for privileged finance/support actions and exact tenant/campus ownership.

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

`main` now contains the fail-closed production-support code and the reviewed Neon integration branch contains the demo-school database baseline. This does **not** mean production is active.

Real provider login, real provider-subject mappings, production secrets, a login-capable least-privilege runtime database credential, production schedules/alerts, deployed seven-persona production-like E2E, recovery sign-off and explicit production authorization remain outstanding. Synthetic pilot identities and `/pilot/*` APIs remain unavailable in production by design.
