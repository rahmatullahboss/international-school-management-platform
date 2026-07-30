# PILOT-03 — Signed staging session context

## Purpose

Replace browser-declared tenant, campus, role and subject headers with a short-lived, server-verifiable synthetic session before a scoped staging snapshot can be read. This creates an explicit identity-context boundary for the non-production pilot while preserving the current screen during renewal or failure.

## Reviewed base

- Main SHA: `f01cb446f8a6590e5800fba1f366e17a8eeedc2a`
- Branch: `pilot/signed-session-context-v1`
- Environment: Cloudflare staging only
- Data and identities: synthetic only
- Production routes and mutations: disabled

## Session contract

`POST /pilot/v1/sessions/:role` issues a 15-minute synthetic session with:

- issuer and API audience;
- fixed pilot tenant and campus;
- one role and its corresponding subject;
- issued-at and expiry timestamps;
- a unique session identifier;
- an HMAC-SHA256 signature using an ephemeral staging secret.

The response is `Cache-Control: no-store`. The browser keeps the token only in memory and `sessionStorage`; it is not written to durable local storage. The deployment generates a new secret for each staged Worker deployment, so older tokens fail closed after rotation.

## Snapshot authorization contract

`GET /pilot/v1/snapshots/:role` requires `Authorization: Bearer <token>`.

The Worker:

1. verifies the HMAC signature;
2. verifies issuer, audience, tenant, campus, role, subject, issued-at and expiry;
3. rejects missing, malformed, tampered, expired, wrong-secret and cross-role tokens;
4. converts verified claims to an internal request scope;
5. resolves capabilities on the server at snapshot time;
6. returns a private ETag-revalidated snapshot only for the verified context.

The browser no longer sends `x-school-tenant-id`, `x-school-campus-id`, `x-school-role` or `x-school-subject-id`.

## Continuity contract

- A valid session is reused until near expiry.
- A `401` clears the role session and performs one renewal attempt.
- Session issuance or renewal failure never removes the last safe scoped snapshot.
- Snapshot cache identity continues to include API origin, tenant, campus, role and subject.
- Returned snapshot scope is validated before acceptance.
- Role changes use a separate signed session and cache namespace.

## Gate

`GATE-PILOT-SIGNED-SESSION-V1` requires:

1. signed session issuance with fixed synthetic context;
2. missing, malformed, tampered, expired, wrong-secret and cross-role denial;
3. no browser-supplied scope headers on the snapshot path;
4. server-resolved capabilities;
5. short-lived session storage and one-time renewal after `401`;
6. current-view preservation when identity or snapshot refresh fails;
7. ephemeral staging secret deployment and signed live smoke tests;
8. generic `404` responses for every `/pilot/*` route in production runtime;
9. root CI, migrations, live Neon, builds, budgets, browser journeys and execution-artifact validation;
10. progress tracker, release evidence and machine board synchronization before merge.

## Production boundary

This is not real login or production authentication. The role session endpoint intentionally supports the synthetic role chooser and must not be promoted as an identity provider. Production requires reviewed OAuth 2.0/OIDC Authorization Code with PKCE, approved issuer/audience/JWKS validation, user-to-tenant membership resolution, database-backed policy evaluation, secure logout and revocation, step-up assurance, monitoring and owner-authorized release. A production browser session should use a reviewed same-origin BFF/HttpOnly-cookie design or another explicitly approved threat model rather than this staging token-storage mechanism.
