# ACAD-01 Operations and Observability

## Readiness contract

ACAD exposes an application-level health snapshot with three states:

- `ready`: migrations are ready and no tracked academic closing/publication exception exists;
- `degraded`: the service is reachable, but academic blockers, timetable conflicts, incomplete attendance, unmoderated assessments, pending records approvals or a stale read model require operational attention;
- `not-ready`: required database migrations are not ready.

Readiness does not claim that a school is academically ready to publish. Publication, finalization, lock and issue commands still enforce their domain-specific blockers.

## Metrics

The stable ACAD metric vocabulary is:

- `academic_command_duration_ms` — command latency histogram labelled by operation and outcome;
- `academic_command_failures_total` — rejected/failed command counter labelled by operation, outcome and stable error code;
- `academic_publication_blockers` — current academic publication blockers;
- `academic_timetable_conflicts` — unresolved blocking timetable conflicts;
- `academic_attendance_sync_rejected_total` — rejected offline attendance rows/batches;
- `academic_attendance_incomplete_sessions` — open/finalizable attendance sessions with missing roster results;
- `academic_gradebook_unmoderated_assessments` — assessments blocking close/lock;
- `academic_records_pending_approvals` — report cards, promotion decisions and transcript corrections awaiting approval;
- `academic_transcript_reissues_total` — transcript replacement versions issued through the correction workflow.

Recommended initial alerts:

- migration readiness false for any serving instance: immediate page;
- command failure ratio above 5% for 10 minutes: investigate by operation/error code;
- blocking timetable conflicts above zero within 72 hours of publication: academic operations alert;
- incomplete attendance sessions older than the school-defined finalization window: attendance office alert;
- unmoderated assessments or pending records approvals remaining after the closing deadline: academic records alert;
- read model staleness above 300 seconds: degraded service alert.

Thresholds are deployment policy and must be adjusted to school size and reporting calendar; they are not hard-coded business rules.

## Structured operation logs

`AcademicOperationLog` contains only operational identifiers and timing:

- tenant ID, actor ID and correlation ID;
- stable operation name and outcome;
- duration and stable error code;
- optional aggregate type/ID;
- recorded timestamp.

Student/guardian names, comments, reasons, evidence, raw scores and attendance explanations are forbidden metric labels. The observability registry rejects known personal-data label keys and overlong values. Application logs should reference audit/event IDs when detailed authorized investigation is required.

## Correlation and audit

Every ACAD command/event uses tenant and correlation metadata. Operational logs should reuse the incoming correlation ID and record the resulting aggregate/event identifier. Audit entries remain append-only domain evidence; metrics and logs are diagnostic indexes and are not a substitute for audit or academic-record history.

## Dashboards

An operational dashboard should show:

1. migration/read-model readiness;
2. command latency and failures by stable operation/error code;
3. current publication blockers and timetable conflicts;
4. attendance sync rejection and incomplete-session age;
5. gradebook moderation/lock readiness;
6. records approval age and transcript reissue count.

Counts should link to permission-scoped exception queues with source version identifiers. Avoid untraceable totals or student-level details in broad operational dashboards.
