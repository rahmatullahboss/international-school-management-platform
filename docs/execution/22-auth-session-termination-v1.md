# AUTH-04 — Browser Session Termination

**Status:** `GATE-AUTH-SESSION-TERMINATION-V1` passed on implementation proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`  
**Date:** 2026-07-30  
**Reviewed base:** `958b81a786b55286d0c41085d6258be17796ccd1`

## Purpose

AUTH-04 adds an explicit browser logout boundary on top of the durable session registry from AUTH-03. It supports termination of the current session or every active session belonging to the signed account while retaining the rule that real provider login remains disabled.

## Endpoint

`POST /auth/v1/logout`

The endpoint accepts one exact JSON shape:

```json
{"scope":"current"}
```

or:

```json
{"scope":"all"}
```

Unknown properties, unknown scope values, malformed JSON and bodies larger than 1,024 characters are rejected.

## Browser mutation origin policy

`AUTH_ALLOWED_WEB_ORIGINS` is a comma-separated allowlist with these restrictions:

- every value must be an exact HTTPS origin;
- credentials, paths, query strings and fragments are forbidden;
- trailing-slash variants are not accepted as alternate values;
- at most ten origins may be configured;
- the request must contain an exact matching `Origin` header.

The logout endpoint does not use a wildcard CORS response. A permitted origin receives credentialed CORS headers for `POST` and `OPTIONS`; an unrelated or missing origin is denied before the session is read.

## Request content policy

Logout requires `Content-Type: application/json`. Form submissions, text requests and other simple cross-origin content types are rejected before cookie verification or registry access.

The route checks both a declared content length and the actual text length. This prevents an oversized request from reaching identity or database logic.

## Current-session logout

For `scope: current`, the server:

1. verifies the signed `__Host-school_session` cookie;
2. confirms the session id is active in the durable registry;
3. revokes that exact session with a server-owned reason;
4. returns no body;
5. deletes the host cookie using the reviewed secure deletion contract.

## Account-wide logout

For `scope: all`, the server derives the internal account id from the signed session claim. No account, membership, tenant or role identifier is accepted from the browser request.

After active-session verification, all unexpired sessions belonging to that account are revoked through the AUTH-03 security-definer function. The current browser cookie is then deleted.

## Fail-closed behavior

Logout fails closed for:

- missing or invalid allowed-origin configuration;
- untrusted or absent request origin;
- non-JSON or malformed request bodies;
- missing, malformed, tampered, expired or future session cookies;
- missing durable registry configuration;
- inactive or revoked sessions;
- database lookup or revocation failures.

Cookie deletion is returned after session-related failures so an unusable local credential is removed. Origin and request-shape failures do not expose session state.

## Readiness contract

The non-sensitive readiness response adds:

- `originCheckedLogout`;
- `accountWideLogout`;
- `secureCookieDeletion`;
- generic missing category `allowed-web-origins`.

The response does not reveal configured origins, binding names, provider data, secrets or database values.

## Staging boundary

The logout route is deployed to staging but no allowed web origin, browser-session signing key, durable identity database binding or real provider is configured. Therefore staging logout returns a generic service-unavailable response and does not inspect a user session.

The existing synthetic pilot bearer routes remain separate from the browser-cookie authentication path.

## Explicitly not enabled

AUTH-04 does not enable:

- public login or provider callback routes;
- a real identity provider or client credential;
- production browser origins or production session secrets;
- provider logout, back-channel logout or provider-token revocation;
- refresh-token persistence or rotation;
- real user, tenant, student or staff identity data;
- production database mutation;
- production promotion or owner go-live authorization.
