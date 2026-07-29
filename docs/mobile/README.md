# Native Mobile Program

This directory is the documentation authority for the planned Flutter mobile applications.

## Product decision

Use one governed Flutter workspace that produces two installable applications:

- **School Family** for guardian and student personas.
- **School Staff** for teacher-first workflows and later approved staff capabilities.

Administrative, finance, admissions, HR, operations and broad reporting workflows remain web/PWA first unless a reviewed use case approves native delivery.

The mobile applications consume versioned, permission-aware platform APIs. They never connect directly to Neon PostgreSQL, duplicate domain rules or act as an authorization boundary.

## Reading order

1. `01-product-and-persona-scope.md`
2. `02-application-and-repository-architecture.md`
3. `03-api-contract-and-backend-readiness.md`
4. `04-offline-sync-and-local-data.md`
5. `05-auth-device-security-privacy.md`
6. `06-design-system-accessibility-localization.md`
7. `07-testing-ci-release-observability.md`
8. `08-delivery-plan-parallel-execution.md`
9. `09-agent-ownership-and-handoff.md`
10. `10-decision-log-and-risk-register.md`
11. `99-references.md`
12. `../adr/ADR-007-flutter-mobile-product-strategy.md`

Execution artifacts:

- `../execution/MOB-01-MOBILE-FOUNDATION-ONE-SHOT-PROMPT.md`
- `../execution/mobile-program-board.json`
- `../execution/mobile-progress-tracker.md`

## Mandatory gates

- `GATE-MOBILE-DOCS-APPROVED`
- `GATE-EXP-CONTRACTS-STABLE`
- `GATE-MOBILE-FOUNDATION-READY`
- `GATE-FAMILY-APP-READY`
- `GATE-STAFF-APP-READY`
- `GATE-MOBILE-INTEGRATED`
- `GATE-MOBILE-PILOT-READY`

A gate requires matching contracts, code, tests, security evidence, build artifacts and tracker state.

## Parallel-development rule

Mobile documentation, workspace foundation, CI, design-token mapping, authentication spike, generated-client pipeline, local database, sync engine, mock server and contract-test harness may begin while EXP-01 continues.

Final persona features must wait for reviewed persona, capability, relationship, teacher, notification and document contracts. Flutter must never be implemented from database-table inspection; the dependency is the versioned application API/read model.

## Change control

Changes to app count, identity flow, sync protocol, local data classification, API versioning, shared package ownership or release strategy require an ADR amendment, affected-stream analysis, security/privacy review, migration plan and approval before implementation.
