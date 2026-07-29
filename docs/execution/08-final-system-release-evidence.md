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
