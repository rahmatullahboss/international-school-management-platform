# PILOT-13 — Database-Owned Operator Domain Commands Release Evidence

**Gate:** `GATE-PILOT-OPERATOR-DOMAIN-COMMANDS-V1`  
**Result:** passed  
**Implementation head:** `171feb0358a6dafd04f11f86ad46f7d2d1038169`  
**Main merge:** `cbe66e15648725a8f01a8414f875382a1fb389e3`

## Test-first evidence

The initial checkpoint contained only the command-boundary and database-adapter tests. After canonical formatting, CI `30695916420` passed formatting and failed strict lint exactly because the implementation modules were intentionally unresolved.

The tests define and verify:

- exact Admissions, Finance and Support command shapes;
- rejection of caller-supplied tenant, campus, account and unrelated domain scope;
- UUID, idempotency-key and correlation validation;
- safe-integer optimistic versions and support access windows;
- bounded Admissions score/notes and Finance/Support reasons;
- disabled behavior without a configured durable store;
- sanitized store outages;
- exact database function invocation for each command;
- strict one-row database response validation;
- exact receipt binding to command, idempotency key and correlation ID;
- controlled step-up and revision-conflict response shapes;
- rejection of malformed, ambiguous and secret-bearing database responses.

A final non-workflow regression also verifies that fractional support access windows are rejected before storage.

## Verification lineage

- full authoring CI `30696574964` passed all application, database, live-Neon, build, security, browser and artifact gates and published the guarded generated integration;
- the canonical workflow was restored and the temporary authoring helper removed;
- final canonical CI `30696776026` passed on exact clean head `171feb0358a6dafd04f11f86ad46f7d2d1038169`;
- runtime PR #85 had no review threads or submitted reviews and was squash merged with expected-head protection as `cbe66e15648725a8f01a8414f875382a1fb389e3`.

The final canonical run passed formatting, strict lint, architecture boundaries, TypeScript, the complete application suite, canonical and post-integration migrations, durable AUTH/projection contracts, the product-persona PostgreSQL verifier with real operator-domain command lifecycle, live Neon, builds, experience budget, high-severity dependency audit, licences, provenance, tracked-artifact drift detection, the complete browser suite and execution-artifact validation.

Cloudflare staging run `30696776021` was expectedly skipped because PILOT-13 adds no deployed route, binding or approved staging activation.

## Migration evidence

The canonical Wave 2 manifest remains fixed at 40 migrations. The post-integration manifest now contains thirteen contiguous migrations through PILOT-13, producing 53 `platform.schema_migration` ledger entries.

The PILOT-13 migration adds:

- reviewed permissions for Admissions review, Finance reconciliation and AAL2 Support access requests;
- append-only `platform.operator_domain_command_receipt`;
- current-session revalidation helper `platform.resolve_operator_domain_command_session(uuid)`;
- `admissions.record_application_review_command(...)`;
- `billing.reconcile_bank_statement_line_command(...)`;
- `iam.request_privileged_support_access_command(...)`;
- execute-only application access to the three reviewed command functions;
- revocation of direct `app_runtime` command-receipt access and direct privileged-grant writes.

## Fresh-PostgreSQL domain evidence

The persona integration verifier provisions isolated canonical fixtures and proves the following.

### Admissions

- one exact-campus submitted application at version three is reviewed successfully;
- the identical request replays the original receipt without a second review;
- changed request content under the same idempotency key returns `idempotency-conflict`;
- a stale independent expected version returns `revision-conflict` with current version four;
- a second application whose interview campus differs from the session campus returns `scope-not-found`;
- the accepted command leaves exactly one confidential review and advances application version from three to four.

### Finance/Cashier

- one balanced posted journal, billing account, authorized payment intent, settled payment and unmatched bank line are provisioned in the exact session legal entity;
- the exact compatible bank line/payment pair reconciles successfully;
- identical replay returns the original receipt;
- changed reason under the same idempotency key returns `idempotency-conflict`;
- a bank line in a different legal entity returns `scope-not-found`;
- the accepted line becomes `reconciled` with the exact payment, actor and timestamp.

### Platform/Support

- the AAL1 support session receives `step-up-required` with `aal2`;
- the AAL2 session creates one pending 15-minute privileged-access request;
- identical replay returns the original receipt;
- changed requested duration under the same key returns `idempotency-conflict`;
- the persisted grant has no approver, no approval timestamp, no revocation and a bounded expiry.

Across the three accepted commands, PostgreSQL verifies exactly three operator-domain receipts, three audit events and three outbox events.

## Privilege evidence

Fresh PostgreSQL verifies that `app_runtime`:

- cannot directly read or insert operator-domain command receipts;
- cannot directly insert privileged-access grants;
- cannot execute the internal session-scope helper;
- can execute only the three reviewed command functions introduced for this milestone.

Every command derives authorization scope from the durable session and current database state rather than browser-supplied tenant or campus identifiers.

## Review and diff state

The final runtime diff contains nine application, test, migration and integration-verifier files. Temporary workflow authoring changes and `scripts/author_pilot_13.py` were removed before final canonical verification.

## Production boundary

No public operator-domain route, production identity-provider activation, production operator credential, production database/Worker binding, automatic privileged-access approval, production mutation enablement, schedule, alert destination or production promotion was introduced.

The remaining production-depth gates stay open in `docs/execution/52-production-readiness-backlog.md` and Issue #78: deployed real-IdP/session authorization, reviewed deployed service/HTTP wiring, staging post-write assertions, recovery rehearsal, security review, owner UAT and explicit production authorization.
