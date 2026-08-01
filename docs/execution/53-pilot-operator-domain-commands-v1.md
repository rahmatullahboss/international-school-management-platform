# PILOT-13 — Database-Owned Operator Domain Commands V1

**Gate:** `GATE-PILOT-OPERATOR-DOMAIN-COMMANDS-V1`  
**Runtime merge:** `cbe66e15648725a8f01a8414f875382a1fb389e3`

## Purpose

PILOT-13 replaces the synthetic operator evidence-only mutation contract with three bounded, non-HTTP, database-owned domain commands. The commands reuse durable browser-session state and current database permission evaluation while keeping tenant, campus, account, persona and capability scope server-owned.

The milestone does not expose a production mutation API. It establishes reviewed domain command primitives that a later deployed staging/production boundary may call only after separate authorization and integration review.

## Commands

### Admissions application review

`admissions.record_application_review_command(uuid, uuid, bigint, text, numeric, text, text, uuid)` records one confidential application review.

The command:

- requires an active durable browser session and `admissions.application.review`;
- derives tenant, membership, campus and reviewer account from the durable session;
- derives application campus from reviewed canonical evidence: one unambiguous non-cancelled interview or existing offer campus;
- rejects an application with missing, ambiguous or cross-campus lineage;
- locks the application and requires the exact expected version;
- permits only `submitted` or `under-review` application state;
- appends one `admissions.application_review` row;
- advances the application to `under-review` and increments the version;
- persists command receipt, audit and outbox evidence atomically.

### Finance bank-line reconciliation

`billing.reconcile_bank_statement_line_command(uuid, uuid, uuid, text, text, uuid)` reconciles one exact bank statement line to one exact payment.

The command:

- requires an active durable browser session and `finance.reconciliation.write`;
- derives the legal entity only from the exact session campus;
- locks the exact unmatched statement line inside that legal entity;
- requires a same-legal-entity payment in `settled` or `partially-refunded` state;
- requires equal positive amount and currency;
- rejects a payment already attached to another matched or reconciled statement line;
- writes reconciliation metadata using the server-resolved actor;
- persists command receipt, audit and outbox evidence atomically.

### Support break-glass request

`iam.request_privileged_support_access_command(uuid, text, integer, text, uuid)` creates a pending privileged-access request.

The command:

- requires an active durable browser session and `support.break-glass.request`;
- relies on database permission evaluation to require AAL2;
- accepts only a 5–30 minute requested window and a bounded reason;
- inserts one `iam.privileged_access_grant` row with no approver and no approval timestamp;
- never approves, activates or broadens privileged access itself;
- persists command receipt, audit and outbox evidence atomically.

A separate reviewed approval path remains mandatory before any requested support access can become usable.

## Shared authorization and idempotency boundary

The TypeScript command boundary accepts only:

- durable `sessionId`;
- exact command-specific domain identifiers and expected state/version;
- an idempotency key;
- a correlation ID;
- bounded command-specific business values.

Caller-supplied tenant, campus, account, persona, capability or unrelated domain scope is rejected before storage.

`platform.resolve_operator_domain_command_session(uuid)` revalidates the current session, active OIDC membership binding, enabled account, active membership and exact current role-binding array while locking the relevant identity rows. The helper is `SECURITY DEFINER` and is not executable by `app_runtime`.

Each command hashes the exact command request and takes a transaction advisory lock over server-owned scope plus command type and idempotency key. An identical replay returns the original receipt; a changed request under the same key returns `idempotency-conflict`.

## Durable evidence

`platform.operator_domain_command_receipt` stores one append-only accepted command receipt with:

- exact tenant, membership and campus scope;
- durable session and actor account;
- command type and idempotency key;
- request digest;
- domain evidence identifier;
- correlation ID;
- bounded response receipt and acceptance timestamp.

The table is mutation-protected with the canonical append-only audit trigger. Direct `app_runtime` table access is denied. Direct `app_runtime` writes to `iam.privileged_access_grant` are also revoked; the reviewed support command is the bounded request path introduced by this milestone.

## Failure behavior

Malformed or caller-expanded TypeScript inputs return `invalid-command` before database access. Store outages are sanitized as `command-unavailable`.

Database functions return a bounded reviewed rejection vocabulary including:

- `invalid-command`;
- `session-inactive`;
- `permission-not-granted`;
- `step-up-required`;
- `idempotency-conflict`;
- `scope-not-found`;
- `revision-conflict`;
- `domain-conflict`.

The database adapter rejects ambiguous rows, unexpected keys, secret-bearing reasons, malformed evidence identifiers and responses that do not bind back to the exact submitted command, idempotency key and correlation ID.

## Non-production boundary

PILOT-13 introduces no public operator-domain HTTP route, production operator credential, production database or Worker binding, real external IdP activation, automatic support approval, production mutation enablement, schedule, alert integration or production promotion.

Production-depth activation remains gated by the deployed seven-persona staging matrix, real IdP/session lifecycle, reviewed HTTP/service boundary, post-write staging assertions, security and recovery review, owner UAT and explicit production authorization.
