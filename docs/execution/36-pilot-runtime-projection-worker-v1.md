# PILOT-06 — Durable Runtime Projection Worker

**Status:** passed and merged to `main`  
**Runtime merge:** `a731f89fc4c6476580129ab0cd734e9250c0aa64`  
**Reviewed implementation head:** `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829`

## Objective

Introduce the first durable database-native processor for the allowlisted runtime refresh command emitted by PILOT-05, without creating a general-purpose event consumer or enabling production projection population.

PILOT-06 processes only `platform.runtime_snapshot_refresh_requested`. It derives the exact tenant, membership, campus and `home` projection scope from the immutable command receipt and database-owned source state. The browser cannot select an event type, aggregate, tenant, campus, membership, role, principal, projection key or source revision.

## Worker readiness contract

The scheduled boundary is enabled only when both of these bindings are present and valid:

- `DATABASE_URL`;
- `RUNTIME_PROJECTION_WORKER_SOURCE=database`.

The reviewed staging configuration supplies only bounded worker identity, batch-size and retry settings. Database and source activation remain absent, so the scheduled handler and the internal readiness endpoint fail closed.

`GET /auth/v1/runtime-projection-worker/readiness` exposes only:

- schema version and `disabled`, `incomplete` or `ready` state;
- generic database-native processing controls;
- generic missing-configuration names.

The response is `Cache-Control: no-store`, creates no cookie and emits no CORS header.

## Database source integrity

`platform.runtime_projection_source` stores the database-owned source payload for one exact tenant, membership, campus and projection key. It includes persona, principal, payload, source revision, SHA-256 digest and byte count.

Triggers verify that the declared digest and byte count match the serialized payload. `app_runtime` has no direct access to the source table. Source publication is therefore a separate reviewed server-side responsibility and is not activated by PILOT-06.

## Batch processing contract

`platform.process_runtime_projection_refresh_batch(worker_id, batch_size, max_attempts)` is a security-definer function with a fixed search path and execute permission only for `app_runtime`.

The function:

1. selects only the exact reviewed event type;
2. orders eligible events deterministically;
3. claims a bounded batch with `FOR UPDATE OF event SKIP LOCKED`;
4. validates the immutable command receipt and exact event binding;
5. serializes duplicate command delivery by locking the receipt before deduplication;
6. locks and revalidates the exact projection revision;
7. verifies source scope, revision, digest and byte integrity;
8. copies the database-owned source into the projection;
9. records append-only applied-command evidence;
10. publishes sanitized completion audit/outbox evidence.

Unrelated outbox events remain unclaimed.

## Idempotency and duplicate delivery

`platform.runtime_projection_applied_command` has a unique command/event application identity. Re-delivery of the same accepted command does not advance the projection revision again and does not duplicate applied-command evidence.

Receipt locking occurs before the deduplication decision so concurrent duplicate deliveries cannot both apply the source payload.

## Retry and dead-letter isolation

Expected processing failures are converted to bounded sanitized codes. Failed events receive exponential backoff capped at fifteen minutes. Attempts are bounded by the configured maximum.

After the terminal attempt, the event is isolated in `platform.runtime_projection_dead_letter` and terminal evidence is published. An unknown or untrusted receipt cannot cause a dead-letter foreign-key rollback: its command identifier is cleared before terminal persistence.

Both applied-command and dead-letter tables are append-only.

## Scheduled boundary

The Cloudflare scheduled handler:

- validates worker identity, batch and attempt settings;
- invokes only the reviewed database processor;
- returns zero counters while disabled;
- sanitizes configured-store failures as `projection-worker-unavailable`;
- rejects malformed database reports;
- uses `waitUntil` without exposing request-facing state;
- emits only a sanitized completion summary.

The staging Wrangler configuration declares a five-minute Cron Trigger, but the current Cloudflare token could not publish the account schedule. The Worker code and live readiness contract were deployed and verified; schedule activation remains an explicit non-production credential/permission task.

## Explicit exclusions

PILOT-06 does not:

- publish projection source records;
- process arbitrary outbox event types;
- expose a browser-facing worker execution route;
- configure a production database or source binding;
- activate a production Cron Trigger;
- populate production runtime projections;
- configure real identity-provider credentials or public login;
- authorize production data mutation or promotion;
- replace backup/restore rehearsal, monitoring, owner UAT, security approval or explicit production authorization.
