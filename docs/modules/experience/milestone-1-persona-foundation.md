# EXP-01 Milestone 1 — Persona Experience Foundation

## Scope

The first EXP-01 checkpoint establishes one capability-aware experience frame for school administrators, teachers, guardians and students. It composes existing module surfaces and public contracts; it does not read domain tables or redefine domain permissions.

## Product and design authority

- Foundation authority repair merged to `main` as `3ddfcf22a237fe3025c4c456005812641b4397af` after full CI passed.
- EXP-01 consumed that reviewed repair through merge `ce4a417109fa35f03dd4e7962393ab2fa6fc0565` while preserving exact reviewed Wave 2 base `60836a8fe92f64ba581c4bde65005729d1fe14b2` in ancestry.
- `PRODUCT.md` authority blob: `5e769c75f28c0c5cc426f5b85eaf46f032a3367f`.
- `DESIGN.md` authority blob: `4be926a77d501dd8f16934ad4c50672ba754d66f`.
- Impeccable v4.0.2 references used: `SKILL.md`, `reference/new-work.md`, `reference/craft-floor.md`, `reference/harden.md`, `reference/audit.md` and `reference/polish.md`.

## Surface brief

- **Mode:** Operate.
- **Audience:** school administrators, assigned teachers, authenticated guardians and enrolled students.
- **Job:** enter through one stable role context, understand current session/connectivity state and reach only authorised work.
- **Primary action:** choose the next permitted task from the persona navigation rail.
- **Constraints:** capability filtering, AAL/session visibility, accessible keyboard navigation, responsive layout, RTL, low-bandwidth/offline status and purpose-bound separation between guardian and student access.
- **Direction:** extend the documented “Operational Ledger” world; do not create a new visual identity or replace module-owned workspaces.
- **Memorable moment:** the navigation and current task remain stable while connection, session and assurance state are visible without interrupting work.

## Implementation

- `@school/documents-experience` owns the shared shell contract, capability filtering, locale direction resolution, connection/session state and responsive visual system.
- Admin, teacher, guardian and student adapters define purpose-specific navigation without importing private domain internals.
- Navigation and utility actions are deny-by-default when a capability is declared.
- Offline, degraded, loading and error states explain both the condition and the safe recovery path.
- The authority layer binds shell colors, radii, focus, semantic notices and flat-surface behavior to `DESIGN.md` without rewriting the reviewed shell implementation.
- Mobile navigation becomes a contained horizontal task rail, narrow screens preserve long labels, RTL uses logical borders and reduced-motion removes pulse/shimmer animation.

## Critique, audit and hardening

- **Critique:** retained the stable persona rail and task-first masthead; rejected a dashboard-card wall and decorative brand treatment.
- **Audit:** identified local token drift, a visually elevated loading/error container, incomplete mobile evidence and no dedicated EXP browser suite.
- **Hardening:** aligned exact semantic tokens, removed decorative shadow, completed mobile/RTL/forced-color/reduced-motion behavior and isolated stylesheet parsing in browser fixtures.
- **Polish:** preserved one action accent, explicit focus-blue outlines, long-content wrapping and source-order continuity across desktop and mobile.

## Verification

Focused unit tests cover capability filtering, RTL resolution, persona separation, offline guidance, verified-session context and recoverable loading/error states. Dedicated Chromium run `30440615331` passed desktop semantics and keyboard entry, 360-pixel responsive navigation/body overflow, RTL logical borders and reduced-motion behavior; durable details are recorded in `milestone-1-browser-evidence.md`. Full format, lint, boundaries, typecheck, unit/integration tests, build, repository browser suite, dependency/provenance checks and execution-artifact validation must also pass on the final checkpoint head before merge.
