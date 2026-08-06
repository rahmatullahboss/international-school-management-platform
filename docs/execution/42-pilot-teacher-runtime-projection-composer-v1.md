# PILOT-09 — Database-Owned Teacher Runtime Projection Composer

**Status:** passed and merged to `main`  
**Runtime merge:** `e6301efaaa374e34b9e2719977f3a5eee51ec651`  
**Reviewed implementation head:** `0db23a475b8cd5db980b657922813e907077bed8`

## Objective

Introduce a database-owned teacher `home` projection composer without accepting caller-authored payloads, exposing a public route or activating production composition.

PILOT-09 derives the teacher identity from the active runtime membership, reviewed persona mapping and account-to-person-to-staff linkage. It composes a bounded campus-local workload from authoritative timetable, attendance and gradebook tables, publishes changed data only through the PILOT-07 source publisher and retains the PILOT-05/06 command and worker lifecycle unchanged.

The contract is intentionally teacher-specific. Guardian and student compositions remain separate reviewed milestones.

## Least-privilege invocation

PILOT-09 reuses the `app_projection_composer` role introduced by PILOT-08. The role remains `NOLOGIN` and `NOBYPASSRLS` and receives execute authority only on reviewed persona-specific composition functions.

Only `app_projection_composer` may execute:

- `platform.compose_teacher_runtime_projection_source(uuid, uuid, uuid, bigint, text, uuid)`.

`app_runtime`, `app_projection_admin`, `app_projection_publisher`, public and browser-facing identities cannot execute the function. The composer role receives no direct select, insert, update or delete privilege on identity, HR, timetable, attendance, gradebook, runtime-source, publication or composition-evidence tables.

The function is `SECURITY DEFINER` with a fixed search path. No production credential for the composer role is introduced.

## Exact composition input

The privileged boundary accepts only:

- tenant identifier;
- membership identifier;
- non-null campus identifier;
- exact expected previous source revision;
- composer identifier;
- correlation identifier.

The caller cannot submit:

- payload data;
- persona or role;
- staff or person identity;
- capabilities;
- arbitrary projection keys;
- tenant, membership or campus scope embedded in data.

The TypeScript boundary enforces the exact key allowlist, UUID structure, non-negative safe-integer revision and bounded composer identifier before querying the database.

## Database-owned teacher identity

The composition function verifies and locks:

- the exact active membership;
- the exact non-null campus;
- the linked account is not disabled;
- current membership roles and reviewed persona mappings;
- exactly one resolved persona and that persona is `teacher`;
- an active `iam.person_link` target;
- an active `people.person`;
- an active `hr.staff_profile` in the exact campus whose `person_ref` matches the linked person.

Composition fails closed when identity or scope is inactive, persona resolution is absent or ambiguous, or no active campus-local staff record exists. The caller cannot select or replace the staff identity.

## Authoritative data sources

The teacher payload is generated from reviewed canonical tables:

- published campus timetable versions from `scheduling.timetable_version`;
- assigned class patterns from `scheduling.class_meeting_pattern`;
- assigned scheduled meetings from `scheduling.scheduled_class_meeting`;
- open assigned attendance from `attendance.attendance_session`;
- published or closed assigned assessments from `gradebook.assessment`;
- explicit missing assessment results from `gradebook.assessment_result`.

The campus-local date is derived from the canonical campus time zone. Teacher assignment is matched against the database-derived staff UUID in timetable `teacher_ids` arrays.

No browser-provided filters or staff identifiers participate in the queries.

## Campus isolation

Every timetable and gradebook lookup is constrained through the canonical published `scheduling.timetable_version` for the exact campus.

Fresh PostgreSQL verification inserted:

- a second campus in the same tenant;
- a published timetable for that campus;
- a class assigned to the same teacher staff UUID;
- an inconsistent attendance row whose local campus field attempted to reference the selected campus while the canonical timetable belonged to the second campus;
- a second-campus assessment and missing result.

None of those rows changed the selected-campus metrics or class list. The canonical timetable campus, not a denormalized or caller-controlled field, owns the isolation decision.

## Deterministic payload contract

The generated JSON object contains:

- `schemaVersion: 1`;
- `view: teacher-home`;
- database-derived local date;
- four ordered metrics;
- up to eight ordered assigned classes for the local date;
- ordered actionable exceptions;
- source marker `database-teacher-composer-v1`.

The four metrics are:

1. scheduled classes assigned to the teacher today;
2. assigned attendance sessions that remain open;
3. published assessments in assigned sections due within seven local days;
4. explicit missing results in assigned published or closed assessments.

The payload uses the canonical teacher capabilities:

- `classes.assigned.read`;
- `attendance.assigned.write`;
- `gradebook.assigned.write`.

The composer does not copy unrestricted student records, health, safeguarding, communications or finance data into the teacher projection.

## Revision and unchanged lifecycle

The composer requires the exact previous source revision. A stale expectation returns `revision-conflict` with the current source revision and does not mutate source or evidence.

The composed JSON is deterministically serialized and hashed with SHA-256. When the payload digest matches the current source:

- source revision does not advance;
- the PILOT-07 source publisher is not called;
- no source-publication row is added;
- an append-only composition run records state `unchanged`;
- an audit event records the no-op decision.

When authoritative data changes, the composer calls the reviewed PILOT-07 publisher with the exact expected source revision. The publisher retains persona, subject, payload-size, digest and revision integrity.

## Composition evidence

PILOT-09 extends `platform.runtime_projection_composition_run` with a backward-compatible required `persona` field. Existing PILOT-08 rows backfill as `admin`; teacher runs persist `teacher`.

Each successful run records:

- exact tenant, membership and campus;
- persona;
- expected previous and resulting source revision;
- payload digest and byte count;
- composer and correlation identifiers;
- composition timestamp.

The table remains append-only and inaccessible directly to application and composer roles. Every successful teacher run also emits `runtime.projection.teacher.composed` with the database-derived staff identifier in audit metadata.

## Runtime adapter

`composeTeacherRuntimeProjection(...)`:

- returns `composer-disabled` without storage access when not explicitly configured;
- rejects malformed, expanded, null-campus or unsafe-revision inputs as `invalid-composition`;
- sanitizes store or credential failures as `composer-unavailable`.

`DatabaseTeacherProjectionComposerStore` invokes only the reviewed teacher composition function, requires exactly one database row and validates the complete accepted or rejected response. Unknown states, reasons, malformed identifiers, invalid digests, invalid byte counts, invalid timestamps or ambiguous cardinality fail closed.

The adapter is exported for privileged server-side orchestration only. No Hono route or browser-accessible endpoint was added.

## End-to-end proof

Fresh PostgreSQL established this lifecycle:

1. a separate active teacher account, membership, reviewed teacher role and AAL2 browser session were created;
2. composition failed before the account had a valid active person and campus-local staff link;
3. one selected-campus timetable, class, open attendance session, published assessment and missing result were inserted;
4. the first composition published source revision one;
5. the second composition over unchanged data retained source revision one and recorded `unchanged`;
6. attendance finalization and result scoring changed the deterministic payload;
7. the next composition published source revision two;
8. stale source revision, ambiguous persona and inactive staff attempts failed without successful evidence;
9. cross-campus timetable, attendance and gradebook fixtures remained excluded;
10. `app_runtime` submitted the reviewed AAL2 refresh command at projection revision four;
11. the PILOT-06 worker applied source revision two;
12. the teacher projection advanced from revision four to five with exact selected-campus metrics, one class and no remaining exceptions;
13. source-publication, composition-run, command, applied-command and audit evidence remained consistent.

## Rejection contract

The reviewed boundary exposes only bounded reasons:

- `invalid-composition`;
- `scope-inactive`;
- `persona-not-teacher`;
- `staff-unlinked`;
- `revision-conflict`;
- `publisher-rejected`;
- adapter-only `composer-disabled` and `composer-unavailable`.

Database, SQL, credential and domain-row details are not returned.

## Explicit exclusions

PILOT-09 does not:

- expose a public composer endpoint;
- create a production composer credential;
- configure production persona mappings;
- compose or publish production tenant data;
- provide guardian or student composers;
- expose unrestricted student, care, finance or communications data;
- create a general-purpose query or payload language;
- activate production database, Worker or source bindings;
- activate a Cloudflare schedule;
- enable real identity-provider login;
- replace monitoring, recovery rehearsal, owner UAT, security approval or explicit production authorization.
