# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`  
**Updated:** 2026-07-31  
**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1`, `GATE-OIDC-PKCE-FLOW-V1`, `GATE-AUTH-DURABLE-CONTEXT-V1`, `GATE-AUTH-SESSION-TERMINATION-V1`, `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1`, `GATE-AUTH-FRESH-STEP-UP-V1`, `GATE-AUTH-BACKCHANNEL-LOGOUT-V1`, `GATE-AUTH-DATABASE-PERMISSION-V1` and `GATE-PILOT-DATABASE-READ-MODEL-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching, signing-key rotation, fresh-AAL2 step-up, atomic provider back-channel logout, database-backed permission governance and tenant-safe database runtime projections with current-grant revalidation, while real provider login, production identity, production projection population and mutations remain disabled.

Historical checkpoint-by-checkpoint evidence through Wave 3 is preserved in [the archived tracker](archive/04-progress-tracker-through-wave3.md). PILOT-01 scope is recorded in [09-pilot-runtime-composition.md](09-pilot-runtime-composition.md), UX continuity in [10-ux-continuity-v1.md](10-ux-continuity-v1.md) and [11-ux-continuity-release-evidence.md](11-ux-continuity-release-evidence.md), scoped reads in [12-pilot-read-api-v1.md](12-pilot-read-api-v1.md) and [13-pilot-read-api-release-evidence.md](13-pilot-read-api-release-evidence.md), and signed staging sessions in [14-pilot-signed-session-v1.md](14-pilot-signed-session-v1.md) [15-pilot-signed-session-release-evidence.md](15-pilot-signed-session-release-evidence.md), and the OIDC trust boundary in [16-oidc-trust-boundary-v1.md](16-oidc-trust-boundary-v1.md) and [17-oidc-trust-boundary-release-evidence.md](17-oidc-trust-boundary-release-evidence.md), with the PKCE flow in [18-oidc-pkce-flow-v1.md](18-oidc-pkce-flow-v1.md) and [19-oidc-pkce-flow-release-evidence.md](19-oidc-pkce-flow-release-evidence.md), and durable identity context in [20-auth-durable-context-v1.md](20-auth-durable-context-v1.md) and [21-auth-durable-context-release-evidence.md](21-auth-durable-context-release-evidence.md), with browser session termination in [22-auth-session-termination-v1.md](22-auth-session-termination-v1.md) and [23-auth-session-termination-release-evidence.md](23-auth-session-termination-release-evidence.md), and provider cache/key rotation governance in [24-auth-provider-cache-key-rotation-v1.md](24-auth-provider-cache-key-rotation-v1.md) and [25-auth-provider-cache-key-rotation-release-evidence.md](25-auth-provider-cache-key-rotation-release-evidence.md), with fresh step-up assurance in [26-auth-fresh-step-up-assurance-v1.md](26-auth-fresh-step-up-assurance-v1.md) and [27-auth-fresh-step-up-assurance-release-evidence.md](27-auth-fresh-step-up-assurance-release-evidence.md), and provider back-channel logout in [28-auth-backchannel-logout-v1.md](28-auth-backchannel-logout-v1.md) and [29-auth-backchannel-logout-release-evidence.md](29-auth-backchannel-logout-release-evidence.md), with database-backed permission evaluation in [30-auth-database-permission-evaluation-v1.md](30-auth-database-permission-evaluation-v1.md) and [31-auth-database-permission-release-evidence.md](31-auth-database-permission-release-evidence.md), followed by tenant-safe database runtime read models in [32-pilot-database-read-models-v1.md](32-pilot-database-read-models-v1.md) and [33-pilot-database-read-models-release-evidence.md](33-pilot-database-read-models-release-evidence.md).

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
| `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` | passed | Implementation proof `d8e60bc045265799d6ecf63da6a75e22c9287459`; main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`; root CI `30574007099`; deploy/smoke `30574006810`; bounded cache timestamps, endpoint-origin pins and signing-key rotation verified |
| `GATE-AUTH-FRESH-STEP-UP-V1` | passed | Implementation proof `17b53865900c3606bf5781a9ed0cf0b856262782`; main merge `12881a80c6776020c8e26ca70ffb4af5c6b42b39`; root CI `30578058983`; deploy/smoke `30578058937`; signed step-up intent, forced reauthentication and bounded fresh AAL2 verified |
| `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` | passed | Implementation proof `fd30d6bd7c56e745a83114722147e83605f01cdd`; main merge `ace9f6f45e21468ae29a68f4ff741ac3994764af`; root CI `30581812037`; deploy/smoke `30581812029`; typed Logout Tokens, atomic replay/revocation and no-CORS provider route verified |
| `GATE-AUTH-DATABASE-PERMISSION-V1` | passed | Implementation proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; main merge `3a81f7f32c794b18524f0050828300e76ad4df95`; root CI `30601433379`; deploy/smoke `30601433411`; current grants, assurance, server-owned scope and bounded request streaming verified |
| `GATE-PILOT-DATABASE-READ-MODEL-V1` | passed | Implementation proof `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; main merge `a81b0025d0427398a616b316dd96451d5e15bcaf`; root CI `30605205955`; deploy/smoke `30605205966`; exact session scope, current roles/grants, digest-bound payloads, private ETags and bounded cache verified |

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
| `AUTH-05` | post-integration | provider cache and signing-key rotation gate passed; provider routes disabled | proof `d8e60bc045265799d6ecf63da6a75e22c9287459`; main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`; CI `30574007099`; deploy `30574006810` |
| `AUTH-06` | post-integration | fresh AAL2 step-up gate passed; provider routes disabled | proof `17b53865900c3606bf5781a9ed0cf0b856262782`; main merge `12881a80c6776020c8e26ca70ffb4af5c6b42b39`; CI `30578058983`; deploy `30578058937` |
| `AUTH-07` | post-integration | atomic provider back-channel logout gate passed; real provider login disabled | proof `fd30d6bd7c56e745a83114722147e83605f01cdd`; main merge `ace9f6f45e21468ae29a68f4ff741ac3994764af`; CI `30581812037`; deploy `30581812029` |
| `AUTH-08` | post-integration | database-backed permission gate passed; real provider login disabled | proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; main merge `3a81f7f32c794b18524f0050828300e76ad4df95`; CI `30601433379`; deploy `30601433411` |
| `PILOT-04` | post-integration | tenant-safe database runtime read-model gate passed; production projection source disabled | proof `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; main merge `a81b0025d0427398a616b316dd96451d5e15bcaf`; CI `30605205955`; deploy `30605205966` |

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

## AUTH-05 provider cache and signing-key rotation gate closure

Completed and verified on implementation proof `d8e60bc045265799d6ecf63da6a75e22c9287459` and main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`:

- exact HTTPS origin pins for issuer, authorization, token and JWKS endpoints;
- reviewed provider endpoint changes denied after cached discovery;
- bounded discovery and JWKS freshness with conditional ETag revalidation;
- bounded stale-if-error use only for previously approved provider data;
- single-flight discovery and JWKS refreshes;
- bounded retired signing-key overlap;
- same-`kid` key-material reuse denied;
- unknown token `kid` triggers exactly one forced refresh;
- known-key signature failure does not refresh;
- malformed, future-dated and overlong durable-cache records fail closed;
- Cloudflare readiness exposes only generic cache/origin requirements while `loginEnabled` remains false.

Verification evidence:

- repository tests: 584 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- TDD red gate proved both timestamp-poisoning regressions failed before implementation;
- migrations: 40 canonical migrations plus one AUTH post-integration migration passed on fresh PostgreSQL;
- all platform, SIS, finance, integrations, student-support and experience browser suites passed;
- root CI `30574007099` and Cloudflare deploy/smoke `30574006810` passed;
- all asset budgets remained within approved limits.


## AUTH-06 fresh step-up assurance gate closure

Completed and verified on implementation proof `17b53865900c3606bf5781a9ed0cf0b856262782`:

- signed OAuth transactions bind the requested AAL2 assurance and freshness window;
- step-up authorization forces `prompt=login` and `max_age=0`;
- optional reviewed ACR values are count-, length-, whitespace- and control-character bounded;
- callback completion requires locally verified AAL2 and an `auth_time` no older than five minutes;
- missing, future, stale or AAL1 authentication fails closed before membership or session issuance;
- readiness exposes forced reauthentication, bounded fresh authentication and reviewed ACR controls while `loginEnabled` remains false.

Verification evidence:

- TDD red gate proved the fresh-AAL2 and stale/AAL1 regressions failed before implementation;
- repository tests: 588 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- migrations: 40 canonical migrations plus one AUTH post-integration migration passed on fresh PostgreSQL;
- all platform, SIS, finance, integrations, student-support and experience browser suites passed;
- root CI `30578058983` and Cloudflare deploy/smoke `30578058937` passed;
- build, budget, audit, licence, provenance and execution-artifact gates passed.


## AUTH-07 provider back-channel logout gate closure

Completed and verified on implementation proof `fd30d6bd7c56e745a83114722147e83605f01cdd`:

- strict RS256 `logout+jwt` verification with exact issuer, audience and empty logout event;
- nonce denial and required provider subject or session id;
- bounded token length, age, lifetime, audiences and identifiers;
- one forced JWKS refresh only for an unknown key id;
- provider `sid` retained in signed and durable browser-session context;
- JTI replay insertion and exact provider `sid`/`sub` revocation performed atomically;
- persistence failure rolls back JTI consumption so provider retry remains possible;
- function-only database access for replay, revocation and provider cache;
- form-only bounded provider endpoint with pre-body length rejection, no CORS, no cookie and `no-store`;
- readiness remains non-sensitive and real provider login remains disabled.

Verification evidence:

- TDD red gates covered cryptographic, durable, HTTP and atomic-outage behavior;
- repository tests: 602 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately;
- migrations: 40 canonical plus AUTH-03 and AUTH-07, producing 42 ledger entries;
- root CI `30581812037` and Cloudflare deploy/smoke `30581812029` passed;
- build, budget, audit, licence, provenance, browser and execution-artifact gates passed.


## AUTH-08 database permission gate closure

Completed and verified on implementation proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514` and main merge `3a81f7f32c794b18524f0050828300e76ad4df95`:

- permission decisions derive only from an active durable browser session and current database-owned membership, role and grant state;
- browser-declared tenant, campus, membership, principal, role, assurance and session scope are not accepted;
- revoked or expired sessions, disabled accounts, removed roles and missing grants fail closed;
- AAL2-required permissions return an explicit step-up decision for AAL1 sessions;
- `/auth/v1/authorize` requires the exact configured web origin, signed HttpOnly cookie and exact permission-only JSON body;
- public session introspection omits the opaque session identifier;
- unsupported media types and malformed or extra fields are rejected;
- declared and chunked request bodies are bounded to 2 KiB before parsing;
- `app_runtime` retains function-only database access;
- provider login, production identity/data and mutations remain disabled.

Verification evidence:

- TDD red gates proved database authority, malformed permission, exact-origin HTTP and chunked-body regressions before implementation;
- repository tests: 613 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- browser journeys: 22 passed;
- post-integration manifest: three AUTH migrations after the immutable 40-migration canonical manifest; 43 ledger entries verified on fresh PostgreSQL;
- format, lint, architecture boundaries, TypeScript, builds, budget, audit, licence, provenance and artifact validation passed;
- root CI `30601433379` and Cloudflare deploy/smoke `30601433411` passed.

## Live staging routes

- Role chooser: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`
- Admin: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/admin`
- Teacher: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/teacher`
- Guardian: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/family`
- Student: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/student`
- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`
- OIDC readiness: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/readiness`
- Browser session introspection: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/session`
- Database permission decision: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/authorize` — currently fail-closed without reviewed identity and database bindings
- Browser logout: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/logout` — currently fail-closed because real browser identity configuration is disabled
- Provider back-channel logout: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/backchannel-logout` — currently fail-closed without a reviewed real provider and durable production binding
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
- AUTH-05 proof: `d8e60bc045265799d6ecf63da6a75e22c9287459`
- AUTH-05 main merge: `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`
- AUTH-06 proof: `17b53865900c3606bf5781a9ed0cf0b856262782`
- AUTH-06 main merge: `12881a80c6776020c8e26ca70ffb4af5c6b42b39`
- AUTH-07 proof: `fd30d6bd7c56e745a83114722147e83605f01cdd`
- AUTH-07 main merge: `ace9f6f45e21468ae29a68f4ff741ac3994764af`
- AUTH-08 proof: `6a1d49cc47ebae090470db4ee8c7c6f56953b514`
- AUTH-08 main merge: `3a81f7f32c794b18524f0050828300e76ad4df95`

## Final integrated system verification

### Application and browser evidence

- Repository tests: 613 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately; AUTH-08 adds database-owned permission, current-grant/role, assurance, exact-origin HTTP and bounded-stream coverage without changing domain invariants.
- Browser journeys: 22 passed.
- Format, lint, architecture boundaries, typecheck, Worker/Vite builds, audit, licence, provenance and artifact validation passed.
- Assets remain within approved initial and total budgets.

### Database and recovery evidence

- Canonical migration manifest: 40 immutable migrations.
- Post-integration AUTH manifest: three migrations; 43 total ledger entries verified.
- Exact Neon project: `lingering-brook-52999532`.
- Exact integration Neon branch: `br-shiny-silence-axznuy37`.
- Idempotent apply, forced RLS, `app_runtime` policy, finance immutability/balance, cross-tenant probes and disposable recovery replay passed.

## Remaining production milestones

- configure a reviewed provider, production provider-cache binding and production database binding;
- add reviewed provider front-channel logout/token revocation where supported;
- replace synthetic snapshots with database-backed read models and tenant-safe server caching;
- provide approved staging seed/reset tooling and safe mutations;
- add monitoring, backup and rollback rehearsal;
- complete owner-led UAT and explicit production authorization.

## Safe cleanup report

No Git branch, worktree or Neon branch was deleted. Cleanup remains owner-reviewed only.

## Production boundary

No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. AUTH-01 through AUTH-08 provide provider-neutral verification, PKCE flow, durable identity state, browser and provider session termination, bounded provider caching, signing-key rotation, fresh-AAL2 step-up and database-backed permission contracts with real login explicitly disabled. Production promotion requires all remaining provider, policy, data, monitoring, recovery and owner-authorization gates.
