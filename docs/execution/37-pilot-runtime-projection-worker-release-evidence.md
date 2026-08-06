# PILOT-06 — Durable Runtime Projection Worker Release Evidence

**Gate:** `GATE-PILOT-RUNTIME-PROJECTION-WORKER-V1`  
**Result:** passed  
**Implementation head:** `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829`  
**Main merge:** `a731f89fc4c6476580129ab0cd734e9250c0aa64`

## Test-first evidence

The initial behavioral red gate was committed before the worker and database store modules existed. Formatting passed and strict lint failed on the intentionally unresolved modules. The final implementation preserved those contracts and added scheduled-boundary, HTTP-readiness, database-integration and staging assertions.

The reviewed tests cover:

- disabled, incomplete and ready worker configuration;
- strict worker id, batch-size and retry-attempt validation;
- exact database function invocation and typed report validation;
- malformed and unavailable database responses;
- fail-closed scheduled execution and sanitized logging;
- no-store readiness with no cookie or CORS exposure;
- successful source application, duplicate delivery, retry and terminal dead-letter behavior;
- unknown-receipt terminal isolation without foreign-key rollback;
- unrelated outbox events remaining unclaimed.

## Canonical verification

Canonical CI run `30635344251` passed on the exact reviewed head.

- format check: passed;
- lint: passed;
- architecture boundaries: passed;
- TypeScript: passed;
- ordinary unit/integration suite: 125 files passed and one environment-dependent Neon file skipped;
- ordinary tests: 654 passed and one environment-dependent test skipped;
- live Neon direct-driver gate: passed separately;
- canonical Wave 2 migrations: passed;
- post-integration migration and projection-processing probes: passed;
- Worker and web builds: passed;
- experience budget: passed;
- high-severity dependency audit: zero vulnerabilities;
- licence and provenance checks: passed;
- tracked artifact drift: none;
- browser journeys: passed;
- execution-artifact validation: passed.

## Database evidence

The immutable canonical manifest remains at 40 migrations. The post-integration manifest now contains AUTH-03, AUTH-07, AUTH-08, PILOT-04, PILOT-05 and PILOT-06 in contiguous order, producing 46 verified schema-migration ledger entries on fresh PostgreSQL.

The PILOT-06 migration creates:

- `platform.runtime_projection_source`;
- `platform.runtime_projection_applied_command`;
- `platform.runtime_projection_dead_letter`;
- supporting deterministic-order indexes;
- `platform.process_runtime_projection_refresh_batch(text, integer, integer)`.

Positive and negative probes verified:

- exact allowlisted event selection;
- deterministic bounded `SKIP LOCKED` claiming;
- first valid source application advances the exact projection;
- source digest, byte count, scope and revision remain database-owned;
- duplicate delivery does not advance revision twice;
- one applied-command record is retained;
- missing source retries with bounded backoff and then dead-letters;
- unknown receipt terminally isolates without rolling back the dead-letter write;
- unrelated events remain pending and unclaimed;
- direct source/applied/dead-letter table access is denied to `app_runtime`;
- completion/dead-letter audit and outbox evidence is persisted;
- post-integration replay, ownership and migration-order rules remain intact.

## Concurrency and integrity review

The merged processor locks eligible outbox rows with `FOR UPDATE OF event SKIP LOCKED`, then locks the immutable command receipt before evaluating applied-command deduplication. It locks the exact projection revision before source application.

This ordering ensures:

1. independent workers can process different eligible events concurrently;
2. the same event cannot be claimed by two workers;
3. duplicate events for one command cannot both mutate the projection;
4. stale projection revisions cannot overwrite newer state;
5. source scope or integrity mismatches fail without applying payload data.

The unknown-receipt path was hardened before merge so an untrusted command id is not persisted through the dead-letter foreign key.

## Runtime and HTTP evidence

The final Worker tests verified:

- disabled execution returns zero counters and performs no database call;
- configured execution invokes the exact reviewed database function;
- unexpected database failures are sanitized;
- malformed reports are rejected;
- scheduled execution uses the Cloudflare `waitUntil` boundary;
- completion logs contain counters only and no token, digest, database URL or payload;
- `/auth/v1/runtime-projection-worker/readiness` returns the exact disabled contract in staging;
- readiness uses `Cache-Control: no-store`, no `Set-Cookie` and no `Access-Control-Allow-Origin`.

## Cloudflare staging evidence

Cloudflare deployment and live smoke run `30635344238` passed.

The live staging Worker and web application were deployed at:

- API: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev`;
- web: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev`.

The deployed projection worker readiness endpoint returned HTTP `200` with:

- state `disabled`;
- all reviewed controls enabled;
- missing configuration `database-url` and `runtime-projection-worker-source`;
- `Cache-Control: no-store`;
- no cookie;
- no CORS header.

Existing session, permission, read-model, mutation, logout and back-channel paths retained their expected fail-closed staging responses. Signed pilot session/snapshot flows, all persona routes, PWA manifest and offline surface passed live smoke.

### Cron publication limitation

Wrangler uploaded and deployed the Worker code, but the current Cloudflare account token could not publish the configured schedule through `/workers/scripts/international-school-platform-api-staging/schedules`.

The staging workflow was hardened to continue only when all of these facts are true:

1. Wrangler established the deployed Worker URL;
2. the only deployment failure is the exact schedules API failure;
3. the run records `STAGING_CRON_TRIGGER_STATE=unavailable`;
4. API, projection readiness, signed-session and web smoke tests still pass.

Any other Wrangler deployment failure remains fatal. The configured scheduled handler remains fail closed because database/source bindings are absent.

## Review state

PR #62 was mergeable, contained no unresolved review threads and had no submitted reviews. It was marked ready and squash merged with expected-head protection only after canonical CI and live Cloudflare staging smoke passed on `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829`.

## Production boundary

No source publisher, production database binding, production schedule, real identity-provider credential, production tenant/student data, production projection population, public login or production promotion was introduced.

Production activation still requires:

- approved identity-provider/client credentials and production origins;
- reviewed production database and worker-source bindings;
- source publishers into `runtime_projection_source`;
- a Cloudflare token authorized to publish the intended schedule;
- outbox, retry and dead-letter monitoring;
- backup, restore and rollback rehearsal;
- owner UAT and security sign-off;
- explicit production authorization.
