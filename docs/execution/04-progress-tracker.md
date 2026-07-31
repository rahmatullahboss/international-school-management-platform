# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`  
**Updated:** 2026-08-01  
**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1`, `GATE-OIDC-PKCE-FLOW-V1`, `GATE-AUTH-DURABLE-CONTEXT-V1`, `GATE-AUTH-SESSION-TERMINATION-V1`, `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1`, `GATE-AUTH-FRESH-STEP-UP-V1`, `GATE-AUTH-BACKCHANNEL-LOGOUT-V1`, `GATE-AUTH-DATABASE-PERMISSION-V1`, `GATE-PILOT-DATABASE-READ-MODEL-V1`, `GATE-PILOT-SAFE-MUTATION-V1`, `GATE-PILOT-RUNTIME-PROJECTION-WORKER-V1`, `GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1`, `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1`, `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1` and `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching, signing-key rotation, fresh-AAL2 step-up, atomic provider back-channel logout, database-backed permission governance, tenant-safe database runtime projections with current-grant revalidation and one tightly allowlisted AAL2/idempotent/revision-checked runtime refresh command with atomic audit/outbox persistence, and a database-native SKIP LOCKED projection processor with applied-command deduplication, bounded retries and terminal dead-letter isolation, plus a privileged non-HTTP projection source publisher with database-owned persona/subject derivation, monotonic source revisions and append-only evidence, and database-owned admin, teacher and guardian home composers with authoritative scoped metrics, deterministic unchanged-payload no-op evidence, canonical persona capabilities, verified guardian authority, education/billing separation and canonical campus-lineage isolation, while real provider login, production mapping/publisher/composer credentials and source population, production database/worker bindings, production schedule activation and general production mutations remain disabled.

Historical checkpoint-by-checkpoint evidence through Wave 3 is preserved in [the archived tracker](archive/04-progress-tracker-through-wave3.md). PILOT-01 scope is recorded in [09-pilot-runtime-composition.md](09-pilot-runtime-composition.md), UX continuity in [10-ux-continuity-v1.md](10-ux-continuity-v1.md) and [11-ux-continuity-release-evidence.md](11-ux-continuity-release-evidence.md), scoped reads in [12-pilot-read-api-v1.md](12-pilot-read-api-v1.md) and [13-pilot-read-api-release-evidence.md](13-pilot-read-api-release-evidence.md), and signed staging sessions in [14-pilot-signed-session-v1.md](14-pilot-signed-session-v1.md) [15-pilot-signed-session-release-evidence.md](15-pilot-signed-session-release-evidence.md), and the OIDC trust boundary in [16-oidc-trust-boundary-v1.md](16-oidc-trust-boundary-v1.md) and [17-oidc-trust-boundary-release-evidence.md](17-oidc-trust-boundary-release-evidence.md), with the PKCE flow in [18-oidc-pkce-flow-v1.md](18-oidc-pkce-flow-v1.md) and [19-oidc-pkce-flow-release-evidence.md](19-oidc-pkce-flow-release-evidence.md), and durable identity context in [20-auth-durable-context-v1.md](20-auth-durable-context-v1.md) and [21-auth-durable-context-release-evidence.md](21-auth-durable-context-release-evidence.md), with browser session termination in [22-auth-session-termination-v1.md](22-auth-session-termination-v1.md) and [23-auth-session-termination-release-evidence.md](23-auth-session-termination-release-evidence.md), and provider cache/key rotation governance in [24-auth-provider-cache-key-rotation-v1.md](24-auth-provider-cache-key-rotation-v1.md) and [25-auth-provider-cache-key-rotation-release-evidence.md](25-auth-provider-cache-key-rotation-release-evidence.md), with fresh step-up assurance in [26-auth-fresh-step-up-assurance-v1.md](26-auth-fresh-step-up-assurance-v1.md) and [27-auth-fresh-step-up-assurance-release-evidence.md](27-auth-fresh-step-up-assurance-release-evidence.md), and provider back-channel logout in [28-auth-backchannel-logout-v1.md](28-auth-backchannel-logout-v1.md) and [29-auth-backchannel-logout-release-evidence.md](29-auth-backchannel-logout-release-evidence.md), with database-backed permission evaluation in [30-auth-database-permission-evaluation-v1.md](30-auth-database-permission-evaluation-v1.md) and [31-auth-database-permission-release-evidence.md](31-auth-database-permission-release-evidence.md), followed by tenant-safe database runtime read models in [32-pilot-database-read-models-v1.md](32-pilot-database-read-models-v1.md) and [33-pilot-database-read-models-release-evidence.md](33-pilot-database-read-models-release-evidence.md), and the first safe database mutation envelope in [34-pilot-safe-database-mutation-v1.md](34-pilot-safe-database-mutation-v1.md) and [35-pilot-safe-database-mutation-release-evidence.md](35-pilot-safe-database-mutation-release-evidence.md), followed by the durable runtime projection worker in [36-pilot-runtime-projection-worker-v1.md](36-pilot-runtime-projection-worker-v1.md) and [37-pilot-runtime-projection-worker-release-evidence.md](37-pilot-runtime-projection-worker-release-evidence.md), and the controlled runtime projection source publisher in [38-pilot-runtime-projection-source-publisher-v1.md](38-pilot-runtime-projection-source-publisher-v1.md) and [39-pilot-runtime-projection-source-publisher-release-evidence.md](39-pilot-runtime-projection-source-publisher-release-evidence.md), followed by the database-owned admin runtime composer in [40-pilot-admin-runtime-projection-composer-v1.md](40-pilot-admin-runtime-projection-composer-v1.md) and [41-pilot-admin-runtime-projection-composer-release-evidence.md](41-pilot-admin-runtime-projection-composer-release-evidence.md), and the database-owned teacher runtime composer in [42-pilot-teacher-runtime-projection-composer-v1.md](42-pilot-teacher-runtime-projection-composer-v1.md) and [43-pilot-teacher-runtime-projection-composer-release-evidence.md](43-pilot-teacher-runtime-projection-composer-release-evidence.md), followed by the database-owned guardian runtime composer in [44-pilot-guardian-runtime-projection-composer-v1.md](44-pilot-guardian-runtime-projection-composer-v1.md) and [45-pilot-guardian-runtime-projection-composer-release-evidence.md](45-pilot-guardian-runtime-projection-composer-release-evidence.md).

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
| `GATE-PILOT-SAFE-MUTATION-V1` | passed | Implementation proof `2ff251c17d2b4d939a6f274402da99e6447707fd`; main merge `9f32a588d7b61d4ef8b1ac38dc4807fa329212de`; root CI `30608179482`; deploy/smoke `30608179484`; exact-origin AAL2/current-grant authorization, optimistic revision, replay-safe idempotency and atomic receipt/audit/outbox verified |
| `GATE-PILOT-RUNTIME-PROJECTION-WORKER-V1` | passed | Implementation proof `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829`; main merge `a731f89fc4c6476580129ab0cd734e9250c0aa64`; root CI `30635344251`; deploy/smoke `30635344238`; exact event allowlist, SKIP LOCKED claims, source integrity, applied-command deduplication, bounded retry and terminal dead-letter isolation verified |
| `GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1` | passed | Implementation proof `0ae5b782adb2443d74fafdf4c191638b949d379d`; main merge `1321466a690c1f70be4d1528ed7015f029083302`; root CI `30648006915`; privileged function-only publication, reviewed persona mapping, server-owned subject, monotonic source revisions, append-only evidence and publisher-to-worker projection `8 → 9` verified |
| `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1` | passed | Implementation proof `22802925c2a38b355b0f219e762c6e18cc5cd1be`; main merge `7476fbfe8830ba98e3a7500165950f26b8bd1310`; root CI `30651595094`; privileged function-only composition, authoritative admin metrics, deterministic unchanged no-op and composer-to-worker projection `9 → 10` verified |
| `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1` | passed | Implementation proof `0db23a475b8cd5db980b657922813e907077bed8`; main merge `e6301efaaa374e34b9e2719977f3a5eee51ec651`; root CI `30659200077`; privileged teacher composition, database-owned staff identity, canonical capabilities, exact campus isolation and composer-to-worker projection `4 → 5` verified |
| `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` | passed | Implementation proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; main merge `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`; root CI `30662644211`; verified child authority, education/billing separation, canonical campus lineage and composer-to-worker projection `3 → 4` verified |

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
| `PILOT-05` | post-integration | safe allowlisted database mutation gate passed; production mutation source/consumer disabled | proof `2ff251c17d2b4d939a6f274402da99e6447707fd`; main merge `9f32a588d7b61d4ef8b1ac38dc4807fa329212de`; CI `30608179482`; deploy `30608179484` |
| `PILOT-06` | post-integration | durable runtime projection worker gate passed; source/database binding and schedule activation disabled | proof `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829`; main merge `a731f89fc4c6476580129ab0cd734e9250c0aa64`; CI `30635344251`; deploy `30635344238` |
| `PILOT-07` | post-integration | controlled runtime projection source publisher gate passed; production credentials, mappings and source population disabled | proof `0ae5b782adb2443d74fafdf4c191638b949d379d`; main merge `1321466a690c1f70be4d1528ed7015f029083302`; CI `30648006915`; non-HTTP staging deploy not required |
| `PILOT-08` | post-integration | database-owned admin runtime composer gate passed; production composer credential, cadence and source population disabled | proof `22802925c2a38b355b0f219e762c6e18cc5cd1be`; main merge `7476fbfe8830ba98e3a7500165950f26b8bd1310`; CI `30651595094`; non-HTTP staging deploy not required |
| `PILOT-09` | post-integration | database-owned teacher runtime composer gate passed; production composer credential, cadence and source population disabled | proof `0db23a475b8cd5db980b657922813e907077bed8`; main merge `e6301efaaa374e34b9e2719977f3a5eee51ec651`; CI `30659200077`; non-HTTP staging deploy not required |
| `PILOT-10` | post-integration | database-owned guardian runtime composer gate passed; production composer credential, authority data, cadence and source population disabled | proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; main merge `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`; CI `30662644211`; non-HTTP staging deploy not required |

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

## PILOT-06 durable runtime projection worker gate closure

Completed and verified on implementation proof `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829` and main merge `a731f89fc4c6476580129ab0cd734e9250c0aa64`:

- one exact `platform.runtime_snapshot_refresh_requested` event type is processed;
- bounded deterministic batches use `FOR UPDATE OF event SKIP LOCKED`;
- immutable receipt, scope, projection revision and source integrity are revalidated;
- duplicate command delivery cannot advance a projection twice;
- expected failures use bounded exponential retry and terminal dead-letter isolation;
- unknown receipts cannot roll back terminal isolation through the dead-letter foreign key;
- `app_runtime` retains function-only access to source, applied-command and dead-letter state;
- scheduled and readiness boundaries fail closed without database/source bindings;
- Cloudflare Worker/API/web deployment and all live smoke assertions passed;
- the current Cloudflare token could not publish the configured schedule, recorded explicitly as `STAGING_CRON_TRIGGER_STATE=unavailable`.

Verification evidence:

- repository tests: 654 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- migrations: 40 canonical plus six post-integration migrations, producing 46 ledger entries;
- format, lint, boundaries, TypeScript, builds, budget, audit, licence, provenance, browser and artifact gates passed;
- root CI `30635344251` and Cloudflare deploy/smoke `30635344238` passed.

## PILOT-07 controlled runtime projection source publisher gate closure

Completed and verified on implementation proof `0ae5b782adb2443d74fafdf4c191638b949d379d` and main merge `1321466a690c1f70be4d1528ed7015f029083302`:

- separate no-login, no-bypass-RLS roles govern persona mapping and source publication;
- all privileged roles retain function-only access and `app_runtime` cannot publish source payloads;
- active account, exact membership/campus and current reviewed role mappings determine scope;
- persona and subject are database-owned and cannot be injected by the caller or payload;
- unmapped, ambiguous, inactive, stale, oversized and scope-bearing publications fail closed;
- source revisions are monotonic and the existing trigger owns payload digest and byte integrity;
- mapping changes and accepted source publications retain append-only governance and audit evidence;
- no public HTTP route or publisher credential was introduced;
- fresh PostgreSQL verified source publication, safe mutation, worker processing and projection revision `8 → 9` end to end.

Verification evidence:

- ordinary suite: 662 tests passed, with one environment-dependent direct-Neon test skipped and passed separately against live Neon;
- migrations: 40 canonical plus seven post-integration migrations, producing 47 ledger entries;
- browser journeys: 22 passed;
- format, lint, boundaries, TypeScript, builds, budget, audit, licence, provenance and artifact gates passed;
- root CI `30648006915` passed; Cloudflare staging was expectedly skipped for this non-HTTP milestone.

## PILOT-08 database-owned admin runtime composer gate closure

Completed and verified on implementation proof `22802925c2a38b355b0f219e762c6e18cc5cd1be` and main merge `7476fbfe8830ba98e3a7500165950f26b8bd1310`:

- a separate no-login, no-bypass-RLS role has function-only composer authority;
- `app_runtime`, persona mapping and source publisher roles cannot execute the composer;
- active account, exact membership/campus and reviewed database-owned persona mapping determine scope;
- the caller cannot provide payload, persona, subject, capabilities or expanded browser scope;
- active enrollment, open attendance, unmatched bank lines and open cashier sessions provide bounded authoritative admin metrics;
- campus-local date and legal-entity finance scope are database-derived;
- deterministic payload digests produce audited `unchanged` no-ops without advancing source revision or publication evidence;
- changed domain state publishes only through the reviewed PILOT-07 source publisher;
- successful composition runs and audit evidence are append-only;
- fresh PostgreSQL verified published → unchanged → published composition and projection revision `9 → 10` using source revision four;
- no public HTTP route or composer credential was introduced.

Verification evidence:

- complete canonical application and browser suites passed;
- migrations: 40 canonical plus eight post-integration migrations, producing 48 ledger entries;
- format, lint, boundaries, TypeScript, live Neon, builds, budget, audit, licence, provenance and artifact gates passed;
- root CI `30651595094` passed; Cloudflare staging was expectedly skipped for this non-HTTP milestone.

## PILOT-09 database-owned teacher runtime composer gate closure

Completed and verified on implementation proof `0db23a475b8cd5db980b657922813e907077bed8` and main merge `e6301efaaa374e34b9e2719977f3a5eee51ec651`:

- the existing no-login, no-bypass-RLS composer role has function-only teacher composition authority;
- `app_runtime`, persona mapping and source publisher roles cannot execute the teacher composer;
- active account, exact campus membership and reviewed teacher persona mapping determine scope;
- account-to-person-to-active-campus-staff linkage is database-owned and cannot be supplied by the caller;
- published campus timetables, assigned meetings, attendance sessions and gradebook rows provide bounded authoritative workload;
- canonical capabilities are `classes.assigned.read`, `attendance.assigned.write` and `gradebook.assigned.write`;
- every timetable and gradebook query is constrained through the canonical published timetable campus;
- adversarial second-campus classes, inconsistent attendance and gradebook rows remain excluded;
- deterministic payload digests produce audited `unchanged` no-ops without advancing source revision or publication evidence;
- changed domain state publishes only through the reviewed PILOT-07 source publisher;
- successful persona-tagged composition runs and audit evidence are append-only;
- fresh PostgreSQL verified published → unchanged → published composition and projection revision `4 → 5` using source revision two;
- no public HTTP route or composer credential was introduced.

Verification evidence:

- complete canonical application and browser suites passed;
- migrations: 40 canonical plus nine post-integration migrations, producing 49 ledger entries;
- capability hardening CI `30658568371` and campus-isolation CI `30658930197` passed;
- format, lint, boundaries, TypeScript, live Neon, builds, budget, audit, licence, provenance and artifact gates passed;
- final root CI `30659200077` passed; Cloudflare staging was expectedly skipped for this non-HTTP milestone.

## PILOT-10 database-owned guardian runtime composer gate closure

Completed and verified on implementation proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286` and main merge `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`:

- the existing no-login, no-bypass-RLS composer role has function-only guardian composition authority;
- `app_runtime`, persona mapping and source publisher roles cannot execute the guardian composer;
- active account, exact campus membership and reviewed guardian persona mapping determine scope;
- account-to-active-person guardian linkage is database-owned and cannot be supplied by the caller;
- current verified portal authority plus active exact-campus child enrollment determines child visibility;
- education and billing authority independently gate attendance/grade and finance metrics;
- responsible-party finance scope is limited to the exact campus legal entity, currency and responsibility basis points;
- canonical capabilities are `student.household.read`, `attendance.household.read`, `records.household.read` and `finance.household.read`;
- attendance and grades are constrained through canonical published timetable campus lineage;
- unverified, expired, cross-campus and forged-campus child rows remain excluded;
- deterministic payload digests produce audited `unchanged` no-ops without advancing source revision or publication evidence;
- changed domain state publishes only through the reviewed PILOT-07 source publisher;
- successful persona-tagged composition runs and audit evidence are append-only;
- fresh PostgreSQL verified published → unchanged → published composition and projection revision `3 → 4` using source revision two;
- no public HTTP route or composer credential was introduced.

Verification evidence:

- complete canonical application and browser suites passed;
- migrations: 40 canonical plus ten post-integration migrations, producing 50 ledger entries;
- full authoring CI `30661567046` and campus-lineage hardening CI `30662369824` passed;
- format, lint, boundaries, TypeScript, live Neon, builds, budget, audit, licence, provenance and artifact gates passed;
- final root CI `30662644211` passed; Cloudflare staging was expectedly skipped for this non-HTTP milestone.

## Live staging routes

- Role chooser: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`
- Admin: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/admin`
- Teacher: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/teacher`
- Guardian: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/family`
- Student: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/student`
- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`
- OIDC readiness: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/readiness`
- Projection worker readiness: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/runtime-projection-worker/readiness` — live and fail-closed without database/source bindings
- Database runtime snapshot: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/snapshot` — currently fail-closed without reviewed identity and read-model bindings
- Safe runtime mutation: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/commands/runtime.snapshot.refresh` — currently fail-closed without reviewed identity and mutation bindings
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
- PILOT-04 proof: `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`
- PILOT-04 main merge: `a81b0025d0427398a616b316dd96451d5e15bcaf`
- PILOT-05 proof: `2ff251c17d2b4d939a6f274402da99e6447707fd`
- PILOT-05 main merge: `9f32a588d7b61d4ef8b1ac38dc4807fa329212de`
- PILOT-06 proof: `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829`
- PILOT-06 main merge: `a731f89fc4c6476580129ab0cd734e9250c0aa64`
- PILOT-07 proof: `0ae5b782adb2443d74fafdf4c191638b949d379d`
- PILOT-07 main merge: `1321466a690c1f70be4d1528ed7015f029083302`
- PILOT-08 proof: `22802925c2a38b355b0f219e762c6e18cc5cd1be`
- PILOT-08 main merge: `7476fbfe8830ba98e3a7500165950f26b8bd1310`
- PILOT-09 proof: `0db23a475b8cd5db980b657922813e907077bed8`
- PILOT-09 main merge: `e6301efaaa374e34b9e2719977f3a5eee51ec651`
- PILOT-10 proof: `d59334952813afafd00b2ddf4ae9b5e06d5f3286`
- PILOT-10 main merge: `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`

## Final integrated system verification

### Application and browser evidence

- Repository application suite: the complete canonical suite passed; PILOT-10 adds database-owned guardian identity and verified child authority, education/billing separation, canonical campus-lineage isolation, deterministic unchanged no-op evidence and guardian composer-to-worker lifecycle coverage without changing domain invariants.
- Browser journeys: the complete canonical browser suite passed.
- Format, lint, architecture boundaries, typecheck, Worker/Vite builds, audit, licence, provenance and artifact validation passed.
- Assets remain within approved initial and total budgets.

### Database and recovery evidence

- Canonical migration manifest: 40 immutable migrations.
- Post-integration manifest: ten migrations through PILOT-10; 50 total ledger entries verified.
- Exact Neon project: `lingering-brook-52999532`.
- Exact integration Neon branch: `br-shiny-silence-axznuy37`.
- Idempotent apply, forced RLS, `app_runtime` policy, finance immutability/balance, cross-tenant probes and disposable recovery replay passed.

## Remaining production milestones

- configure a reviewed provider, production provider-cache binding, production database binding and exact production origins;
- add reviewed provider front-channel logout/token revocation where supported;
- provision reviewed production mapping, publisher and composer credentials; approve admin, teacher and guardian composition cadence and add a separate student composer where required;
- authorize and publish the intended non-production/production Cron Trigger with least-privilege Cloudflare credentials;
- add projection outbox, retry and dead-letter monitoring plus approved source seed/reset tooling;
- complete backup, restore and rollback rehearsal;
- complete owner-led UAT, security sign-off and explicit production authorization.

## Safe cleanup report

No Git branch, worktree or Neon branch was deleted. Cleanup remains owner-reviewed only.

## Production boundary

No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. AUTH-01 through AUTH-08 provide provider-neutral verification, PKCE flow, durable identity state, browser and provider session termination, bounded provider caching, signing-key rotation, fresh-AAL2 step-up and database-backed permission contracts. PILOT-04 through PILOT-10 add tenant-safe database read models, one allowlisted safe mutation, a durable projection processor, a controlled non-HTTP source publisher and database-owned admin, teacher and guardian composers while real login, production mapping/publisher/composer credentials, guardian authority data and source population, database/worker bindings and schedule activation remain explicitly disabled. Production promotion requires all remaining provider, policy, data, monitoring, recovery and owner-authorization gates.
