# 08 — Delivery Plan and Parallel Execution

## 1. Direct answer

Web and Flutter work can proceed at the same time. Mobile must not wait for the final database, and it must not be built by copying database schemas. Parallelism is safe when mobile uses frozen platform contracts, synthetic fixtures and explicit gates.

The recommended model is:

```text
Current platform EXP-01 work
        │
        ├── Mobile documentation and contract review (now)
        ├── Mobile foundation using synthetic/reviewed contracts (after docs approval)
        │
        └── Reviewed persona/API contracts
                 │
                 ├── Family app stream
                 └── Staff app stream
                          │
                          └── Serial mobile integration and pilot gate
```

## 2. Dependency principle

Mobile features depend on application contracts, not database completion. A platform module is mobile-ready when it has:

- stable command/query contract;
- authorization and relationship/assignment semantics;
- data classification;
- idempotency/concurrency behavior;
- stable errors;
- audit/disclosure behavior;
- bounded read model;
- contract tests and synthetic fixtures.

A table, migration or web screen alone does not make a feature ready.

## 3. Waves

### Wave M0 — Documentation and governance

Owner: `MOB-00` coordinator/documentation stream.

Deliver:

- ADR and product decision;
- architecture, API, sync, security, design, testing and release specifications;
- dependency/readiness matrix;
- mobile program board and tracker;
- agent path ownership;
- risk register and references.

Exit: `GATE-MOBILE-DOCS-APPROVED`.

### Wave M1 — Shared mobile foundation

Owner: `MOB-01` whole-module stream.

May start after documentation approval while EXP-01 continues. It uses reviewed identity/platform contracts and synthetic feature contracts.

Deliver:

- `mobile/` Pub Workspace;
- Family and Staff empty shells;
- pinned toolchain, analysis and CI;
- shared design tokens/components;
- authentication, session, persona and capability framework;
- generated API-client pipeline;
- encrypted local database;
- sync engine and command queue;
- notification/deep-link/device adapters;
- observability/redaction;
- mock server and testing kit;
- boundary and architecture checks.

Exit: `GATE-MOBILE-FOUNDATION-READY` after reviewed foundation evidence. Feature contracts may still be simulated, but simulator schemas must be explicitly marked and replaced before product gates.

### Wave M2 — Persona applications

Starts from the exact reviewed mobile-foundation SHA and exact reviewed platform contract snapshot.

#### `MOB-02` — Family application

Owns guardian and student journeys end-to-end. It may begin when guardian/student/session/notification/document contracts pass `GATE-EXP-CONTRACTS-STABLE` for its required scope.

#### `MOB-03` — Staff application

Owns teacher-first journeys end-to-end. It may begin when teacher assignment, timetable, roster, attendance and notification contracts pass the relevant gate.

These streams may run in parallel because they have separate app and feature-package ownership. They consume frozen shared packages; changes to foundation require a contract-change request.

### Wave M3 — Serial integration and pilot readiness

Owner: `MOB-INTEG`.

Deliver:

- integrate reviewed Family and Staff SHAs serially;
- regenerate against the final reviewed platform OpenAPI snapshot;
- run platform + mobile end-to-end journeys;
- verify local migrations, release builds and signing;
- run security, privacy, accessibility, performance and recovery gates;
- prepare closed-pilot store releases and support runbooks.

Exit: `GATE-MOBILE-INTEGRATED`, then `GATE-MOBILE-PILOT-READY`.

## 4. What can be done now

While EXP-01 is active:

- approve these documents;
- define mobile API additions without changing domain ownership;
- freeze persona/capability session schema;
- create OpenAPI contract tests and synthetic examples;
- scaffold the Flutter workspace after approval;
- implement dependency boundaries, design system and adaptive shells;
- implement OAuth/PKCE integration against the platform identity environment;
- implement encrypted local storage and sync engine using simulators;
- implement push/device/deep-link adapters with non-sensitive fixtures;
- create CI, test matrix, SBOM and release skeleton;
- benchmark low-cost Android and representative iOS devices.

## 5. What must not start early

Do not finalize:

- guardian household/child switching against guessed relationships;
- teacher roster/attendance conflict handling against guessed API semantics;
- student publication logic before publication contracts;
- fee/payment screens by reproducing balances/calculations;
- document caching without classification/expiry contracts;
- push routes before notification schemas and authorization recheck;
- mobile-only business endpoints that bypass module application services.

## 6. Contract stabilization checkpoints

Do not use one all-or-nothing platform gate. Review feature families independently:

| Checkpoint | Enables |
|---|---|
| Session/persona/capability | both app shells and navigation |
| Guardian household/relationship | Family guardian core |
| Student self/publication | Family student core |
| Teacher assignment/timetable | Staff shell and schedule |
| Roster/attendance sync | Staff offline attendance |
| Notification/device/deep link | both app notification journeys |
| Document authorization | document metadata/download/upload |
| Messaging membership/retention | secure communication |
| Billing read/payment initiation | Family fees/payments |

Each checkpoint records OpenAPI SHA, owning platform module SHA, compatibility tests and unresolved risks.

## 7. Branch/worktree policy

Proposed implementation branches:

```text
program/mobile-foundation-v1
module/mobile-family-v1
module/mobile-staff-v1
integration/mobile-v1
```

Proposed fixed worktrees:

```text
.worktrees/mob-01-foundation
.worktrees/mob-02-family
.worktrees/mob-03-staff
.worktrees/mob-integ
```

All implementation streams start from recorded reviewed SHAs. They do not reset, discard, overwrite or import unreviewed code from another stream.

Mobile has no separate Neon branch unless a stream changes backend schema/application code. Normal Flutter-only streams use platform integration environments and synthetic tenants, not direct database access.

## 8. Parallel ownership

After mobile foundation is frozen:

- `MOB-01` owns shared workspace/tooling/core packages;
- `MOB-02` owns Family app and `family_*` feature packages;
- `MOB-03` owns Staff app and `staff_*` feature packages;
- `MOB-INTEG` owns integration wiring, generated final snapshots and release evidence.

Feature streams cannot edit shared core packages concurrently. They request compatible extensions through a documented change request.

## 9. Checkpoint cadence

Each whole-module stream checkpoint includes:

- exact base and head SHA;
- owned paths changed;
- platform/OpenAPI/design authority SHAs;
- focused and full checks;
- Android/iOS build status;
- accessibility/localization/offline evidence;
- security/privacy impact;
- remaining simulator or contract assumptions;
- dirty state;
- exact next milestone;
- confirmation that no production data or unauthorized deployment was used.

## 10. Recommended owner actions

1. Review and approve `GATE-MOBILE-DOCS-APPROVED`.
2. Continue EXP-01; do not pause web work for mobile.
3. Ask EXP-01/INTEG-01 to publish reviewed persona/mobile-relevant OpenAPI snapshots and compatibility rules.
4. Start `MOB-01` from an exact reviewed base after docs approval.
5. Start Family and Staff streams only when their contract-family checkpoints pass.
6. Integrate mobile serially after reviewed candidates exist.
7. Pilot with synthetic/internal distribution first, then named design partners after security/privacy/store gates.

## 11. Schedule guidance

Do not plan mobile as “after the web is completely finished.” That delays risk discovery in authentication, offline sync, low-end-device performance and app-store operations.

Do not plan mobile as fully independent parallel product development either. That causes duplicate rules and API churn.

The enterprise approach is staged concurrency: foundation work now, feature work after each contract family stabilizes, and release after platform/mobile integration evidence.
