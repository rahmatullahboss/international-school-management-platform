# 03 — API Contracts and Backend Coordination

## 1. Principle

Mobile is a versioned client of the existing Cloudflare Worker application platform. It never connects to Neon PostgreSQL, R2, queues or module tables directly. It does not infer business rules from database migrations.

The backend remains authoritative for:

- authentication/session validity;
- tenant, region and membership resolution;
- capability, relationship, class/campus scope and assurance decisions;
- finance, academic, attendance and enrollment invariants;
- masking, publication, retention and disclosure rules;
- audit, idempotency, concurrency and historical correction.

## 2. Contract ownership

- Domain modules own commands, queries, events and domain-specific read models.
- EXP-01 owns cross-module persona composition and journeys.
- FND-01 owns shared identity, policy, error, idempotency, observability, localization, notification and document primitives.
- MOB-01 owns generated mobile clients, repositories, local synchronization and app-facing presentation—not backend domain semantics.

When a required endpoint/read model does not exist, MOB-01 raises a contract-change request to the owning stream. It must not read private tables or duplicate logic locally.

## 3. Mobile API profile

The mobile profile is an explicitly versioned subset/composition of the platform API. It must provide:

### Session and bootstrap

- authenticated actor/account identifier;
- tenant membership and home region;
- available personas;
- active persona and permitted scopes;
- capability set and assurance level;
- feature entitlements;
- locale/time zone/country-pack version;
- device/session status;
- synchronization cursor/version;
- server time and minimum supported app/API versions.

### Queries

- bounded, paginated and permission-filtered;
- cache/freshness metadata where safe;
- stable opaque IDs;
- explicit publication/finalization/revision state;
- metric definition/source/timestamp for totals;
- data classification and offline eligibility metadata where required;
- no unauthorized counts or record-existence leakage.

### Commands

- explicit command type/version;
- idempotency key;
- actor, tenant, persona and device context resolved by server/session rather than trusted from payload;
- aggregate/version precondition where relevant;
- client timestamp as evidence only; server time is authoritative;
- stable result, retryability and reconciliation status;
- duplicate replay returns the original compatible result;
- conflicting reuse of an idempotency key fails.

## 4. Candidate endpoints

Exact paths are finalized through OpenAPI review; these names define required responsibilities, not permission to implement speculative APIs.

```text
GET    /v1/mobile/session-context
POST   /v1/mobile/persona/switch
GET    /v1/mobile/bootstrap
GET    /v1/mobile/sync/pull?cursor=...
POST   /v1/mobile/sync/commands
POST   /v1/mobile/devices/register
PATCH  /v1/mobile/devices/{deviceId}
DELETE /v1/mobile/devices/{deviceId}
GET    /v1/mobile/notifications
POST   /v1/mobile/notifications/{id}/read
POST   /v1/mobile/documents/{id}/download-intent
```

Feature queries/commands remain owned by their modules or EXP composition layer.

## 5. Error contract

Every error response includes:

- stable non-sensitive error code;
- localized message key/parameters or safe fallback message;
- correlation ID;
- retryable flag and optional retry-after;
- field validation details where safe;
- reconciliation/conflict reference where applicable;
- required assurance/action when step-up is needed;
- no sensitive resource existence in denied/not-found cases.

Client behavior is mapped by error code, not English message text.

Minimum categories:

- unauthenticated/session expired;
- membership/persona unavailable;
- forbidden or masked/not-found;
- assurance/step-up required;
- validation failed;
- stale version/conflict;
- duplicate-compatible result;
- idempotency mismatch;
- finalized/locked/published restriction;
- rate limited;
- temporary provider/service unavailable;
- unsupported client/API version;
- partial success/reconciliation required.

## 6. Versioning and compatibility

- OpenAPI is versioned and committed/generated in CI.
- Breaking changes require a new API version or additive migration/coexistence period.
- Mobile clients declare app version, build, platform and supported API profile.
- Backend publishes minimum-supported and recommended app versions without forcing an unsafe immediate update during offline work.
- At least one previous supported mobile version remains compatible during ordinary rollout.
- Old clients are blocked only through an approved security/compatibility decision with a safe user message and support route.
- Generated DTO snapshots and contract tests fail CI on unreviewed breaking changes.

## 7. Sync protocol

### Pull

Incremental pull returns:

- cursor and server snapshot/version;
- ordered upserts/tombstones or bounded resource changes;
- tenant/persona scope;
- server timestamp;
- reset/full-resync requirement when cursor is invalid;
- classification/offline policy needed by the client;
- no raw event stream or private module internals.

### Push

Command batch returns an item result for every submitted command:

- accepted/completed;
- duplicate with original result;
- retryable failure;
- permanent validation/authorization failure;
- conflict requiring user reconciliation;
- obsolete because resource/session was finalized or revoked.

Batch transport success does not imply every command succeeded.

## 8. Attendance contract requirements

Attendance offline sync must carry:

- attendance session ID and immutable roster/session reference;
- record/student opaque ID;
- local draft status and reason/evidence reference;
- per-command idempotency key;
- session/aggregate version or equivalent precondition;
- device/session correlation;
- client capture time and time-zone evidence;
- explicit server result: accepted, duplicate, conflict, finalized, assignment removed or session expired.

The server verifies teacher assignment, current session, codes, finalization and amendment rules. The client never silently overwrites a conflict.

## 9. Documents and files

- Upload begins with an authorized upload intent defining size/type/classification.
- Files use object storage through signed intents; mobile does not receive storage credentials.
- Malware/validation status is visible and upload completion is not equivalent to domain acceptance.
- Downloads require re-authorization and short-lived URLs or streamed access.
- Offline document retention is policy-driven and removable.
- File names, previews and push payloads do not leak sensitive information.

## 10. Notifications

The backend remains the notification authority. Mobile provides device-token registration and delivery interaction.

Push payload contains only:

- notification/event type;
- opaque notification ID;
- versioned route/deep-link identifier;
- optional non-sensitive localization key.

The app opens an authenticated route and fetches current authorized content. It handles foreground, background and terminated launches and rejects expired or unauthorized deep links.

## 11. Contract development during EXP-01

Parallel work is safe when:

- mobile consumes reviewed existing contracts or clearly marked provisional schemas;
- provisional schemas use fake/synthetic servers and cannot be mistaken for production authority;
- contract changes are proposed to EXP/domain owners rather than committed into their paths;
- generated clients are reproducible from a recorded schema SHA;
- feature work stops at the boundary when the server contract is missing.

After EXP-01 integration, the coordinator freezes the mobile API profile and records the exact reviewed schema/base for MOB-01 activation.

## 12. Required contract tests

- schema validation and code generation reproducibility;
- authentication, persona, relationship and class/campus negative cases;
- tenant isolation;
- pagination/bounds;
- error-code stability;
- idempotency duplicate and mismatch behavior;
- optimistic concurrency/conflict behavior;
- offline batch partial success;
- unsupported-version handling;
- signed document/upload intent expiry;
- notification deep-link authorization;
- old/new client compatibility during rolling release;
- synthetic import/export and recovery where mobile participates.
