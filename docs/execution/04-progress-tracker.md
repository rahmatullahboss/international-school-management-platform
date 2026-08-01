# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`  
**Updated:** 2026-08-01  
**Current repository state:** All planned domain module streams are complete and integrated. The non-production pilot/canonical-CI implementation now has explicit E2E coverage for all seven principal product personas: Admin, Admissions, Finance/Cashier, Teacher, Guardian, Student and Platform/Support. PR #77, which provides the four original pilot-role E2E baseline, is merged to `main` at `18f50ecd252473034e6132cc6e911015c8ceb831`. PR #80 adds the remaining three independent operator personas and is the only pending integration PR for the seven-persona checkpoint. The program is **not yet production-ready**: real external IdP login for all seven personas is not proven on deployed staging, the three new operator personas are not yet end-to-end bound to durable production-style browser sessions/database-backed reads and real domain writes in staging, and production credentials/bindings/schedules/general mutations remain disabled.

Detailed checkpoint evidence is preserved in the dedicated execution documents. The newest status documents are:

- [48-product-persona-e2e-v2.md](48-product-persona-e2e-v2.md) — seven-principal-persona implementation checkpoint;
- [49-product-persona-e2e-v2-evidence.md](49-product-persona-e2e-v2-evidence.md) — canonical CI, PostgreSQL and Playwright evidence;
- [50-production-readiness-backlog.md](50-production-readiness-backlog.md) — remaining staging/production work and exit conditions.

Historical checkpoint-by-checkpoint evidence through Wave 3 remains in [the archived tracker](archive/04-progress-tracker-through-wave3.md). Existing post-integration scope/evidence documents remain authoritative for PILOT-01 through PILOT-11, UX-01 and AUTH-01 through AUTH-08.

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
| `GATE-PILOT-READY` | passed | Final root CI `30467898523`; Neon recovery `30467899681` |
| `GATE-CLOUDFLARE-STAGING` | passed | Main merge `41639fab433491df0395d02217a70c6eb2ddb775`; root CI `30479347127`; deploy/smoke `30479347117` |
| `GATE-PILOT-RUNTIME-COMPOSED` | passed | Candidate `a50ad782489137f5afd806e30c7a3e249b5074ec`; CI `30484622352`; deploy/smoke `30484622364` |
| `GATE-UX-CONTINUITY-V1` | passed | Candidate `e74a30143eb7882e81ebd7d5b5c373d3132b309e`; CI `30490122291`; deploy/smoke `30490122337` |
| `GATE-PILOT-READ-API-V1` | passed | Proof `73be1c1eb0418c8c2f744729354bd9f1a63467b0`; CI `30495509757`; deploy/smoke `30495509773` |
| `GATE-PILOT-SIGNED-SESSION-V1` | passed | Proof `0a36ef62ec1622bdea6de7d0135bf30026845528`; CI `30501350771`; deploy/smoke `30501350785` |
| `GATE-OIDC-TRUST-BOUNDARY-V1` | passed | Proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`; CI `30515626535`; deploy/smoke `30515626541` |
| `GATE-OIDC-PKCE-FLOW-V1` | passed | Proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; CI `30517446940`; deploy/smoke `30517446956` |
| `GATE-AUTH-DURABLE-CONTEXT-V1` | passed | Proof `9886f41d198772c684d3b245258964d4bcb0e83c`; CI `30530441477`; deploy/smoke `30530441742` |
| `GATE-AUTH-SESSION-TERMINATION-V1` | passed | Proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`; CI `30533390869`; deploy/smoke `30533390917` |
| `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` | passed | Proof `d8e60bc045265799d6ecf63da6a75e22c9287459`; main `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`; CI `30574007099`; deploy `30574006810` |
| `GATE-AUTH-FRESH-STEP-UP-V1` | passed | Proof `17b53865900c3606bf5781a9ed0cf0b856262782`; main `12881a80c6776020c8e26ca70ffb4af5c6b42b39`; CI `30578058983`; deploy `30578058937` |
| `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` | passed | Proof `fd30d6bd7c56e745a83114722147e83605f01cdd`; main `ace9f6f45e21468ae29a68f4ff741ac3994764af`; CI `30581812037`; deploy `30581812029` |
| `GATE-AUTH-DATABASE-PERMISSION-V1` | passed | Proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; main `3a81f7f32c794b18524f0050828300e76ad4df95`; CI `30601433379`; deploy `30601433411` |
| `GATE-PILOT-DATABASE-READ-MODEL-V1` | passed | Proof `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; main `a81b0025d0427398a616b316dd96451d5e15bcaf`; CI `30605205955`; deploy `30605205966` |
| `GATE-PILOT-SAFE-MUTATION-V1` | passed | Proof `2ff251c17d2b4d939a6f274402da99e6447707fd`; main `9f32a588d7b61d4ef8b1ac38dc4807fa329212de`; CI `30608179482`; deploy `30608179484` |
| `GATE-PILOT-RUNTIME-PROJECTION-WORKER-V1` | passed | Proof `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829`; main `a731f89fc4c6476580129ab0cd734e9250c0aa64`; CI `30635344251`; deploy `30635344238` |
| `GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1` | passed | Proof `0ae5b782adb2443d74fafdf4c191638b949d379d`; main `1321466a690c1f70be4d1528ed7015f029083302`; CI `30648006915` |
| `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1` | passed | Proof `22802925c2a38b355b0f219e762c6e18cc5cd1be`; main `7476fbfe8830ba98e3a7500165950f26b8bd1310`; CI `30651595094` |
| `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1` | passed | Proof `0db23a475b8cd5db980b657922813e907077bed8`; main `e6301efaaa374e34b9e2719977f3a5eee51ec651`; CI `30659200077` |
| `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` | passed | Proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; main `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`; CI `30662644211` |
| `GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1` | passed | PILOT-11 proof `9a3978e294bc3d9f463780ec9154bed67d802eb8`; main `f260d18bab8084ab2132767f2d8fb3040290c6cd`; CI `30678621687` |
| `E2E-V1-FOUR-PILOT-ROLES` | passed and merged | PR #77; head `d331bd11fdd1af9329bfeeddff9d1a389bcbe65b`; merge `18f50ecd252473034e6132cc6e911015c8ceb831`; canonical CI `30692087194`; 51 platform / 65 aggregate browser tests |
| `E2E-V2-SEVEN-PRINCIPAL-PERSONAS` | implementation passed; PR #80 integration and production-depth open | PR #80; implementation proof `a14fa756ad9391bcce98a14b3ea5a6dea7b8455a`; canonical CI `30693986766`; 75 platform / 89 aggregate browser tests; PostgreSQL persona verifier passed |

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
| `INTEG-01` | gated serial | pilot ready | `docs/execution/08-final-system-release-evidence.md` |
| `PILOT-01` | post-integration | runtime composed and staged | `a50ad782489137f5afd806e30c7a3e249b5074ec`; CI `30484622352`; deploy `30484622364` |
| `UX-01` | post-integration | continuity passed and staged | `e74a30143eb7882e81ebd7d5b5c373d3132b309e`; CI `30490122291`; deploy `30490122337` |
| `PILOT-02` | post-integration | scoped read API passed and staged | `73be1c1eb0418c8c2f744729354bd9f1a63467b0`; CI `30495509757`; deploy `30495509773` |
| `PILOT-03` | post-integration | signed staging session passed | `0a36ef62ec1622bdea6de7d0135bf30026845528`; CI `30501350771`; deploy `30501350785` |
| `AUTH-01..08` | post-integration | provider-neutral auth/session/permission gates passed; real provider login disabled | latest AUTH-08 proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; CI `30601433379`; deploy `30601433411` |
| `PILOT-04` | post-integration | database runtime read models passed | `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; CI `30605205955` |
| `PILOT-05` | post-integration | safe allowlisted DB mutation passed | `2ff251c17d2b4d939a6f274402da99e6447707fd`; CI `30608179482` |
| `PILOT-06` | post-integration | durable projection worker passed; production schedule/bindings disabled | `c1bb4d3f5713d093bd9865d9c37dcf3e9db2c829`; CI `30635344251` |
| `PILOT-07` | post-integration | source publisher passed; production credentials/source population disabled | `0ae5b782adb2443d74fafdf4c191638b949d379d`; CI `30648006915` |
| `PILOT-08` | post-integration | admin composer passed; production cadence/source population disabled | `22802925c2a38b355b0f219e762c6e18cc5cd1be`; CI `30651595094` |
| `PILOT-09` | post-integration | teacher composer passed; production cadence/source population disabled | `0db23a475b8cd5db980b657922813e907077bed8`; CI `30659200077` |
| `PILOT-10` | post-integration | guardian composer passed; production cadence/source population disabled | `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; CI `30662644211` |
| `PILOT-11` | post-integration | student composer passed; production cadence/source population disabled | `9a3978e294bc3d9f463780ec9154bed67d802eb8`; main `f260d18bab8084ab2132767f2d8fb3040290c6cd`; CI `30678621687` |
| `E2E-V1` | post-integration | four existing pilot roles fully browser-covered and merged | PR #77; merge `18f50ecd252473034e6132cc6e911015c8ceb831`; CI `30692087194` |
| `E2E-V2` | post-integration | seven principal personas explicit at pilot/canonical-CI level; PR #80 integration and production-depth staging open | PR #80; implementation proof `a14fa756ad9391bcce98a14b3ea5a6dea7b8455a`; CI `30693986766` |

## E2E-V2 seven-persona checkpoint

The implementation checkpoint now covers every principal persona defined by `PRODUCT.md`:

1. Admin
2. Admissions
3. Finance/Cashier
4. Teacher
5. Guardian
6. Student
7. Platform/Support

Merged PR #77 covers every currently published route for Admin, Teacher, Guardian and Student and adds real local Wrangler Worker session/snapshot E2E. PR #80 adds independent Admissions, Finance/Cashier and Platform/Support pilot identities/workspaces plus explicit role-bound sessions, snapshots, permission allow/deny behavior, cross-role replay denial, tenant/campus command scope and controlled audit receipts.

Canonical PostgreSQL verification for the three new operator personas proves explicit account/membership/role provisioning, least-privilege grants, Admissions/Finance/Support negative permission paths, Support AAL1-to-AAL2 step-up, idempotent mutation receipts, audit/outbox evidence and immediate authorization loss after finance-session revocation.

Canonical CI `30693986766` passed on implementation proof `a14fa756ad9391bcce98a14b3ea5a6dea7b8455a` with:

- 137 Vitest files passed, 1 skipped;
- 698 Vitest tests passed, 1 skipped;
- V2 PostgreSQL persona verifier passed with `personas = [admissions, finance, support]`, `persisted_receipts = 3`, `audit_events = 3`;
- 75 platform Playwright tests passed;
- 89 aggregate browser tests passed;
- live Neon connectivity passed;
- API/web production builds, budgets, audit, licences, provenance and execution-artifact validation passed.

This is an **implementation checkpoint**, not a production-depth completion claim. See [48-product-persona-e2e-v2.md](48-product-persona-e2e-v2.md), [49-product-persona-e2e-v2-evidence.md](49-product-persona-e2e-v2-evidence.md) and [50-production-readiness-backlog.md](50-production-readiness-backlog.md).

## Current live staging boundary

The previously deployed staging stack continues to expose the existing four runtime role roots and fail-closed auth/runtime endpoints. The V2 Admissions, Finance/Cashier and Platform/Support workspaces are **not claimed as deployed staging evidence until PR #80 is merged and a new staging deploy/smoke matrix passes**.

Existing staging roots:

- Role chooser: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`
- Admin: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/admin`
- Teacher: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/teacher`
- Guardian: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/family`
- Student: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/student`
- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`
- OIDC readiness: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/readiness`
- Projection worker readiness: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/runtime-projection-worker/readiness`
- Database runtime snapshot: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/snapshot`
- Safe runtime mutation: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/commands/runtime.snapshot.refresh`
- Browser session introspection: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/session`
- Database permission decision: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/authorize`
- Browser logout: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/logout`
- Provider back-channel logout: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/backchannel-logout`

Production auth/database endpoints remain fail-closed without reviewed identity, origin, provider and database bindings.

## Final integrated implementation verification

### Application/browser evidence

- All domain streams remain complete and integrated.
- Admin, Teacher, Guardian and Student runtime composer gates are complete; PILOT-11 closes the four original database-owned home-composer set.
- PR #77 is merged; PR #80 carries the three remaining persona implementation and documentation update.
- Seven principal personas have explicit non-production E2E implementation coverage through the merged V1 baseline plus PR #80.
- Latest implementation checkpoint: 137 passed Vitest files / 698 passed tests and 89 passed aggregate browser tests.
- Format, lint, architecture boundaries, TypeScript, Worker/Vite builds, budgets, audit, licences, provenance and execution-artifact gates passed.

### Database/recovery evidence

- Canonical migration manifest remains 40 immutable migrations.
- Durable auth and runtime post-integration migrations remain verified on fresh PostgreSQL.
- V2 adds no canonical migration; its persona verifier exercises the existing canonical session/permission/mutation functions with explicit identities and grants.
- Live Neon connectivity passed in canonical CI `30693986766`.
- Existing RLS, function-only runtime access, finance immutability/balance and cross-tenant safeguards remain covered by canonical verification.

## Remaining production milestones

The detailed backlog and exit conditions are in [50-production-readiness-backlog.md](50-production-readiness-backlog.md). Highest-priority remaining work is:

1. merge PR #80; rerun canonical `main` CI and record the final merge SHA/run ID;
2. deploy the merged seven-persona runtime to staging and run the full staging smoke matrix;
3. configure a reviewed real external IdP and prove login/logout/revocation/fresh-AAL2 lifecycle for all seven personas;
4. bind Admissions, Finance/Cashier and Platform/Support browser sessions to durable database session/permission evaluation end to end;
5. replace synthetic operator snapshots with database-owned staging read models;
6. exercise real domain writes for the three new operator personas with post-write DB state plus audit/outbox assertions;
7. verify deployed Worker + staging database + real IdP negative paths for cross-role, cross-tenant, cross-campus, revoked/expired and step-up-required cases;
8. retain safe failed-run traces/screenshots/correlation evidence for production-depth E2E;
9. configure approved production provider/cache/database/Worker/mapping/publisher/composer credentials and source population;
10. authorize production scheduler/worker activation and add monitoring for outbox, retries and dead letters;
11. complete backup/restore/rollback rehearsal, owner-led UAT and security sign-off;
12. obtain explicit production authorization before enabling real student data or general production mutations.

## Safe cleanup report

No Git branch, worktree or Neon branch is deleted by this checkpoint. Cleanup remains owner-reviewed only.

## Production boundary

No production deployment, real account, real tenant/student data or unrestricted production database mutation is claimed by E2E-V2. AUTH-01 through AUTH-08 provide provider-neutral verification, PKCE flow, durable identity state, browser/provider session termination, bounded provider caching, signing-key rotation, fresh-AAL2 and database-backed permission contracts. PILOT-04 through PILOT-11 provide tenant-safe runtime read/projection infrastructure, the allowlisted safe mutation envelope, projection worker/source publication and database-owned Admin/Teacher/Guardian/Student composers. The merged E2E-V1 baseline plus PR #80 complete the explicit browser/authorization implementation checkpoint for all seven principal personas, while real provider login, production credentials/source population, deployed seven-persona staging proof, database-backed operator read/write journeys, production bindings, schedule activation and general production mutations remain explicitly gated.
