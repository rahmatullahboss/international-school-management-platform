# AUTH-01 — Provider-Neutral OIDC Trust Boundary

**Status:** `GATE-OIDC-TRUST-BOUNDARY-V1` passed on implementation proof candidate `5d58706e119e34e72fee17d2a67be74428ad5ab3`  
**Date:** 2026-07-30  
**Reviewed base:** `26e6f5b034dd62f0486f20d7f24194551b642191`

## Purpose

AUTH-01 replaces implicit identity assumptions with an executable, provider-neutral trust boundary before any real login is enabled. It establishes the cryptographic token, membership and browser-session contracts that an approved OpenID Connect provider must satisfy.

## OIDC token boundary

The policy package verifies ID tokens with WebCrypto and permits only `RS256`. Verification fails closed unless all of the following pass:

- exact configured issuer;
- expected client audience;
- `azp` equal to the client when multiple audiences are present;
- transaction-bound nonce;
- matching approved `kid` from the supplied JWKS;
- RSA signing key with compatible `alg` and `use` metadata;
- valid signature;
- integer `iat` and `exp` claims;
- valid optional `nbf`;
- bounded clock skew;
- maximum one-hour ID-token lifetime.

The verifier rejects unsigned, malformed, incorrectly signed, expired, future, excessive-lifetime, wrong-issuer, wrong-audience and wrong-nonce tokens. Assurance is derived only from trusted `acr` and `amr` claims; browser input cannot declare AAL2.

Provider configuration requires canonical absolute HTTPS endpoints. Local HTTP is accepted only for localhost test environments. The issuer must not contain a trailing slash.

## Membership boundary

A verified provider identity is resolved by exact `issuer + subject` against server-owned membership records. A membership contains:

- immutable membership id;
- internal principal id;
- tenant id;
- permitted campus ids;
- server-owned role ids;
- active, suspended or revoked status.

Unknown, suspended and revoked identities are denied. Multi-tenant identities require explicit tenant selection. Multi-campus memberships require explicit campus selection unless only one campus is available. Cross-tenant and cross-campus selection is denied, and roles are never accepted from browser input.

## Browser-session boundary

The production-oriented browser-session contract uses a signed `__Host-school_session` cookie with:

- `Path=/`;
- `HttpOnly`;
- `Secure`;
- `SameSite=Lax`;
- explicit short `Max-Age`;
- HMAC-SHA256 integrity;
- 30-minute default lifetime;
- 60-second minimum and eight-hour absolute maximum.

Session claims contain identity and membership identifiers, tenant, campus, role ids, assurance and timestamps. They intentionally exclude email, display name and provider tokens. Missing, malformed, tampered, wrongly signed, future and expired sessions fail closed. Logout has an explicit secure cookie-deletion contract.

## API boundary

The staging API exposes:

- `GET /auth/v1/readiness` — non-sensitive configuration categories and required security controls;
- `GET /auth/v1/session` — cookie-only session introspection returning safe internal scope.

Both responses are `Cache-Control: no-store`; session introspection also sends `Vary: Cookie`. The readiness response never reports configuration values or environment-variable names. Login remains disabled even when the provider-neutral contract is present.

## Cloudflare staging behavior

The staged Worker proves that:

- the readiness endpoint is available;
- all required controls are declared;
- no secret material or secret-labelled binding name is returned;
- auth state is `disabled` without approved provider and membership configuration;
- session introspection fails closed while its signing key is absent;
- the existing PILOT-03 synthetic session and role portals remain operational.

No real provider credentials or real identity data are deployed.

## Explicitly not enabled

AUTH-01 does not enable:

- authorization redirects or callback handling;
- PKCE transaction issuance;
- authorization-code exchange;
- remote discovery or JWKS fetching/caching;
- a client credential;
- a real membership adapter;
- refresh-token storage;
- production browser sessions;
- logout propagation or provider revocation;
- step-up initiation;
- production data or mutations.

Those capabilities require later gates and explicit owner-approved configuration.
