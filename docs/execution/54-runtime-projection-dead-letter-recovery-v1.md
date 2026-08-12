# Runtime Projection Dead-Letter Recovery v1

Updated: 2026-08-12
Status: implementation in review; production activation is not authorized

## Objective

Provide a narrowly scoped recovery path for runtime projection refresh work that reached a terminal dead letter because of a transient failure, without weakening the append-only dead-letter, audit, command, or outbox evidence model.

## Safety boundary

Recovery is intentionally **not** a generic replay API.

- It is non-HTTP and function-only.
- The database role is `app_projection_recovery` (`NOLOGIN`, `NOBYPASSRLS`). A reviewed production login may later be granted that role; the migration does not create a production credential.
- `app_runtime`, the read-only projection monitor, projection publisher/admin/composer roles, and `PUBLIC` cannot execute the recovery function.
- The caller must identify an active tenant operator account that has an active OIDC membership binding whose role owns `runtime.projection.dead-letter.recover`.
- The permission is classified `aal2`; production credential/session binding and operator runbook authorization remain separate activation work.
- Inputs are exact and bounded: tenant, dead-letter id, actor account, idempotency key, reason, correlation id. Replacement event identifiers, error codes, command ids, payloads and projection scope are never caller-selected.

## Eligible dead letters

Only terminal failures classified by the worker as transient are eligible:

- `source-unavailable`
- `processor-error`

These terminal classes remain non-recoverable through this boundary:

- `invalid-event`
- `projection-state-conflict`

Permanent failures require a corrective action or a new normal command; replaying them would preserve a known-invalid invariant.

## Required preconditions

Before accepting recovery, the function locks and revalidates the exact dead letter and requires all of the following:

1. The tenant is active.
2. The operator has the dedicated tenant permission.
3. The dead-letter command id is present and still resolves to the original `runtime.snapshot.refresh` receipt.
4. The original outbox event is terminal (`published_at` set), carries the same terminal error, and preserves the original command envelope.
5. The command has not already been applied.
6. The current projection revision still equals the command receipt's expected revision.
7. A current projection source exists for the exact tenant/membership/campus/home scope.
8. No prior recovery receipt exists for that dead-letter row.

Any failed precondition returns a bounded reason and creates no replacement event.

## Persistence model

Accepted recovery is one atomic database transaction:

1. Generate a new replacement outbox event id and recovery id.
2. Append a new pending `platform.runtime_snapshot_refresh_requested` event using the original event type/schema/aggregate/correlation/causation/payload. `attempt_count` starts at zero.
3. Append one `platform.runtime_projection_recovery_receipt` containing the original and replacement event ids, command id, operator account, bounded reason, request hash, correlation id and sanitized response.
4. Append `runtime.snapshot.refresh.dead_letter.recovery_requested` to `audit.audit_event`.

The original outbox event and original `runtime_projection_dead_letter` row are never changed. Recovery receipts are themselves append-only via `audit.prevent_mutation()`.

## Idempotency and concurrency

- The dead-letter row is locked before the recovery receipt is checked/created.
- There is at most one recovery receipt for a specific `(tenant_id, dead_letter_id)`.
- Repeating the same idempotency key and request hash returns the existing receipt with `replayed=true` and creates no additional event.
- A different request against an already recovered dead letter returns `already-recovered`.
- If a replacement event itself later dead-letters, that is a new immutable dead-letter row and can be separately evaluated under the same policy.

## Application boundary

`runtime-projection-dead-letter-recovery.ts` rejects unknown keys and malformed IDs/reasons before privileged storage. `database-projection-dead-letter-recovery-store.ts` accepts only exact reviewed response shapes and allowlisted rejection reasons. Database errors are converted by the application boundary to `recovery-unavailable`; database URLs or raw exceptions are never returned.

## Verification

`tests/integration/verify-runtime-projection-dead-letter-recovery.sh` rehearses:

- permission denial before role permission assignment;
- refusal while the transient source condition is still unresolved;
- successful recovery after source repair;
- exact idempotent replay;
- refusal of a second recovery identity;
- least-privilege function grants;
- preservation of original dead-letter/outbox evidence;
- one append-only recovery receipt and one replacement event;
- audit evidence;
- successful processing of the replacement event exactly once;
- projection revision advancement using the repaired source;
- append-only receipt mutation rejection;
- permanent `projection-state-conflict` refusal.

## Production work still required

This repository boundary does not authorize production use. Production still needs:

- a reviewed password-bearing/secret-managed login granted only the recovery role needed for this tool;
- credential rotation and revocation rehearsal;
- operator ownership and escalation thresholds tied to the projection monitor;
- documented approval criteria for recovery decisions;
- backup/restore/rollback and dead-letter recovery rehearsal against the deployed environment;
- explicit owner/security production authorization.
