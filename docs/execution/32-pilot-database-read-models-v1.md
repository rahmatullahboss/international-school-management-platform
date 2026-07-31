# PILOT-04 — Tenant-Safe Database Runtime Read Models

**Status:** passed and merged to `main`  
**Runtime merge:** `a81b0025d0427398a616b316dd96451d5e15bcaf`  
**Reviewed implementation head:** `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`

## Objective

Replace the synthetic-only runtime snapshot boundary with a durable, tenant-safe database projection contract without allowing the browser to select its own tenant, campus, membership, principal, role or projection scope.

A snapshot is available only when the signed browser session is active and its durable identity context still matches the current database membership and role bindings.

## Projection and integrity contract

`platform.runtime_read_model_projection` stores bounded home projections by exact tenant, membership and optional campus scope. The database enforces:

- one home projection for an exact tenant/membership/campus tuple;
- active foreign-key ownership by the tenant membership and campus;
- a positive revision;
- an object-shaped JSON payload;
- a maximum payload size of 256 KiB;
- trigger-maintained SHA-256 payload digest and byte count;
- restricted direct table privileges.

The digest and byte count are recomputed by the database on insert or update. Caller-supplied integrity metadata cannot override the stored values.

## Server-owned scope resolution

`platform.resolve_runtime_read_model_head` is a restricted `SECURITY DEFINER` function. It derives scope exclusively from the opaque session identifier recovered from the verified HttpOnly browser-session cookie and verifies:

1. the durable session exists, is unexpired and is not revoked;
2. the OIDC membership binding remains active and exactly matches the account, tenant, membership and campus recorded at issuance;
3. the account remains enabled;
4. the session role set still exactly matches the current membership-role bindings;
5. the current permission set is recomputed from current role grants;
6. an exact home projection exists for the resolved tenant/membership/campus scope.

`platform.read_runtime_read_model_payload` returns payload data only when the exact session, revision, payload digest and current-capability digest still match. Role or grant changes invalidate the previously resolved tuple.

`app_runtime` has execute permission on the reviewed functions and no direct projection-table access.

## HTTP boundary

`GET /auth/v1/snapshot`:

- requires a valid configured database read-model source;
- requires the exact configured web origin for browser CORS;
- requires a valid signed HttpOnly browser-session cookie;
- verifies durable session activity before resolving the projection;
- never accepts browser-provided authorization or tenancy scope;
- returns sanitized `401`, `404` or `503` failures;
- never sets an authentication cookie;
- uses `Cache-Control: private, max-age=0, must-revalidate` for successful snapshots and `no-store` for failures.

The matching `OPTIONS` route is credentialed and exact-origin only.

## Revision-bound ETags and bounded cache

The response ETag is an opaque SHA-256 value bound to:

- tenant, membership and campus scope;
- persona and subject reference;
- current sorted capabilities;
- projection revision;
- payload digest;
- current-capability digest.

The database head is resolved on every request. `304 Not Modified` is returned only after the current session, current roles, current grants and current projection tuple have been revalidated.

The isolate cache is bounded by entry count and lifetime and stores only payloads for an exact validated ETag tuple. It cannot bypass database head revalidation or reuse a payload after role, permission, revision or digest changes.

## Readiness controls

The provider-neutral readiness document exposes these non-secret controls:

- `databaseReadModels`;
- `tenantSafeReadModelScope`;
- `revisionBoundEtags`;
- `boundedServerSnapshotCache`;
- `currentGrantSnapshotRevalidation`.

`runtime-read-model-source` remains listed as missing until the reviewed database binding is configured.

## Explicit exclusions

PILOT-04 does not:

- populate production projection rows;
- activate a real identity provider or public login;
- authorize production data access or mutation;
- permit browser-selected tenant, campus, role or principal scope;
- return stale snapshots while the database or durable session registry is unavailable;
- authorize production promotion without owner UAT, security approval and explicit deployment authorization.
