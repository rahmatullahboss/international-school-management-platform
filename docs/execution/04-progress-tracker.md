# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`  
**Updated:** 2026-07-30  
**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1`, `GATE-OIDC-PKCE-FLOW-V1`, `GATE-AUTH-DURABLE-CONTEXT-V1` and `GATE-AUTH-SESSION-TERMINATION-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state and exact-origin current/account-wide browser logout, while real provider routes, production identity and mutations remain disabled.

Historical checkpoint-by-checkpoint evidence through Wave 3 is preserved in [the archived tracker](archive/04-progress-tracker-through-wave3.md). PILOT-01 scope is recorded in [09-pilot-runtime-composition.md](09-pilot-runtime-composition.md), UX continuity in [10-ux-continuity-v1.md](10-ux-continuity-v1.md) and [11-ux-continuity-release-evidence.md](11-ux-continuity-release-evidence.md), scoped reads in [12-pilot-read-api-v1.md](12-pilot-read-api-v1.md) and [13-pilot-read-api-release-evidence.md](13-pilot-read-api-release-evidence.md), and signed staging sessions in [14-pilot-signed-session-v1.md](14-pilot-signed-session-v1.md) [15-pilot-signed-session-release-evidence.md](15-pilot-signed-session-release-evidence.md), and the OIDC trust boundary in [16-oidc-trust-boundary-v1.md](16-oidc-trust-boundary-v1.md) and [17-oidc-trust-boundary-release-evidence.md](17-oidc-trust-boundary-release-evidence.md), with the PKCE flow in [18-oidc-pkce-flow-v1.md](18-oidc-pkce-flow-v1.md) and [19-oidc-pkce-flow-release-evidence.md](19-oidc-pkce-flow-release-evidence.md), and durable identity context in [20-auth-durable-context-v1.md](20-auth-durable-context-v1.md) and [21-auth-durable-context-release-evidence.md](21-auth-durable-context-release-evidence.md), with browser session termination in [22-auth-session-termination-v1.md](22-auth-session-termination-v1.md) and [23-auth-session-termination-release-evidence.md](23-auth-session-termination-release-evidence.md).

## Gate status

| Gate | Status | Evidence |
|---|---|---|
| `GATE-DOCUMENTS-APPROVED` | passed | Foundation execution artifacts and product/design authorities approved |
| `GATE-FOUNDATION-READY` | passed | Foundation milestones, Neon, RLS, policy, UI and verification complete |
| `GATE-REVIEWED-SHAS-AVAILABLE` | passed | Reviewed SHAs recorded for every module stream |
| `GATE-WAVE-1-INTEGRATED` | passed | `8cc8ee1562ade672b14c1c44af935fe7e2307976`; CI `30362743336`; Neon recovery `30362743167` |
| `GATE-STUDENT-SUPPORT-THREAT-MODEL` | passed | Restricted-data threat model, negative tests and recovery controls approved |
| `GATE-WAVE-2-INTEGRATED` | passed | `60836a8fe92f64ba581c4bde65005729d1fe14b2`; CI `30437010804`; Neon recovery `30437011092` |
| `GATE-EXP-COMPLETE` | passed | EXP implementation `5c952703c24ee9927fcf2cd480d3ce8d0d139847`; CI `30464998020` |
| `GATE-EXP-WAVE-3-INTEGRATION` | passed | Wave 3 integration merge `6093109c8c573c3b4495141ad71661d5d5ca22c1`; integration CIs `30466466903` and `30466808450` |
| `GATE-PILOT-READY` | passed | Final root CI `30467898523` and final Neon recovery run `30467899681` passed on PR #39 candidate ancestry |
| `GATE-CLOUDFLARE-STAGING` | passed | Main merge `41639fab433491df0395d02217a70c6eb2ddb775`; root CI `30479347127`; deploy/smoke `30479347117` |
| `GATE-PILOT-RUNTIME-COMPOSED` | passed | Candidate `a50ad782489137f5afd806e30c7a3e249b5074ec`; root CI `30484622352`; Cloudflare deploy/smoke `30484622364`; all role routes live |
| `GATE-UX-CONTINUITY-V1` | passed | Candidate `e74a30143eb7882e81ebd7d5b5c373d3132b309e`; root CI `30490122291`; Cloudflare deploy/smoke `30490122337`; continuous navigation and task discovery verified |
| `GATE-PILOT-READ-API-V1` | passed | Implementation proof `73be1c1eb0418c8c2f744729354bd9f1a63467b0`; root CI `30495509757`; deploy/smoke `30495509773`; scope denial and revalidation verified |
| `GATE-PILOT-SIGNED-SESSION-V1` | passed | Implementation proof `0a36ef62ec1622bdea6de7d0135bf30026845528`; root CI `30501350771`; deploy/smoke `30501350785`; signature, expiry, wrong-secret, cross-role and live bearer flow verified |
| `GATE-OIDC-TRUST-BOUNDARY-V1` | passed | Implementation proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`; root CI `30515626535`; deploy/smoke `30515626541`; RS256, issuer/audience/nonce, membership isolation and secure-cookie boundaries verified |
| `GATE-OIDC-PKCE-FLOW-V1` | passed | Implementation proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; root CI `30517446940`; deploy/smoke `30517446956`; S256 transaction, discovery, replay, confidential exchange and token-withholding boundaries verified |
| `GATE-AUTH-DURABLE-CONTEXT-V1` | passed | Implementation proof `9886f41d198772c684d3b245258964d4bcb0e83c`; root CI `30530441477`; deploy/smoke `30530441742`; durable replay, membership projection, session registration and revocation verified |
| `GATE-AUTH-SESSION-TERMINATION-V1` | passed | Implementation proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`; root CI `30533390869`; deploy/smoke `30533390917`; exact-origin current/account-wide logout and secure cookie deletion verified |

## Stream tracker

| Stream | Wave | Status | Reviewed/final evidence |
|---|---:|---|---|
| `FND-01` | 0 | complete; gate passed | `55114f55a375d3d79dba7ea21f984b789b5dbca1` |
| `SIS-01` | 1 | complete and integrated | `5e2499018282d8296abfe093b5dd95b231829379` |
| `FIN-01` | 1 | complete and integrated | `5f9e1692a8fc19fc2e9789a338d028918acdeaf6` |
| `INT-01` | 1 | complete and integrated | `bfa95a4a42025213fa7c2090a587ef5304924da7` |
| `ACAD-01` | 2 | complete and integrated | `1d895afdf51f6d4f6323ada4b93d9ba32b244480` |
| `OPS-01` | 2 | complete and integrated | `fc749d7c0ece36964da8f923431bb3b7ac925e56` |
| `CARE-01` | 2 | complete and integrated | `9304bd6c425eca4ec69db90c1f1cab3f7a409b8d` |
| `EXP-01` | 3 | complete and integrated | implementation `5c952703c24ee9927fcf2cd480d3ce8d0d139847`; main merge `6093109c8c573c3b4495141ad71661d5d5ca22c1` |
| `INTEG-01` | gated serial | pilot ready | final system and recovery evidence in `docs/execution/08-final-system-release-evidence.md` |
| `PILOT-01` | post-integration | runtime composed and staged | candidate `a50ad782489137f5afd806e30c7a3e249b5074ec`; CI `30484622352`; deploy `30484622364` |
| `UX-01` | post-integration | continuity gate passed and staged | candidate `e74a30143eb7882e81ebd7d5b5c373d3132b309e`; CI `30490122291`; deploy `30490122337` |
| `PILOT-02` | post-integration | scoped read API gate passed and staged | proof `73be1c1eb0418c8c2f744729354bd9f1a63467b0`; CI `30495509757`; deploy `30495509773` |
| `PILOT-03` | post-integration | signed staging session gate passed and staged | proof `0a36ef62ec1622bdea6de7d0135bf30026845528`; CI `30501350771`; deploy `30501350785` |
| `AUTH-01` | post-integration | OIDC trust boundary passed; login disabled | proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`; CI `30515626535`; deploy `30515626541` |
| `AUTH-02` | post-integration | Authorization Code + PKCE contract passed; provider routes disabled | proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; CI `30517446940`; deploy `30517446956` |
| `AUTH-03` | post-integration | durable identity context and revocation gate passed; provider routes disabled | proof `9886f41d198772c684d3b245258964d4bcb0e83c`; CI `30530441477`; deploy `30530441742` |
| `AUTH-04` | post-integration | browser session termination gate passed; provider routes disabled | proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`; CI `30533390869`; deploy `30533390917` |

## PILOT-01 gate closure

Completed and verified:

- role chooser and four persona runtime shells;
- reviewed persona components mounted into role roots;
- deep-link route surfaces for all integrated module families;
- synthetic read models and explicit mutation boundary;
- capability-scoped navigation and lazy loading;
- role selection, representative module and role-isolation browser journeys;
- Cloudflare role routes, PWA, offline and health smoke tests.

Verified performance: 203,338-byte initial JavaScript, 8,475-byte initial CSS, 283,316-byte total JavaScript and 60,355-byte total CSS; no budget violation.

## UX-01 continuity gate closure

Completed and verified:

- same-origin history navigation without document reload;
- back/forward retaining the application instance and role shell;
- intent and idle preloading;
- current-screen preservation while destination code prepares;
- non-blocking progress and final-layout skeletons;
- task-led grouped navigation and search;
- reduced-motion, responsive, RTL, keyboard and role-isolation coverage.

Evidence: 504 repository tests, 20 browser journeys, 207,287-byte initial JavaScript, 13,514-byte initial CSS, 292,668-byte total JavaScript and 71,650-byte total CSS.

## PILOT-02 scoped read API gate closure

Completed and verified:

- Worker-scoped synthetic role snapshots;
- server-resolved capabilities;
- tenant/campus/role/subject and origin denial;
- generic production-runtime `404` responses;
- private scope-specific ETag revalidation;
- browser cache isolation and returned-scope validation;
- current-view and last-safe-data preservation;
- same-run API-aware web build and live snapshot smoke.

Evidence: 509 repository tests, 22 browser journeys, 208,406-byte initial JavaScript, 15,022-byte initial CSS, 297,916-byte total JavaScript and 73,158-byte total CSS.

## PILOT-03 signed session gate closure

Completed and verified on implementation proof `0a36ef62ec1622bdea6de7d0135bf30026845528`:

- the browser obtains a short-lived signed synthetic session before reading a snapshot;
- HMAC-SHA256 verification binds issuer, audience, tenant, campus, role and subject;
- browser-declared `x-school-*` scope headers are removed from the snapshot path;
- capabilities remain Worker-resolved after identity verification;
- missing, malformed, tampered, expired, wrong-secret and cross-role sessions fail closed;
- session responses are not cached and tokens use only memory/session storage;
- a `401` triggers one role-scoped renewal attempt;
- failed issuance or renewal retains the last safe snapshot and current screen;
- each staging deploy generates and injects a new ephemeral secret through Wrangler without committing it;
- live smoke proves signed issuance and bearer-authorized scope retrieval;
- production runtime continues to hide all `/pilot/*` routes.

Verification evidence:

- repository tests: 514 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- browser journeys: 22 passed across platform/PILOT-03, SIS, finance, integrations, student support and EXP suites;
- initial JavaScript: 208,406 bytes against a 250,000-byte limit;
- initial CSS: 15,022 bytes against a 50,000-byte limit;
- total route JavaScript: 299,838 bytes against a 350,000-byte limit;
- total route CSS: 73,158 bytes against an 85,000-byte limit;
- no build-budget violation.

## AUTH-01 OIDC trust boundary closure

Completed and verified on implementation proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`:

- RS256-only ID-token verification with exact issuer, audience/`azp`, nonce, signing-key, signature and time validation;
- denied unsigned, malformed, tampered, expired, future and excessive-lifetime tokens;
- AAL1/AAL2 derived from trusted `acr`/`amr` claims only;
- exact `issuer + subject` membership lookup with active-status, tenant, campus and role isolation;
- explicit selection for multi-tenant and multi-campus identities;
- suspended, revoked, cross-tenant and cross-campus denial;
- signed `__Host-school_session` cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, bounded lifetime and no profile/provider tokens;
- cookie-only session introspection and non-sensitive readiness reporting;
- Cloudflare readiness smoke proving login disabled and session verification fail-closed without approved configuration.

Verification evidence:

- repository tests: 534 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- browser journeys: 22 passed;
- initial JavaScript: 208,406 bytes against a 250,000-byte limit;
- initial CSS: 15,022 bytes against a 50,000-byte limit;
- total route JavaScript: 299,838 bytes against a 350,000-byte limit;
- total route CSS: 73,158 bytes against an 85,000-byte limit;
- no build-budget violation.

## AUTH-02 Authorization Code + PKCE gate closure

Completed and verified on implementation proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`:

- 256-bit state, nonce and verifier with S256-only PKCE;
- signed `__Host-school_oauth` browser transaction cookie with short bounded lifetime;
- same-origin return-path enforcement, constant-time state validation and authorization-response issuer validation;
- atomic transaction replay dependency before provider token exchange;
- exact discovery issuer and required code, RS256 and S256 capability validation;
- bounded no-redirect discovery, JWKS and token responses;
- unique approved RSA signing keys;
- confidential `client_secret_basic` server-side exchange with exact redirect URI and verifier;
- ordered callback orchestration through ID-token verification, membership resolution and secure session issuance;
- access, refresh and ID tokens withheld from browser-facing results;
- Cloudflare readiness smoke proving every BFF control while `loginEnabled` remains false.

Verification evidence:

- repository tests: 557 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- browser journeys: 22 passed;
- initial JavaScript: 208,406 bytes against a 250,000-byte limit;
- initial CSS: 15,022 bytes against a 50,000-byte limit;
- total route JavaScript: 299,838 bytes against a 350,000-byte limit;
- total route CSS: 73,158 bytes against an 85,000-byte limit;
- no build-budget violation.


## AUTH-03 durable identity context gate closure

Completed and verified on implementation proof `9886f41d198772c684d3b245258964d4bcb0e83c`:

- the canonical 40-migration manifest remains frozen and AUTH-03 is applied through a separate post-integration manifest;
- atomic OAuth transaction consumption denies replay, expiry and invalid lifetimes;
- exact issuer-and-subject membership projection resolves active account, tenant, campus and role context;
- `app_runtime` has function-only access and no direct durable-auth table privileges;
- a browser session is registered durably before its secure cookie is returned;
- signed-cookie introspection requires an active registry record;
- explicit session revocation, account-wide revocation, membership changes and role changes invalidate sessions;
- replay, membership and registry outages fail closed with sanitized errors;
- Cloudflare readiness exposes generic durable-control categories while `loginEnabled` remains false.

Verification evidence:

- repository tests: 565 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- migrations: 40 canonical migrations plus one AUTH-03 post-integration migration passed on fresh PostgreSQL;
- browser journeys: 22 passed;
- initial JavaScript: 208,406 bytes against a 250,000-byte limit;
- initial CSS: 15,022 bytes against a 50,000-byte limit;
- total route JavaScript: 299,838 bytes against a 350,000-byte limit;
- total route CSS: 73,158 bytes against an 85,000-byte limit;
- no build-budget violation.


## AUTH-04 browser session termination gate closure

Completed and verified on implementation proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`:

- exact HTTPS browser-origin allowlisting with no wildcard credentialed CORS;
- credentialed `OPTIONS` preflight only for an approved exact origin;
- JSON-only bounded logout requests with exact `current` or `all` scope;
- unknown fields and browser-supplied account identifiers rejected;
- signed-cookie and durable-registry activity verification before revocation;
- current-session revocation with secure host-cookie deletion;
- account-wide revocation using only the signed server-owned principal id;
- origin, request-shape, cookie and registry failures remain fail-closed and sanitized;
- Cloudflare staging exposes the route but returns generic service unavailable while origins and real identity bindings are unconfigured.

Verification evidence:

- repository tests: 575 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- migrations: 40 canonical migrations plus one AUTH post-integration migration passed on fresh PostgreSQL;
- browser journeys: 22 passed;
- initial JavaScript: 208,406 bytes against a 250,000-byte limit;
- initial CSS: 15,022 bytes against a 50,000-byte limit;
- total route JavaScript: 299,838 bytes against a 350,000-byte limit;
- total route CSS: 73,158 bytes against an 85,000-byte limit;
- no build-budget violation.

## Live staging routes

- Role chooser: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`
- Admin: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/admin`
- Teacher: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/teacher`
- Guardian: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/family`
- Student: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/student`
- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`
- OIDC readiness: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/readiness`
- Browser session introspection: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/session`
- Browser logout: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/logout` — currently fail-closed because real browser identity configuration is disabled
- Synthetic session pattern: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/pilot/v1/sessions/:role`
- Signed snapshot pattern: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/pilot/v1/snapshots/:role` — bearer required; not a public page

## Reviewed integration lineage

- Foundation: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
- Wave 1: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
- Wave 2: `60836a8fe92f64ba581c4bde65005729d1fe14b2`
- EXP implementation: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`
- Wave 3 main merge: `6093109c8c573c3b4495141ad71661d5d5ca22c1`
- Cloudflare staging merge: `41639fab433491df0395d02217a70c6eb2ddb775`
- PILOT-01 candidate: `a50ad782489137f5afd806e30c7a3e249b5074ec`
- UX-01 candidate: `e74a30143eb7882e81ebd7d5b5c373d3132b309e`
- PILOT-02 proof: `73be1c1eb0418c8c2f744729354bd9f1a63467b0`
- PILOT-03 proof: `0a36ef62ec1622bdea6de7d0135bf30026845528`
- AUTH-01 proof: `5d58706e119e34e72fee17d2a67be74428ad5ab3`
- AUTH-02 proof: `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`
- AUTH-03 proof: `9886f41d198772c684d3b245258964d4bcb0e83c`
- AUTH-04 proof: `ea9093af5e2707edf45fde73a19af371d01cb8ac`

## Final integrated system verification

### Application and browser evidence

- Repository tests: 575 passed; AUTH-04 adds exact-origin logout, strict request-shape, current-session and account-wide termination coverage without changing domain invariants.
- Browser journeys: 22 passed.
- Format, lint, architecture boundaries, typecheck, Worker/Vite builds, audit, licence, provenance and artifact validation passed.
- Assets remain within approved initial and total budgets.

### Database and recovery evidence

- Canonical migration manifest: 40 immutable migrations.
- Post-integration AUTH manifest: one migration; 41 total ledger entries verified.
- Exact Neon project: `lingering-brook-52999532`.
- Exact integration Neon branch: `br-shiny-silence-axznuy37`.
- Idempotent apply, forced RLS, `app_runtime` policy, finance immutability/balance, cross-tenant probes and disposable recovery replay passed.

## Remaining production milestones

- add approved discovery/JWKS caching and key-rotation governance;
- configure a reviewed provider and production database binding;
- connect the verified membership context to database-backed permission evaluation;
- add provider logout/back-channel revocation, step-up assurance and live negative authorization tests;
- replace synthetic snapshots with database-backed read models and tenant-safe server caching;
- provide approved staging seed/reset tooling and safe mutations;
- add monitoring, backup and rollback rehearsal;
- complete owner-led UAT and explicit production authorization.

## Safe cleanup report

No Git branch, worktree or Neon branch was deleted. Cleanup remains owner-reviewed only.

## Production boundary

No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. AUTH-01 through AUTH-04 provide provider-neutral verification, PKCE flow, durable identity state and browser session termination contracts with real login explicitly disabled. Production promotion requires all remaining provider, policy, data, monitoring, recovery and owner-authorization gates.
