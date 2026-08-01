# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`  
**Updated:** 2026-08-01  
**Current repository state:** All planned domain module streams are complete and integrated. The non-production pilot/canonical-CI implementation now has explicit E2E coverage for all seven principal product personas: Admin, Admissions, Finance/Cashier, Teacher, Guardian, Student and Platform/Support. PR #77, which provides the four original pilot-role E2E baseline, is merged to `main` at `18f50ecd252473034e6132cc6e911015c8ceb831`. PR #80 adds the remaining three independent operator personas and is the only pending integration PR for the seven-persona checkpoint.

The program is **not yet production-ready**. Real external IdP login for all seven personas is not yet proven on the deployed staging stack; Admissions, Finance/Cashier and Platform/Support are not yet connected end to end to durable deployed browser sessions, database-owned staging read models and real domain-write journeys; and production credentials, bindings, schedules and general mutations remain disabled.

Newest checkpoint documents:

- [50-product-persona-e2e-v2.md](50-product-persona-e2e-v2.md) — seven-principal-persona implementation checkpoint;
- [51-product-persona-e2e-v2-evidence.md](51-product-persona-e2e-v2-evidence.md) — canonical CI, PostgreSQL and Playwright evidence;
- [52-production-readiness-backlog.md](52-production-readiness-backlog.md) — remaining staging/production work and exit conditions.

Historical Wave 1-3 evidence remains in [the archived tracker](archive/04-progress-tracker-through-wave3.md). The existing numbered execution documents remain authoritative for the post-integration PILOT, UX and AUTH checkpoints.

## Gate status

| Gate | Status | Evidence |
|---|---|---|
| `GATE-DOCUMENTS-APPROVED` | passed | Foundation product/design/execution authorities approved |
| `GATE-FOUNDATION-READY` | passed | Foundation, tenancy, Neon, RLS, policy, UI and verification complete |
| `GATE-WAVE-1-INTEGRATED` | passed | `8cc8ee1562ade672b14c1c44af935fe7e2307976`; CI `30362743336` |
| `GATE-WAVE-2-INTEGRATED` | passed | `60836a8fe92f64ba581c4bde65005729d1fe14b2`; CI `30437010804` |
| `GATE-EXP-WAVE-3-INTEGRATION` | passed | `6093109c8c573c3b4495141ad71661d5d5ca22c1`; CI `30466808450` |
| `GATE-PILOT-READY` | passed | CI `30467898523`; Neon recovery `30467899681` |
| `GATE-CLOUDFLARE-STAGING` | passed | main `41639fab433491df0395d02217a70c6eb2ddb775`; CI `30479347127` |
| `GATE-PILOT-RUNTIME-COMPOSED` | passed | `a50ad782489137f5afd806e30c7a3e249b5074ec`; CI `30484622352` |
| `GATE-UX-CONTINUITY-V1` | passed | `e74a30143eb7882e81ebd7d5b5c373d3132b309e`; CI `30490122291` |
| `GATE-PILOT-READ-API-V1` | passed | `73be1c1eb0418c8c2f744729354bd9f1a63467b0`; CI `30495509757` |
| `GATE-PILOT-SIGNED-SESSION-V1` | passed | `0a36ef62ec1622bdea6de7d0135bf30026845528`; CI `30501350771` |
| `GATE-OIDC-TRUST-BOUNDARY-V1` | passed | `5d58706e119e34e72fee17d2a67be74428ad5ab3`; CI `30515626535` |
| `GATE-OIDC-PKCE-FLOW-V1` | passed | `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; CI `30517446940` |
| `GATE-AUTH-DURABLE-CONTEXT-V1` | passed | `9886f41d198772c684d3b245258964d4bcb0e83c`; CI `30530441477` |
| `GATE-AUTH-SESSION-TERMINATION-V1` | passed | `ea9093af5e2707edf45fde73a19af371d01cb8ac`; CI `30533390869` |
| `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` | passed | `d8e60bc045265799d6ecf63da6a75e22c9287459`; CI `30574007099` |
| `GATE-AUTH-FRESH-STEP-UP-V1` | passed | `17b53865900c3606bf5781a9ed0cf0b856262782`; CI `30578058983` |
| `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` | passed | `fd30d6bd7c56e745a83114722147e83605f01cdd`; CI `30581812037` |
| `GATE-AUTH-DATABASE-PERMISSION-V1` | passed | `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; CI `30601433379` |
| `GATE-PILOT-DATABASE-READ-MODEL-V1` | passed | `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; CI `30605205955` |
| `GATE-PILOT-SAFE-MUTATION-V1` | passed | `2ff251c17d2b4d939a6f274402da99e6447707fd`; CI `30608179482` |
| `GATE-PILOT-RUNTIME-PROJECTION-WORKER-V1` | passed | `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829`; CI `30635344251` |
| `GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1` | passed | `0ae5b782adb2443d74fafdf4c191638b949d379d`; CI `30648006915` |
| `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1` | passed | `22802925c2a38b355b0f219e762c6e18cc5cd1be`; CI `30651595094` |
| `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1` | passed | `0db23a475b8cd5db980b657922813e907077bed8`; CI `30659200077` |
| `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` | passed | `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; CI `30662644211` |
| `GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1` | passed | PILOT-11 proof `9a3978e294bc3d9f463780ec9154bed67d802eb8`; main `f260d18bab8084ab2132767f2d8fb3040290c6cd`; CI `30678621687` |
| `GATE-PILOT-PROJECTION-OPERATIONS-MONITOR-V1` | passed on main | PILOT-12 operations-monitor checkpoint is part of the current main lineage |
| `E2E-V1-FOUR-PILOT-ROLES` | passed and merged | PR #77; merge `18f50ecd252473034e6132cc6e911015c8ceb831`; canonical CI `30692087194`; 51 platform / 65 aggregate browser tests |
| `E2E-V2-SEVEN-PRINCIPAL-PERSONAS` | implementation passed; integration and production-depth open | PR #80; implementation proof `a14fa756ad9391bcce98a14b3ea5a6dea7b8455a`; canonical CI `30693986766`; 75 platform / 89 aggregate browser tests; PostgreSQL persona verifier passed |

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
| `EXP-01` | 3 | complete and integrated | implementation `5c952703c24ee9927fcf2cd480d3ce8d0d139847`; main `6093109c8c573c3b4495141ad71661d5d5ca22c1` |
| `INTEG-01` | gated serial | pilot ready | final system/recovery evidence preserved in the execution documentation |
| `PILOT-01..12` | post-integration | reviewed pilot runtime/read/auth/projection/composer/monitor checkpoints passed | individual numbered execution docs and gate evidence |
| `AUTH-01..08` | post-integration | provider-neutral auth/session/permission contracts passed; real provider activation disabled | latest AUTH-08 proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; CI `30601433379` |
| `E2E-V1` | post-integration | four original pilot roles fully browser-covered and merged | PR #77; merge `18f50ecd252473034e6132cc6e911015c8ceb831`; CI `30692087194` |
| `E2E-V2` | post-integration | seven principal personas explicit at pilot/canonical-CI level; PR #80 and production-depth staging open | PR #80; proof `a14fa756ad9391bcce98a14b3ea5a6dea7b8455a`; CI `30693986766` |

## E2E-V2 seven-persona checkpoint

The implementation checkpoint covers every principal persona defined by `PRODUCT.md`:

1. Admin
2. Admissions
3. Finance/Cashier
4. Teacher
5. Guardian
6. Student
7. Platform/Support

Merged PR #77 covers every currently published route for Admin, Teacher, Guardian and Student and adds real local Wrangler Worker session/snapshot E2E. PR #80 adds independent Admissions, Finance/Cashier and Platform/Support pilot identities/workspaces plus signed role-bound sessions, role-scoped snapshots, permission allow/deny behavior, cross-role replay denial, exact tenant/campus command scope and controlled audit receipts.

Canonical PostgreSQL verification for the three new operator personas proves explicit account/membership/role provisioning, least-privilege grants, Admissions/Finance/Support negative permission paths, Support AAL1-to-AAL2 step-up, idempotent mutation receipts, audit/outbox evidence and immediate authorization loss after finance-session revocation.

Canonical CI `30693986766` passed on implementation proof `a14fa756ad9391bcce98a14b3ea5a6dea7b8455a` with 137 passed Vitest files, 698 passed Vitest tests, 75 platform Playwright tests, 89 aggregate browser tests, a passing V2 PostgreSQL persona verifier, live Neon, production builds, budgets, audit, licences, provenance and execution-artifact validation.

This is an **implementation checkpoint**, not a production-depth completion claim. See [50-product-persona-e2e-v2.md](50-product-persona-e2e-v2.md), [51-product-persona-e2e-v2-evidence.md](51-product-persona-e2e-v2-evidence.md) and [52-production-readiness-backlog.md](52-production-readiness-backlog.md).

## Current staging boundary

The previously deployed staging stack contains the existing reviewed runtime/auth infrastructure. The V2 Admissions, Finance/Cashier and Platform/Support workspaces are **not claimed as deployed production-like staging evidence until PR #80 is integrated and a new deployed staging E2E matrix passes**.

Production auth/database endpoints remain fail-closed without reviewed identity, provider, origin and database bindings.

## Remaining production milestones

The canonical detailed backlog is [52-production-readiness-backlog.md](52-production-readiness-backlog.md). Highest-priority remaining work is:

1. integrate PR #80 with current `main`, rerun canonical `main` CI and record the final merge SHA/run ID;
2. deploy the merged seven-persona runtime to staging and run the complete staging smoke/E2E matrix;
3. configure a reviewed real external IdP and prove login, renewal, logout, revocation and fresh-AAL2 lifecycle for all seven personas;
4. bind Admissions, Finance/Cashier and Platform/Support browser sessions to the durable database session registry and permission evaluator;
5. replace synthetic operator snapshots with database-owned staging read models;
6. exercise reviewed real domain commands for the three new operator personas with post-write state plus audit/outbox assertions;
7. verify deployed cross-role, cross-tenant, cross-campus, revoked/expired and step-up-required negative paths;
8. preserve safe failure traces/screenshots/correlation evidence for production-depth E2E;
9. configure approved production provider/cache/database/Worker/mapping/publisher/composer/monitor credentials, bindings and source population;
10. authorize production scheduler/worker/monitor activation and operational alerting;
11. complete security/privacy review, backup/restore/rollback rehearsal and owner-led UAT;
12. obtain explicit production authorization before enabling real student data or general production mutations.

## Safe cleanup report

No Git branch, worktree or Neon branch is deleted by this checkpoint. Cleanup remains owner-reviewed only.

## Production boundary

No production deployment, real account, real tenant/student data or unrestricted production database mutation is claimed by E2E-V2. AUTH-01 through AUTH-08 provide provider-neutral verification, PKCE flow, durable identity state, session termination, provider caching/key rotation, fresh-AAL2 and database-backed permission contracts. PILOT-04 through PILOT-12 provide reviewed read/projection/mutation/composer/operations-monitor infrastructure. The merged E2E-V1 baseline plus PR #80 complete the explicit browser/authorization implementation checkpoint for all seven principal personas, while real provider login, production credentials/source population, deployed seven-persona staging proof, database-backed operator read/write journeys, production bindings, schedule activation and general production mutations remain explicitly gated.
