# PILOT-02 — Permission-aware staging read API

## Purpose

Connect the composed role portals to a non-production Worker read API without reintroducing blocking loading screens. The current authorised view remains visible while fresh data is checked in the background.

## Reviewed base

- Main SHA: `0e054947b41ce7d8a4967dc94aa0b80672b99f58`
- Branch: `pilot/permission-aware-read-api-v1`
- Environment: Cloudflare staging only
- Data: synthetic records only
- Production mutations: disabled

## Scope contract

Every pilot snapshot request is scoped by:

- tenant identifier;
- campus identifier;
- persona/role;
- subject identifier;
- server-resolved capability set.

The endpoint rejects missing, unknown or mismatched scope. The browser cannot request one role while declaring another role or subject. This is a staging simulation of the production authorization boundary; it is not a substitute for reviewed OAuth/OIDC identity.

## Cache and continuity contract

- API responses are private and revalidated with `ETag`/`If-None-Match`.
- Browser cache keys include API origin, tenant, campus, role and subject.
- The last successful scoped snapshot is retained in memory and local storage.
- A refresh never removes usable authorised content.
- Offline or failed refreshes show a small local status and retain the last safe snapshot.
- A response is accepted only when its returned tenant, campus, role and subject match the requested scope.
- Cross-role or cross-subject cached data is never reused.

## Endpoints

- `GET /pilot/v1/snapshots/:role`
- `OPTIONS /pilot/v1/snapshots/:role`

Required request headers:

- `x-school-tenant-id`
- `x-school-campus-id`
- `x-school-role`
- `x-school-subject-id`

## Gate

`GATE-PILOT-READ-API-V1` requires:

1. allowed role/scope requests return only the scoped snapshot and capabilities;
2. missing or mismatched scope is denied;
3. CORS is limited to the staging web origin and local development origins;
4. ETag revalidation returns `304` without replacing current UI state;
5. portal browser journeys prove current content remains visible during refresh and after refresh failure;
6. cache isolation tests cover tenant, campus, role and subject boundaries;
7. root CI, migrations, live Neon, builds, budgets and Cloudflare smoke tests pass;
8. progress tracker, release evidence and machine board are synchronized before reviewed merge.

## Production boundary

This stream does not enable production login, real tenants, real student data, shared caches, live payments, publication, restricted-data changes, approvals or other mutations. Production still requires reviewed identity, database-backed policy enforcement, tenant-safe server caching, approved staging seed/reset tooling, negative authorization tests, monitoring, backup, rollback and owner-led UAT.
