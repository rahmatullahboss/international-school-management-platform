# Projection Recovery Operator Runbook v1

**Status:** pre-production operating procedure; activation is not authorized

## Scope

Use this runbook only for the durable runtime projection pipeline monitored by PILOT-12 and recovered through PROD-06. It does not authorize database editing, queue deletion, source resets, manual outbox mutation or use of owner/broad runtime credentials.

## 1. Detect and classify

1. Capture the current redacted tenant-scoped operations snapshot.
2. Record monitor health (`warning` or `critical`) and aggregate signals only.
3. Open an incident/change record before any recovery action.
4. If the monitor is unavailable, treat the condition as degraded and escalate; do not assume healthy state.

## 2. Investigate before recovery

Determine whether the incident is:

- `source-unavailable`: confirm the exact source-producing path is healthy again;
- `processor-error`: identify and correct the transient processor/dependency fault;
- `invalid-event`: stop; recovery is prohibited;
- `projection-state-conflict`: stop; recovery is prohibited;
- unknown/new class: stop; fail closed and escalate to engineering.

Do not copy event payloads, credentials, tokens or person/student identifiers into the incident record.

## 3. Recovery approval gate

Before invoking recovery, verify:

- source/dependency fault is repaired;
- the incident has a primary operator;
- a different authorized human has recorded secondary approval;
- dedicated recovery login readiness returns true;
- the operator has the AAL2-classified recovery permission;
- no prior recovery receipt exists for the dead letter;
- there is no evidence of a changed projection revision or already-applied original command.

If any check fails, do not attempt to bypass it.

## 4. Submit one controlled recovery

Submit one dead-letter recovery through the reviewed recovery boundary. Never batch-replay dead letters through ad-hoc SQL or scripts.

Record only the returned recovery receipt identifier, replacement event identifier and correlation identifier in the incident record. The original dead-letter and original terminal outbox evidence must remain unchanged.

## 5. Verify outcome

After the existing worker handles the replacement event:

1. capture a new redacted monitor snapshot;
2. confirm the original command was applied at most once;
3. confirm the projection advanced to the expected revision;
4. confirm the replacement event is no longer pending;
5. confirm the recovery receipt and audit evidence exist;
6. confirm the original dead-letter/terminal event evidence remains immutable.

If health remains warning/critical, stop additional replay attempts for the incident and escalate to engineering.

## 6. Close or escalate

Close only when the affected projection is current and the monitor has returned to an acceptable state. Preserve before/after redacted snapshots and recovery identifiers according to the 365-day operational evidence target.

Escalate immediately when:

- a permanent error class is present;
- the same incident would require a second replay;
- readiness fails for the recovery login;
- monitor/alert delivery is unavailable during a critical incident;
- projection revision changed unexpectedly;
- immutable evidence appears altered;
- recovery succeeded technically but business-facing data remains stale or incorrect.

## Prohibited actions

- deleting or updating dead-letter rows;
- resetting outbox attempt counters;
- clearing `last_error` or `published_at` manually;
- changing projection revision to make a replay fit;
- replaying `invalid-event` or `projection-state-conflict`;
- using database owner, Neon superuser, `app_runtime` or `app_production_runtime` as recovery credentials;
- exposing the recovery function through a public HTTP endpoint without a separate reviewed design;
- enabling automatic recovery from monitor health alone.
