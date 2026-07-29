# MOB-01 — Flutter Mobile Applications

## Status

Milestone 1 has passed. Milestone 2 client/native implementation has passed: OIDC/AppAuth session handling, secure storage, authorized tenant/campus/persona bootstrap, Android/iOS projects, device-session client contracts and signed-in app composition are verified. The proposed bootstrap and device-session endpoints remain server-owned and are not live. Milestone 3 Family journeys are active; repository-driven multi-child profiles, timetable, attendance, published results, fees and message summaries now replace fabricated production values.

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
2. **Authentication and bootstrap — client/native passed; server activation remains**
   - OIDC authorization-code flow with PKCE, secure token storage, device sessions, tenant/campus/persona selection and capability bootstrap.
   - Android/iOS projects, reviewed redirect schemes, Android API 23 secure-storage baseline, iOS Keychain Sharing entitlements and native build verification.
3. **Family journeys — active; read-model checkpoint passed**
   - Multi-child guardian context, student context, timetable, attendance, published results, fees and message summaries are repository-driven.
   - Documents, forms, consent and full conversations remain.
4. **Teacher journeys**
   - Today view, roster, timetable, substitutions, offline attendance, corrections, grade drafts and communication.
5. **Durable offline sync**
   - Local encrypted persistence, idempotent operation queue, retry, delta cursor, duplicate response handling, conflict and reconciliation workflows.
6. **Notifications and documents**
   - Device registration, push routing, safe payloads, deep links, secure document download and notification preferences.
7. **Security, accessibility and release verification**
   - Mobile threat model, restricted-data cache rules, step-up authentication, localization/RTL, text scaling, screen readers, performance, Android/iOS integration tests and store-release evidence.

## Checkpoint 1 evidence — shared foundation

- Workspace initialized under `mobile/` with a committed root lockfile and generated state excluded.
- `school_mobile_core` defines tenant, campus, persona, capability and sync-state contracts.
- `school_design_system` ports the approved operational palette, accessible written statuses and adaptive navigation.
- `school_api_client` enforces authenticated tenant/campus/persona-scoped Worker API calls and stable errors.
- Family and Staff app shells include responsive navigation and recoverable teacher attendance drafts.
- Mobile CI run `30480303165` passed the then-configured formatting, analysis and tests.
- Root CI run `30480303673` passed repository verification, migrations, Neon, browser journeys and artifact validation.

## Checkpoint 2 evidence — authentication, native platforms and bootstrap

- `school_authentication` implements compile-time OIDC configuration, AppAuth authorization-code exchange, PKCE-compatible native browser flow, refresh, end-session and stable failure codes.
- Platform secure storage, redacted token diagnostics, refresh skew, concurrent refresh coalescing and local-first sign-out are implemented.
- Account-scoped bootstrap requests do not invent tenant, campus or persona headers before authorized selection.
- Android and iOS projects use separate Family/Staff application identifiers and lowercase redirect schemes.
- Android requires API 23, disables application backup and prohibits debug signing in release configuration.
- iOS registers URL schemes and Keychain Sharing entitlements through committed project configuration.
- Native configuration is checked by `mobile/tool/verify_native_projects.py`.
- `school_app_bootstrap` coordinates restore, sign-in, authorized access selection, capability-scoped sessions and safe sign-out.
- Device-session registration/revocation client contracts are account-scoped, idempotent and exclude hardware, advertising and unrestricted personal identifiers; push credentials redact themselves from diagnostics.
- Mobile CI `30481736792` and root CI `30481735986` passed authentication foundation verification.
- Mobile CI `30482768167` and root CI `30482768058` passed bootstrap contract verification.
- Mobile CI `30486745809` passed native static checks, configured tests and both Android debug APK builds.
- Mobile CI `30488155470` passed signed-in composition analysis, lifecycle tests and both APK builds.
- Mobile CI `30488862416` passed device-session privacy/idempotency tests and both APK builds.
- Proposed endpoints `/v1/mobile/bootstrap` and `/v1/mobile/device-sessions` are not implemented or activated by MOB-01.

## Checkpoint 3 evidence — Family read models and production journeys

- `school_family_domain` defines immutable multi-child profile directories, timetable items, authoritative attendance summaries, published results, exact integer minor-unit money, fees/receipts and message summaries.
- `FamilyReadApi` proposes scoped read contracts for `/v1/mobile/family/profiles` and `/v1/mobile/family/students/{studentId}/dashboard` without implementing server endpoints.
- Decoders reject cross-campus profiles, non-Family personas, malformed shapes and response sections not granted by the active capability set.
- Production Family UI no longer substitutes hard-coded academic or financial values.
- `FamilyJourneyController` preserves authorized profile directories while refreshing, rejects dashboard/profile identity mismatches and discards slower stale responses after a child switch.
- Service failure hides academic and financial values rather than displaying cached fixtures as current data.
- Mobile CI `30489830914` passed the read-only Family-domain gate, all configured tests, both APK builds and artifact upload.
- Mobile CI `30490789540` passed repository-driven Family UI analysis, stale-response tests, all regression suites and both APK builds.
- Root CI `30490789563` passed format, lint, boundaries, typecheck, repository tests, migrations, Neon, builds, audit/licences/provenance, browser journeys and execution-artifact validation.
- Real student data used: no.
- Production deployment or database mutation performed: no.

## Exact next action

Continue Milestone 3 by adding server-approved Family documents, forms, consent and conversation read/write contracts plus loading, pagination and empty-state journeys. In parallel, submit the proposed mobile bootstrap, Family read and device-session endpoints through existing server-module ownership before any live account data is used. After the Family contract set is complete, begin the Teacher journey domain without changing academic publication, attendance or financial authority in the client.
