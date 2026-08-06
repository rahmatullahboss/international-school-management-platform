# PILOT-10 — Database-Owned Guardian Runtime Projection Composer

**Status:** passed and merged to `main`  
**Runtime merge:** `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`  
**Reviewed implementation head:** `d59334952813afafd00b2ddf4ae9b5e06d5f3286`

## Objective

Introduce a database-owned guardian `home` projection composer without accepting caller-authored payloads, exposing a public route or activating production composition.

PILOT-10 derives the guardian person and visible children from active identity, reviewed guardian persona mapping and current verified guardian authority. Education and billing permissions are evaluated independently. Changed data is published only through the PILOT-07 source publisher and applied through the existing PILOT-05/06 command and worker lifecycle.

Student composition remains a separate reviewed milestone.

## Least-privilege invocation

PILOT-10 reuses the `app_projection_composer` role. The role remains `NOLOGIN` and `NOBYPASSRLS` and receives execute authority only on reviewed composition functions.

Only `app_projection_composer` may execute:

- `platform.compose_guardian_runtime_projection_source(uuid, uuid, uuid, bigint, text, uuid)`.

`app_runtime`, `app_projection_admin`, `app_projection_publisher`, public and browser-facing identities cannot execute the function. The composer role has no direct read or mutation privilege on identity, people, enrollment, attendance, gradebook, billing, runtime-source, publication or composition-evidence tables.

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
- guardian person identifier;
- child identifiers;
- authority flags;
- capabilities;
- projection keys or expanded scope.

The TypeScript boundary validates the exact key allowlist, UUID shape, non-negative safe-integer revision and bounded composer identifier before querying.

## Database-owned guardian identity

The function verifies and locks:

- exact active membership and campus;
- non-disabled account;
- current membership roles and reviewed persona mappings;
- exactly one resolved persona and that persona is `guardian`;
- active `iam.person_link` target;
- active guardian `people.person`;
- canonical campus legal entity, time zone and currency.

Composition fails closed when identity, campus, persona or guardian linkage is unavailable. The caller cannot select another guardian identity.

## Verified child authority

Child visibility requires a current `people.guardian_student_authority` row with:

- `portal_access = true`;
- `verification_status = verified`;
- effective date range covering the campus-local date;
- active child person;
- active student profile;
- active current enrollment in the exact membership campus.

Multiple current rows for one child are deterministically collapsed with `bool_or` authority semantics.

Authority types are separated:

- portal authority permits the child summary;
- education authority permits attendance and published-grade metrics;
- billing authority permits responsible-party balance metrics.

Unverified, expired, inactive and cross-campus child authority is excluded.

## Authoritative data sources

The bounded guardian payload uses:

- current exact-campus enrollment from `student_lifecycle.enrollment`;
- current-day attendance records and codes from `attendance`;
- currently available grade publications from `gradebook`;
- exact legal-entity billing accounts, responsible-party allocation and open posted invoices from `billing`;
- published timetable lineage from `scheduling` for campus ownership of attendance and grade sections.

The child array is deterministically ordered and limited to eight entries. It contains only student profile identifier, bounded display name, grade-level identifier, reviewed route and capability metadata.

## Campus-lineage isolation

Enrollment campus alone is insufficient when historical or inconsistent rows reference the same student profile. PILOT-10 therefore binds attendance and grade visibility to the canonical published timetable campus.

Attendance rows require:

- exact-campus attendance session;
- matching scheduled meeting;
- matching published timetable version in the exact campus.

Published-grade rows require a section linked to a published timetable version in the exact campus.

Adversarial verification inserted:

- a verified child enrolled at another campus;
- an unverified same-campus child;
- same-child attendance whose denormalized campus field attempted to point at the selected campus while the canonical timetable belonged to another campus;
- a currently published grade for the same child in a cross-campus section.

None of those rows changed the selected-campus child, attendance, grade or finance metrics.

## Deterministic payload

The payload contains:

- `schemaVersion: 1`;
- `view: guardian-home`;
- database-derived campus-local date and currency;
- four ordered metrics;
- up to eight authorized children;
- ordered actionable exceptions;
- source marker `database-guardian-composer-v1`.

Metrics are:

1. currently authorized portal children;
2. current-day absent or late records for education-authorized children;
3. currently available grade publications for education-authorized children;
4. open posted invoice balance attributable to the guardian for billing-authorized children.

Canonical capabilities are:

- `student.household.read`;
- `attendance.household.read`;
- `records.household.read`;
- `finance.household.read`.

Finance totals are limited to the campus legal entity and currency and weighted by `responsibility_basis_points`.

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

`platform.runtime_projection_composition_run` permits persona `guardian` while retaining prior admin and teacher evidence. Every successful run records exact scope, persona, revisions, digest, byte count, composer, correlation and timestamp.

Every successful guardian run emits `runtime.projection.guardian.composed` with database-derived guardian and authorized-child evidence. The composition table remains append-only and inaccessible directly to application and composer roles.

## End-to-end proof

Fresh PostgreSQL established:

1. a separate guardian account, role, campus membership and AAL2 session;
2. denial before guardian person linkage;
3. denial before current verified child authority;
4. exact authority, attendance, grade and responsible-party billing fixtures;
5. first composition published source revision one;
6. unchanged composition retained source revision one;
7. attendance correction changed the payload and published source revision two;
8. stale revision, expired authority and ambiguous persona attempts failed without successful evidence;
9. unverified, cross-campus and forged-campus rows remained excluded;
10. the reviewed refresh command was accepted at projection revision three;
11. the durable worker applied source revision two;
12. the guardian projection advanced from revision three to four;
13. source, composition, command, applied-command and audit evidence remained consistent.

## Rejection contract

Only bounded reasons are exposed:

- `invalid-composition`;
- `scope-inactive`;
- `persona-not-guardian`;
- `guardian-unlinked`;
- `authority-unavailable`;
- `revision-conflict`;
- `publisher-rejected`;
- adapter-only `composer-disabled` and `composer-unavailable`.

SQL, credential and domain-row details are never returned.

## Explicit exclusions

PILOT-10 does not:

- expose a public composer endpoint;
- create a production composer credential;
- configure production persona mappings or child authority;
- compose or publish production data;
- provide a student composer;
- expose unrestricted student, care, safeguarding or communication data;
- activate production database, Worker or source bindings;
- activate a Cloudflare schedule;
- enable real identity-provider login;
- replace monitoring, recovery rehearsal, owner UAT, security approval or explicit production authorization.
