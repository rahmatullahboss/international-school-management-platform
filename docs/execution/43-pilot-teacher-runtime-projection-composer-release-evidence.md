# PILOT-09 — Database-Owned Teacher Runtime Projection Composer Release Evidence

**Gate:** `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1`  
**Result:** passed  
**Implementation head:** `0db23a475b8cd5db980b657922813e907077bed8`  
**Main merge:** `e6301efaaa374e34b9e2719977f3a5eee51ec651`

## Test-first evidence

The initial checkpoint added teacher-composer boundary and database-adapter tests before either implementation module existed. Canonical formatting passed and strict lint failed on the intentionally unresolved modules in run `30654312455`. This established the behavioral red gate.

The final tests cover:

- explicit disabled behavior without a database call;
- exact input-key allowlisting;
- UUID, safe-integer revision, composer and correlation validation;
- rejection of null campus and caller-supplied payload, persona, staff and capabilities;
- sanitized privileged-store outages;
- exact positional invocation of the reviewed database function;
- accepted `published` and `unchanged` evidence;
- bounded rejection reasons and revision-conflict evidence;
- malformed, multiple or ambiguous database response rejection.

## Verification lineage

The runtime was verified through four complete gate sequences:

- initial authoring CI `30655076945` passed application, fresh PostgreSQL, live Neon, build, audit and browser gates;
- capability-contract CI `30658568371` passed after aligning projected capability metadata to the canonical teacher contract;
- campus-isolation CI `30658930197` passed after adding canonical timetable-campus joins and adversarial cross-campus fixtures;
- final canonical CI `30659200077` passed on exact head `0db23a475b8cd5db980b657922813e907077bed8`.

The final canonical run completed successfully for:

- formatting;
- strict lint;
- architecture boundaries;
- TypeScript;
- the complete application test suite;
- canonical and post-integration migration verification;
- the fresh-PostgreSQL teacher composition and projection lifecycle;
- the separate live Neon serverless-driver gate;
- all Worker, web and module builds;
- experience-budget enforcement;
- dependency audit;
- licence and provenance generation;
- tracked-artifact drift detection;
- the complete browser suite;
- execution-artifact validation.

Cloudflare staging was expectedly skipped because PILOT-09 introduces no deployed route, binding or schedule.

## Migration evidence

The immutable canonical manifest remains at 40 migrations. The post-integration manifest contains nine contiguous migrations through PILOT-09, producing 49 total migration-ledger entries.

The PILOT-09 migration:

- extends `platform.runtime_projection_composition_run` with a required persona field while preserving existing admin evidence;
- creates `platform.compose_teacher_runtime_projection_source(uuid, uuid, uuid, bigint, text, uuid)`;
- grants function-only execution to `app_projection_composer`;
- registers `202608010101_PILOT-09_teacher_runtime_projection_composer` in the immutable ledger.

## Privilege evidence

Positive and negative probes verified:

- only `app_projection_composer` can execute the teacher function;
- `app_runtime`, `app_projection_admin`, `app_projection_publisher` and public cannot execute it;
- the composer role has no direct privileges on person-link, staff, timetable, attendance, gradebook, source-publication or composition-evidence tables;
- the composer role cannot directly invoke mapping administration or the lower-level source publisher;
- the security-definer function uses a fixed search path;
- composition evidence remains append-only and inaccessible directly.

## Identity and staff-link evidence

The fresh database probes created a separate teacher account, campus-scoped membership, reviewed teacher role and AAL2 session.

Before person and staff linkage existed, composition returned exact `staff-unlinked` evidence. After creating an active person link and active campus-local HR staff record, composition succeeded.

The source subject resolved to the linked person reference. Caller-provided staff or persona fields were rejected before storage.

## Authoritative workload evidence

The selected-campus fixtures contained:

- one published timetable;
- one assigned class for the campus-local date;
- one assigned open attendance session;
- one published assessment due within seven days;
- one explicit missing result.

The first composition published source revision one with exact counts and one ordered class item. It did not accept a caller-authored JSON payload.

## Capability-contract hardening

Review found that the initial generated payload used generic management capability names rather than the existing teacher contract. The migration was corrected and fresh PostgreSQL assertions now require:

- `classes.assigned.read` for class metrics;
- `attendance.assigned.write` for attendance metrics and exceptions;
- `gradebook.assigned.write` for assessment and missing-result metrics and exceptions.

Full run `30658568371` passed after this correction.

## Campus-isolation hardening

Review identified that tenant-and-staff filtering alone was insufficient when one staff UUID appeared in timetables across campuses.

Every scheduled-meeting and class-pattern query was therefore joined to the canonical published timetable version and constrained to the exact membership campus.

Adversarial verification inserted:

- a second campus in the same tenant;
- a published timetable and class for that campus assigned to the same staff UUID;
- an attendance row whose denormalized campus field attempted to point at the selected campus while its canonical timetable belonged to the other campus;
- a second-campus assessment and missing result.

The selected-campus projection remained one class, zero open attendance after finalization, one upcoming assessment and zero missing results. The cross-campus rows did not appear in counts, class items or exceptions. Full run `30658930197` passed.

## Determinism and unchanged evidence

The first successful composition published source revision one. A second composition over unchanged authoritative rows:

- returned `unchanged`;
- retained source revision one;
- retained the exact digest and byte count;
- did not append a source-publication row;
- appended one persona-tagged composition-run row;
- appended one teacher composition audit event.

After attendance finalization and result scoring, the next composition published source revision two. The final evidence retained exactly two published runs and one unchanged run for the teacher membership.

## Negative-case evidence

Fresh PostgreSQL verified:

- malformed or null-campus input fails as `invalid-composition`;
- unlinked or inactive staff fails as `staff-unlinked`;
- conflicting persona mappings fail as `persona-not-teacher`;
- a stale source revision returns exact `revision-conflict` evidence;
- denied cases do not publish a source or append successful composition evidence;
- unsafe JavaScript revision values are rejected before querying;
- malformed database responses fail closed;
- evidence mutation is rejected by the append-only guard.

## Composer-to-worker lifecycle evidence

The final end-to-end probe established:

1. changed authoritative teacher workload published source revision two;
2. the reviewed AAL2 safe mutation accepted a refresh at projection revision four;
3. the durable worker claimed the exact allowlisted event;
4. source revision two was applied to the exact teacher projection;
5. projection revision advanced from four to five;
6. the final payload reported one selected-campus class, zero open attendance, one upcoming assessment and zero missing results;
7. the final class list contained one item and exceptions were empty;
8. command, applied-command, source-publication, persona-tagged composition-run and audit evidence retained consistent scope and revision lineage.

## Runtime adapter evidence

The final TypeScript tests verified:

- exact composition input shape;
- mandatory campus scope;
- pre-query rejection of malformed identifiers, expanded keys, fractional and unsafe revisions;
- exact positional database parameters;
- strict `published` and `unchanged` response validation;
- source revision, digest, byte-count and timestamp validation;
- bounded rejection-reason validation;
- store exceptions sanitized without leaking SQL, credentials or domain data;
- zero, multiple or malformed database rows rejected.

No public HTTP route was introduced.

## Review state

PR #68 was mergeable, contained no unresolved review threads and had no submitted reviews. It was marked ready and squash merged with expected-head protection only after final canonical CI passed on `0db23a475b8cd5db980b657922813e907077bed8`.

The final runtime diff contained exactly eight runtime, test and database files. All temporary authoring scripts and workflows were removed and canonical CI was restored before final verification.

## Production boundary

No composer credential, production persona mapping, production composition run, production source row, production database or Worker binding, schedule activation, real identity-provider login, public composer endpoint or production promotion was introduced.

Production activation still requires:

- approved identity-provider/client credentials and production origins;
- reviewed production database and worker-source bindings;
- secure credentials for the narrowly scoped mapping, publisher and composer roles;
- approved production admin and teacher persona mappings;
- reviewed admin and teacher composition cadence and monitoring;
- separate reviewed guardian and student composers;
- an authorized Cloudflare schedule token where orchestration is approved;
- source freshness, composition failure, outbox retry and dead-letter monitoring;
- backup, restore and rollback rehearsal;
- owner UAT and security sign-off;
- explicit production authorization.

PILOT-09 does not schedule the composer. Orchestration cadence and credential delivery remain separate reviewed production changes.
