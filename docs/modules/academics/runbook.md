# ACAD-01 Operational Runbook

## Safety rules

- Do not edit issued transcripts, published report cards, locked grade results, finalized attendance or published timetable/academic versions directly.
- Do not disable RLS or immutability triggers to resolve an incident.
- Do not write another module's private schema from ACAD.
- Use forward corrections: a new version, approved amendment, reissue, reversal-equivalent status transition or replay-safe command.
- Database verification/probes must run only on an isolated non-production branch and inside a transaction that rolls back.

## Publication blockers

### Symptoms

An academic year, curriculum, timetable or record cannot publish; the admin workspace shows a blocker.

### Diagnose

1. Resolve the exact draft/version identifier and tenant.
2. Inspect its blocker list and required approval state.
3. Confirm the referenced calendar/course/section/reporting-period versions still exist.
4. Check recent command failures by operation and stable error code.
5. Confirm migration/read-model readiness before treating the problem as business data.

### Recover

Correct the draft data or create a successor draft. Never modify a published source version. Retry the idempotent publish command with the original business idempotency key where supported.

## Timetable conflicts

### Symptoms

Publication fails with blocking teacher, room, student or section conflicts.

### Diagnose

Use the conflict register to compare meeting date/time, resource type/ID and both meeting IDs. Confirm timezone, effective ranges and substitutions.

### Recover

Adjust only the draft timetable, rematerialize affected meetings and rerun conflict detection. A published timetable change requires a new timetable version. Dated cover should use a substitution assignment so the published base meeting remains visible.

## Attendance offline synchronization

### Symptoms

A device has pending changes, batch replay conflicts or rejected rows.

### Diagnose

1. Identify tenant, device, client batch ID and correlation ID.
2. Compare the stored payload binding for that client batch/record ID.
3. Review rejected row codes: unrostered student, missing required reason, finalized session, duplicate current result or changed payload under the same client ID.
4. Confirm the actor remains assigned to every referenced section.

### Recover

Replay an identical batch unchanged. A changed payload must receive a new client batch/record ID or follow the amendment workflow. Do not delete accepted rows to force a retry. Reconcile all roster students before finalization.

## Incomplete or finalized attendance

An incomplete session must be reconciled or explicitly finalized through the authorized incomplete-override policy. After finalization, corrections require `academics.attendance.amend`, a reason and required approval. Preserve the amendment chain.

## Gradebook closing

### Symptoms

A section cannot lock or publish.

### Diagnose

Check for draft/unmoderated assessments, missing results, scale/calculation mismatch, existing lock state and snapshot publication window.

### Recover

Complete or explicitly classify raw result states, moderate all active assessments, recalculate explainable snapshots, then lock. After lock, use a grade-change request and independent decision. Recalculate/reissue downstream records instead of rewriting old snapshots.

## Report-card or transcript corrections

- A report card must be approved before publication and cannot be edited after publication.
- Promotion/retention decisions retain their proposal evidence and separate decision.
- Transcript corrections require an issued source, reason, replacement GPA snapshot, distinct amender/approver and a new transcript number/version.
- Never reuse a transcript number or replace the original artifact digest/content.

## Migration failure

### Diagnose

1. Stop the isolated migration transaction on first error.
2. Confirm the branch/project/database identifiers.
3. Confirm the reviewed base SHA and ordered ACAD manifest.
4. Inspect `platform.schema_migration` and the failing statement.
5. Run `verify_acad_schema.sql` only after a successful complete transaction.

### Recover

Because the replay command uses one transaction and `ON_ERROR_STOP`, a failure rolls the full replay back. Fix only the owning migration on the module branch and replay on a fresh/equivalent isolated branch. Do not partially mark the migration ledger or manually create missing objects.

## Recovery verification

Run on an isolated Neon branch:

```text
psql "$CONNECTION" -X -v ON_ERROR_STOP=1 -f packages/modules/academics/verification/verify_acad_schema.sql
psql "$CONNECTION" -X -v ON_ERROR_STOP=1 -f packages/modules/academics/verification/probe_acad_rls_and_recovery.sql
```

The first script is assertion-only. The second creates probe rows under `app_runtime`, verifies tenant isolation and published-version immutability, then ends with `ROLLBACK;`. A follow-up query must show zero `ACAD-PROBE-%` rows.

## Escalation evidence

Provide tenant, actor/correlation IDs, operation/error code, aggregate/version IDs, migration ledger state and timestamps. Do not place names, comments, reasons, evidence or scores in broad incident channels.
