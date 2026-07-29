# Attendance and Offline Synchronization

Attendance sessions are resolved from dated scheduled meetings and snapshot the authorized class roster. The module records exactly one current result per student/session while preserving every later amendment.

## Workflow and invariants

- attendance policy versions define codes, present-count behavior, lateness and chronic-absence thresholds;
- a policy cannot be published without present and absent meanings;
- published policies are immutable;
- session identity references an opaque scheduling meeting ID and stores its own date/time/campus/section snapshot;
- offline clients provide tenant-unique client batch and record IDs;
- an identical retry returns the original result, while a reused ID with different content is rejected;
- invalid rows are isolated and counted without duplicating accepted rows;
- roster reconciliation exposes missing students before finalization;
- finalized sessions reject new capture;
- post-finalization changes require explicit permission, reason and approval and create append-only amendment evidence;
- guardian absence notices retain reason/evidence references;
- summaries retain raw meaning counts, calculated percentage and the policy threshold used for chronic-absence alerts.

## Events

- `attendance.policy.created.v1`
- `attendance.code.created.v1`
- `attendance.policy.published.v1`
- `attendance.session.opened.v1`
- `attendance.sync-batch.accepted.v1`
- `attendance.record.amended.v1`
- `attendance.session.finalized.v1`
- `attendance.absence-notice.submitted.v1`

## Database

Migration `202607280203_ACAD-01_attendance` creates policy/code, session, current record, amendment, arrival/departure, absence notice, finalization, intervention and sync-batch tables. All ten tables use forced tenant RLS. Current student/session results and client IDs are unique; amendment/finalization evidence is append-only; finalized record mutation has a database guard.
