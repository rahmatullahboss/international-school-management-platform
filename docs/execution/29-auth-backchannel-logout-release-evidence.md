# AUTH-07 Back-Channel Logout Release Evidence

## Candidate lineage

- Reviewed base: `e8ae5f4f0ae8ba97214ec7c53f2b7f970558fd4a`
- Branch: `auth/backchannel-logout-v1`
- Pull request: `#54`
- Implementation proof: `fd30d6bd7c56e745a83114722147e83605f01cdd`
- Main merge: `ace9f6f45e21468ae29a68f4ff741ac3994764af`

## TDD evidence

Separate red gates proved failures before implementation for:

- typed Logout Token cryptographic validation and unknown-key refresh;
- provider `sid` propagation and durable store contracts;
- form-encoded HTTP parsing, readiness and no-CORS fail-closed behavior;
- atomic replay insertion plus session revocation;
- retry after persistence outage;
- non-empty logout event rejection;
- malformed or oversized declared body rejection before body read.

## Root verification

Canonical CI run `30581812037` passed:

- clean dependency installation;
- formatting, lint and architecture boundaries;
- TypeScript project references;
- 117 test files passed;
- 602 tests passed, with one environment-dependent direct-Neon test skipped in the ordinary suite;
- all 40 canonical migrations replayed on fresh PostgreSQL;
- AUTH-03 and AUTH-07 post-integration migrations passed, producing 42 migration-ledger entries;
- atomic Logout Token processing, exact provider-session revocation, replay idempotency and function-only privileges passed;
- the direct-Neon test passed separately;
- Worker and web production builds;
- experience budgets, high-severity audit, licence and provenance gates;
- all Chromium browser journeys;
- execution-artifact validation.

## Cloudflare evidence

Cloudflare staging run `30581812029` passed:

- repository verification;
- API and web Worker deployment;
- readiness controls for typed Logout Tokens, durable replay denial, provider-session revocation and durable provider cache;
- `loginEnabled: false`;
- fail-closed `POST /auth/v1/backchannel-logout` with generic 503;
- `Cache-Control: no-store`;
- no `Access-Control-Allow-Origin` and no `Set-Cookie` on the provider route;
- existing browser-session/logout fail-closed behavior;
- existing signed pilot session and scoped snapshot flow;
- all role routes, PWA, offline and health checks.

## Security review

The final diff was reviewed for token substitution, algorithm/type downgrade, nonce acceptance, event confusion, issuer/audience mismatch, unknown-key refresh abuse, provider `sid`/`sub` over-revocation, replay races, durable-cache poisoning, browser CORS exposure and oversized-body handling.

Review found a merge-blocking reliability flaw in the initial persistence sequence: consuming the JTI before revocation could prevent a provider retry after a revocation outage. The final implementation replaces that sequence with one atomic database transaction. The corrective red tests failed before implementation and the complete gate passed afterward.

No critical or important introduced security issue remained at the verified final head.

## Gate outcome

`GATE-AUTH-BACKCHANNEL-LOGOUT-V1` passes for typed signed Logout Tokens, atomic durable replay/revocation, provider `sid`/`sub` session termination, function-only durable provider caching and fail-closed provider-facing HTTP handling.

A reviewed real provider and production bindings, database-backed permission evaluation, database-backed read models, safe mutations, monitoring, recovery rehearsal, owner-led UAT and explicit production authorization remain required.
