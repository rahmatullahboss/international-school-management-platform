# PILOT-11 — Database-Owned Student Runtime Projection Composer

**Status:** passed and merged to `main`  
**Runtime merge:** `f260d18bab8084ab2132767f2d8fb3040290c6cd`  
**Reviewed implementation head:** `9a3978e294bc3d9f463780ec9154bed67d802eb8`

## Objective

Introduce a database-owned student `home` projection composer without accepting caller-authored payloads, exposing a public route or activating production composition.

PILOT-11 derives the exact active student person, profile and current exact-campus enrollment from reviewed identity state. It composes bounded timetable, attendance, upcoming-assessment and currently published-grade information from authoritative database tables. Changed data is published only through the PILOT-07 source publisher and applied through the existing PILOT-05/06 command and worker lifecycle.

The gate completes the reviewed admin, teacher, guardian and student home-composer set for the non-production pilot.

## Least-privilege invocation

PILOT-11 reuses the `app_projection_composer` role. The role remains `NOLOGIN` and `NOBYPASSRLS` and receives execute authority only on reviewed composition functions.

Only `app_projection_composer` may execute:

- `platform.compose_student_runtime_projection_source(uuid, uuid, uuid, bigint, text, uuid)`.

`app_runtime`, `app_projection_admin`, `app_projection_publisher`, public and browser-facing identities cannot execute the function. The composer role has no direct read or mutation privilege on identity links, student profiles, enrollment, rosters, timetable, attendance, gradebook, runtime-source, publication or composition-evidence tables.

The function is `SECURITY DEFINER` with a fixed search path. No production credential is introduced.

## Exact input boundary

The privileged boundary accepts only:

- tenant identifier;
- membership identifier;
- required campus identifier;
- exact expected previous source revision;
- composer identifier;
- correlation identifier.

The caller cannot provide:

- payload data;
- persona or role;
- person, student-profile or enrollment identifiers;
- section or roster identifiers;
- capabilities;
- projection keys or expanded scope.

The TypeScript boundary validates the exact key allowlist, UUID shape, non-negative safe-integer revision and bounded composer identifier before querying.

## Database-owned student identity

The function verifies and locks:

- exact active membership and campus;
- non-disabled account;
- current membership roles and reviewed persona mappings;
- exactly one resolved persona and that persona is `student`;
- active `iam.person_link` target;
- active `people.person`;
- active `student_lifecycle.student_profile`;
- one current active enrollment in the exact membership campus.

The campus-local date is derived from the canonical campus time zone. Composition fails closed when scope, persona, person linkage, active student profile or exact-campus enrollment is unavailable. The caller cannot select another student or campus.

## Exact-campus roster boundary

Student identity and enrollment are not sufficient to expose academic rows. Every timetable, attendance, assessment and grade query also resolves through a current `academics.section_roster` row matching:

- the database-derived student profile;
- the database-derived enrollment;
- joined and not-left date range covering the campus-local date;
- a published section in the exact campus.

Timetable and attendance additionally require the published timetable lineage for the exact campus. A current cross-campus roster may coexist for the same student and enrollment but cannot contribute to the selected-campus payload.

## Authoritative data sources

The bounded student payload uses:

- current exact-campus enrollment from `student_lifecycle.enrollment`;
- current roster from `academics.section_roster`;
- published sections and courses from `academics`;
- published timetable and scheduled meetings from `scheduling`;
- current-day absent or late records from `attendance`;
- published assessments due within seven days from `gradebook.assessment`;
- currently available grade publications and calculation snapshots from `gradebook`.

Lesson and result arrays are deterministically ordered and limited to eight entries each.

## Deterministic payload

The payload contains:

- `schemaVersion: 1`;
- `view: student-home`;
- database-derived campus-local date;
- four ordered metrics;
- up to eight scheduled lessons;
- up to eight currently available published results;
- a bounded attendance exception;
- source marker `database-student-composer-v1`.

Metrics are:

1. scheduled lessons for the current day;
2. current-day absent or late attendance records;
3. published assessments due within seven days;
4. currently available published grades.

Canonical capabilities are:

- `timetable.self.read`;
- `attendance.self.read`;
- `records.self.read`.

No household, staff, finance, care, safeguarding or unrestricted academic capability is introduced.

## Revision and unchanged lifecycle

The composer requires the exact previous source revision. A stale expectation returns `revision-conflict` with the current revision and does not mutate source or evidence.

The deterministic payload is SHA-256 hashed. When its digest matches the current source:

- source revision does not advance;
- the publisher is not called;
- no source-publication row is added;
- an append-only composition row records `unchanged`;
- an audit event records the no-op.

Changed data is passed to the reviewed PILOT-07 publisher with the exact expected revision.

## Evidence contract

`platform.runtime_projection_composition_run` permits persona `student` while retaining prior admin, teacher and guardian evidence. Every successful run records exact scope, persona, revisions, digest, byte count, composer, correlation and timestamp.

Every successful student run emits `runtime.projection.student.composed` with database-derived student-profile and enrollment evidence. The composition table remains append-only and inaccessible directly to application and composer roles.

## End-to-end proof

Fresh PostgreSQL established:

1. a separate student account, role, exact-campus membership and AAL2 session;
2. denial before database-owned person and profile linkage;
3. one active student profile and current exact-campus enrollment;
4. current selected-campus and adversarial cross-campus rosters;
5. exact timetable, attendance, assessment and published-grade fixtures;
6. first composition published source revision one;
7. unchanged composition retained source revision one;
8. attendance correction changed the payload and published source revision two;
9. stale revision, ambiguous persona and withdrawn-profile attempts failed without successful publication;
10. cross-campus roster data remained excluded;
11. the reviewed refresh command was accepted at projection revision two;
12. the durable worker applied source revision two;
13. the student projection advanced from revision two to three;
14. source, composition, command, applied-command and audit evidence remained consistent.

## Rejection contract

Only bounded reasons are exposed:

- `invalid-composition`;
- `scope-inactive`;
- `persona-not-student`;
- `student-unlinked`;
- `revision-conflict`;
- `publisher-rejected`;
- adapter-only `composer-disabled` and `composer-unavailable`.

SQL, credential and domain-row details are never returned.

## Explicit exclusions

PILOT-11 does not:

- expose a public composer endpoint;
- create a production composer credential;
- configure production persona mappings, student profiles, enrollment or rosters;
- compose or publish production data;
- expose household, finance, care, safeguarding or unrestricted academic records;
- activate production database, Worker or source bindings;
- activate a Cloudflare schedule;
- enable real identity-provider login;
- replace monitoring, recovery rehearsal, owner UAT, security approval or explicit production authorization.
