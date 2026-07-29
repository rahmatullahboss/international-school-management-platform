# MOB-01 — Flutter Mobile Applications

## Status

Milestone 1 passed on 2026-07-29 after the web program reached `GATE-PILOT-READY`. Milestone 2 client-side authentication and bootstrap foundation has passed; native Android/iOS wiring, device-session registration and the server-owned bootstrap endpoint remain before Milestone 2 can close.

## Execution identity

- Repository: `rahmatullahboss/international-school-management-platform`
- Reviewed starting base: `310513c2fcb2c37c4489e383cbb05eab7d47d650`
- Branch: `module/flutter-mobile-apps`
- Fixed worktree when resumed locally: `.worktrees/mob-01-flutter`
- Neon branch: none; MOB-01 owns no database schema
- Draft pull request: `#41`
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

1. **Workspace and shared foundation — passed**
   - Dart pub workspace, strict analysis, shared mobile contracts, design system, API transport and CI.
   - Adaptive Family and Staff application shells.
2. **Authentication and bootstrap — client foundation passed; native/server wiring remains**
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

- Workspace initialized under `mobile/` with a committed root lockfile and generated state excluded.
- `school_mobile_core` defines tenant, campus, persona, capability and sync-state contracts.
- `school_design_system` ports the approved operational palette, accessible written statuses and adaptive navigation.
- `school_api_client` enforces authenticated tenant/campus/persona-scoped Worker API calls and stable errors.
- Family app includes Guardian/Student switching, capability-aware fee navigation and initial timetable, attendance, results, fees and message read journeys.
- Staff app includes teacher navigation, gradebook/message placeholders and a recoverable local attendance draft workflow.
- Unit/widget tests cover core contracts, design semantics, persona isolation, responsive navigation and attendance draft state.
- Checkpoint implementation head: `0f4547f02fed2f7a009a2152515a271b15814feb`.
- Mobile CI run `30480303165`: passed formatting, generated-state guard, five analysis targets and four test suites.
- Root CI run `30480303673`: passed format, lint, architecture boundaries, typecheck, repository tests, migration replay, Neon driver, builds, dependency/licence/provenance checks, browser journeys and execution-artifact validation.
- Real student data used: no.
- Production deployment or database mutation performed: no.

## Checkpoint 2 evidence — authentication and bootstrap foundation

- Added `school_authentication` with compile-time OIDC configuration, AppAuth authorization-code exchange, PKCE-compatible native browser flow, refresh, end-session and stable failure codes.
- Added secure token persistence through platform secure storage, redacted token diagnostics, one-minute refresh skew, concurrent refresh coalescing and local-first sign-out.
- Added account-scoped API requests that carry authentication and correlation context without inventing tenant, campus or persona headers before the user selects an authorized scope.
- Added immutable tenant/campus/persona bootstrap contracts and capability-specific `SchoolSession` activation.
- Added a strict client contract for proposed endpoint `/v1/mobile/bootstrap`; the endpoint is not implemented by MOB-01 and remains subject to the existing server-module ownership process.
- Tests reject unknown personas, duplicate access declarations and unavailable tenant/campus/persona selections; they verify that scoped headers appear only after activation.
- Checkpoint implementation head: `3da3ed04a94e58bedb68402704f93bc6cfff79e2`.
- Mobile CI run `30481736792`: authentication foundation passed formatting, generated-state guard, six analysis targets and all then-configured tests.
- Root CI run `30481735986`: full repository verification passed after the authentication foundation.
- Mobile CI run `30482768167`: bootstrap contract passed formatting, six analysis targets and six test targets, including API header/decoder tests.
- Root CI run `30482768058`: full repository verification, browser journeys and artifact validation passed after the bootstrap contract.
- Real student data used: no.
- Production deployment or database mutation performed: no.

## Exact next action

Generate and verify the native Android/iOS application projects, configure reviewed redirect schemes and secure-storage platform requirements, connect both app shells to `AuthSessionManager`, and submit the server-owned `/v1/mobile/bootstrap` plus device-session registration contract through the existing ownership process before using live account data.
