# AUTH-01 OIDC Trust Boundary Release Evidence

## Candidate lineage

- Reviewed base: `26e6f5b034dd62f0486f20d7f24194551b642191`
- Branch: `pilot/oidc-trust-boundary-v1`
- Pull request: `#46`
- Implementation proof candidate: `5d58706e119e34e72fee17d2a67be74428ad5ab3`

## Root verification

Root CI run `30515626535` passed all 21 canonical gates:

- clean dependency installation;
- formatting and lint;
- architecture boundaries;
- TypeScript project references;
- 534 repository tests passed, with one environment-dependent direct-Neon test skipped in the ordinary suite;
- all 40 canonical migrations replayed on fresh PostgreSQL;
- the direct-Neon test passed separately against the configured live Neon branch;
- Worker and web production builds;
- initial and total experience asset budgets;
- dependency audit and licence policy;
- provenance generation without tracked drift;
- all 22 Chromium browser journeys;
- execution-artifact validation.

## Cryptographic and authorization evidence

Executable tests prove:

- valid 2048-bit RSA `RS256` signatures are accepted;
- `alg=none` and incompatible algorithms are rejected;
- missing `kid`, unknown signing keys and tampered signatures are rejected;
- issuer, audience, `azp` and nonce mismatches are rejected;
- expired, future and excessive-lifetime ID tokens are rejected;
- AAL2 is derived from trusted authentication claims only;
- suspended, revoked and unknown memberships are rejected;
- tenant and campus ambiguity requires explicit selection;
- cross-tenant and cross-campus scope is rejected;
- membership identifiers cannot be rebound;
- browser cookies are host-prefixed, HTTP-only, secure and same-site;
- weak session keys, tampering, wrong keys and expiry are rejected;
- secure logout deletion is explicit;
- API session introspection accepts cookie context only.

## Cloudflare evidence

Cloudflare staging run `30515626541` passed:

- repository verification;
- API Worker deployment;
- web Worker deployment;
- non-sensitive OIDC readiness smoke;
- fail-closed unconfigured browser-session smoke;
- signed PILOT-03 session and scoped snapshot smoke;
- admin, teacher, guardian and student route smoke;
- manifest, offline page and API health smoke.

The readiness endpoint reports `loginEnabled: false`. No approved provider, membership source, transaction signing key or browser-session key was deployed.

## Performance evidence

- Initial JavaScript: 208,406 bytes / 250,000-byte limit
- Initial CSS: 15,022 bytes / 50,000-byte limit
- Total route JavaScript: 299,838 bytes / 350,000-byte limit
- Total route CSS: 73,158 bytes / 85,000-byte limit
- Violations: none

## Gate outcome

`GATE-OIDC-TRUST-BOUNDARY-V1` passes for the provider-neutral cryptographic, membership and browser-session contract.

This gate does not authorize real login or production identity. Authorization Code + PKCE transactions, callback and token exchange, approved provider credentials, JWKS retrieval and rotation, database-backed membership resolution, revocation, step-up initiation, monitoring, rollback, owner-led UAT and explicit production authorization remain required.
