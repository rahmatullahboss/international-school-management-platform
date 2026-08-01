# Product Persona E2E V2 Evidence

**Program:** `international-school-platform-v1`  
**Checkpoint:** `E2E-V2`  
**Date:** 2026-08-01  
**PR:** #80  
**Prerequisite PR:** #77

## Evidence summary

The V2 checkpoint closes the implementation gap where Admissions, Finance/Cashier and Platform/Support were principal product personas but were not independent pilot browser identities.

PR #77 covers Admin, Teacher, Guardian and Student. PR #80 adds the remaining three personas and preserves the existing four-role browser and API contracts.

## Role coverage

| Persona | Independent pilot identity | Dedicated browser surface | Positive permission | Negative permission | Cross-role replay denial | Persisted DB authorization/mutation evidence |
|---|---:|---:|---:|---:|---:|---:|
| Admin | yes | yes | yes | yes | yes | existing canonical gates |
| Admissions | yes | yes | yes | yes | yes | yes |
| Finance / Cashier | yes | yes | yes | yes | yes | yes |
| Teacher | yes | yes | yes | yes | yes | existing canonical gates |
| Guardian | yes | yes | yes | yes | yes | existing canonical gates |
| Student | yes | yes | yes | yes | yes | existing canonical gates |
| Platform / Support | yes | yes | yes | yes | yes | yes |

## New V2 files and contracts

The V2 implementation introduces or updates:

- `apps/platform-api/src/entry.ts`
- `apps/platform-api/src/pilot-operator-api.ts`
- `apps/platform-api/src/pilot-operator-models.ts`
- `apps/platform-api/src/pilot-operator-sessions.ts`
- `apps/platform-api/wrangler.jsonc`
- `apps/platform-web/src/entry.tsx`
- `apps/platform-web/src/operator-portal.tsx`
- `tests/browser/platform-api-e2e-worker.ts`
- `tests/browser/product-persona-v2.e2e.spec.ts`
- `tests/integration/verify-product-persona-e2e.sh`
- `.github/workflows/ci.yml`
- `package.json`

The production Worker entry delegates the existing core Worker behavior and adds the non-production operator pilot routes without changing the existing core API contracts.

## PostgreSQL proof

The canonical CI persona verifier executes against PostgreSQL after canonical migrations and durable auth migrations have been applied.

It verifies the following security properties:

### Admissions

- explicit Admissions account/membership/role provisioning;
- admissions review capability allowed;
- finance receipt capability denied;
- scoped mutation accepted only with the reviewed grant;
- persisted receipt/audit/outbox evidence.

### Finance / Cashier

- explicit Finance/Cashier account/membership/role provisioning;
- reconciliation/receipt capability allowed;
- refund approval capability denied without grant;
- idempotent replay;
- revoked browser session immediately loses authorization;
- persisted receipt/audit/outbox evidence.

### Platform / Support

- explicit Support identity provisioning;
- no implicit tenant-owned mutation authority;
- AAL1 break-glass denial;
- AAL2 step-up requirement;
- AAL2 break-glass request allowed only under reviewed scope;
- platform configuration mutation denied without explicit grant;
- persisted receipt/audit/outbox evidence for the reviewed mutation envelope.

Final verifier summary from CI `30693986766`:

```text
{"personas" : ["admissions","finance","support"], "persisted_receipts" : 3, "audit_events" : 3}
```

## Browser proof

The platform Playwright suite runs the built web application together with a real local Wrangler Worker rather than replacing the new operator API with browser mocks.

The suite verifies:

- role/workspace routing;
- signed operator session creation;
- role-bound snapshots;
- permission allow/deny behavior;
- exact tenant/campus command scope;
- cross-role token replay rejection;
- browser-triggered controlled Finance/Cashier command evidence;
- preservation of the original four-role pilot coverage from PR #77.

Final browser counts from canonical CI `30693986766`:

| Suite | Passed |
|---|---:|
| Platform | 75 |
| SIS | 2 |
| Finance | 2 |
| Integrations | 1 |
| Student support | 3 |
| Experience | 6 |
| **Total** | **89** |

## Canonical CI proof

Implementation checkpoint head:

`a14fa756ad9391bcce98a14b3ea5a6dea7b8455a`

Canonical CI:

`30693986766`

The complete job finished successfully, including:

- format check;
- lint;
- architecture boundary validation;
- TypeScript;
- 137 passed Vitest files / 698 passed tests;
- canonical migration verification;
- durable auth migration verification;
- V2 product-persona PostgreSQL E2E verification;
- live Neon connectivity;
- API and web production builds;
- bundle budget check;
- npm audit with zero vulnerabilities;
- licence validation;
- provenance validation;
- 89 browser tests;
- execution-artifact validation.

## Production-depth evidence not yet claimed

This evidence deliberately does not claim the following as complete:

- real external IdP login for every persona against staging;
- browser sessions for the new operator personas backed end-to-end by the production session registry and database permission service in a deployed staging Worker;
- real domain writes from the new operator browser surfaces into staging domain tables with post-write state assertions;
- a deployed staging Worker + staging database + external IdP matrix for all seven personas;
- production credentials, source population, schedules and mutation enablement.

Those items remain open in [52-production-readiness-backlog.md](52-production-readiness-backlog.md) and correspond to the production-depth portion of Issue #78.
