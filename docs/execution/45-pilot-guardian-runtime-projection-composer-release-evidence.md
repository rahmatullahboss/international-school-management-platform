# PILOT-10 — Database-Owned Guardian Runtime Projection Composer Release Evidence

**Gate:** `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1`  
**Result:** passed  
**Implementation head:** `d59334952813afafd00b2ddf4ae9b5e06d5f3286`  
**Main merge:** `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`

## Test-first evidence

The initial checkpoint added guardian-composer boundary and database-adapter tests before implementation modules existed. Canonical formatting passed and strict lint failed on the intentionally unresolved modules in run `30660699184`.

Final tests cover:

- explicit disabled behavior without storage access;
- exact input-key allowlisting;
- UUID, safe-integer, non-finite revision, composer and correlation validation;
- rejection of null campus and caller-supplied payload, persona, guardian, children, authority and capability scope;
- sanitized privileged-store outages;
- exact positional invocation of the reviewed function;
- strict `published`, `unchanged` and bounded rejection responses;
- zero, multiple, malformed or ambiguous database responses failing closed.

## Verification lineage

- full authoring CI `30661567046` passed application, 50-migration lifecycle, live Neon, builds, audit and browser gates;
- guardian campus-lineage hardening CI `30662369824` passed adversarial same-child cross-campus attendance and grade isolation;
- final canonical CI `30662644211` passed on exact head `d59334952813afafd00b2ddf4ae9b5e06d5f3286`.

The final canonical run passed:

- formatting and strict lint;
- architecture boundaries and TypeScript;
- the complete application suite;
- all canonical and post-integration migrations;
- fresh-PostgreSQL guardian composition and worker lifecycle;
- live Neon serverless-driver verification;
- all Worker, web and module builds;
- experience budget, dependency audit, licences and provenance;
- tracked-artifact drift detection;
- the complete browser suite;
- execution-artifact validation.

Cloudflare staging was expectedly skipped because PILOT-10 adds no deployed route, binding or schedule.

## Migration evidence

The immutable canonical manifest remains at 40 migrations. The post-integration manifest contains ten contiguous migrations through PILOT-10, producing 50 schema-migration ledger entries.

The PILOT-10 migration:

- permits `guardian` in persona-tagged composition evidence while preserving admin and teacher rows;
- creates `platform.compose_guardian_runtime_projection_source(uuid, uuid, uuid, bigint, text, uuid)`;
- grants execute only to `app_projection_composer`;
- registers `202608010201_PILOT-10_guardian_runtime_projection_composer`.

## Privilege evidence

Fresh PostgreSQL verified:

- only `app_projection_composer` can execute the guardian function;
- `app_runtime`, `app_projection_admin`, `app_projection_publisher` and public cannot execute it;
- the composer role has no direct table privileges over identity links, guardian authority, enrollment, attendance, grade publication, billing or projection evidence;
- source publication and persona administration remain separately privileged;
- the security-definer function uses a fixed search path;
- composition evidence remains append-only.

## Identity and authority evidence

A separate guardian account, role, exact-campus membership, reviewed guardian mapping and AAL2 session were created.

Composition returned `guardian-unlinked` before an active person link existed. After the link was created, it returned `authority-unavailable` until a current verified portal authority was added.

The reviewed authority granted portal, education and billing access for one active exact-campus child. A pending same-campus authority and a verified cross-campus child were excluded.

## Authoritative family evidence

The exact-campus fixtures contained:

- one authorized active child;
- one current-day absent attendance record;
- one currently available grade publication;
- one active billing account held by the child;
- one responsible-party allocation to the guardian;
- one posted invoice with open balance `1,850,000` BDT minor units.

The first composition published source revision one with exact bounded metrics, one child and two exceptions.

## Education and billing separation

The composer derives separate child sets for education and billing authority:

- attendance and published grades use only education-authorized student profiles;
- finance uses only billing-authorized child person references plus a matching responsible-party row;
- portal-only authority permits child visibility but does not imply education or billing access.

The billing total is restricted to the exact campus legal entity and currency and weighted by the guardian's responsibility basis points.

## Campus-lineage hardening

Review found that student enrollment and denormalized attendance campus fields were insufficient to protect historical or inconsistent same-child rows.

The final function requires:

- attendance to resolve through the scheduled meeting and a published timetable in the exact campus;
- grade snapshots to resolve through a class pattern and published timetable in the exact campus.

Adversarial verification added:

- a same-child attendance record whose session claimed the selected campus but whose canonical timetable belonged to a second campus;
- a currently published grade for the same child in a second-campus section.

Neither row changed the exact-campus metrics. Full hardening run `30662369824` passed.

## Determinism and unchanged evidence

The first successful composition published source revision one. A second composition over unchanged rows:

- returned `unchanged`;
- retained source revision one;
- retained digest and byte count;
- did not add a source-publication row;
- appended one guardian composition run and audit event.

After the exact-campus attendance record changed from absent to present, the next composition published source revision two. Final evidence retained exactly two published runs and one unchanged run.

## Negative-case evidence

Fresh PostgreSQL verified:

- malformed and null-campus inputs fail as `invalid-composition`;
- missing guardian link fails as `guardian-unlinked`;
- absent, unverified or expired exact-campus authority fails as `authority-unavailable`;
- ambiguous persona fails as `persona-not-guardian`;
- stale source revision returns exact conflict evidence;
- unauthorized and cross-campus children remain excluded;
- same-child forged-campus attendance and grade rows remain excluded;
- denied cases do not publish source or append successful composition evidence;
- malformed database responses fail closed.

## Composer-to-worker lifecycle

The final probe established:

1. changed authoritative family data published source revision two;
2. the reviewed AAL2 mutation accepted a refresh at projection revision three;
3. the durable worker claimed the exact allowlisted event;
4. source revision two was applied to the exact guardian projection;
5. projection revision advanced from three to four;
6. the final payload reported one child, zero attendance alerts, one published grade and `1,850,000` BDT minor units open balance;
7. the child list contained only the exact authorized student profile;
8. the remaining exception was finance-only;
9. capabilities were exactly `student.household.read`, `attendance.household.read`, `records.household.read` and `finance.household.read`;
10. source, composition, command, applied-command and audit evidence retained consistent scope and revisions.

## Review state

PR #70 was mergeable, contained no unresolved review threads and had no submitted reviews. It was marked ready and squash merged with expected-head protection only after final canonical CI passed.

The final runtime diff contained exactly eight runtime, test and database files. Temporary authoring scripts and workflows were removed and canonical CI was restored before final verification.

## Production boundary

No composer credential, production persona mapping, production child authority, production composition run, source population, database or Worker binding, schedule activation, real identity-provider login, public composer endpoint or production promotion was introduced.

Production activation still requires approved provider credentials and origins, reviewed database and Worker bindings, secure mapping/publisher/composer credentials, approved production persona and authority data, reviewed composition cadence and monitoring, a separate student composer, recovery rehearsal, owner UAT, security sign-off and explicit production authorization.
