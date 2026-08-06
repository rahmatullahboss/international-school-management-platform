# PILOT-12 — Runtime Projection Operations Monitor V1

**Gate:** `GATE-PILOT-RUNTIME-PROJECTION-OPERATIONS-MONITOR-V1`  
**Runtime merge:** `1106bc88cb3323de540b1d4b14c67b913ba02f5d`

## Purpose

PILOT-12 adds a privileged, non-HTTP, tenant-scoped operations snapshot for the durable runtime projection pipeline. It reports bounded aggregate health signals without exposing payloads, identities, event identifiers, membership identifiers, URLs or credentials.

## Contract

The application boundary accepts exactly:

- a tenant UUID;
- an eligible-backlog warning threshold from 60 to 86,400 seconds;
- a stale-source threshold from 300 to 604,800 seconds.

The response contains only:

- overall `healthy`, `warning` or `critical` state;
- eligible and retry-scheduled backlog counts plus oldest eligible age;
- applied-command and dead-letter counts with a fixed sanitized error-code breakdown;
- current, stale, unapplied and missing-source counts;
- active unique, unmapped and ambiguous persona-mapping counts;
- fixed controls declaring exact event allowlisting, tenant scope, payload redaction and function-only access.

Caller-expanded campus, membership, payload or event scope is rejected before database access.

## Database boundary

`platform.read_runtime_projection_operations_snapshot(uuid, integer, integer)` is `SECURITY DEFINER`, uses a fixed search path and filters every metric by the supplied active tenant. Exact backlog metrics include only `platform.runtime_snapshot_refresh_requested` events.

A separate `app_projection_monitor` no-login role can execute the function. Public, `app_runtime`, mapping administration, source publishing and composition roles cannot execute it. The monitor role has no direct table privileges over identity, outbox, source, applied-command or dead-letter tables.

## Health classification

A snapshot is critical when recent dead letters or ambiguous mappings exist, or eligible backlog age reaches four times the warning threshold. It is warning when eligible/retry backlog, stale/unapplied/missing sources or unmapped active memberships exist. Otherwise it is healthy.

## Failure behavior

Malformed thresholds and unknown/inactive tenants fail inside the privileged function. The TypeScript boundary sanitizes database outages as `monitor-unavailable`. Database responses with extra keys, tenant mismatch, false control claims, negative counters, malformed timestamps or secret-bearing fields fail closed.

## Operations use

The snapshot is intended for approved operational polling and alert evaluation. It is read-only: it does not retry, replay, delete, reset or mutate events, sources, mappings, projections or dead letters.

## Non-production boundary

PILOT-12 does not add a public route, monitor credential, Worker/database binding, schedule, alert destination, reset tool or production promotion. Production use requires reviewed credentials, binding, cadence, thresholds, alert ownership, runbook escalation, recovery rehearsal and explicit authorization.
