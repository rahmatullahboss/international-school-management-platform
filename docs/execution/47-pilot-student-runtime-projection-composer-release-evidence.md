# PILOT-11 — Database-Owned Student Runtime Projection Composer Release Evidence

**Gate:** `GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1`  
**Result:** passed  
**Implementation head:** `9a3978e294bc3d9f463780ec9154bed67d802eb8`  
**Main merge:** `f260d18bab8084ab2132767f2d8fb3040290c6cd`

## Test-first and debugging evidence

The initial checkpoint added student-composer boundary and database-adapter tests before the complete database implementation was verified. Run `30664306850` exposed the first fresh-PostgreSQL failure at a PostgreSQL-invalid UUID aggregate.

Subsequent full gates exposed and corrected only evidence/fixture defects:

- PostgreSQL UUID aggregate selection was made deterministic and valid;
- the inventory reservation test clock was frozen instead of changing production expiration behavior;
- canonical academic-year, term, curriculum, course and class-section rows were added for roster foreign-key integrity;
- the non-active student fixture used the schema-valid `withdrawn` lifecycle state instead of staff-only `inactive`.

Final tests cover:

- explicit disabled behavior without storage access;
- exact input-key allowlisting;
- UUID, safe-integer, non-finite revision, composer and correlation validation;
- rejection of null campus and caller-supplied payload, persona, person, profile, enrollment, section and capability scope;
- sanitized privileged-store outages;
- exact positional invocation of the reviewed function;
- strict `published`, `unchanged` and bounded rejection responses;
- zero, multiple, malformed or ambiguous database responses failing closed.

## Verification lineage

- full authoring CI `30678506882` passed application, 51-migration lifecycle, live Neon, builds, audit and browser gates;
- final canonical CI `30678621687` passed on exact clean head `9a3978e294bc3d9f463780ec9154bed67d802eb8`;
- runtime PR #72 was squash merged as `f260d18bab8084ab2132767f2d8fb3040290c6cd` with expected-head protection.

The final canonical run passed:

- formatting and strict lint;
- architecture boundaries and TypeScript;
- 135 test files passed, one skipped;
- 691 application tests passed, one skipped;
- all canonical and post-integration migrations;
- fresh-PostgreSQL student composition and worker lifecycle;
- live Neon serverless-driver verification;
- all Worker, web and module builds;
- experience budget, dependency audit, licences and provenance;
- tracked-artifact drift detection;
- the complete browser suite;
- execution-artifact validation.

Cloudflare staging was expectedly skipped because PILOT-11 adds no deployed route, binding or schedule.

## Migration evidence

The immutable canonical manifest remains at 40 migrations. The post-integration manifest contains eleven contiguous migrations through PILOT-11, producing 51 schema-migration ledger entries.

The PILOT-11 migration:

- permits `student` in persona-tagged composition evidence while preserving admin, teacher and guardian rows;
- creates `platform.compose_student_runtime_projection_source(uuid, uuid, uuid, bigint, text, uuid)`;
- grants execute only to `app_projection_composer`;
- registers `202608010301_PILOT-11_student_runtime_projection_composer`.

## Privilege evidence

Fresh PostgreSQL verified:

- only `app_projection_composer` can execute the student function;
- `app_runtime`, `app_projection_admin`, `app_projection_publisher` and public cannot execute it;
- the composer role has no direct table privileges over identity links, student profiles, enrollment, roster, timetable, attendance, gradebook or projection evidence;
- source publication and persona administration remain separately privileged;
- the security-definer function uses a fixed search path;
- composition evidence remains append-only.

## Identity and enrollment evidence

A separate student account, role, exact-campus membership, reviewed student mapping and AAL2 session were created.

Composition returned `student-unlinked` before an active person link, student profile and current exact-campus enrollment resolved. The caller never supplied person, profile or enrollment identity.

A schema-valid transition from active to `withdrawn` caused the composer to fail closed as `student-unlinked`. Restoring the profile to active re-enabled only the exact reviewed student scope.

## Exact-campus academic evidence

The selected-campus fixtures contained:

- one active student profile and current exact-campus enrollment;
- one current roster entry in the selected campus;
- two scheduled current-day lessons;
- one current-day attendance record;
- one published assessment due within seven days;
- one currently available published grade.

A second current roster and academic rows existed in another campus for the same student and enrollment. Those rows did not change selected-campus metrics, lessons or results.

## Determinism and unchanged evidence

The first successful composition published source revision one. A second composition over unchanged rows:

- returned `unchanged`;
- retained source revision one;
- retained digest and byte count;
- did not add a source-publication row;
- appended one student composition run and audit event.

After the exact-campus attendance record changed from absent to present, the next composition published source revision two. Final evidence retained exactly two published runs and one unchanged run.

## Negative-case evidence

Fresh PostgreSQL verified:

- malformed and null-campus inputs fail as `invalid-composition`;
- missing person, active profile or exact-campus enrollment fails as `student-unlinked`;
- ambiguous persona fails as `persona-not-student`;
- a withdrawn student profile fails closed;
- stale source revision returns exact conflict evidence;
- cross-campus roster, lesson and result rows remain excluded;
- denied cases do not publish source or append successful composition evidence;
- malformed database responses fail closed.

## Composer-to-worker lifecycle

The final probe established:

1. changed authoritative attendance data published source revision two;
2. the reviewed AAL2 mutation accepted a refresh at projection revision two;
3. the durable worker claimed the exact allowlisted event;
4. source revision two was applied to the exact student projection;
5. projection revision advanced from two to three;
6. the final payload reported two lessons, zero attendance alerts, one upcoming assessment and one published grade;
7. lesson and result arrays contained only selected-campus sections;
8. no attendance exception remained after the correction;
9. capabilities were exactly `timetable.self.read`, `attendance.self.read` and `records.self.read`;
10. source, composition, command, applied-command and audit evidence retained consistent scope and revisions.

## Review state

PR #72 was mergeable, contained no unresolved review threads and had no submitted reviews. It was marked ready and squash merged with expected-head protection only after final canonical CI passed.

The final runtime diff contained exactly nine runtime, test and database files. Temporary authoring scripts and workflow changes were removed and canonical CI was restored before final verification.

## Production boundary

No composer credential, production persona mapping, production student identity, profile, enrollment or roster data, production composition run, source population, database or Worker binding, schedule activation, real identity-provider login, public composer endpoint or production promotion was introduced.

Production activation still requires approved provider credentials and origins, reviewed database and Worker bindings, secure mapping/publisher/composer credentials, approved production identity and academic data, reviewed composition cadence and monitoring, recovery rehearsal, owner UAT, security sign-off and explicit production authorization.
