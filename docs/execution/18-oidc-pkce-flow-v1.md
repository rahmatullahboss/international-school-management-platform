# AUTH-02 — Authorization Code and PKCE Flow

**Status:** `GATE-OIDC-PKCE-FLOW-V1` passed on implementation proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`  
**Date:** 2026-07-30  
**Reviewed base:** `48f3fb311a60b87faad3ec4f643b4a32b323099f`

## Purpose

AUTH-02 defines and verifies the complete provider-facing Authorization Code flow before any real provider is configured. The flow is provider-neutral, server mediated and deliberately fail-closed.

## Browser-bound authorization transaction

A login transaction contains:

- a 256-bit state value;
- a 256-bit OpenID Connect nonce;
- a 256-bit PKCE code verifier;
- the derived S256 challenge;
- the selected provider issuer;
- a safe same-origin return path;
- a unique transaction id;
- an issued-at time and short expiry;
- whether the provider requires the authorization-response issuer parameter.

The transaction is signed with HMAC-SHA256 and stored in `__Host-school_oauth` with `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` and an explicit maximum age. The default lifetime is five minutes, with a one-minute minimum and ten-minute maximum.

Return targets must be relative same-origin paths. External URLs, protocol-relative URLs, backslash ambiguity, NUL characters and excessive lengths are rejected.

## Callback and replay boundary

Callback verification requires:

- the browser-bound signed transaction cookie;
- an exact state match using constant-time comparison;
- an unexpired transaction;
- the exact authorization-response issuer when required or supplied;
- a valid authorization code;
- successful atomic transaction consumption before the provider token endpoint is contacted.

Every callback failure clears the transaction cookie. A consumed transaction cannot trigger another provider request.

## Provider discovery boundary

Discovery is fetched from the exact issuer `/.well-known/openid-configuration` URL using `redirect: error`, `cache: no-store` and a bounded JSON response.

Metadata is accepted only when:

- returned issuer exactly matches the configured issuer;
- authorization, token and JWKS endpoints are approved HTTPS URLs;
- Authorization Code is advertised;
- RS256 ID-token signing is advertised;
- S256 PKCE is advertised.

The discovery response is capped at 128 KiB.

## JWKS boundary

Signing keys are fetched without redirects or caching. The response must be JSON and is capped at 256 KiB and 20 keys. Only RSA signing keys compatible with RS256 are retained. Key ids must be present and unique.

Malformed responses, duplicate key ids, unsupported keys, excessive key sets, redirects and provider failures are denied.

## Authorization-code exchange

The code is exchanged server-side using confidential `client_secret_basic` authentication. The client secret is never placed in the request body. The exact redirect URI and PKCE verifier are included.

Token responses are capped at 256 KiB and must contain:

- a non-empty access token;
- exact `Bearer` token type;
- a positive integer expiry;
- a non-empty ID token.

Provider error details are sanitized. Access, refresh and ID tokens remain server-side and never appear in successful or failed browser-facing flow results.

## Complete login orchestration

The verified order is:

1. validate callback and signed browser transaction;
2. atomically consume the transaction id;
3. exchange the authorization code;
4. fetch bounded approved signing keys;
5. verify the ID-token signature, issuer, audience, nonce and timestamps;
6. resolve the server-owned tenant/campus membership;
7. issue the secure `__Host-school_session` cookie;
8. clear the OAuth transaction cookie;
9. redirect only to the approved relative return path.

Ambiguous tenant or campus membership produces an explicit selection boundary instead of issuing a session.

## Staging behavior

The staged readiness endpoint declares all required BFF controls and generic missing configuration categories. It continues to report `loginEnabled: false`. No provider endpoint is contacted by live staging smoke tests, and no provider or application credential is deployed.

## Explicitly not enabled

AUTH-02 does not configure:

- a real provider;
- a real client credential;
- public login or callback routes;
- a durable transaction replay store;
- a database-backed membership adapter;
- refresh-token persistence;
- provider logout or token revocation;
- production browser-session keys;
- step-up initiation;
- production identity, data or mutations.
