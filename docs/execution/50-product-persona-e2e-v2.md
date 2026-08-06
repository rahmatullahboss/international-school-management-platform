# Product Persona E2E V2

**Program:** `international-school-platform-v1`  
**Checkpoint:** `E2E-V2`  
**Date:** 2026-08-01  
**Status:** implementation checkpoint complete; production-depth gates remain open

## Purpose

This checkpoint extends the pilot browser and authorization surface from the original four runtime personas to all seven principal personas defined by `PRODUCT.md`.

The seven covered personas are:

1. School administrator / leader
2. Admissions staff
3. Finance / cashier
4. Teacher
5. Guardian
6. Student
7. Platform / support operator

PR #77 is the prerequisite for the original four browser personas. PR #80 adds Admissions, Finance/Cashier and Platform/Support as independent pilot identities and workspaces.

## Implemented in V2

### Independent operator identities

Admissions, Finance/Cashier and Platform/Support now have independent non-production pilot role identities instead of being treated only as implied admin capabilities.

Each added role has:

- a dedicated workspace route;
- a signed, role-bound pilot session;
- a role-scoped snapshot contract;
- explicit allow/deny permission decisions;
- tenant/campus scope checks where applicable;
- cross-role replay denial;
- idempotent controlled command receipts;
- role-scoped audit evidence.

### Admissions staff

The E2E contract proves an Admissions identity may exercise reviewed admissions capabilities while finance and unrelated privileged capabilities remain denied.

### Finance / cashier

The E2E contract proves a Finance/Cashier identity may exercise reviewed cashier/reconciliation capabilities while higher-risk approval capabilities remain denied unless explicitly granted.

### Platform / support

The E2E contract proves a Platform/Support identity has no implicit tenant-owned mutation authority. AAL1 access is insufficient for break-glass operations; reviewed support escalation requires AAL2 and remains grant-bound.

### Canonical PostgreSQL authorization proof

`npm run verify:persona-e2e` provisions explicit accounts, memberships, role bindings and least-privilege grants against the canonical PostgreSQL schema, then verifies:

- Admissions allowed and denied permission boundaries;
- Finance/Cashier allowed and denied permission boundaries;
- Support AAL1 denial with AAL2 step-up requirement;
- Support AAL2 grant-bound behavior;
- exact tenant/campus scope enforcement;
- persisted command receipts;
- one audit event and one outbox event per accepted mutation;
- idempotent replay;
- immediate permission loss after finance-session revocation.

### Browser and live local Worker proof

Playwright now exercises the web application against a real local Wrangler Worker for all currently published pilot roles and the three added operator personas. The V2 coverage includes positive role journeys, denied routes/actions, cross-role replay and browser-triggered controlled command evidence.

## Verification checkpoint

PR #80 head at the implementation checkpoint:

- `a14fa756ad9391bcce98a14b3ea5a6dea7b8455a`

Canonical CI run:

- `30693986766`

The run passed:

- formatting;
- ESLint;
- architecture boundaries;
- TypeScript;
- Vitest;
- canonical migration verification;
- durable auth migration verification;
- product-persona PostgreSQL E2E verification;
- live Neon connectivity;
- production builds;
- experience budgets;
- dependency audit;
- licence/provenance checks;
- Chromium Playwright;
- execution-artifact validation.

Test evidence from that run:

- Vitest: 137 test files passed, 1 skipped; 698 tests passed, 1 skipped.
- Product-persona PostgreSQL verifier: `personas = [admissions, finance, support]`, `persisted_receipts = 3`, `audit_events = 3`.
- Platform Playwright: 75 passed.
- SIS Playwright: 2 passed.
- Finance Playwright: 2 passed.
- Integrations Playwright: 1 passed.
- Student-support Playwright: 3 passed.
- Experience Playwright: 6 passed.
- Aggregate browser total: 89 passed.

## Boundary of this checkpoint

This checkpoint means **all seven principal personas now have explicit E2E implementation coverage at the non-production pilot/canonical-CI level**.

It does **not** mean production rollout is complete. In particular, the new operator browser command surface records controlled pilot evidence; it is not a general production mutation channel. Real provider login, production credentials, real data/source population and production-bound mutation journeys remain separately gated.

The remaining production-depth work is tracked in [52-production-readiness-backlog.md](52-production-readiness-backlog.md).
