# PILOT-05 — Safe Database Mutation Envelope

**Status:** passed and merged to `main`  
**Runtime merge:** `9f32a588d7b61d4ef8b1ac38dc4807fa329212de`  
**Reviewed implementation head:** `2ff251c17d2b4d939a6f274402da99e6447707fd`

## Objective

Introduce the first database-backed mutation boundary without creating a general-purpose write API or allowing browser-controlled tenancy and authorization scope.

PILOT-05 permits exactly one reviewed command: `runtime.snapshot.refresh`. The command requests a rebuild of the caller's own tenant/membership/campus home runtime projection. It does not directly edit domain records or accept a client-selected event type, aggregate, tenant, campus, membership, role, principal or projection key.

## Authorization contract

The HTTP boundary requires:

- the exact configured HTTPS browser origin;
- a valid signed HttpOnly browser-session cookie;
- an active durable session registry record;
- an active exact OIDC membership binding;
- an enabled account;
- the exact current database role set;
- the current database grant for `runtime.snapshot.refresh`;
- fresh AAL2 assurance.

The atomic database function locks the current browser-session row, OIDC membership binding and account before acceptance. It also locks and revalidates the complete membership-role set and the required role-permission grant before evaluating the assurance decision. Concurrent session revocation, account disabling, binding status changes or role/grant changes cannot race through command acceptance.

## Optimistic concurrency

The command body contains only:

- `expectedRevision`: a positive integer;
- `reason`: a trimmed, bounded and control-character-free explanation.

The function locks the exact tenant/membership/campus `home` projection and accepts the command only when its current revision equals `expectedRevision`. Missing projections return a not-found decision. Stale revisions return the current revision as a sanitized conflict response.

## Idempotency contract

Every request requires a bounded `Idempotency-Key`. Request identity is a SHA-256 digest over the reviewed command type, expected revision and reason.

- same key and same request: returns the original durable receipt;
- same key and different request: returns an idempotency conflict;
- concurrent same-key requests: at most one receipt is inserted, while the other request resolves to the original receipt or a conflict;
- replay authorization is revalidated before the receipt is returned;
- the original receipt retains its original command and correlation identifiers.

## Atomic persistence

First acceptance writes, in one PostgreSQL transaction:

1. one immutable command receipt;
2. one append-only audit event;
3. one transactional outbox event.

A failure in any write rolls back the complete acceptance. `app_runtime` has execute permission only on the reviewed security-definer function and no direct access to the command-receipt table.

The outbox event records `platform.runtime_snapshot_refresh_requested`. PILOT-05 does not introduce or activate a production outbox consumer.

## HTTP boundary

`OPTIONS/POST /auth/v1/commands/runtime.snapshot.refresh`:

- uses exact-origin credentialed CORS;
- permits only `content-type` and `idempotency-key` request headers;
- accepts JSON only;
- validates declared content length before reading;
- enforces a 4 KiB byte cap while streaming requests without `Content-Length`;
- rejects invalid UTF-8 and any extra JSON property;
- returns `202` with a durable receipt;
- returns sanitized `400`, `401`, `403`, `404`, `409` or `503` failures;
- always uses `Cache-Control: no-store`;
- never creates or refreshes an authentication cookie.

## Readiness controls

The provider-neutral readiness response exposes:

- `safeDatabaseMutations`;
- `idempotentMutationReceipts`;
- `optimisticMutationConcurrency`;
- `atomicMutationAuditOutbox`;
- `aal2MutationAuthorization`.

`runtime-mutation-source` remains missing until a reviewed database mutation binding is configured.

## Explicit exclusions

PILOT-05 does not:

- expose arbitrary domain writes;
- configure production tenant or student data;
- populate production runtime projections;
- activate a production outbox consumer;
- configure real identity-provider credentials or public login;
- authorize production database mutation or deployment;
- replace owner UAT, security approval, recovery rehearsal or explicit production promotion authorization.
