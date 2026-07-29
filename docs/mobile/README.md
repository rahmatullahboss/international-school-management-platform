# Native Mobile Platform Documentation

**Status:** Architecture and execution baseline proposed for review  
**Scope:** Flutter applications for guardian, student and teacher/staff personas  
**Decision:** One Flutter workspace, two distributable applications  
**Implementation gate:** Reviewed EXP-01/Wave 3 API and read-model contracts plus mobile security gate

## Purpose

This documentation defines the product, architecture, security, offline, API, design, testing, delivery and multi-agent rules required before native mobile implementation begins. It extends the existing web/platform authorities; it does not create a second business system or permit direct database access.

## Authority order

When documents conflict, use this order:

1. Approved ADRs and `PRODUCT.md`.
2. `docs/execution/05-module-ownership-and-integration-contracts.md`.
3. Module-owned API/event/read-model contracts.
4. `DESIGN.md` and repository design governance.
5. This mobile documentation pack.
6. Implementation notes and generated code.

A mobile agent must stop and raise a contract-change request rather than inventing a conflicting rule.

## Reading order

1. [ADR-007 — Native Mobile Application Strategy](../adr/ADR-007-native-mobile-application-strategy.md)
2. [Product, personas and application portfolio](01-product-personas-and-scope.md)
3. [Flutter system architecture](02-flutter-system-architecture.md)
4. [API, contracts and backend coordination](03-api-contracts-and-backend-coordination.md)
5. [Identity, device and mobile security](04-identity-device-and-security.md)
6. [Offline synchronization and local data](05-offline-sync-and-local-data.md)
7. [Design system, accessibility and localization](06-design-accessibility-and-localization.md)
8. [Testing, CI, observability and release](07-testing-ci-observability-and-release.md)
9. [Delivery sequence and parallel execution](08-delivery-and-parallel-execution.md)
10. [MOB-01 whole-module workpack](MOB-01-WORKPACK.md)
11. [Machine-readable mobile program board](mobile-program-board.json)
12. [Architecture decisions and open questions](09-decision-register.md)

## Application portfolio

| Product | Personas | Primary purpose |
|---|---|---|
| School Family | Guardian and student | Household/child context, published academic records, fees, forms, documents, announcements and communication |
| School Staff | Teacher-first; explicitly approved staff later | Daily timetable, assigned rosters, attendance, grade entry drafts, communication and selected operational capture |
| Existing web/PWA | Admin, finance, admissions, HR, operations, restricted case staff | Dense configuration, approvals, reconciliation, reporting and sensitive administration |

## Non-negotiable constraints

- Flutter never connects directly to Neon PostgreSQL.
- The server remains authoritative for authorization and domain invariants.
- Navigation is capability-, context- and assurance-driven, not role-name-only.
- Offline storage is allowlisted, minimized, encrypted and remotely revocable.
- Generic last-write-wins is prohibited for attendance, grades, finance and forms requiring evidence.
- Development uses synthetic data only.
- No production app release or real customer data without separate authorization.
- Mobile work cannot alter active EXP-01-owned paths.
- A client feature is incomplete without API contract, error/retry behavior, authorization tests, accessibility, localization, telemetry and support guidance.

## Current timing decision

Architecture and platform foundations may run in parallel with EXP-01. Domain-integrated mobile journeys must wait for reviewed Wave 3 contracts. The mobile implementation therefore uses two stages:

- **Stage A — contract-safe parallel foundation:** documentation, Flutter workspace, CI, design tokens, fake repositories, auth/device proof, generated-client pipeline, encrypted local storage and generic synchronization.
- **Stage B — activated MOB-01:** bind reviewed contracts, implement Family and Staff journeys, perform end-to-end verification and produce store-release evidence.

This avoids waiting for every web screen while also preventing mobile agents from guessing database or API behavior.
