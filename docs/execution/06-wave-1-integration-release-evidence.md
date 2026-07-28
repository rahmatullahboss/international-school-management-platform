# Wave 1 Integration Release Evidence

## Verdict

`GATE-WAVE-1-INTEGRATED` is passed.

Reviewed integration SHA: `8cc8ee1562ade672b14c1c44af935fe7e2307976`

Integration branch: `integration/international-school-platform-v1`

Integration worktree: `.worktrees/integ-01-release`

Integration Neon branch: `integration/international-school-platform-v1` (`br-shiny-silence-axznuy37`)

No production deployment or production database mutation was performed.

## Accepted reviewed inputs

| Stream | Reviewed SHA | Integration evidence |
|---|---|---|
| `SIS-01` | `5e2499018282d8296abfe093b5dd95b231829379` | Already integrated in the exact starting `main` SHA |
| `FIN-01` | `5f9e1692a8fc19fc2e9789a338d028918acdeaf6` | Merge checkpoint `da3d561` |
| `INT-01` | `bfa95a4a42025213fa7c2090a587ef5304924da7` | Merge checkpoint `0822462` |

Exact integration base: `042b75990f9cd819239c584a370687042393f6a7`.

## Conflict and contract resolution

Shared workspace manifests, TypeScript project references, the lockfile, admin and family application exports, CI workflows and tracker state were composed without dropping reviewed SIS, finance or international-platform behavior.

The integration keeps:

- SIS people, admissions and lifecycle exports plus the `@school/sis` compatibility facade;
- finance billing and ledger exports, immutable journal rules and admin/family finance surfaces;
- country packs, integration runtime, import/export, migration studio, OneRoster, LTI, SSO/SCIM, connector governance and integration administration;
- platform, SIS, finance and integration browser suites in the root verification flow.

No frozen module contract or module-owned semantic rule was redesigned during conflict resolution.

## Migration and recovery evidence

The canonical manifest `infra/database/migration-manifest.json` contains 22 unique migrations in dependency-safe order:

1. Foundation: 5 migrations
2. SIS: 6 migrations
3. Finance: 4 migrations
4. International platform: 7 migrations

GitHub Actions run `30362743167` applied and verified this composition on the exact integration Neon branch. Re-running the gate safely skipped already-recorded migrations. The same manifest was replayed into a disposable fresh database and fully re-verified before that temporary database was removed.

Independent post-run checks confirmed:

- branch identity matched project `lingering-brook-52999532` and branch `br-shiny-silence-axznuy37`;
- migration ledger counts were Foundation 5, SIS 6, Finance 4 and International 7;
- all 139 tenant-owned tables had RLS enabled, RLS forced and an `app_runtime` policy;
- no tenant-protection failures remained.

## Finance and tenant invariants

The live integration schema contains the finance journal-posting function and both posted-entry and posted-line immutability triggers. No unbalanced posted journal was present.

The integrated application journey verified applicant review, offer and contract acceptance, enrollment conversion, billing-account creation, invoice posting, payment settlement, allocation, receivable reconciliation, balanced trial balance and bounded safe CSV export.

## Repository verification

Local verification at the reviewed integration SHA passed:

- formatting, lint and architecture boundaries;
- TypeScript project build and typecheck;
- 254 tests passed, with one local secret-backed Neon test skipped;
- Worker dry-run and Vite production build;
- execution-artifact validation;
- six browser journeys: platform 1, SIS 2, finance 2 and integrations 1.

GitHub CI run `30362743336` passed with a clean install, fresh PostgreSQL SIS migration replay, live Neon serverless-driver verification, dependency audit, licence check, provenance generation, browser suites and documentation/artifact validation.

## Known risk

GitHub emitted a non-blocking deprecation warning because `actions/checkout@v4` and `actions/setup-node@v4` target Node.js 20 while the runner forced them onto Node.js 24. All affected jobs passed. Routine CI maintenance should upgrade those actions when their next supported major versions are approved.

## Safe-cleanup report

No existing Git branch, worktree or Neon branch was deleted. All active module streams, reviewed branches and integration resources remain retained because Wave 2 will use the reviewed Wave 1 integration SHA.

## Wave 2 release base

`ACAD-01` and `OPS-01` may start from exact reviewed SHA `8cc8ee1562ade672b14c1c44af935fe7e2307976`.

`CARE-01` may use the same reviewed base only after `GATE-STUDENT-SUPPORT-THREAT-MODEL` passes.
