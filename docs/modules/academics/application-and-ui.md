# ACAD-01 Application, Reporting and UI Contracts

## Application boundary

`packages/modules/academics/src/application.ts` is the ACAD application boundary. It composes the academic-structure, scheduling, attendance, gradebook and records domains without bypassing their invariants.

Every operation receives an `AcademicActorContext` containing tenant, actor, permissions, locale/timezone and optional section, student and campus scopes. Access is deny-by-default. Holding a functional permission does not bypass assignment scope unless the actor also holds `academics.scope.all`.

### Permission vocabulary

- structure: `academics.structure.read`, `academics.structure.manage`, `academics.structure.publish`;
- rosters: `academics.roster.read`, `academics.roster.manage`;
- schedules: `academics.schedule.read`, `academics.schedule.manage`, `academics.schedule.publish`;
- attendance: `academics.attendance.read`, `academics.attendance.capture`, `academics.attendance.finalize`, `academics.attendance.amend`, `academics.attendance.report`;
- gradebook: `academics.gradebook.read`, `academics.gradebook.write`, `academics.gradebook.moderate`, `academics.gradebook.lock`, `academics.gradebook.publish`, `academics.gradebook.change`;
- records: `academics.records.read`, `academics.records.issue`, `academics.records.amend`;
- data operations: `academics.reports.read`, `academics.import.stage`, `academics.export`, `academics.audit.read`;
- elevated scope: `academics.scope.all`.

Permission checks and assignment scopes are both application-service invariants. UI visibility is only a convenience; server authorization remains authoritative.

## Integrated public contracts

ACAD validates external identifiers through `AcademicExternalContracts` only:

- tenancy/foundation validates campuses;
- SIS validates students, staff and enrollment/student relationships;
- INT validates country-pack references.

The facade never reads or writes another module's private tables. FIN is not coupled to ordinary academic structure, attendance, grading or records. A future fee or graduation-clearance rule must use an explicit FIN public decision/read contract rather than an ACAD database dependency.

## Attendance capture

The application service registers the section scope of an opened attendance session. Offline batches may be synchronized only by an actor assigned to every referenced session's section. Finalization requires the finalization permission and the same scope. Domain idempotency, roster checks, finalization and amendment rules remain unchanged beneath the facade.

## Reports

Initial application reports include policy-versioned attendance summaries. Report rows preserve raw counts, percentage and chronic-absence alert state. Additional curriculum, timetable, grade and records reports must preserve source version IDs and explain calculations instead of publishing untraceable aggregates.

## CSV export

CSV export:

- requires `academics.export`;
- accepts an explicit unique column order;
- quotes every cell;
- escapes embedded quotes;
- prefixes spreadsheet-formula-leading values (`=`, `+`, `-`, `@`) with an apostrophe;
- deterministically serializes arrays/objects as JSON.

## Import staging

Course, section-roster and calendar-day imports are staged before application. The staging contract:

- requires an exact entity-specific header set;
- validates required values and typed fields;
- records row numbers and stable error codes;
- counts duplicate rows without applying them;
- sets `canApply` only when at least one row is accepted and no row is rejected;
- performs no domain mutation during staging.

A later apply command must be explicit, idempotent, permission-checked and revalidate public external references.

## Admin workspace

`AcademicAdminWorkspace` is an exception-first academic control room. It presents:

- a contextual readiness ledger rather than isolated KPI cards;
- cross-area priority work;
- version publication and blockers;
- timetable conflict evidence;
- attendance reconciliation;
- gradebook close readiness;
- report-card/promotion/transcript approval queues;
- report links and validated import batches.

Mutation links are permission-gated. Every table has a caption, row actions are explicit links, overflow regions are keyboard-focusable, and loading/error/empty states are present.

## Teacher workspace

`TeacherAcademicWorkspace` follows a teacher's operational day:

- offline/synchronization integrity;
- resolved schedule and substitutions;
- roster attendance capture and guarded finalization;
- assessment/result entry with explicit raw states;
- report-card comments while the snapshot is still draft.

Mutation forms are rendered only when corresponding permissions are present. Finalization is disabled while students are missing. Finalized attendance routes to the amendment workflow rather than silently overwriting the result.
