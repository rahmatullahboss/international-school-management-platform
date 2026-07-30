# AUTH-03 Durable Identity Context Release Evidence

## Candidate lineage

- Reviewed base: `84b637f6b5080476b2a015cf938fe8d2c60d1e3f`
- Branch: `pilot/auth-durable-context-v1`
- Pull request: `#48`
- Implementation proof: `9886f41d198772c684d3b245258964d4bcb0e83c`

## Root verification

Root CI run `30530441477` passed every canonical gate plus the AUTH-03 post-integration migration gate:

- clean dependency installation;
- formatting and lint;
- architecture boundaries;
- TypeScript project references;
- 565 repository tests passed, with one environment-dependent direct-Neon test skipped in the ordinary suite;
- all 40 canonical migrations replayed on fresh PostgreSQL;
- AUTH-03 replayed separately as the 41st migration-ledger entry;
- durable replay, membership, session registration and revocation SQL probes passed under `app_runtime`;
- the direct-Neon test passed separately against the configured live Neon branch;
- Worker and web production builds;
- initial and total experience asset budgets;
- dependency audit and licence policy;
- provenance generation without tracked drift;
- all 22 Chromium browser journeys;
- execution-artifact validation.

## Database security evidence

Fresh PostgreSQL verification proves:

- direct access to durable auth tables is denied to `app_runtime`;
- the first valid OAuth transaction consumption succeeds;
- replay and expired transactions are denied;
- exact issuer-and-subject membership projection returns only the active tenant, campus and role context;
- a valid browser session can be registered once;
- duplicate session ids are denied;
- explicit single-session revocation makes the session inactive;
- removal of a bound role invalidates an otherwise unexpired session;
- account-wide revocation invalidates remaining active sessions;
- the migration records exactly one `AUTH-03` ledger entry without modifying the frozen 40-migration manifest.

## Application evidence

Executable Worker and policy tests prove:

- database response rows are strictly validated;
- malformed UUIDs and malformed role arrays fail closed;
- replay-store exceptions become sanitized service-unavailable responses;
- membership-store exceptions become sanitized service-unavailable responses;
- browser-session registration is mandatory before a cookie is released;
- registration failure prevents successful login completion;
- signed-cookie introspection also requires a live durable registry record;
- revoked registry entries return an unauthenticated response;
- missing registry configuration returns service unavailable rather than trusting the cookie alone;
- provider tokens and database details remain absent from browser-facing results.

## Cloudflare evidence

Cloudflare staging run `30530441742` passed:

- repository verification;
- API and web Worker deployment;
- durable replay-ledger readiness control;
- database-membership-projection readiness control;
- browser-session-registry and revocation readiness controls;
- exact generic missing-configuration categories;
- `loginEnabled: false`;
- fail-closed browser-session verification without an approved registry configuration;
- existing signed pilot session and scoped snapshot flow;
- all role routes, PWA manifest, offline page and API health.

No real provider, provider credential, production database binding, durable staging identity record, browser-session key or public login route was enabled.

## Performance evidence

- Initial JavaScript: 208,406 / 250,000 bytes
- Initial CSS: 15,022 / 50,000 bytes
- Total route JavaScript: 299,838 / 350,000 bytes
- Total route CSS: 73,158 / 85,000 bytes
- Violations: none

## Gate outcome

`GATE-AUTH-DURABLE-CONTEXT-V1` passes for durable OAuth replay protection, database-backed identity membership projection, browser-session registration, active-session checks and revocation contracts.

Real login remains disabled. Reviewed provider configuration, public login/callback routing, production secret management, provider logout/revocation, refresh-token governance, step-up initiation, monitoring, backup and rollback rehearsal, owner-led UAT and explicit production authorization remain required.
