# Integration Runtime

## Public API and versioning

The first public integration contract is OpenAPI `3.1.0`, product API version `1.0.0`. Published specifications are immutable; a breaking contract requires a new version and a coexistence/deprecation window. The source-controlled artefact is:

`packages/modules/integrations/openapi/v1.0.0.json`

The initial contract exposes connection health, external-identifier resolution and dead-letter replay operations. Every operation declares a tenant-scoped machine scope. Public routes must return stable error codes and must not expose credential digests, connector configuration internals or provider payloads outside the caller's permitted purpose.

## Scoped machine credentials

`IntegrationCredentialRegistry` issues a random credential value once and stores only its SHA-256 digest. Each record is bound to:

- one tenant;
- one integration connection;
- explicit scopes;
- explicit data categories;
- optional expiration;
- rotation and revocation evidence.

Authentication compares digests without ordinary early-exit string comparison, validates tenant, status and expiration, then enforces the required scope. Rotation preserves the key identifier while invalidating the previous value. Revocation requires a reason.

Production adapters must place credential values and webhook signing material in the deployment's managed encrypted binding or vault. PostgreSQL stores digests or key references, never plaintext values.

## External identifier ownership

An external identifier is unique within tenant, connection and object type in both directions:

- one internal object cannot silently point to multiple external records for the same connection;
- one external identifier cannot point to two internal objects;
- synchronization records provider version/etag, authority, status and last synchronization time;
- human-facing admission or student numbers are not treated as universal integration identifiers.

## Webhook authenticity and replay safety

Outbound signatures use HMAC-SHA-256 over:

```text
<unix_timestamp>.<exact_request_body>
```

The signature header format is:

```text
t=<unix_timestamp>,v1=<hex_digest>
```

Verification rejects malformed signatures, payload changes and timestamps outside the configured tolerance. The exact serialized body must be signed and delivered unchanged.

Inbound provider events are deduplicated by tenant, connection and provider event ID. The stored payload hash prevents a provider from reusing one event ID for different content. Concurrent duplicate processing shares the in-flight result rather than executing the domain handler twice.

Outbound deliveries are unique by tenant, subscription and event. Failed deliveries receive observable retry scheduling. Exhausted deliveries enter a dead-letter state; an explicit replay resets attempts, increments replay evidence and retains the same delivery identity.

## Connection health

Connection health is derived from explicit checks or synchronization outcomes:

- `healthy`: most recent operation succeeded;
- `degraded`: failures exist but remain below the configured threshold;
- `down`: consecutive failures reached the threshold;
- `disabled`: tenant administration intentionally disabled the connection.

Health records retain last success, last failure, last error, failure count and check time. Health is operational evidence, not a substitute for reconciliation.

## Disclosure audit

Every data transfer records immutable evidence containing tenant, connection, direction, destination, data categories, purpose, record count, status, correlation ID and occurrence time. Disclosure events are append-only in both the application contract and PostgreSQL trigger policy.

The audit records what was transferred and why. It must not duplicate full sensitive payloads when category/count/reference evidence is sufficient.

## Database migration

`202607280102_INT-01_integration_runtime` creates the `integration` schema and these objects:

- immutable `api_spec`;
- tenant connections and scoped credential digests;
- external identifier mappings;
- webhook subscriptions, deliveries, retry/dead-letter state and inbound receipts;
- connection health;
- append-only disclosure events.

Every tenant-owned table uses forced row-level security through `app.tenant_id`. Pending and dead-letter deliveries have bounded operational indexes. Signing values are represented only by managed key references.

## Verification

Focused automated coverage includes:

- OpenAPI immutability and resolution;
- scope, rotation, expiration-ready and revocation behavior;
- external-ID uniqueness and synchronization evidence;
- signature authenticity and timestamp replay protection;
- inbound deduplication and event-ID collision rejection;
- retry, dead-letter and replay transitions;
- health thresholds and disclosure evidence;
- migration object, uniqueness, RLS-loop and append-only trigger contracts.
