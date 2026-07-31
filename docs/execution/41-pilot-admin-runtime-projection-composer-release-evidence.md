# PILOT-08 — Database-Owned Admin Runtime Projection Composer Release Evidence

**Gate:** `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1`  
**Result:** passed  
**Implementation head:** `22802925c2a38b355b0f219e762c6e18cc5cd1be`  
**Main merge:** `7476fbfe8830ba98e3a7500165950f26b8bd1310`

## Test-first evidence

The first checkpoint added admin-composer boundary and database-adapter tests before either implementation module existed. Canonical formatting passed and strict lint failed on the intentionally unresolved modules in run `30650380670`. This established the behavioral red gate before implementation.

The final tests cover:

- explicitly disabled composition without a database call;
- exact input-key allowlisting;
- UUID, revision, composer and correlation validation;
- rejection of caller-supplied payload, persona and capabilities;
- nullable tenant-level campus scope preservation;
- sanitized privileged-store outages;
- exact reviewed database-function invocation;
- accepted `published` and `unchanged` evidence;
- bounded rejection reasons and revision-conflict evidence;
- malformed or ambiguous database response rejection.

## Canonical verification

Canonical CI run `30651595094` passed on the exact reviewed head.

The run completed successfully for:

- format check;
- strict lint;
- architecture boundaries;
- TypeScript;
- the complete application test suite;
- canonical and post-integration migration verification;
- the fresh-PostgreSQL composer and projection lifecycle;
- the separate live Neon serverless-driver gate;
- all Worker, web and module builds;
- experience-budget enforcement;
- dependency audit;
- licence and provenance generation;
- tracked-artifact drift detection;
- the complete browser journey suite;
- execution-artifact validation.

The Cloudflare staging workflow was expectedly skipped because PILOT-08 introduces no deployed route, binding or public surface.

## Migration evidence

The immutable canonical manifest remains at 40 migrations. The post-integration manifest contains eight contiguous migrations:

1. AUTH-03 durable identity context;
2. AUTH-07 back-channel logout;
3. AUTH-08 database permission evaluation;
4. PILOT-04 database read models;
5. PILOT-05 safe runtime mutation;
6. PILOT-06 durable projection worker;
7. PILOT-07 controlled source publisher;
8. PILOT-08 database-owned admin composer.

Fresh PostgreSQL verified 48 total schema-migration ledger entries.

The PILOT-08 migration creates:

- `app_projection_composer`;
- `platform.runtime_projection_composition_run`;
- `platform.compose_admin_runtime_projection_source(uuid, uuid, uuid, bigint, text, uuid)`.

## Privilege evidence

Positive and negative probes verified:

- `app_projection_composer` is no-login and cannot bypass RLS;
- only `app_projection_composer` can execute the reviewed composition function;
- `app_runtime`, `app_projection_admin` and `app_projection_publisher` cannot execute it;
- the composer role cannot execute the lower-level publisher or persona-mapping administrator functions;
- the composer role has no direct privileges on identity, domain-source, runtime-source, publication or composition-evidence tables;
- public and application roles have no direct access to composition evidence;
- the security-definer function uses a fixed search path.

## Authoritative composition evidence

The database probes inserted controlled fixtures for:

- one active enrollment in the exact campus;
- one open attendance session on the campus-local date;
- one unmatched bank statement line in the campus legal entity;
- one open cashier session in the same legal entity.

The first composition generated the reviewed admin payload and published source revision three. The payload contained the exact counts from those authoritative tables and did not accept a caller-authored JSON object.

The local date came from the canonical campus time zone. Finance counts were limited to the canonical campus legal entity. The composer selected only the bounded summary fields required by the admin home projection.

## Determinism and unchanged evidence

A second composition against unchanged domain rows:

- returned state `unchanged`;
- retained source revision three;
- retained the exact payload digest and byte count;
- did not add a PILOT-07 source-publication row;
- appended one composition-run row;
- appended one composition audit event.

After the attendance session changed from `open` to `finalized`, the deterministic payload digest changed. The next composition published source revision four and removed only the attendance exception from the bounded payload.

The final evidence contained exactly two `published` composition runs and one `unchanged` run.

## Negative-case evidence

Fresh PostgreSQL verified:

- a stale expected source revision returns exact `revision-conflict` evidence;
- conflicting persona mappings fail as `persona-not-admin`;
- a suspended membership fails as `scope-inactive`;
- denied cases do not advance the source revision or append successful composition evidence;
- the TypeScript boundary rejects expanded caller keys before querying;
- malformed database responses fail closed;
- composition-run evidence cannot be updated or deleted.

## Composer-to-worker lifecycle evidence

The final probe exercised the reviewed runtime chain end to end:

1. the composer published source revision four from authoritative data;
2. the AAL2/current-grant safe mutation function accepted one refresh command at projection revision nine;
3. the durable worker claimed only the exact allowlisted event;
4. the worker copied source revision four into the exact runtime projection;
5. the projection advanced from revision nine to ten;
6. the final payload reported one active student, zero open attendance sessions, one unmatched bank line and one open cashier session;
7. the final exceptions contained only the two remaining finance items;
8. the command receipt, applied-command row, source-publication row, composition-run rows and audit events retained consistent tenant, membership, campus, source-revision and projection-revision evidence.

## Runtime adapter evidence

The final TypeScript tests verified:

- exact composition input shape;
- campus-scoped and explicit null-campus input preservation;
- pre-query rejection of malformed identifiers and expanded inputs;
- exact positional database parameters;
- strict `published` and `unchanged` state validation;
- source revision, digest, byte-count and timestamp validation;
- bounded rejection-reason validation;
- configured-store exceptions sanitized without leaking SQL, credentials or domain data;
- zero, multiple or malformed database rows rejected.

No public HTTP route was introduced.

## Review state

PR #66 was mergeable, contained no unresolved review threads and had no submitted reviews. It was marked ready and squash merged with expected-head protection only after canonical CI passed on `22802925c2a38b355b0f219e762c6e18cc5cd1be`.

The final runtime diff contained exactly eight runtime, test and database files. All temporary authoring scripts and workflows were removed before final canonical verification.

## Production boundary

No composer credential, production persona mapping, production composition run, production source row, production database binding, Worker source activation, Cloudflare schedule activation, real identity-provider login, public composer endpoint or production promotion was introduced.

Production activation still requires:

- approved identity-provider/client credentials and production origins;
- reviewed production database and worker-source bindings;
- secure credentials for the narrowly scoped mapping, publisher and composer roles;
- approved production persona mappings;
- reviewed production admin metric definitions and source cadence;
- separate reviewed teacher, guardian and student composers where required;
- a Cloudflare token authorized to publish the intended schedule;
- source freshness, composition failure, outbox retry and dead-letter monitoring;
- backup, restore and rollback rehearsal;
- owner UAT and security sign-off;
- explicit production authorization.