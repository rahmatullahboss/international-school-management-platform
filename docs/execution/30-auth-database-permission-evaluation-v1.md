# AUTH-08 — Database-Backed Permission Evaluation

**Status:** passed and merged to `main`  
**Runtime merge:** `3a81f7f32c794b18524f0050828300e76ad4df95`  
**Reviewed implementation head:** `6a1d49cc47ebae090470db4ee8c7c6f56953b514`

## Objective

Move authorization decisions out of browser-declared or synthetic role context and into the durable identity database. A permission decision is valid only when the signed browser session is active and its current database membership, role bindings, permission grants and assurance level authorize the requested action.

## Authoritative inputs

The evaluator accepts only:

- the opaque session identifier recovered from the verified HttpOnly browser-session cookie;
- one syntactically bounded permission key supplied as the requested action;
- server-owned configuration and a database connection.

It does not accept tenant, campus, membership, account, role or assurance scope from the request body or browser headers.

## Durable evaluation

`iam.evaluate_browser_permission` is a `SECURITY DEFINER` function with a restricted search path. It verifies, in one server-side decision:

1. the browser-session registry record exists, is unexpired and is not revoked;
2. its membership binding is still active and still matches the account, tenant, membership and campus stored at issuance;
3. the account remains enabled;
4. the session role set still exactly matches the current OIDC membership-role bindings;
5. at least one current role grants the exact requested permission;
6. the session assurance satisfies the permission assurance requirement.

The result is a typed decision: `allowed`, `denied`, `step_up` or `inactive`. Direct `app_runtime` table access remains revoked; only the reviewed function is executable.

## HTTP boundary

`POST /auth/v1/authorize`:

- requires the exact configured web origin;
- requires `application/json` with the exact shape `{ "permission": "..." }`;
- requires a valid signed HttpOnly browser-session cookie;
- verifies registry activity before evaluating current grants;
- returns `200` only for `allowed`;
- returns a sanitized `403` for `denied` or `step_up`;
- returns sanitized `401`/`503` failures for inactive identity or unavailable configuration;
- always uses `Cache-Control: no-store`;
- never returns or sets authentication cookies;
- never exposes the opaque session identifier.

## Request resource controls

The declared content length is bounded at 2 KiB. Missing `Content-Length` does not bypass the limit: the request stream is read incrementally and rejected as soon as cumulative bytes exceed 2 KiB. Unsupported media types are rejected before body consumption. Invalid UTF-8 and malformed or extra JSON fields fail closed.

## Assurance behavior

A permission requiring AAL2 is not granted to an AAL1 session. The evaluator returns a distinct `step_up` decision so the caller can initiate the already-reviewed AUTH-06 fresh-AAL2 flow without weakening the requested permission.

## Readiness controls

The provider-neutral readiness document exposes these non-secret controls:

- `databasePermissionEvaluation`;
- `currentRoleRevalidation`;
- `assuranceAwarePermissionDecision`;
- `serverOwnedAuthorizationScope`.

`permission-source` is reported as missing until a reviewed durable binding is configured. Real provider login and production access remain disabled.

## Explicit exclusions

AUTH-08 does not:

- enable a real identity provider or public login route;
- replace synthetic pilot read models;
- introduce production data or mutations;
- grant any permission from browser-supplied role or tenant claims;
- authorize while the durable database is unavailable.
