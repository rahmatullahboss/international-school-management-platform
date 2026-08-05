# 03 — API Contract and Backend Readiness

## 1. Contract-first rule

Flutter depends on reviewed application APIs and bounded read models, never module tables. The web application and mobile applications may share platform APIs, but mobile-specific aggregation endpoints are permitted when they reduce round trips without duplicating domain rules.

Every endpoint remains tenant-, permission-, relationship-, assignment- and purpose-aware. Client-side capability checks are presentation controls only.

## 2. Required contract families

### 2.1 Session and capability

Minimum contract:

```text
GET  /v1/session/context
POST /v1/session/persona
GET  /v1/session/devices
POST /v1/session/devices/{id}/revoke
```

The session context returns opaque identifiers, active tenant/persona, available personas, campus/class/relationship scopes, capabilities, assurance level, locale, time zone, feature entitlements, session expiry and policy version.

The response must not expose unauthorized module names, counts or hidden-record existence.

### 2.2 Mobile bootstrap

```text
GET /v1/mobile/bootstrap?app=family|staff
```

Bootstrap is a bounded, cache-aware composition read model containing only frequently required shell information: tenant branding, current context, navigation capabilities, notification count, sync policy, minimum supported app version and safe feature flags.

It cannot become an unbounded dump of school data.

### 2.3 Family contracts

- household and authorized relationship summary;
- child-scoped timetable/calendar;
- attendance publication and absence submission;
- published result/report-card summary;
- billing statement/invoice/receipt reads and payment-session initiation;
- forms, consent, acknowledgements and response drafts;
- authorized documents and signed-download issuance;
- secure conversations and messages;
- notification inbox and preferences.

### 2.4 Staff contracts

- teacher assignment and timetable;
- class roster snapshot;
- attendance session and codes;
- attendance batch submission and reconciliation;
- permitted grade draft/read contracts;
- announcements, acknowledgements and messages;
- minimum-necessary student alerts;
- authorized upload and scan workflows.

### 2.5 Device and notification

```text
POST   /v1/mobile/devices
PATCH  /v1/mobile/devices/{id}
DELETE /v1/mobile/devices/{id}
GET    /v1/notifications
POST   /v1/notifications/{id}/read
```

Device registration stores provider token, app target, platform, app version, locale, notification permission state and a server-issued device identifier. Provider tokens are replaceable and never used as user identity.

## 3. Contract properties

All public/mobile endpoints define:

- version and deprecation policy;
- authentication and required assurance;
- tenant/persona/resource scope;
- request and response schema;
- data classification;
- pagination and bounds;
- cache policy and freshness;
- idempotency behavior;
- optimistic-concurrency behavior;
- stable error codes;
- audit/disclosure behavior;
- retry safety;
- rate limits;
- observability fields;
- synthetic examples with no real student data.

## 4. Versioning

Use additive evolution within a major API version. Breaking changes require a new version or a documented compatibility window.

Rules:

- generated clients pin an exact reviewed OpenAPI snapshot;
- server changes must pass backward-compatibility checks against supported app versions;
- fields are optional before clients depend on them;
- enum expansion must not crash old clients; unknown values map to a safe fallback;
- removal occurs only after telemetry shows unsupported app versions are outside policy;
- minimum supported app version is returned through bootstrap and controlled server-side;
- forced upgrade is reserved for security or incompatible-data events and has a reviewed UX.

## 5. Commands and idempotency

Commands that can be retried use an idempotency key bound to actor, tenant, endpoint and request fingerprint. Reusing a key with a different request fails.

Required examples:

- attendance batch submission;
- absence notice submission;
- form response submission;
- message send;
- payment-session initiation;
- document upload finalization;
- notification acknowledgement where duplicate events matter.

A successful duplicate returns the original result reference. A timeout with unknown outcome is recoverable through status/query endpoints.

## 6. Concurrency

Mutable resources expose version/ETag/precondition data. The server decides whether to accept, reject or reconcile.

The client must distinguish:

- retryable transport failure;
- stale version/conflict;
- finalized or locked resource;
- permission/relationship change;
- validation failure;
- partial batch acceptance;
- duplicate already processed.

Generic last-write-wins is prohibited for attendance, grades, forms requiring evidence, finance and sensitive records.

## 7. Error model

Errors include:

```text
code
message_key
correlation_id
retryable
field_errors[]
conflict_reference (optional)
required_assurance (optional)
```

Messages are localized client-side or supplied through approved localized keys. Errors do not reveal sensitive record existence, internal SQL, stack traces, policy implementation or credentials.

Stable categories include authentication, assurance, forbidden/masked, not found, validation, conflict, finalized, rate limited, maintenance, dependency unavailable, duplicate, payload too large and unsupported app version.

## 8. Pagination and payload budgets

Every collection is bounded. Prefer cursor pagination for changing lists and explicit date/range windows for timetable, attendance and messages.

The mobile contract defines payload budgets and low-bandwidth variants. Images, PDFs and large exports are not embedded in JSON. Documents use metadata plus short-lived authorized URLs.

## 9. Caching

Server responses declare whether they are:

- non-cacheable;
- memory-cacheable;
- encrypted-local-cache eligible;
- offline allowlisted;
- stale-readable with timestamp;
- invalidated by context or policy version.

Sensitive responses use restrictive HTTP cache headers. Client persistence is governed by the local-data classification document, not by HTTP cacheability alone.

## 10. OpenAPI and generated client pipeline

The canonical OpenAPI artifact is produced by the platform integration process. Mobile CI:

1. fetches or checks in the reviewed snapshot according to repository policy;
2. validates syntax and lint rules;
3. generates the Dart transport client deterministically;
4. fails on uncommitted generated differences;
5. runs compatibility and mock-server tests;
6. records contract SHA in build metadata.

Generated code is isolated under `core_api` and wrapped by narrow service interfaces.

## 11. Backend readiness matrix

| Mobile area | Required backend evidence before feature implementation |
|---|---|
| App shell | session, persona, capability, tenant branding and feature flags stable |
| Guardian | household/relationship and child-scoped reads stable |
| Student | own-student and publication contracts stable |
| Staff shell | teacher assignment/timetable contracts stable |
| Offline attendance | roster snapshot, session version, batch idempotency and reconciliation stable |
| Fees | statement/invoice/receipt reads and hosted payment initiation stable |
| Documents | classification, authorization, metadata and signed-download contract stable |
| Messaging | conversation membership, retention, send idempotency and delivery state stable |
| Push | notification event, preference, device and deep-link contracts stable |

A database migration or internal application service is not sufficient evidence.

## 12. Parallel development with EXP-01

Mobile foundation can use synthetic contract fixtures while EXP-01 continues. Each fixture must be replaced by a reviewed contract snapshot before a feature gate passes.

Feature streams may start independently after their exact contracts are reviewed; they do not need to wait for every web screen. Mobile release integration waits for the reviewed Wave 3 platform integration and successful cross-client journeys.

## 13. Contract change process

A mobile-blocking API change request records:

- requesting stream and checkpoint SHA;
- current contract and exact gap;
- compatible extension preferred;
- affected web/mobile versions;
- security/privacy and data-classification impact;
- migration/deprecation plan;
- tests and rollout evidence;
- owning platform module decision.

Mobile agents must not patch domain packages or read module tables to bypass a missing contract.
