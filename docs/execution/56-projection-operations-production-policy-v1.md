# Projection Operations Production Policy v1

**Program:** `international-school-platform-v1`  
**Status:** reviewed repository policy; production activation is not authorized  
**Depends on:** PILOT-12 monitor, PROD-06 controlled recovery, PROD-07 recovery credential readiness

## Objective

Turn the existing redacted projection monitor and controlled dead-letter recovery primitives into a deterministic production operating contract without introducing a public endpoint, production credential, alert destination, schedule or automatic replay.

The repository owns the policy shape and validation. Deployment owns secrets, monitor/recovery login principals, alert destinations, named on-call owners and explicit activation.

## Monitoring baseline

The production candidate policy uses:

- polling every **60 seconds**;
- monitor backlog warning age **300 seconds**;
- stale-source threshold **900 seconds**;
- warning notification after **2 consecutive warning snapshots** to avoid one-sample noise;
- critical notification after **1 critical snapshot**;
- alert de-duplication window **900 seconds** for the same tenant/severity condition.

These values stay within the PILOT-12 database boundary and are intentionally conservative for interactive school workflows. The monitor remains aggregate-only and tenant-scoped.

## Severity and response

### Healthy

No notification. Continue normal polling.

### Warning

Acknowledge within 30 minutes and begin investigation within 60 minutes. Warning state does **not** authorize dead-letter recovery by itself. Operators inspect backlog/source/mapping signals and preserve the redacted snapshot as incident evidence.

### Critical

Acknowledge within 10 minutes and begin investigation within 15 minutes. Critical state requires an incident record and escalation to the configured primary operations owner. A critical monitor state is still not sufficient evidence for replay; recovery is separately governed.

## Recovery policy

Production dead-letter recovery is manual and one-dead-letter-at-a-time. It is never automatic or monitor-triggered.

Recovery may be requested only when all of the following are true:

- the dead letter is `source-unavailable` or `processor-error`;
- the underlying source fault has been identified and repaired;
- the current projection revision still equals the original expected revision;
- the original command is still unapplied;
- the exact current source exists;
- the operator uses the dedicated recovery credential and AAL2-classified application permission;
- an incident/change record exists;
- a second authorized human has approved the production recovery action.

`invalid-event` and `projection-state-conflict` are never replayed. They require corrective data/code action and a new normal command after review.

The existing PROD-06 database function remains the enforcement boundary for technical eligibility, idempotency, immutable evidence and one-time replacement-event creation. The policy does not widen that function.

## Evidence requirements

For every production recovery incident retain:

- the redacted monitor snapshot before intervention;
- incident/change identifier and timestamps;
- primary operator and secondary approver identities in the external incident system;
- dead-letter error class without payload content;
- recovery receipt identifier and correlation identifier;
- redacted monitor snapshot after the worker processes the replacement event;
- whether the projection reached the expected next revision;
- rollback/escalation decision if recovery did not restore health.

Operational evidence retention target is 365 days unless a stricter organizational policy supersedes it. Payloads, tokens, credentials and student/person identifiers must not be copied into the incident record.

## Fail-safe behavior

- Monitor unavailable: treat as operationally degraded; do not infer healthy state.
- Alert delivery unavailable: continue collecting snapshots and escalate through the configured secondary channel; do not auto-recover.
- Recovery credential not ready: recovery is unavailable; do not substitute owner or broad runtime credentials.
- Repeated warning/critical state after a successful recovery: stop further replay attempts for the incident and escalate for engineering review.
- Unknown or expanded error codes: non-recoverable by default.

## Activation requirements

Production activation remains blocked until all external bindings are supplied and rehearsed:

1. password-bearing `app_projection_monitor` login and secret-bound connection;
2. password-bearing `app_projection_recovery` login satisfying PROD-07;
3. approved scheduled poller/Cron binding;
4. primary and secondary alert destinations;
5. named primary and secondary operations owners;
6. deployed monitor and alert-delivery rehearsal;
7. credential rotation/revocation rehearsal;
8. one controlled recovery rehearsal in a production-like isolated environment;
9. owner/security approval.

The machine-readable companion policy is `config/production/projection-operations-policy.json`. CI validates that it cannot silently widen thresholds, recovery error classes, approval requirements or redaction/activation controls.
