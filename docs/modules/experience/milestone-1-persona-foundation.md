# EXP-01 Milestone 1 — Persona Experience Foundation

## Scope

The first EXP-01 checkpoint establishes one capability-aware experience frame for school administrators, teachers, guardians and students. It composes existing module surfaces and public contracts; it does not read domain tables or redefine domain permissions.

## Product and design context

The reviewed branch does not contain the root `PRODUCT.md` or `DESIGN.md` files referenced by the execution contract. EXP-01 did not recreate or modify those coordinator-owned authorities as a side effect. The checkpoint inherits the established Operate language visible in the reviewed SIS, finance, academics, operations, integrations and student-support surfaces: bright institutional paper, ink-blue structure, restrained teal actions, amber exceptions, compact task-first information and explicit audit/security state.

Impeccable v4.0.2 references used: `SKILL.md`, `reference/new-work.md` and `reference/craft-floor.md`.

## Surface brief

- **Mode:** Operate.
- **Audience:** school administrators, assigned teachers, authenticated guardians and enrolled students.
- **Job:** enter through one stable role context, understand current session/connectivity state and reach only authorised work.
- **Primary action:** choose the next permitted task from the persona navigation rail.
- **Constraints:** capability filtering, AAL/session visibility, accessible keyboard navigation, responsive layout, RTL, low-bandwidth/offline status and purpose-bound separation between guardian and student access.
- **Direction:** extend the incumbent institutional-register world; do not create a new visual identity or replace module-owned workspaces.
- **Memorable moment:** the navigation and current task remain stable while connection, session and assurance state are visible without interrupting work.

## Implementation

- `@school/documents-experience` owns the shared shell contract, capability filtering, locale direction resolution, connection/session state and responsive visual system.
- Admin, teacher, guardian and student adapters define purpose-specific navigation without importing private domain internals.
- Navigation and utility actions are deny-by-default when a capability is declared.
- Offline, degraded, loading and error states explain both the condition and the safe recovery path.

## Verification intent

Focused tests cover capability filtering, RTL resolution, persona separation, offline guidance, verified-session context and recoverable loading/error states. Full format, lint, boundaries, typecheck, test, build, accessibility/browser and design-detector checks remain required before the milestone gate is passed.
