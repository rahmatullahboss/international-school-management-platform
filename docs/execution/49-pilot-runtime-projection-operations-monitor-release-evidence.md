# PILOT-12 — Runtime Projection Operations Monitor Release Evidence

**Gate:** `GATE-PILOT-RUNTIME-PROJECTION-OPERATIONS-MONITOR-V1`  
**Result:** passed  
**Implementation head:** `d87297777ddac389fcfc983a260f0c146978c3c4`  
**Main merge:** `1106bc88cb3323de540b1d4b14c67b913ba02f5d`

## Test-first evidence

The initial checkpoint contained only monitor-boundary and database-adapter tests. CI `30679326523` passed formatting and failed strict lint on the intentionally unresolved implementation modules.

Tests verify:

- disabled behavior without storage access;
- exact input-key allowlisting and bounded integer thresholds;
- rejection of caller-supplied campus, membership and payload scope;
- sanitized privileged-store outages;
- exact positional invocation of the reviewed database function;
- acceptance of healthy, warning and critical snapshots;
- fixed true redaction/security controls;
- exact tenant matching, nonnegative counters and valid timestamps;
- rejection of extra fields, false redaction controls, cross-tenant responses, negative counts and secret-bearing responses.

## Verification lineage

- full authoring CI `30679744735` passed all gates and published the helper-free implementation;
- final canonical CI `30679892474` passed on exact head `d87297777ddac389fcfc983a260f0c146978c3c4`;
- runtime PR #74 was squash merged with expected-head protection as `1106bc88cb3323de540b1d4b14c67b913ba02f5d`.

The final canonical run passed formatting, strict lint, architecture boundaries, TypeScript, the complete application suite, all canonical and post-integration migrations, fresh-PostgreSQL projection monitoring contracts, live Neon, builds, experience budget, high-severity dependency audit, licences, provenance, tracked-artifact drift detection, the complete browser suite and execution-artifact validation.

Cloudflare staging was expectedly skipped because PILOT-12 adds no deployed route, binding or schedule.

## Migration evidence

The canonical manifest remains immutable at 40 migrations. The post-integration manifest contains twelve contiguous migrations through PILOT-12, producing 52 schema-migration ledger entries.

The PILOT-12 migration creates the no-login monitor role and `platform.read_runtime_projection_operations_snapshot(uuid, integer, integer)`, revokes execute from public and all application/mapping/publisher/composer roles, grants execute only to `app_projection_monitor`, and registers the PILOT-12 schema migration.

## Fresh-PostgreSQL evidence

An isolated tenant fixture proved exact counts for:

- one eligible allowlisted event;
- one future retry-scheduled allowlisted event;
- an unrelated event excluded from backlog metrics;
- one recent sanitized invalid-event dead letter;
- one current source that was stale and unapplied;
- two uniquely mapped active memberships;
- one unmapped active membership;
- one ambiguously mapped active membership;
- one uniquely mapped membership missing a source.

The snapshot was classified critical, returned only aggregate counts and fixed controls, and contained no scoped membership identifier or payload collection. Invalid thresholds and an unknown tenant failed with exact controlled database errors.

## Privilege evidence

Fresh PostgreSQL verified that only `app_projection_monitor` can execute the function. The monitor role cannot directly select, insert, update or delete identity membership, persona mapping, outbox, source, applied-command or dead-letter tables.

## Review state

The final runtime diff contained exactly eight runtime, test and database files. Temporary authoring scripts and workflow changes were removed before final canonical verification. PR #74 contained no review threads or submitted reviews.

## Production boundary

No public monitoring endpoint, production monitor credential, production database or Worker binding, scheduled polling, alert destination, source reset/retry tooling or production promotion was introduced. Production activation remains subject to approved credentials, bindings, cadence, thresholds, alert ownership, escalation procedures, recovery rehearsal, owner UAT, security sign-off and explicit authorization.
