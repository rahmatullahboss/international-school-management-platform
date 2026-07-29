# INTEG-01 Wave 3 — EXP-01 Integration Start

Date/time: 2026-07-29T21:34:00+06:00

## Frozen inputs

- Current main: `3ddfcf22a237fe3025c4c456005812641b4397af`
- Reviewed EXP-01 implementation candidate: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`
- EXP-01 coordinator evidence-only head: `6c2ec8eec92727abeca2477820a9c7f35b2e7bbd`
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

No reviewed EXP implementation behavior was modified during branch advancement.

## Existing candidate evidence

- Implementation CI `30464998020`: all 21 steps passed.
- Final-head CI `30465524930`: all 21 steps passed.
- Repository tests: 504 passed.
- Browser suites: 15/15 passed.
- Fresh PostgreSQL replay: 40/40 migrations passed.
- Live Neon driver, build, PWA budget, dependency audit, licences, provenance and artifact validation passed.

## Integration gate

PR `#38` must pass a fresh integration-branch CI run before review readiness or merge. After CI succeeds, INTEG-01 records the exact verified head, marks the Wave 3 checkpoint ready, and merges only with expected-head protection.

No production deployment or production database mutation is authorized.
