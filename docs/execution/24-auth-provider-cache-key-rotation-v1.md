# AUTH-05 — OIDC Provider Cache and Signing-Key Rotation

**Status:** `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` passed on implementation proof `d8e60bc045265799d6ecf63da6a75e22c9287459`  
**Date:** 2026-07-31  
**Reviewed base:** `146589b2abc400fbfda5e8952ede55252f4c13c9`  
**Main merge:** `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`

## Purpose

AUTH-05 adds provider-discovery and signing-key cache governance on top of the provider-neutral Authorization Code + PKCE and durable browser-session contracts. It reduces provider dependency and supports safe signing-key rotation without enabling public login or a production identity provider.

## Provider endpoint origin policy

Provider discovery and JWKS access require an approved list of exact HTTPS origins. Each configured origin:

- must be an origin only, without credentials, path, query or fragment;
- must use HTTPS;
- must be represented canonically without a trailing slash variant;
- is checked against issuer, authorization, token and JWKS endpoints;
- is limited to a bounded number of entries.

A discovered endpoint outside the approved origins is denied. A later discovery response that changes a reviewed endpoint is denied until configuration and cache state are explicitly reviewed.

## Discovery cache

Discovery metadata is keyed by issuer, client id and redirect URI. The cache provides:

- bounded freshness derived from provider cache policy with minimum and maximum limits;
- conditional ETag revalidation;
- bounded stale-if-error use only for previously validated metadata;
- one shared network request for concurrent cache misses;
- no redirects and no shared HTTP cache use;
- fail-closed validation for malformed, poisoned, future-dated or overlong cache records.

Provider response, endpoint origin and cached configuration validation run before metadata is returned to the login flow.

## JWKS cache and rotation

Signing keys are keyed by issuer and JWKS URI. The cache:

- accepts only reviewed RSA signing keys compatible with RS256;
- enforces unique key identifiers;
- conditionally revalidates cached key sets;
- retains removed keys for a bounded overlap so already-issued tokens can finish their valid lifetime;
- expires retired keys after the overlap;
- rejects a reused `kid` carrying different key material;
- limits the combined active and retired key count;
- performs exactly one forced refresh when token verification reports an unknown `kid`;
- does not refresh after a known-key signature failure.

This separates legitimate rotation from signature tampering and prevents unbounded key retention.

## Durable-cache integrity

Persisted cache entries contain a schema version, exact scope, fetched time, fresh-until time and stale-until time. AUTH-05 validates that:

- timestamps are integers;
- the fetched timestamp is not in the future;
- the freshness duration is within the reviewed minimum and maximum;
- the stale interval is exactly the reviewed bounded interval;
- cached provider scope and key scope exactly match the current request;
- invalid entries fail closed instead of falling back to untrusted data.

## Readiness contract

The non-sensitive readiness response adds these control categories:

- `conditionalDiscoveryRevalidation`;
- `boundedJwksCache`;
- `boundedStaleIfError`;
- `unknownKidSingleRefresh`;
- `retiredKeyOverlap`;
- `kidReuseDenied`;
- `providerEndpointOriginPins`;
- `providerEndpointChangeReview`.

It also adds generic missing categories `provider-endpoint-origins` and `provider-cache-source`. No endpoint list, cache key, provider secret or durable binding value is returned.

## Staging boundary

Cloudflare staging deploys the provider-neutral readiness and verification code but does not configure a real provider credential, production cache, production database binding, public callback route or real identity. Readiness remains disabled and browser session/logout requests fail closed with sanitized service-unavailable responses.

## Explicitly not enabled

AUTH-05 does not enable:

- public login or provider callback routes;
- a real identity provider or client credential;
- production discovery or JWKS cache bindings;
- production browser origins or session secrets;
- provider logout, back-channel logout or provider-token revocation;
- refresh-token persistence or rotation;
- real user, tenant, student or staff identity data;
- production database mutation;
- production promotion or owner go-live authorization.
