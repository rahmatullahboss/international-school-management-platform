# AUTH-08 — Database Permission Release Evidence

**Gate:** `GATE-AUTH-DATABASE-PERMISSION-V1`  
**Result:** passed  
**Implementation head:** `6a1d49cc47ebae090470db4ee8c7c6f56953b514`  
**Main merge:** `3a81f7f32c794b18524f0050828300e76ad4df95`

## Test-first evidence

The authoring gates proved the following regressions failed before their implementations were applied:

- durable authorization from current database grants;
- malformed permission-key rejection;
- role removal and inactive-session denial;
- AAL1 denial with an explicit AAL2 step-up outcome;
- exact-origin credentialed authorization;
- rejection of browser-declared authorization scope;
- bounded chunked request-body streaming.

## Canonical verification

Canonical CI run `30601433379` passed on the final reviewed head.

- format check: passed;
- lint: passed;
- architecture boundaries: passed;
- TypeScript: passed;
- ordinary unit/integration suite: 118 files passed and one environment-dependent file skipped;
- ordinary tests: 613 passed and one environment-dependent test skipped;
- live Neon direct-driver test: passed separately;
- canonical Wave 2 migration verification: passed;
- post-integration AUTH migration and permission probes: passed;
- Worker and web builds: passed;
- experience budget: passed;
- high-severity dependency audit: passed;
- licence and provenance checks: passed;
- tracked artifact drift: none;
- browser journeys: 22 passed;
- execution-artifact validation: passed.

## Database evidence

The post-integration manifest contains three ordered AUTH migrations after the immutable 40-migration canonical manifest, for 43 verified ledger entries in a fresh PostgreSQL replay.

Negative and positive probes verified:

- an active exact-scope session with a current grant is allowed;
- an ungranted permission is denied;
- an AAL2 permission requested by AAL1 returns `step_up`;
- revoked or expired sessions are inactive;
- removed role bindings invalidate existing sessions and authorization;
- `app_runtime` has no direct authorization-table access;
- malformed database decisions are rejected by the durable store.

## Cloudflare staging evidence

Cloudflare deploy and smoke run `30601433411` passed.

The deployed staging API verified that `/auth/v1/authorize`:

- remains fail-closed with `permission_configuration_invalid` while reviewed production identity/database bindings are absent;
- returns `Cache-Control: no-store`;
- does not emit `Set-Cookie`;
- does not emit an authorization CORS header while configuration is incomplete;
- exposes only non-secret readiness controls;
- does not enable real login or production data access.

Existing API health, browser session, browser logout, provider back-channel logout, signed pilot session, scoped snapshot, web routes, PWA manifest and offline smoke checks also passed.

## Security review

The final diff review found no unresolved review threads or submitted reviews. A merge-blocking resource-control gap was found before merge: requests without `Content-Length` could otherwise be read without a byte cap. The final implementation streams request bytes with a strict 2 KiB limit and rejects unsupported media types before reading.

## Production boundary

No production deployment, real account, real tenant/student data, production database mutation, permission grant, provider credential, cache purge or destructive cleanup was introduced. Production activation still requires reviewed real-provider bindings, database-backed read models, safe mutation workflows, monitoring/recovery rehearsal, owner UAT and explicit authorization.
