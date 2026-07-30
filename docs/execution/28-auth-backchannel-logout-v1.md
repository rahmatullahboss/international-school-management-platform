# AUTH-07 — OIDC Back-Channel Logout

**Status:** `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` passed on implementation proof `fd30d6bd7c56e745a83114722147e83605f01cdd`  
**Date:** 2026-07-31  
**Reviewed base:** `e8ae5f4f0ae8ba97214ec7c53f2b7f970558fd4a`  
**Main merge:** `ace9f6f45e21468ae29a68f4ff741ac3994764af`

## Purpose

AUTH-07 adds provider-neutral OpenID Connect Back-Channel Logout governance on top of the verified discovery/JWKS cache, signing-key rotation, durable browser-session registry and fresh-AAL2 controls completed in AUTH-01 through AUTH-06.

The gate proves cryptographic Logout Token validation, durable replay denial, exact provider-session revocation and a fail-closed provider-facing HTTP boundary. A real provider remains disabled.

## Logout Token validation

The verifier accepts only a compact signed JWT that satisfies all of these controls:

- signing algorithm exactly RS256;
- token type exactly `logout+jwt`;
- exact configured issuer and client audience;
- required `iat`, `exp`, `jti` and back-channel logout event;
- the logout event object must be empty;
- `nonce` is forbidden;
- at least one of provider `sub` or `sid` is required;
- token, identifier, audience, age and lifetime limits are bounded;
- an unknown `kid` triggers at most one forced JWKS refresh;
- known-key signature failures do not trigger refresh.

## Provider-session binding

A verified ID token may carry provider `sid`. AUTH-07 binds it through:

1. the verified OIDC identity;
2. the signed `__Host-school_session` claim;
3. the durable browser-session registry.

This allows a Logout Token carrying `sid` to revoke only the matching active browser sessions. A subject-only token can revoke active sessions for the exact provider issuer and subject.

## Atomic replay and revocation

`iam.process_oidc_backchannel_logout` performs the JTI insert and provider-scoped session revocation in one security-definer database transaction.

- the first valid token inserts the `(issuer, jti)` replay record and revokes matching sessions;
- a replay returns an idempotent result and performs no additional revocation;
- any database error rolls back both operations, leaving a provider retry possible;
- `app_runtime` has function execution only and no direct table access.

## Durable provider cache

OIDC discovery/JWKS cache records are read and written through security-definer functions. The existing cache parser continues to reject malformed, future-dated or overlong cache records. `app_runtime` cannot query or mutate the cache table directly.

## HTTP boundary

`POST /auth/v1/backchannel-logout` accepts exactly one `application/x-www-form-urlencoded` field named `logout_token`.

The route:

- rejects duplicate, unknown, empty and oversized fields;
- validates a strictly numeric declared content length before reading the body;
- returns no browser CORS headers;
- reads no browser cookie and issues no cookie;
- sets `Cache-Control: no-store`;
- returns an empty 200 for successful or replayed valid tokens;
- returns sanitized 400 for invalid tokens and 503 for missing configuration or durable outages.

## Readiness contract

The non-sensitive readiness response adds:

- `backChannelLogout`;
- `typedLogoutTokens`;
- `logoutTokenReplayProtection`;
- `providerSessionRevocation`;
- `durableProviderCache`;
- generic missing configuration `backchannel-logout-source`.

## Staging boundary

Cloudflare staging deploys the route but does not configure a real provider or production durable identity binding. The live route therefore returns a generic 503 without CORS, cookies or token processing.

## Explicitly not enabled

AUTH-07 does not enable:

- a real identity provider or client credential;
- public login/callback routes;
- production provider, cache or database bindings;
- front-channel provider logout or refresh-token persistence;
- real account, tenant, student or staff data;
- production mutations, promotion or owner go-live authorization.
