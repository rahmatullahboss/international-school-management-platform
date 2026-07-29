# MOB-01 — Flutter Mobile Applications

## Status

Active on 2026-07-29 after the web program reached `GATE-PILOT-READY`.

## Execution identity

- Repository: `rahmatullahboss/international-school-management-platform`
- Reviewed starting base: `310513c2fcb2c37c4489e383cbb05eab7d47d650`
- Branch: `module/flutter-mobile-apps`
- Fixed worktree when resumed locally: `.worktrees/mob-01-flutter`
- Neon branch: none; MOB-01 owns no database schema
- Production mutation: prohibited without separate authorization

## Objective

Deliver two native Flutter applications on one shared workspace:

1. **School Family** for guardian and student personas.
2. **School Staff** for teacher-first operational workflows.

The applications consume existing versioned platform APIs and read models. They must not connect directly to Neon, read module-private tables, duplicate authoritative academic or financial calculations, or weaken tenant and capability enforcement.

## Owned paths

- `mobile/**`
- `docs/mobile/**`
- `docs/execution/09-mobile-stream-plan.md`
- `.github/workflows/mobile-ci.yml`

Any backend API, notification, identity or shared platform contract change requires an approved contract-change request and remains owned by the relevant existing module.

## Ordered milestones

1. **Workspace and shared foundation**
   - Dart pub workspace, strict analysis, shared mobile contracts, design system, API transport and CI.
   - Adaptive Family and Staff application shells.
2. **Authentication and bootstrap**
   - OIDC authorization-code flow with PKCE, secure token storage, device sessions, tenant/campus/persona selection and capability bootstrap.
3. **Family journeys**
   - Multi-child guardian context, student context, timetable, attendance, published results, fees, documents, forms, consent and communication.
4. **Teacher journeys**
   - Today view, roster, timetable, substitutions, offline attendance, corrections, grade drafts and communication.
5. **Durable offline sync**
   - Local encrypted persistence, idempotent operation queue, retry, delta cursor, duplicate response handling, conflict and reconciliation workflows.
6. **Notifications and documents**
   - Device registration, push routing, safe payloads, deep links, secure document download and notification preferences.
7. **Security, accessibility and release verification**
   - Mobile threat model, restricted-data cache rules, step-up authentication, localization/RTL, text scaling, screen readers, performance, Android/iOS integration tests and store-release evidence.

## Checkpoint 1 evidence

- Workspace initialized under `mobile/`.
- `school_mobile_core` defines tenant, campus, persona, capability and sync-state contracts.
- `school_design_system` ports the approved operational palette and adaptive navigation.
- `school_api_client` enforces authenticated tenant/campus/persona-scoped Worker API calls.
- Family app includes Guardian/Student switching, capability-aware fee navigation and initial read journeys.
- Staff app includes teacher navigation and a local offline attendance draft workflow.
- Unit/widget tests cover core contracts, design semantics, persona isolation and attendance draft state.
- Implementation head before this evidence file: `e01748b4355685566e0ba3339a475ff936e4fbea`.
- Real student data used: no.
- Production deployment or database mutation performed: no.

## Exact next action

Run mobile CI, resolve analysis/test failures, then implement milestone 2 authentication and mobile bootstrap contracts without changing frozen backend ownership silently.
