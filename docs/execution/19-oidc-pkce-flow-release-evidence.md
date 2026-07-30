# AUTH-02 Authorization Code and PKCE Release Evidence

## Candidate lineage

- Reviewed base: `48f3fb311a60b87faad3ec4f643b4a32b323099f`
- Branch: `pilot/oidc-pkce-flow-v1`
- Pull request: `#47`
- Implementation proof: `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`

## Root verification

Root CI run `30517446940` passed all 21 canonical gates:

- clean dependency installation;
- formatting and lint;
- architecture boundaries;
- TypeScript project references;
- 557 repository tests passed, with one environment-dependent direct-Neon test skipped in the ordinary suite;
- all 40 canonical migrations replayed on fresh PostgreSQL;
- the direct-Neon test passed separately against the configured live Neon branch;
- Worker and web production builds;
- initial and total experience asset budgets;
- dependency audit and licence policy;
- provenance generation without tracked drift;
- all 22 Chromium browser journeys;
- execution-artifact validation.

## Transaction and callback evidence

Executable tests prove:

- high-entropy state, nonce and verifier generation;
- exact S256 challenge derivation;
- secure signed host-only transaction cookie behavior;
- safe relative return-path enforcement;
- state and authorization-response issuer validation;
- expiry, tampering and weak-key rejection;
- explicit transaction-cookie deletion on callback outcomes;
- transaction replay denial before another provider request.

## Provider and token evidence

Executable tests prove:

- exact issuer discovery validation;
- required Authorization Code, RS256 and S256 capabilities;
- redirect and malformed metadata denial;
- bounded JSON responses;
- bounded JWKS size and key count;
- RSA/RS256 signing-key filtering and unique key ids;
- confidential `client_secret_basic` code exchange;
- exact redirect URI and PKCE verifier transmission;
- no client secret in the form body;
- sanitized provider errors;
- malformed token-response denial;
- access, refresh and ID tokens withheld from browser-facing results.

## Orchestration evidence

The complete tested flow performs transaction validation, replay consumption, code exchange, JWKS retrieval, ID-token verification, membership resolution and secure browser-session issuance in that order. Wrong nonce, provider failure, replay and ambiguous membership fail closed without exposing provider tokens.

## Cloudflare evidence

Cloudflare staging run `30517446956` passed:

- repository verification;
- API and web Worker deployment;
- extended AUTH-02 readiness controls;
- exact generic missing-configuration categories;
- `loginEnabled: false`;
- fail-closed browser-session verification;
- existing signed pilot session and snapshot flow;
- all role routes, PWA manifest, offline page and API health.

No real provider, provider credential, replay source, membership source, browser-session key or public login route was enabled.

## Performance evidence

- Initial JavaScript: 208,406 / 250,000 bytes
- Initial CSS: 15,022 / 50,000 bytes
- Total route JavaScript: 299,838 / 350,000 bytes
- Total route CSS: 73,158 / 85,000 bytes
- Violations: none

## Gate outcome

`GATE-OIDC-PKCE-FLOW-V1` passes for the provider-neutral Authorization Code + PKCE, discovery, code-exchange and callback-orchestration contracts.

Real login remains disabled. A durable replay ledger, database-backed identity memberships, reviewed provider configuration, session revocation, refresh-token governance, step-up initiation, monitoring, recovery rehearsal, owner-led UAT and explicit production authorization remain required.
