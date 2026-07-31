# PILOT-04 — Database Runtime Read-Model Release Evidence

**Gate:** `GATE-PILOT-DATABASE-READ-MODEL-V1`  
**Result:** passed  
**Implementation head:** `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`  
**Main merge:** `a81b0025d0427398a616b316dd96451d5e15bcaf`

## Test-first evidence

The authoring gates proved the following contracts before final implementation acceptance:

- unresolved database store imports failed before the store implementation existed;
- exact session-scoped projection head and payload access;
- malformed, duplicate, unsorted or oversized store rows fail closed;
- browser scope cannot choose tenant, campus, membership, role, principal or projection key;
- private ETag and `304` behavior require current database head revalidation;
- capability changes produce a new ETag and bypass stale payload cache;
- bounded cache eviction and expiry;
- missing projection and head/payload races fail closed;
- unconfigured HTTP and staging routes return sanitized failures.

## Canonical verification

Canonical CI run `30605205955` passed on the final reviewed head.

- format check: passed;
- lint: passed;
- architecture boundaries: passed;
- TypeScript: passed;
- ordinary unit/integration suite: 120 files passed and one environment-dependent file skipped;
- ordinary tests: 626 passed and one environment-dependent test skipped;
- live Neon direct-driver test: passed separately;
- canonical Wave 2 migration verification: passed;
- post-integration AUTH/PILOT migration and negative probes: passed;
- Worker and web builds: passed;
- experience budget: passed;
- high-severity dependency audit: zero vulnerabilities;
- licence and provenance checks: 342 packages passed;
- tracked artifact drift: none;
- browser journeys: 22 passed;
- execution-artifact validation: passed.

## Database evidence

The immutable canonical manifest remains at 40 migrations. The post-integration manifest now contains AUTH-03, AUTH-07, AUTH-08 and PILOT-04 in order, for 44 verified ledger entries in a fresh PostgreSQL replay.

Positive and negative probes verified:

- an active exact-scope session resolves its own projection;
- a cross-tenant or cross-membership session cannot resolve the projection;
- current capabilities are sorted, distinct and database-derived;
- revision, payload-digest or capability-digest mismatch returns no payload;
- role removal invalidates an existing session projection;
- revoked or expired sessions cannot resolve a projection;
- the database trigger recomputes payload integrity metadata;
- oversized payloads are rejected;
- `app_runtime` has no direct projection-table access;
- only the reviewed security-definer functions are executable.

## HTTP and cache evidence

The final runtime tests verified that `/auth/v1/snapshot`:

- authenticates only through the signed HttpOnly browser-session cookie and durable registry;
- applies exact-origin credentialed CORS;
- returns private revalidation cache headers on success;
- binds the ETag to scope, revision, payload digest and current capability digest;
- resolves the database head on every request;
- returns `304` only after current identity and grant revalidation;
- reads a cached payload only for the exact validated tuple;
- fails closed on unavailable configuration, inactive identity, absent projection or head/payload races;
- does not expose the opaque session identifier or emit authentication cookies.

## Cloudflare staging evidence

Cloudflare deployment and live smoke run `30605205966` passed.

With production database/read-model bindings intentionally absent, the deployed staging snapshot route returned:

- HTTP `503`;
- error code `runtime_read_model_configuration_invalid`;
- `Cache-Control: no-store`;
- no `Set-Cookie`;
- no unintended `Access-Control-Allow-Origin` header.

Existing health, readiness, browser-session, database-permission, logout, provider back-channel logout, signed pilot snapshot, web-role, PWA manifest and offline smoke checks also passed.

## Security review

The final diff review found no unresolved review threads or submitted reviews and no merge-blocking authorization or cache issue.

The review confirmed:

- no browser-controlled authorization or tenancy scope;
- no direct runtime table privileges;
- no payload cache hit without current database head validation;
- no stale ETag after role, grant, revision or digest changes;
- no shared-cache response for identity-bound data;
- no production activation when the read-model source or database binding is absent.

## Production boundary

No real identity-provider credential, production tenant/student data, production projection population, production database mutation, public login, production domain binding or production promotion was introduced. Production activation still requires reviewed provider and database bindings, projection population/reconciliation procedures, monitoring and recovery rehearsal, owner UAT/security sign-off and explicit deployment authorization.
