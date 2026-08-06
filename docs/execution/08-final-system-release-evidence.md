# Final System and Pilot-Readiness Evidence

## Candidate

- Program: `international-school-platform-v1`
- Wave 3 main integration: `6093109c8c573c3b4495141ad71661d5d5ca22c1`
- Finalization branch: `integration/international-school-platform-finalization`
- Initial finalization head: `2b9c171be7c3278aa5db3ce8385dcb0978650fd9`
- Canonical migration manifest: 40 migrations across FND-01, SIS-01, FIN-01, INT-01, ACAD-01, OPS-01 and CARE-01
- Experience implementation: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`

EXP-01 adds application, communication, reporting, document and PWA capabilities without adding a database migration stream. The reviewed database manifest therefore intentionally remains anchored to `GATE-WAVE-2-INTEGRATED` while the final system gate re-verifies the complete integrated application against that canonical database.

## Final root system gate

Root CI run `30467898523` passed all 21 verification steps on the finalization candidate ancestry:

- clean npm installation;
- formatting, lint and architecture boundaries;
- TypeScript project references;
- all 504 repository tests;
- all 40 canonical migrations on fresh PostgreSQL;
- live Neon serverless driver verification;
- Worker and Vite production builds;
- platform-web JavaScript/CSS/PWA budget;
- dependency audit and licence policy;
- provenance generation with no tracked drift;
- all 15 Chromium browser journeys;
- execution-artifact validation.

## Final Neon recovery gate

INTEG-01 Final Neon Recovery Gate run `30467899681` passed:

- repository Neon API credential presence;
- exact project `lingering-brook-52999532`;
- exact integration branch `br-shiny-silence-axznuy37`;
- idempotent canonical migration apply;
- 40-entry migration ledger completeness;
- forced RLS and `app_runtime` policy coverage on tenant-owned tables;
- finance posting function, immutable posted journals/lines and balanced posted entries;
- cross-tenant read invisibility and forbidden-write rejection;
- disposable database creation, complete migration replay, verification and cleanup.

## Integration lineage

- Foundation reviewed SHA: `55114f55a375d3d79dba7ea21f984b789b5dbca1`.
- Wave 1 reviewed integration: `8cc8ee1562ade672b14c1c44af935fe7e2307976`.
- Wave 2 reviewed integration: `60836a8fe92f64ba581c4bde65005729d1fe14b2`.
- EXP reviewed implementation: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`.
- Wave 3 main merge: `6093109c8c573c3b4495141ad71661d5d5ca22c1`.

## Gate outcome

`GATE-PILOT-READY` passes for the reviewed integrated candidate. The final documentation reconciliation commit and its exact workflow reruns are recorded on PR #39 before merge.

Pilot-ready does not authorize production deployment. Production environment creation, secrets, DNS, monitoring, backups, rollback rehearsal, data migration and go-live remain separate owner-approved activities.

## Safe cleanup

No branch, worktree or Neon branch was deleted. The prior detailed agent board and progress tracker are retained under `docs/execution/archive/`. No production deployment, production database mutation, production cache purge or destructive cleanup was performed.

## Post-gate Cloudflare Pilot Composition

After `GATE-PILOT-READY`, PILOT-01 converted the integrated persona packages into a browser-runnable non-production acceptance environment.

- Starting Cloudflare staging merge: `41639fab433491df0395d02217a70c6eb2ddb775`.
- Verified PILOT-01 candidate: `a50ad782489137f5afd806e30c7a3e249b5074ec`.
- Root CI `30484622352` passed all 21 gates, including all tests, 40-migration replay, live Neon, builds, initial/total asset budgets, browser journeys and artifact validation.
- Cloudflare run `30484622364` deployed API and web Workers and passed live smoke tests for the role chooser, admin, teacher, guardian, student, PWA manifest, offline page and API health.
- Initial asset evidence: 203,338-byte JavaScript and 8,475-byte CSS.
- Total lazy-route assets: 283,316-byte JavaScript and 60,355-byte CSS.
- API Worker version: `360f923e-1518-4d1d-9540-3f02c4939216`.
- Web Worker version: `11539129-464f-4f80-8fc1-8254f4c9e1be`.
- Live web: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`.
- Live API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`.

`GATE-PILOT-RUNTIME-COMPOSED` passes for the synthetic-data staging pilot. This does not change the production boundary: real identity, permission-aware APIs, approved staging data, safe mutation acceptance, monitoring, backup, rollback and explicit owner authorization remain required before production promotion.

## Post-gate Scoped Read and Signed Session Evidence

PILOT-02 and PILOT-03 progressively hardened the synthetic staging boundary without representing it as production authentication.

### PILOT-02

- Implementation proof: `73be1c1eb0418c8c2f744729354bd9f1a63467b0`.
- Root CI: `30495509757`.
- Cloudflare deploy/smoke: `30495509773`.
- Outcome: private, scope-checked, ETag-revalidated role snapshots with API-origin/tenant/campus/role/subject browser cache isolation and current-view preservation.

### PILOT-03

- Implementation proof: `0a36ef62ec1622bdea6de7d0135bf30026845528`.
- Root CI: `30501350771`.
- Cloudflare deploy/smoke: `30501350785`.
- Repository tests: 514 passed; one direct-Neon test skipped in the ordinary suite and passed separately against live Neon.
- Browser journeys: 22 passed.
- Signed-session tests cover exact 15-minute expiry, signature verification, wrong-secret denial and cross-role denial.
- Browser snapshot calls use only `Authorization: Bearer`; browser-declared tenant/campus/role/subject headers were removed.
- Capabilities remain server-resolved after the session is verified.
- Deployment generates an ephemeral 256-bit signing secret and injects it through a protected temporary Wrangler secrets file.
- Live smoke validates signed session issuance and bearer-authorized scoped snapshot retrieval.
- Initial assets remain 208,406-byte JavaScript and 15,022-byte CSS.
- Total route assets remain within budget at 299,838-byte JavaScript and 73,158-byte CSS.

`GATE-PILOT-SIGNED-SESSION-V1` passes for the synthetic staging identity bridge. Production remains blocked until reviewed OAuth/OIDC, real membership and tenant/campus resolution, database-backed authorization, safe production browser sessions, logout/revocation, step-up assurance, monitoring, backup, rollback, UAT and explicit owner authorization are complete.


## Post-gate OIDC Trust Boundary Evidence

AUTH-01 establishes a provider-neutral authentication trust boundary without enabling real login.

- Reviewed base: `26e6f5b034dd62f0486f20d7f24194551b642191`.
- Implementation proof: `5d58706e119e34e72fee17d2a67be74428ad5ab3`.
- Root CI: `30515626535` passed all 21 gates with 534 repository tests, 40 migrations, live Neon, builds, budgets, 22 browser journeys and artifact validation.
- Cloudflare deploy/smoke: `30515626541` passed readiness, fail-closed session, pilot bearer, persona, PWA and health checks.
- The ID-token verifier permits RS256 only and validates issuer, audience/`azp`, nonce, signing key, signature and timestamps.
- Membership resolution uses exact provider issuer+subject and denies inactive, cross-tenant and cross-campus context.
- The browser-session contract uses a signed `__Host-school_session` cookie with `HttpOnly`, `Secure` and `SameSite=Lax` attributes.
- The staged readiness endpoint reports `loginEnabled: false`; no provider credential, membership source or production session key is deployed.

`GATE-OIDC-TRUST-BOUNDARY-V1` passes. Authorization Code + PKCE transactions, callback and token exchange, approved discovery/JWKS retrieval and rotation, a real provider, database-backed memberships and permissions, revocation, step-up, monitoring, recovery rehearsal, owner-led UAT and explicit production authorization remain blocked.


## Post-gate Authorization Code and PKCE Evidence

AUTH-02 completes the provider-neutral Authorization Code + PKCE contract without enabling a real provider.

- Reviewed base: `48f3fb311a60b87faad3ec4f643b4a32b323099f`.
- Implementation proof: `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`.
- Root CI `30517446940` passed all 21 gates with 557 repository tests, 40 migrations, live Neon, builds, budgets, 22 browser journeys and artifact validation.
- Cloudflare `30517446956` passed extended readiness, fail-closed session, pilot bearer, persona, PWA and health smoke tests.
- The browser transaction uses high-entropy state, nonce, verifier, S256 and a signed host-only cookie.
- Discovery, JWKS and token responses are no-redirect, JSON-only and size bounded.
- The confidential code exchange sends the exact redirect URI and verifier and never returns provider tokens to browser-facing results.
- Atomic replay consumption occurs before a provider request.
- Staging continues to report `loginEnabled: false` with no provider or durable identity adapter configured.

`GATE-OIDC-PKCE-FLOW-V1` passes. Durable replay, JWKS cache/rotation, database-backed membership and policy adapters, reviewed provider configuration, session revocation, refresh-token governance, step-up, monitoring, rollback, UAT and production authorization remain blocked.


## Post-gate Durable Identity Context Evidence

AUTH-03 adds durable server-owned identity context without enabling a real provider or public login route.

- Reviewed base: `84b637f6b5080476b2a015cf938fe8d2c60d1e3f`.
- Implementation proof: `9886f41d198772c684d3b245258964d4bcb0e83c`.
- Root CI `30530441477` passed the canonical gates with 565 repository tests, 40 canonical migrations, one AUTH-03 post-integration migration, live Neon, builds, budgets, 22 browser journeys and artifact validation.
- Cloudflare `30530441742` passed durable-control readiness, fail-closed browser-session verification, pilot bearer, persona, PWA and health smoke tests.
- OAuth replay consumption is atomic and durable.
- Exact provider issuer+subject resolves a database-owned account, membership, tenant, campus and role projection.
- `app_runtime` has no direct durable-auth table access and uses only reviewed security-definer functions.
- Browser sessions are registered before cookies are released and are checked against the registry during introspection.
- Explicit revocation, account-wide logout, membership suspension and role removal invalidate signed sessions.
- The staged readiness endpoint reports `loginEnabled: false`; no provider credential, production database binding or session key is deployed.

`GATE-AUTH-DURABLE-CONTEXT-V1` passes. Reviewed provider configuration, public login/callback routing, production secrets, JWKS rotation, permission evaluation, provider logout/revocation, refresh-token governance, step-up, monitoring, recovery rehearsal, UAT and production authorization remain blocked.


## Post-gate Browser Session Termination Evidence

AUTH-04 adds a reviewed browser logout endpoint without enabling a real provider or production identity configuration.

- Reviewed base: `958b81a786b55286d0c41085d6258be17796ccd1`.
- Implementation proof: `ea9093af5e2707edf45fde73a19af371d01cb8ac`.
- Root CI `30533390869` passed with 575 repository tests, canonical and post-integration migrations, live Neon, builds, budgets, 22 browser journeys and artifact validation.
- Cloudflare `30533390917` passed exact-origin logout readiness, unconfigured logout denial, existing pilot bearer, persona, PWA and health smoke tests.
- Logout requires an exact configured HTTPS origin and `application/json`; wildcard credentialed CORS is forbidden.
- Current-session revocation checks the signed cookie and durable registry before deleting the host cookie.
- Account-wide revocation derives the account id from the signed session and accepts no browser account identifier.
- Invalid origins, malformed bodies, missing cookies, revoked sessions and database failures remain fail-closed and sanitized.
- Staging continues to report `loginEnabled: false` and has no approved origin, provider, production session key or real identity database binding.

`GATE-AUTH-SESSION-TERMINATION-V1` passes. Provider logout/back-channel revocation, refresh-token governance, reviewed provider activation, production origins/secrets, step-up, monitoring, recovery rehearsal, UAT and production authorization remain blocked.
