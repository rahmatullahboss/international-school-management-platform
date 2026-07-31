# PILOT-08 — Database-Owned Admin Runtime Projection Composer

**Status:** passed and merged to `main`  
**Runtime merge:** `7476fbfe8830ba98e3a7500165950f26b8bd1310`  
**Reviewed implementation head:** `22802925c2a38b355b0f219e762c6e18cc5cd1be`

## Objective

Introduce the first database-owned runtime snapshot composer for the admin `home` projection without accepting caller-authored payloads, exposing a browser route or activating production composition.

PILOT-08 composes one bounded and deterministic admin payload from authoritative enrollment, attendance and finance tables. It preserves exact tenant, membership and campus scope, derives the admin persona from the reviewed PILOT-07 mapping, publishes changed data only through the PILOT-07 source publisher and leaves the PILOT-05/06 command and worker lifecycle unchanged.

This is intentionally the first persona-specific composer rather than a generic payload engine. Teacher, guardian and student compositions remain separate future contracts.

## Least-privilege composer role

The migration creates `app_projection_composer` as `NOLOGIN` and `NOBYPASSRLS`.

The role receives:

- schema usage needed to invoke the reviewed function;
- execute authority only on `platform.compose_admin_runtime_projection_source(...)`.

The role receives no direct select, insert, update or delete privilege on:

- identity and persona-mapping tables;
- enrollment, attendance or finance source tables;
- runtime projection source, publication or composition-evidence tables.

It cannot configure mappings or invoke the lower-level PILOT-07 publisher directly. `app_runtime`, `app_projection_admin` and `app_projection_publisher` cannot execute the composer.

No credential for `app_projection_composer` is introduced by this milestone.

## Exact composition input

The privileged boundary accepts only:

- tenant identifier;
- membership identifier;
- nullable campus identifier;
- exact expected previous source revision;
- composer identifier;
- correlation identifier.

The caller cannot submit:

- a projection payload;
- persona or role;
- subject identity;
- capabilities;
- tenant, membership or campus scope embedded inside payload data;
- arbitrary projection keys.

The TypeScript boundary enforces the exact key allowlist and validates UUIDs, the non-negative expected revision and the bounded composer identifier before any database query.

## Database-owned identity and persona

The composition function locks and verifies:

- the exact active membership;
- the exact campus, including reviewed null-campus equivalence;
- the linked account is not disabled;
- the current reviewed role-to-persona mappings.

Composition proceeds only when the membership resolves to exactly one persona and that persona is `admin`. Unmapped, conflicting or non-admin role state fails closed as `persona-not-admin`. Inactive identity or membership scope fails as `scope-inactive`.

Neither the caller nor an intermediate application object can override this decision.

## Authoritative data sources

The admin payload is generated from reviewed canonical tables:

- active students from `student_lifecycle.enrollment`;
- open attendance sessions from `attendance.attendance_session`;
- unmatched bank lines from `billing.bank_statement_line`;
- open cashier sessions from `billing.cashier_session`.

Campus-local date is derived from the canonical campus time zone. Finance rows are constrained to the campus legal entity when campus scope is present. Tenant-level null-campus composition uses the exact tenant-wide scope selected by the membership.

No data is read through browser-provided filters.

## Deterministic payload contract

The generated JSON object contains:

- `schemaVersion: 1`;
- `view: admin-home`;
- tenant- or campus-level summary scope;
- database-derived local date;
- four ordered metrics;
- ordered actionable exceptions;
- source marker `database-admin-composer-v1`.

The four metrics are:

1. current active students;
2. open attendance sessions for the local date;
3. unmatched bank statement lines;
4. open cashier sessions.

Attendance and finance exceptions are included only when their authoritative counts are non-zero. Each item carries reviewed labels, definitions, routes and capability metadata for the existing read-model consumer.

The composer does not copy arbitrary domain records, confidential student details or unrestricted finance data into the projection.

## Revision and unchanged lifecycle

The composer requires the exact previous source revision. A stale expectation returns `revision-conflict` with the current source revision and does not mutate source or evidence.

The composed JSON is serialized deterministically and hashed with SHA-256. When the digest matches the current source payload:

- the source revision does not advance;
- the PILOT-07 source publisher is not called;
- no new source-publication row is created;
- an append-only composition run is recorded with state `unchanged`;
- an audit event records the no-op decision.

When authoritative data changes, the composer calls the reviewed PILOT-07 publisher with the exact expected source revision. The publisher owns payload-size and digest integrity and advances the source revision exactly once.

## Composition evidence

`platform.runtime_projection_composition_run` records each successful `published` or `unchanged` run with:

- exact tenant, membership and campus scope;
- expected previous and resulting source revisions;
- payload digest and byte count;
- composer and correlation identifiers;
- composition timestamp.

The table is append-only. Direct table access is denied to public, runtime, mapping, publisher and composer roles.

Every successful run also emits `runtime.projection.admin.composed` into the append-only audit stream.

## Runtime adapter

`composeAdminRuntimeProjection(...)`:

- returns `composer-disabled` without invoking storage when not explicitly configured;
- rejects malformed or expanded inputs as `invalid-composition`;
- sanitizes database or credential failures as `composer-unavailable`.

`DatabaseAdminProjectionComposerStore` invokes only `platform.compose_admin_runtime_projection_source(...)`, requires exactly one row and validates the complete accepted or rejected response. Unknown states, reasons, malformed identifiers, invalid digests, invalid byte counts or ambiguous cardinality fail closed.

The adapter is exported for privileged server-side orchestration only. No Hono route or browser-accessible endpoint was added.

## End-to-end proof

Fresh PostgreSQL verification established this lifecycle:

1. existing reviewed source revision two and projection revision nine were present;
2. authoritative enrollment, attendance and finance fixtures were inserted;
3. the first composition published source revision three;
4. a second composition over unchanged data retained source revision three and recorded `unchanged`;
5. finalizing the attendance session changed the deterministic digest;
6. the next composition published source revision four;
7. stale source revision, conflicting persona and suspended membership attempts failed without mutation;
8. `app_runtime` submitted the reviewed AAL2 refresh command for projection revision nine;
9. the PILOT-06 worker applied source revision four;
10. the runtime projection advanced from revision nine to ten with one active student, zero open attendance sessions, one unmatched bank line and one open cashier session;
11. source-publication, composition-run, command, applied-command and audit evidence remained consistent.

## Explicit exclusions

PILOT-08 does not:

- expose a public composer endpoint;
- create a production composer credential;
- configure production persona mappings;
- compose or publish production tenant data;
- provide teacher, guardian or student composers;
- create a general-purpose query or payload language;
- activate database, Worker or source bindings;
- activate the Cloudflare Cron Trigger;
- enable real identity-provider login;
- replace monitoring, backup/restore rehearsal, owner UAT, security approval or explicit production authorization.