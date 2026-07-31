# PILOT-07 — Controlled Runtime Projection Source Publisher Release Evidence

**Gate:** `GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1`  
**Result:** passed  
**Implementation head:** `0ae5b782adb2443d74fafdf4c191638b949d379d`  
**Main merge:** `1321466a690c1f70be4d1528ed7015f029083302`

## Test-first evidence

The first checkpoint added publisher-boundary and database-adapter tests before either implementation module existed. After canonical formatting, strict lint failed on the intentionally unresolved modules. This provided the behavioral red gate before implementation.

The final tests cover:

- disabled publication without a database call;
- strict exact-shape UUID, revision, timestamp and publisher validation;
- empty, oversized and browser-scope-bearing payload rejection;
- accepted and rejected database result validation;
- sanitized unavailable-store behavior;
- malformed or ambiguous database response rejection;
- exact reviewed database-function invocation.

## Canonical verification

Canonical CI run `30648006915` passed on the exact reviewed head.

- format check: passed;
- strict lint: passed;
- architecture boundaries: passed;
- TypeScript: passed;
- ordinary suite: 127 files passed and one environment-dependent Neon file skipped;
- ordinary tests: 662 passed and one environment-dependent test skipped;
- live Neon direct-driver gate: one file and one test passed separately;
- canonical Wave 2 migrations: passed;
- post-integration publisher and projection lifecycle: passed;
- all Worker, web and module builds: passed;
- experience budget: passed with no violations;
- dependency audit: zero vulnerabilities;
- licence and provenance checks: passed for 342 packages;
- tracked artifact drift: none;
- browser journeys: 22 passed;
- execution-artifact validation: passed.

The Cloudflare staging workflow was expectedly skipped because PILOT-07 changes only a privileged non-HTTP database publication contract and introduces no deployed route or binding.

## Database migration evidence

The immutable canonical manifest remains at 40 migrations. The post-integration manifest contains seven contiguous migrations:

1. AUTH-03 durable identity context;
2. AUTH-07 back-channel logout;
3. AUTH-08 database permission evaluation;
4. PILOT-04 database read models;
5. PILOT-05 safe runtime mutation;
6. PILOT-06 durable projection worker;
7. PILOT-07 controlled source publisher.

Fresh PostgreSQL verified 47 total schema-migration ledger entries.

The PILOT-07 migration creates:

- `app_projection_admin`;
- `app_projection_publisher`;
- `platform.runtime_projection_persona_role`;
- `platform.runtime_projection_persona_role_event`;
- `platform.runtime_projection_source_publication`;
- `platform.configure_runtime_projection_persona_role(uuid, uuid, text, text)`;
- `platform.publish_runtime_projection_source(uuid, uuid, uuid, bigint, jsonb, timestamptz, text, uuid)`.

## Privilege evidence

Positive and negative probes verified:

- both privileged roles are no-login and cannot bypass RLS;
- `app_projection_admin` can execute only the reviewed mapping function;
- `app_projection_publisher` can execute only the reviewed publication function;
- `app_runtime` can execute neither function;
- public, runtime, administrator and publisher roles have no direct access to governance/publication tables;
- `app_runtime` continues to have no direct access to durable auth, projection source, applied-command or dead-letter tables;
- security-definer functions use fixed search paths.

## Mapping and identity evidence

The database probes verified:

- an existing role can be mapped to a reviewed persona;
- each mapping change appends configuration history;
- an unmapped membership fails closed;
- roles resolving to conflicting personas fail as `persona-ambiguous`;
- inactive membership or disabled identity state fails as `scope-inactive`;
- campus scope must match exactly;
- persona is derived only from current reviewed mappings;
- subject reference is derived from the linked person, with durable account fallback;
- persona and subject cannot be injected through the payload.

The isolated verification database intentionally retains the temporary referenced role after removing its membership assignment. This preserves append-only mapping history and its foreign-key evidence rather than deleting governance history.

## Source integrity and revision evidence

The publication probes verified:

- first source publication requires expected previous revision zero;
- every accepted publication advances source revision exactly once;
- stale expected revision returns `revision-conflict` and the current revision;
- source timestamps cannot move backwards;
- timestamps materially in the future are rejected;
- empty or non-object payloads are rejected;
- payloads over 262,144 bytes are rejected;
- tenant, membership, campus, role, persona, subject and capability keys are rejected from payload data;
- the integrity trigger owns payload digest and byte calculation;
- each accepted source revision produces exactly one append-only publication record and one audit event.

## Publisher-to-worker lifecycle evidence

The final fresh-PostgreSQL probe exercised the reviewed runtime path end to end:

1. source revision one was published for the exact active admin membership;
2. negative revision, scope and freshness cases were denied without source mutation;
3. source revision two was published with a new payload;
4. the AAL2/current-grant safe mutation function accepted one refresh command at projection revision eight;
5. the durable worker claimed only the allowlisted event;
6. the worker copied source revision two into the exact projection;
7. the projection advanced from revision eight to nine;
8. the applied-command, command receipt, source publication and audit evidence remained consistent;
9. unrelated events and tenant scopes remained untouched.

## Runtime adapter evidence

The final TypeScript tests verified:

- exact input-key allowlisting;
- pre-query rejection of invalid identifiers, revision, publisher and timestamp;
- payload byte measurement before publication;
- caller-supplied scope denial;
- exact positional database parameters;
- accepted result validation including persona, derived subject, digest, bytes, revision and timestamps;
- bounded rejection-reason validation;
- configured-store exceptions sanitized without leaking SQL, credentials or payload data;
- malformed response cardinality or shape rejected.

No public HTTP route was introduced.

## Review state

PR #64 was mergeable, contained no unresolved review threads and had no submitted reviews. It was marked ready and squash merged with expected-head protection only after canonical CI passed on `0ae5b782adb2443d74fafdf4c191638b949d379d`.

The final runtime diff contained exactly eight runtime, test and database files. All temporary authoring scripts and workflows were removed before final canonical verification.

## Production boundary

No publisher credential, production persona mapping, production source row, production database binding, Worker source activation, Cloudflare schedule activation, real identity-provider login, public publisher endpoint or production promotion was introduced.

Production activation still requires:

- approved identity-provider/client credentials and production origins;
- reviewed production database and worker-source bindings;
- secure credentials for the narrowly scoped publisher and mapping roles;
- approved production persona mappings;
- reviewed domain-owned snapshot composers and source publication cadence;
- a Cloudflare token authorized to publish the intended schedule;
- outbox, source freshness, retry and dead-letter monitoring;
- backup, restore and rollback rehearsal;
- owner UAT and security sign-off;
- explicit production authorization.