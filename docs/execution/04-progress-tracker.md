# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`  
**Updated:** 2026-07-30  
**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED` and `GATE-UX-CONTINUITY-V1` have passed. The non-production Cloudflare pilot now provides continuous client navigation, task-led role menus and synthetic records without enabling production mutations.

Historical checkpoint-by-checkpoint evidence through Wave 3 is preserved in [the archived tracker](archive/04-progress-tracker-through-wave3.md). PILOT-01 scope is recorded in [09-pilot-runtime-composition.md](09-pilot-runtime-composition.md), while the UX continuity contract and evidence are recorded in [10-ux-continuity-v1.md](10-ux-continuity-v1.md) and [11-ux-continuity-release-evidence.md](11-ux-continuity-release-evidence.md).

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
| `PILOT-01` | post-integration | runtime composed and staged | base `41639fab433491df0395d02217a70c6eb2ddb775`; candidate `a50ad782489137f5afd806e30c7a3e249b5074ec`; CI `30484622352`; deploy `30484622364` |
| `UX-01` | post-integration | continuity gate passed and staged | candidate `e74a30143eb7882e81ebd7d5b5c373d3132b309e`; CI `30490122291`; deploy `30490122337` |

## PILOT-01 gate closure

Completed and verified:

- role chooser at `/` with accessible skip navigation and responsive role cards;
- admin, teacher, guardian and student runtime shells;
- existing EXP-01 overview components mounted into role-specific composition roots;
- deep-link route surfaces covering all integrated module families;
- synthetic, non-sensitive read models and explicit production-mutation boundary;
- capability-scoped navigation and role-level lazy loading;
- browser journeys for role selection, representative module routes and role scoping;
- Cloudflare live smoke tests for role chooser, admin, teacher, guardian, student, manifest, offline page and API health;
- deployment, execution, progress and release evidence documentation.

Verified PILOT-01 performance evidence:

- initial JavaScript: 203,338 bytes against a 250,000-byte limit;
- initial CSS: 8,475 bytes against a 50,000-byte limit;
- total route JavaScript: 283,316 bytes against a 350,000-byte limit;
- total route CSS: 60,355 bytes against an 85,000-byte limit;
- no budget violation.

## UX-01 continuity gate closure

Completed and verified on candidate `e74a30143eb7882e81ebd7d5b5c373d3132b309e`:

- same-origin application links navigate through browser history without reloading the document;
- browser back and forward retain the application instance and current role shell;
- role bundles preload on pointer intent, keyboard focus and suitable idle time;
- the current screen remains available while a destination bundle prepares;
- in-app transitions use a non-blocking progress status rather than a separate loading screen;
- initial direct deep links use a skeleton in the final shell layout;
- role navigation is grouped by familiar school tasks and long menus include task search;
- active location, identity, capability filtering, connectivity and native link behaviour remain explicit;
- reduced-motion, responsive, RTL, keyboard and role-isolation journeys pass;
- staging deployment concurrency is isolated by branch so unrelated pull requests cannot cancel the verified run.

Verification evidence:

- repository tests: 504 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- browser journeys: 20 passed across platform/UX, SIS, finance, integrations, student support and EXP suites;
- initial JavaScript: 207,287 bytes against a 250,000-byte limit;
- initial CSS: 13,514 bytes against a 50,000-byte limit;
- total route JavaScript: 292,668 bytes against a 350,000-byte limit;
- total route CSS: 71,650 bytes against an 85,000-byte limit;
- no build-budget violation.

## Live staging routes

- Role chooser: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`
- Admin: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/admin`
- Teacher: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/teacher`
- Guardian: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/family`
- Student: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/student`
- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`

## Reviewed integration lineage

- Foundation: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
- Wave 1: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
- Wave 2: `60836a8fe92f64ba581c4bde65005729d1fe14b2`
- EXP implementation: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`
- Wave 3 main merge: `6093109c8c573c3b4495141ad71661d5d5ca22c1`
- Cloudflare staging merge: `41639fab433491df0395d02217a70c6eb2ddb775`
- PILOT-01 verified candidate: `a50ad782489137f5afd806e30c7a3e249b5074ec`
- UX-01 verified candidate: `e74a30143eb7882e81ebd7d5b5c373d3132b309e`

## Final integrated system verification

### Application and browser evidence

- Repository tests: 504 passed; UX-01 changed navigation and copy contracts without changing domain-test outcomes.
- Browser journeys: 20 passed across platform/UX, SIS, finance, integrations, student support and EXP suites.
- Format, lint, architecture boundaries, typecheck, Worker build, Vite build, dependency audit, licence policy, provenance drift and execution-artifact validation passed.
- Role bundles remain lazy-loaded and intent-prefetched, keeping the initial payload within the approved production budget.

### Database and recovery evidence

- Canonical migration manifest: 40 migrations.
- Exact Neon project: `lingering-brook-52999532`.
- Exact integration Neon branch: `br-shiny-silence-axznuy37`.
- Idempotent canonical apply passed.
- Forced RLS and `app_runtime` policy checks passed.
- Posted-journal and posted-line immutability checks passed.
- No unbalanced posted journal was found.
- Cross-tenant read and write probes passed.
- Disposable database apply, verification and cleanup replay passed.

## Remaining production milestones

- replace synthetic read models with permission-aware Worker APIs and a tenant-safe stale-while-revalidate cache;
- implement reviewed OAuth/OIDC login, renewal, logout, role, tenant and campus context;
- provide approved staging tenant seed and reset tooling;
- connect safe pilot mutations and live permission-negative tests;
- add monitoring, alerting, backup evidence and rollback rehearsal;
- complete owner-led user acceptance before production-domain consideration.

## Safe cleanup report

No Git branch, worktree or Neon branch was deleted. Cleanup remains owner-reviewed only. A resource is eligible only when it is clean, inactive, reachable from reviewed integration history and no longer required for rollback or audit.

## Production boundary

No production deployment, production database mutation, production cache purge or destructive cleanup was performed. Cloudflare staging and UX-01 use synthetic records and non-production Workers. Production promotion still requires reviewed authentication, permission-aware APIs and cache isolation, approved staging data, monitoring, rollback, backup rehearsal and explicit owner authorization.
