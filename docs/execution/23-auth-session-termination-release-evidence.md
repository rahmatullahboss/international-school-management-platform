# AUTH-04 Browser Session Termination Release Evidence

## Candidate lineage

- Reviewed base: `958b81a786b55286d0c41085d6258be17796ccd1`
- Branch: `pilot/auth-session-termination-v1`
- Pull request: `#49`
- Implementation proof: `ea9093af5e2707edf45fde73a19af371d01cb8ac`

## Root verification

Root CI run `30533390869` passed:

- clean dependency installation;
- formatting and lint;
- architecture-boundary checks;
- TypeScript project references;
- 575 repository tests passed, with one environment-dependent direct-Neon test skipped in the ordinary suite;
- all 40 canonical migrations replayed on fresh PostgreSQL;
- the AUTH-03 post-integration migration and revocation probes passed;
- the direct-Neon test passed separately against the configured live Neon branch;
- Worker and web production builds;
- initial and total experience asset budgets;
- dependency audit and licence policy;
- provenance generation without tracked drift;
- all 22 Chromium browser journeys;
- execution-artifact validation.

## Unit and route evidence

Executable tests prove:

- only exact configured HTTPS origins are accepted;
- an origin containing a path, trailing slash, credentials, query, fragment or HTTP scheme is invalid;
- untrusted origins and non-JSON requests are denied before registry access;
- preflight responses never use wildcard CORS and enable credentials only for an allowed origin;
- request bodies must contain only `scope` with value `current` or `all`;
- browser-supplied account identifiers and extra fields are rejected;
- a valid current-session request checks the registry, revokes the exact session and deletes the host cookie;
- an account-wide request derives the account id from the signed session and invokes account-wide revocation;
- missing cookies, revoked sessions and registry outages fail closed;
- an unavailable origin allowlist returns a generic service-unavailable response;
- no provider token, database URL, configured origin list or secret appears in the response.

## Cloudflare evidence

Cloudflare staging run `30533390917` passed:

- repository verification;
- API and web Worker deployment;
- readiness controls for exact-origin logout, account-wide logout and secure cookie deletion;
- exact generic `allowed-web-origins` missing configuration;
- `loginEnabled: false`;
- fail-closed `POST /auth/v1/logout` while staging has no approved browser origin or durable session configuration;
- fail-closed browser-session introspection;
- existing signed pilot session and scoped snapshot flow;
- all role routes, PWA manifest, offline page and API health.

The live smoke confirms the logout error code is generic and that no cookie or identity state is issued during an unconfigured request.

## Performance evidence

- Initial JavaScript: 208,406 / 250,000 bytes
- Initial CSS: 15,022 / 50,000 bytes
- Total route JavaScript: 299,838 / 350,000 bytes
- Total route CSS: 73,158 / 85,000 bytes
- Violations: none

## Gate outcome

`GATE-AUTH-SESSION-TERMINATION-V1` passes for origin-checked current-session logout, account-wide session revocation and secure local-cookie deletion.

Real provider login, public callback routes, production browser origins, production identity/database bindings, provider logout or back-channel revocation, refresh-token governance, step-up initiation, monitoring, recovery rehearsal, owner-led UAT and explicit production authorization remain required.
