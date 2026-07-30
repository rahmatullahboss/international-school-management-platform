# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`  
**Updated:** 2026-07-30  
**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1` and `GATE-PILOT-SIGNED-SESSION-V1` have passed. The non-production Cloudflare pilot now requires a short-lived signed synthetic session before role-scoped Worker snapshots are read, while production identity and mutations remain disabled.

Historical checkpoint-by-checkpoint evidence through Wave 3 is preserved in [the archived tracker](archive/04-progress-tracker-through-wave3.md). PILOT-01 scope is recorded in [09-pilot-runtime-composition.md](09-pilot-runtime-composition.md), UX continuity in [10-ux-continuity-v1.md](10-ux-continuity-v1.md) and [11-ux-continuity-release-evidence.md](11-ux-continuity-release-evidence.md), scoped reads in [12-pilot-read-api-v1.md](12-pilot-read-api-v1.md) and [13-pilot-read-api-release-evidence.md](13-pilot-read-api-release-evidence.md), and signed staging sessions in [14-pilot-signed-session-v1.md](14-pilot-signed-session-v1.md) and [15-pilot-signed-session-release-evidence.md](15-pilot-signed-session-release-evidence.md).

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

## Live staging routes

- Role chooser: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`
- Admin: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/admin`
- Teacher: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/teacher`
- Guardian: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/family`
- Student: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/student`
- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`
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

## Final integrated system verification

### Application and browser evidence

- Repository tests: 514 passed; PILOT-03 adds signed-session, expiry and role-binding coverage without changing domain invariants.
- Browser journeys: 22 passed.
- Format, lint, architecture boundaries, typecheck, Worker/Vite builds, audit, licence, provenance and artifact validation passed.
- Assets remain within approved initial and total budgets.

### Database and recovery evidence

- Canonical migration manifest: 40 migrations.
- Exact Neon project: `lingering-brook-52999532`.
- Exact integration Neon branch: `br-shiny-silence-axznuy37`.
- Idempotent apply, forced RLS, `app_runtime` policy, finance immutability/balance, cross-tenant probes and disposable recovery replay passed.

## Remaining production milestones

- implement reviewed OAuth/OIDC Authorization Code with PKCE and issuer/JWKS validation;
- resolve real user memberships, tenant/campus context and database-backed permissions;
- adopt a reviewed same-origin BFF/HttpOnly production session design or approved equivalent;
- add logout, revocation, step-up assurance and negative authorization tests;
- replace synthetic snapshots with database-backed read models and tenant-safe server caching;
- provide approved staging seed/reset tooling and safe mutations;
- add monitoring, backup and rollback rehearsal;
- complete owner-led UAT and explicit production authorization.

## Safe cleanup report

No Git branch, worktree or Neon branch was deleted. Cleanup remains owner-reviewed only.

## Production boundary

No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. Production promotion requires all remaining identity, policy, data, monitoring, recovery and owner-authorization gates.
