# INTEG-01 Wave 3 — EXP-01 Integration Gate

Date/time started: 2026-07-29T21:34:00+06:00
Date/time verified: 2026-07-29T21:42:00+06:00

## Frozen inputs

- Current main: `3ddfcf22a237fe3025c4c456005812641b4397af`
- Reviewed EXP-01 implementation candidate: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`
- EXP-01 coordinator evidence-only head: `6c2ec8eec92727abeca2477820a9c7f35b2e7bbd`
- Initial integration checkpoint: `c87e0a04be3541973b7cae42e9187b9fbbf4af71`
- Integration branch: `integration/international-school-platform-v1`
- Integration pull request: `#38`

## Ancestry verification

GitHub compare reports current main as the exact merge base of both the reviewed implementation candidate and final evidence head. The implementation candidate is 87 commits ahead and zero commits behind current main. The evidence-only head is 88 commits ahead and zero commits behind current main.

The existing integration branch was nine commits behind current main at the prior Wave 2 evidence head. It was advanced without force to the EXP final evidence head. No history rewrite, dirty-work reset, branch deletion, worktree deletion or Neon branch deletion was performed.

## Accepted scope

- admin, teacher, guardian and student persona experiences;
- communications, forms, notification preferences and delivery evidence;
- governed dashboards, report jobs, exports and document authorization;
- PWA shell, low-bandwidth mode, approved offline drafts, privacy-safe telemetry and support runbooks;
- coordinator-owned EXP tracker and final handoff evidence.

No reviewed EXP implementation behavior was modified during branch advancement or integration evidence recording.

## Candidate evidence

- Implementation CI `30464998020`: all 21 steps passed.
- EXP final-head CI `30465524930`: all 21 steps passed.
- Repository tests: 504 passed.
- Browser suites: 15/15 passed.
- Fresh PostgreSQL replay: 40/40 migrations passed.
- Live Neon driver, build, PWA budget, dependency audit, licences, provenance and artifact validation passed.

## Fresh integration verification

Fresh PR #38 integration CI run `30466466903` passed all 21 verification steps on checkpoint `c87e0a04be3541973b7cae42e9187b9fbbf4af71`:

- clean npm installation;
- canonical formatting;
- lint and architecture boundaries;
- TypeScript project references;
- all 504 repository tests;
- all 40 Wave 2 migrations on a fresh PostgreSQL database;
- live Neon serverless driver verification;
- Worker and Vite production builds;
- platform-web JavaScript/CSS/PWA budget;
- dependency audit and licence policy;
- provenance generation with no tracked drift;
- all 15 Chromium browser journeys;
- execution artifact validation.

## Gate outcome

`GATE-EXP-WAVE-3-INTEGRATION` passes for the exact implementation candidate `5c952703c24ee9927fcf2cd480d3ce8d0d139847` and coordinator handoff ancestry `6c2ec8eec92727abeca2477820a9c7f35b2e7bbd`.

The final evidence commit created from this document must pass the same CI before PR #38 is marked ready and merged with expected-head protection. After merge, main becomes the reviewed Wave 3 integration base for final database/recovery, system verification and pilot-readiness evidence.

No production deployment, production database mutation, production cache purge or destructive cleanup is authorized.
