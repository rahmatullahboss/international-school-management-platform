# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`  
**Updated:** 2026-07-30  
**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY` passed for the integrated candidate. Cloudflare staging infrastructure was deployed and verified through merge `41639fab433491df0395d02217a70c6eb2ddb775`. `PILOT-01` is now composing the integrated role packages into a browser-runnable acceptance environment.

Historical checkpoint-by-checkpoint evidence through Wave 3 is preserved in [the archived tracker](archive/04-progress-tracker-through-wave3.md). PILOT-01 scope and gates are recorded in [09-pilot-runtime-composition.md](09-pilot-runtime-composition.md).

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
| `GATE-PILOT-RUNTIME-COMPOSED` | in progress | Branch `pilot/runtime-portal-composition`; role composition, synthetic read models, browser coverage and expanded Cloudflare smoke tests added; final CI/deploy evidence pending |

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
| `PILOT-01` | post-integration | runtime composition in progress | base `41639fab433491df0395d02217a70c6eb2ddb775`; branch `pilot/runtime-portal-composition` |

## PILOT-01 checkpoint

Implemented on the working branch:

- pilot role chooser at `/`;
- admin, teacher, guardian and student runtime shells;
- existing EXP-01 overview components mounted in the composition root;
- deep-link route surfaces covering all integrated module families;
- synthetic, non-sensitive staging read models;
- responsive pilot UI and capability-scoped navigation;
- new browser journeys for role and module composition;
- Cloudflare smoke-test expansion for every role route;
- staging deployment and execution documentation updates.

Pending before gate closure:

- exact-head root CI;
- exact-head Cloudflare deployment and live smoke evidence;
- any corrections discovered by format, lint, typecheck, build or browser runs;
- reviewed merge to main.

## Reviewed integration lineage

- Foundation: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
- Wave 1: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
- Wave 2: `60836a8fe92f64ba581c4bde65005729d1fe14b2`
- EXP implementation: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`
- Wave 3 main merge: `6093109c8c573c3b4495141ad71661d5d5ca22c1`
- Cloudflare staging merge: `41639fab433491df0395d02217a70c6eb2ddb775`

## Final integrated system verification

### Application and browser evidence

- Repository tests: 504 passed before PILOT-01 additions.
- Browser journeys: 15/15 passed before PILOT-01 additions across platform, SIS, finance, integrations, student support and EXP.
- Platform-web production budget before composition: 201,022-byte JavaScript and 4,054-byte CSS.
- Required PWA manifest, service worker, offline page and icons were present.
- Format, lint, architecture boundaries, typecheck, Worker build, Vite build, dependency audit, licence policy, provenance drift and execution-artifact validation passed.

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

## Safe cleanup report

No Git branch, worktree or Neon branch was deleted. Cleanup remains owner-reviewed only. A resource is eligible only when it is clean, inactive, reachable from reviewed integration history and no longer required for rollback or audit.

## Production boundary

No production deployment, production database mutation, production cache purge or destructive cleanup was performed. Cloudflare staging and PILOT-01 use synthetic records and non-production Workers. Production promotion still requires reviewed authentication, permission-aware API read models, approved staging data, monitoring, rollback, backup rehearsal and explicit owner authorization.
