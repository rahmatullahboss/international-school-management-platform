# Mobile bearer authentication and bootstrap activation

## Purpose

School Family and School Staff are public native clients. They must not reuse the browser application's confidential OIDC BFF session or embed a client secret. The mobile runtime therefore uses an OIDC authorization-code + PKCE client flow and presents the resulting access token to the platform API as a bearer credential.

The server-side source contract is now implemented for:

- `GET /v1/mobile/readiness`
- `GET /v1/mobile/bootstrap`
- `GET /v1/mobile/family/profiles`
- `GET /v1/mobile/family/students/{studentId}/dashboard`
- `GET /v1/mobile/teacher/today`
- `GET /v1/mobile/teacher/meetings/{meetingId}/roster`
- `POST /v1/mobile/device-sessions`
- `POST /v1/mobile/device-sessions/{deviceSessionId}/revoke`

The implementation remains fail closed until the reviewed identity-provider configuration and database migration are activated in the target environment.

## Trust boundary

The platform API accepts a mobile access token only when all of the following are true:

- the configured issuer is an exact HTTPS issuer;
- the token is a bounded three-segment JWT signed with RS256;
- the signature validates against a bounded, origin-pinned JWKS response;
- redirects are denied when fetching JWKS;
- the configured API audience is present in the token audience;
- the exact `school_api` scope is present in `scope` or `scp`;
- the token is within its issued/not-before/expiry window and the maximum token lifetime policy;
- an unknown signing-key id causes at most one forced JWKS refresh before failing closed.

The browser session cookie is not accepted by this endpoint, and the mobile application must never contain an OIDC client secret.

## Server configuration

The following non-secret runtime bindings are required before `/v1/mobile/readiness` reports `ready`:

- `MOBILE_OIDC_ISSUER`
- `MOBILE_OIDC_AUDIENCE`
- `MOBILE_OIDC_JWKS_URI`
- `MOBILE_OIDC_JWKS_ORIGIN`
- `MOBILE_OIDC_REQUIRED_SCOPE=school_api`
- `MOBILE_MEMBERSHIP_SOURCE=database`

`DATABASE_URL` remains the existing protected server-side database credential and must not be exposed to the mobile client or committed to source control.

The JWKS origin must exactly match the origin of `MOBILE_OIDC_JWKS_URI`. The API never discovers or follows an arbitrary provider URL supplied by a device.

## Database projection

Migration `202608190001_MOB-02_mobile_bearer_bootstrap.sql` adds the bounded mobile capability keys and the `iam.resolve_mobile_bootstrap_access(text,text)` resolver.

The resolver is `SECURITY DEFINER`, uses an explicit `pg_catalog` search path, is not executable by `PUBLIC`, and is executable by `app_runtime`. It resolves only:

- enabled accounts matching the verified OIDC issuer and subject;
- active OIDC membership bindings;
- active memberships;
- active tenants;
- the exact bound campus and its authoritative timezone;
- the canonical `guardian`, `student`, or `teacher` personas;
- persona-specific mobile capabilities that are also present in the role-permission authority.

Administrator, finance, admissions, support and other non-mobile roles are not returned. A mistaken cross-persona role permission is filtered from the mobile bootstrap projection rather than becoming a client capability.

## Client bootstrap contract

The response contains:

- `accountId`;
- presentation locale fallback (`en` until an authoritative account preference is activated server-side);
- schools/tenants;
- campuses, including each campus's authoritative `timeZone`;
- allowed mobile personas;
- bounded mobile capabilities for each persona.

Timezone is campus-scoped. The client no longer assumes one account-global timezone when an account can access more than one campus.

## Core mobile read models

Migration `202608190002_MOB-03_mobile_core_read_models.sql` adds database-owned, tenant-safe Family and Teacher read functions. Each function re-resolves the verified issuer/subject against the exact tenant, campus and persona before reading domain tables; request headers are selectors, not authority.

The first data-bearing tranche intentionally covers the journeys that can be served from existing authoritative school records without inventing new write semantics:

- Family authorized student/profile selection;
- Family current published timetable, finalized attendance summary and currently published results;
- Teacher current-day assigned/substitution meetings;
- Teacher exact assigned meeting roster with a server version suitable for the existing attendance-draft client contract.

Family billing/messages remain `null` and Staff assessment/conversation lists remain fail closed until their owning authoritative mobile read contracts are added. The API never falls back to pilot fixture JSON when an authoritative read model is unavailable.

Every scoped read requires `X-Tenant-Id`, `X-Campus-Id` and `X-Persona`, validates identifiers and database response shapes, bounds returned arrays/payload bytes, sends `Cache-Control: no-store`, and redacts database failures behind stable mobile error codes.

## Mobile device sessions and push credentials

Migration `202608190003_MOB-04_mobile_device_sessions.sql` adds account-scoped notification device sessions for the already-implemented Flutter native-notification lifecycle. Registration is authenticated by the same verified mobile bearer identity but is deliberately account-scoped rather than tenant-scoped, because one installation may switch between authorized school/campus contexts after bootstrap.

The server stores only app-generated installation IDs plus the provider credential required for delivery; it does not accept hardware IDs, advertising IDs, phone numbers, email addresses or device names. Provider credentials are never returned by the API, copied into idempotency responses, written to application logs or exposed through public/app-runtime table grants.

Registration and revocation are idempotent. A repeated idempotency key with different input fails closed. Re-registering the same installation updates the existing session/revision, and registering an installation or provider token under a different account defensively revokes the previous active owner before the new session becomes active. Android registrations accept Firebase/FCM credentials only; iOS accepts APNs credentials only. Non-production API environments accept only `development` notification credentials, while production accepts only `production` credentials.

Both mutation routes bound request bodies, validate exact known fields/identifiers, use `Cache-Control: no-store`, and return stable redacted errors. The notification-sending worker/provider activation remains a separate server/platform responsibility; MOB-04 only establishes the safe registration lifecycle and delivery-address authority.

Canonical API failures use the nested shape:

```json
{
  "error": {
    "code": "mobile_access_unavailable",
    "message": "No active mobile school access is available for this account."
  }
}
```

The Flutter API client accepts this canonical nested error shape and retains compatibility with the earlier top-level error shape.

## Mobile compile-time configuration

A test build that is intended to authenticate against the activated environment must receive the reviewed values for:

- `SCHOOL_API_BASE_URL`
- `SCHOOL_OIDC_ISSUER`
- `SCHOOL_OIDC_CLIENT_ID`
- `SCHOOL_OIDC_SCOPES` including `openid` and `school_api`
- `SCHOOL_FAMILY_OIDC_REDIRECT_URI`
- `SCHOOL_STAFF_OIDC_REDIRECT_URI`
- optional reviewed post-logout redirect URI

The Family and Staff redirect schemes remain separate. The identity provider must register the exact native redirect URIs for the corresponding public clients.

## Activation order

1. Review the target identity provider and create public native OIDC clients using authorization code + PKCE; do not create an app-embedded secret.
2. Configure the API audience and issue RS256 access tokens containing the exact `school_api` scope.
3. Review and apply `202608190001_MOB-02_mobile_bearer_bootstrap.sql`, `202608190002_MOB-03_mobile_core_read_models.sql` and `202608190003_MOB-04_mobile_device_sessions.sql` to the intended non-production database branch first.
4. Populate/review account, active membership, OIDC binding, campus and canonical mobile role mappings.
5. Configure the `MOBILE_OIDC_*` bindings and `MOBILE_MEMBERSHIP_SOURCE=database` on the intended API environment.
6. Confirm `GET /v1/mobile/readiness` reports `ready` without exposing configuration values.
7. Build Family and Staff with the reviewed `SCHOOL_*` values and distribute them through the dedicated `school-management-mobile-dev` Firebase App Distribution project.
8. Verify real-device sign-in, multi-school/campus selection, logout, token refresh, expired-token behavior and revoked/suspended membership behavior.
9. Verify the now-implemented Family/Teacher core read and device-session registration/revocation endpoints on that same verified bearer context, then activate attendance/grade writes, Family interactions and notification issuance as separate authority-preserving tranches.

## Verification

Source verification includes:

- policy tests for RS256 signature, issuer, audience, exact scope, expiry, denied algorithms and unknown signing keys;
- bounded/origin-pinned JWKS tests;
- platform mobile-auth and route tests;
- Flutter bootstrap/error/timezone tests;
- `tests/integration/verify-mobile-bearer-bootstrap.sh`, which uses a disposable PostgreSQL 16 database (Docker fallback when local PostgreSQL client tools are absent) and verifies tenant/campus projection, persona capability isolation, Family authorized-student isolation and function privileges.

The reviewed post-integration migration manifest now includes MOB-02, MOB-03 and MOB-04 so the normal reviewed migration runner cannot silently omit the mobile authority, read-model or device-session functions.

As of August 19, 2026, the staging Worker still has no `DATABASE_URL` secret and no reviewed `MOBILE_OIDC_*` provider bindings, so live staging authentication/data remains deliberately disabled even though the source contracts are implemented. No production provider configuration, real account data or production deployment is performed by this source tranche.
