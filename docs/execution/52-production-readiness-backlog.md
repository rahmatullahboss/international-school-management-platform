# Production Readiness Backlog

**Program:** `international-school-platform-v1`  
**Updated:** 2026-08-12  
**Status:** open; production activation is not authorized

## Purpose

This backlog separates repository-verified production-support implementation from the external configuration, deployed rehearsals, security/operations evidence and owner authorization still required before real production promotion. Code, schema, CI or demo readiness does not authorize real identities, credentials, schedules, alert destinations, production mutations or customer data.

## Completed production-support baseline

The production-support baseline on `main` includes the earlier production runtime hardening through `PROD-04`, followed by the current Admissions and projection-operations work completed on 2026-08-12.

Earlier production checkpoints remain in force:

- PR #88 — fail-closed production OIDC/workspace/runtime foundation;
- PR #89 — authenticated production operator command path;
- PR #90 — database-owned Admissions/Finance operator work queues;
- PR #91 — least-privilege `app_production_runtime` capability boundary;
- PR #92 — fail-closed production database login credential self-check;
- PR #93 — fail-closed Cloudflare pre-authentication rate limiting;
- PR #94 — bounded and de-ambiguous OIDC login/callback ingress;
- PR #95 — streaming byte caps on sensitive production POST routes.

Current production-readiness additions now merged and verified:

- PR #143 (`62b61fb3821f8f78c22d3e28d040e09ba626955c`) — server-owned production Admissions lifecycle: staged review, canonical placement validation, offer issuance, offer acceptance and applicant-to-student conversion with idempotency/concurrency/audit/outbox enforcement;
- Issue #97 — operational ERP/persona UX work closed as completed after the Admissions lifecycle gap was merged;
- PR #147 (`560d591843b9d523cb0b85c712fd1a3499f1ca87`) — `PROD-06` controlled runtime-projection dead-letter recovery;
- PR #148 (`dfedbcffca7db6d27a57097df8aa607704558ca4`) — `PROD-07` fail-closed recovery-login credential readiness;
- PR #149 (`9f32ae478efe82e42e16714f8b12d06cfb5c740f`) — machine-verifiable production projection-monitoring/recovery policy and operator runbook.

The following controls are verified in repository CI:

- distinct Cloudflare `production` environments exist for API and web Workers;
- production browser authentication uses reviewed OIDC Authorization Code + PKCE and durable browser-session contracts;
- `/auth/v1/login`, `/auth/v1/callback` and `/auth/v1/workspace` are fail-closed;
- the web Worker proxies `/auth/*` to the API Worker through a private Service Binding so secure host-only cookies remain on one browser origin;
- synthetic `/pilot` and `/pilot/*` routes are unavailable in production;
- Admin, Teacher, Guardian and Student production surfaces use database-owned runtime read models;
- Admissions, Finance/Cashier and Platform/Support production surfaces use authenticated database-owned capability/work-queue/command contracts rather than synthetic pilot state;
- production operator commands derive session, tenant/campus/account scope and correlation server-side and preserve permission, AAL2, idempotency and concurrency enforcement;
- `PROD-03` defines `app_production_runtime` as a NOLOGIN least-privilege capability role with no direct application relation CRUD and no inheritance from broad `app_runtime`;
- `PROD-04` defines `platform.production_runtime_credential_ready()` and production auth paths reject owner, broad-runtime or otherwise overprivileged database logins;
- OIDC ingress, pre-auth rate limiting and sensitive-body byte limits are bounded before expensive provider/database work;
- PUBLIC execution is revoked from reviewed privileged helpers outside intended capability surfaces;
- CI verifies canonical migrations, auth/revocation, persona authorization, production runtime boundaries, runtime credential identity, operator work queues, Admissions lifecycle, builds and Cloudflare production dry-runs;
- normal internal PRs/main retain the secret-backed live Neon driver verification gate;
- Dependabot bot PRs skip only that secret-dependent live Neon step because repository Actions secrets are not exposed to Dependabot-triggered workflows; all secret-independent gates continue;
- Dependabot provenance export/sync keeps checked-in SBOM/license artifacts exact without exposing production secrets or executing candidate dependency code in the trusted provenance generator;
- reviewed safe Dependabot updates for Playwright patch (#142) and Wrangler minor (#139) were merged only after trusted full CI; major upgrades remain isolated/deferred;
- repository-level Dependabot version updates remain active, while Dependabot security alerts are still disabled at repository settings level and require settings access to enable.

## Projection recovery and operations controls now complete in repository

### PROD-06 — controlled dead-letter recovery

`PROD-06` adds a function-only `app_projection_recovery` boundary and AAL2-classified application permission `runtime.projection.dead-letter.recover`.

The recovery function is intentionally narrow:

- only `source-unavailable` and `processor-error` dead letters are technically recoverable;
- `invalid-event`, `projection-state-conflict` and unknown classes fail closed and require corrective action plus a new normal command;
- the original dead-letter row and original terminal outbox event remain immutable;
- the original command must remain unapplied;
- the current projection revision must still match the original expected revision;
- an exact current source must exist before a retry can be requested;
- one append-only recovery receipt is permitted per dead letter;
- the replacement event preserves the original command envelope/correlation/causation and is processed by the existing worker;
- recovery receipt and audit evidence remain append-only.

The PostgreSQL rehearsal verifies permission denial, unresolved-source refusal, successful recovery after source repair, idempotent replay, immutable original evidence, exactly-once application and permanent-error refusal.

### PROD-07 — recovery-login credential readiness

`PROD-07` adds `platform.projection_recovery_credential_ready()` and derives the actual login identity from `session_user` rather than accepting a caller-supplied role name.

The reviewed recovery login must:

- be a real PostgreSQL `LOGIN` principal;
- have no superuser, `CREATEDB`, `CREATEROLE`, replication or `BYPASSRLS` capability;
- be a member of `app_projection_recovery`;
- not inherit broad runtime/projection roles or Neon superuser authority;
- have no application relation CRUD or application sequence privilege;
- execute only the reviewed recovery function and the readiness self-check among application SECURITY DEFINER functions.

CI rehearses a temporary real login and proves that broad-runtime membership, projection-monitor membership, direct relation access and elevated role attributes each make readiness fail closed.

### Production projection-operations policy

PR #149 pins the repository-owned operating policy without embedding real credentials, destinations, owners or schedules:

- candidate polling cadence: 60 seconds;
- eligible-backlog warning age: 300 seconds;
- stale-source threshold: 900 seconds;
- warning escalation after two consecutive warning snapshots;
- critical escalation after one critical snapshot;
- same-condition alert de-duplication window: 900 seconds;
- warning response target: acknowledge within 30 minutes, investigate within 60 minutes;
- critical response target: acknowledge within 10 minutes, investigate within 15 minutes;
- automatic dead-letter recovery is prohibited;
- production recovery is one dead letter at a time and requires a second authorized human approval;
- before/after redacted monitor evidence and incident/change evidence are required;
- payloads, tokens, credentials and person/student identifiers are prohibited from operational incident evidence.

`config/production/projection-operations-policy.json` is guarded by an adversarial CI validator. The validator rejects unknown policy expansion, widened thresholds, disabled redaction, automatic recovery, removal of secondary approval, widened replay classes, weakened permanent-error prohibition, embedded alert destinations and missing external owner bindings.

`docs/execution/57-projection-recovery-operator-runbook-v1.md` documents detection, classification, investigation, two-human approval, one controlled recovery, verification and escalation. It explicitly prohibits manual dead-letter/outbox mutation, revision manipulation, broad/owner credentials and monitor-triggered automatic replay.

The production runtime manifest still represents the reviewed `PROD-01` through `PROD-04` baseline. The separate production-readiness manifest extends that baseline with `PROD-06` then `PROD-07` in isolated PostgreSQL verification. This documentation does not claim that those production-readiness migrations or their password-bearing principals are deployed to a live production database.

## 1. Real identity-provider activation — open

Before real production login can be enabled:

- configure one reviewed external OIDC provider with exact issuer, authorization, token and JWKS origins;
- configure the real client identifier and client secret outside repository source;
- replace/bind placeholder provider subjects with real provider `iss`/`sub` identities;
- configure strong transaction and browser-session signing secrets;
- verify Authorization Code + PKCE, nonce/state, signing-key rotation, provider cache and fresh-AAL2 step-up against that real provider;
- verify current-session, account-wide and provider back-channel logout with durable registry state;
- verify suspended/revoked memberships, role removal and grant removal invalidate live sessions.

Until these are configured, production login intentionally remains fail-closed.

## 2. Production database credential and bindings — partially complete

Repository controls are complete for the runtime credential shape, but the real production credential does not exist in repository source and must not be invented there.

Still required before deployment:

- provision a password-bearing login principal outside repository source and grant it only `app_production_runtime` membership;
- bind that principal's exact production `DATABASE_URL` to the API Worker as a secret;
- confirm deployed `/auth/v1/database-credential/readiness` returns ready using that exact secret-bound connection;
- do not use the Neon owner connection or broad `app_runtime` as the production application credential;
- verify the deployed Worker connects as the intended login principal and cannot directly read/mutate restricted tables outside reviewed functions;
- establish credential rotation/revocation ownership and rehearse rotation without widening privileges.

## 3. Operator production writes — repository path complete, deployed proof open

The bounded Admissions/Finance/Support command surfaces and server-owned work queues are implemented. Admissions now also has the full production application lifecycle through review, offer issuance, acceptance and conversion.

Still required:

- verify post-write database state, receipt, audit and outbox evidence through the deployed production-like path with a real IdP/session;
- verify fresh AAL2 step-up end-to-end for privileged finance/support actions against the real provider;
- preserve exact tenant/campus ownership and keep synthetic pilot endpoints unavailable in production.

## 4. Runtime projection operations — repository controls complete, external activation open

Repository-owned monitoring, recovery, credential-shape enforcement, policy validation and operator runbook are complete and verified.

Still required before activation:

- provision reviewed password-bearing publisher/composer/worker/monitor credentials and bindings as applicable;
- provision a password-bearing recovery login that satisfies `PROD-07` and grant only `app_projection_recovery`;
- bind monitor/recovery credentials as secrets outside repository source;
- approve and bind the intended production Cron Trigger/poller at the reviewed cadence;
- configure real primary and secondary alert destinations;
- assign named primary and secondary operations owners;
- rehearse deployed monitor polling and alert delivery using real bindings;
- rehearse monitor/recovery credential rotation and revocation;
- rehearse one controlled transient dead-letter recovery in an isolated production-like environment without destructive queue/projection resets;
- preserve the no-automatic-recovery and second-human-approval policy.

## 5. Deployed seven-persona production-like E2E — open

Issue #78 remains open for production-depth verification. After the real IdP and production secrets are available, run the deployed matrix across all seven principal personas.

The matrix must cover:

- real login, session renewal, logout and fresh step-up;
- database-owned workspace resolution and wrong-role URL denial;
- positive/negative permission boundaries;
- tenant/campus isolation and cross-role replay denial;
- database read-model refresh and approved operator/domain mutations;
- post-write state, receipt, audit, outbox and projection assertions;
- connection identity proving the deployed API uses only the reviewed production runtime login/capability role;
- cache/ETag and last-safe-data behavior during API outages;
- responsive, keyboard, RTL/reduced-motion and role-isolation browser journeys where applicable.

## 6. Security, privacy and operational readiness — open

Repository controls now include bounded auth ingress, pre-auth rate limiting, streaming request limits, fail-closed credential identity checks, redacted projection monitoring, controlled recovery, recovery credential readiness and machine-validated recovery/alerting policy. Deployed-environment assurance is still required.

Before production authorization:

- complete a targeted security review for identity, privileged support access, finance mutations, student/guardian boundaries and projection recovery;
- confirm log/trace redaction for tokens, payloads, digests, temporary files and sensitive identifiers;
- verify rate limiting, OIDC ingress bounds, body limits, origin controls and fail-closed dependency behavior in the deployed production-like environment;
- validate real alert delivery, escalation ownership and on-call acceptance against the repository policy/runbook;
- verify backup retention, restore integrity and rollback procedures in an isolated recovery environment;
- rehearse credential rotation/revocation for runtime, projection-monitor and projection-recovery logins;
- accept incident-response and evidence-retention procedures.

## 7. Owner UAT and explicit production authorization — open

Production promotion remains blocked until:

- owner-led UAT covers representative workflows for all seven personas;
- business owners approve Admissions, Finance/Cashier, Support and projection-recovery operating procedures;
- security sign-off is recorded;
- backup/restore and rollback rehearsal evidence is accepted;
- production domains, origins, secrets, database/projection credentials, IdP configuration, schedules, alert destinations and named owners are reviewed;
- explicit production authorization is given.

## Current boundary

`main` now contains the fail-closed production-support runtime, full production Admissions lifecycle, controlled transient projection dead-letter recovery, recovery-login privilege self-check, machine-verifiable projection operations policy and operator recovery runbook. Final PR #149 CI (`31590087033`) passed the policy adversarial validator, canonical/auth/persona/runtime gates, recovery and recovery-credential PostgreSQL rehearsals, Admissions lifecycle verification, secret-backed live Neon driver check, build, Cloudflare production dry-runs, experience budget, audit/license/provenance checks, browser E2E and execution-artifact validation.

This does **not** mean production is active.

Real external IdP configuration, real identity mappings, password-bearing runtime/monitor/recovery credentials and secret bindings, approved production polling/schedules, real alert destinations and named owners, deployed seven-persona E2E, deployed monitoring/recovery rehearsal, targeted security/privacy review, backup/restore/rollback rehearsal, owner UAT and explicit owner/security production authorization remain outstanding. Synthetic pilot identities and `/pilot/*` APIs remain unavailable in production by design.
