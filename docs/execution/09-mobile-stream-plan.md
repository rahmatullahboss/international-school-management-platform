# MOB-01 — Flutter Mobile Applications

## Status

Milestones 1 and 2 have passed on the client/native side. Milestone 3 Family read and interaction contracts have passed, including repository-driven multi-child production journeys, documents, forms, consent and paginated conversations. Milestone 4 Teacher read/write contracts and repository-driven Today/roster production journeys have passed. Milestone 5 now has a verified durable sync contract/state-machine foundation; encrypted on-device persistence, platform key management and live delta transport remain. All proposed mobile endpoints remain server-owned and are not live.

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
3. **Family journeys — client contracts and repository-driven journeys passed; server activation remains**
   - Multi-child guardian context, student context, timetable, attendance, published results, fees, receipts and message summaries.
   - Secure document metadata/download grants, forms, idempotent submission, guardian consent and paginated conversations.
   - Production failures hide unverifiable academic and financial values instead of substituting fixtures.
4. **Teacher journeys — client contracts and Today/roster journeys passed; write UI integration remains**
   - Assigned Today view, roster, timetable, substitutions, attendance batches and exact integer grade drafts.
   - Attendance finalization, grade publication and corrections remain server-authoritative.
5. **Durable offline sync — contract/state-machine foundation passed; encrypted store and transport integration remain**
   - Encrypted payload envelopes, idempotent operation queue contracts, scoped retry, delta cursor, duplicate handling, conflict, rejection and reconciliation states.
   - Platform-backed encrypted persistence and key lifecycle are not yet implemented.
6. **Notifications and documents — Family document contracts passed; push/deep-link delivery remains**
   - Device registration contracts, safe notification payloads, push routing, secure document download and notification preferences.
7. **Security, accessibility and release verification — pending**
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
- Secure document models expose short-lived download grants rather than permanent raw URLs.
- Forms and guardian consent commands require operation identities and idempotency keys; clients do not grant themselves consent authority.
- Conversation contracts use scoped pagination and reject malformed or cross-profile responses.
- Mobile CI `30489830914` passed the read-only Family-domain gate, all configured tests, both APK builds and artifact upload.
- Mobile CI `30490789540` passed repository-driven Family UI analysis, stale-response tests, all regression suites and both APK builds.
- Mobile CI `30492794318` passed the final read-only Family interaction gate, all configured tests, both APK builds and artifact upload.
- Root CI `30490789563` passed format, lint, boundaries, typecheck, repository tests, migrations, Neon, builds, audit/licences/provenance, browser journeys and execution-artifact validation.

## Checkpoint 4 evidence — Teacher journeys

- `school_staff_domain` defines immutable assigned meetings, substitutions, versioned rosters, attendance batch commands, exact integer grade drafts and explicit accepted/duplicate/conflict/rejected/reconciliation receipts.
- `TeacherMobileApi` proposes scoped contracts for teacher Today, meeting roster, attendance batches and grade drafts without implementing server endpoints.
- Attendance commands carry operation ID, idempotency key, base version and client creation time; the client cannot finalize attendance.
- Grade draft commands use exact integer score units and cannot publish grades.
- Production Staff Today and roster screens are repository-driven and fail closed when authorized services cannot verify assignments.
- `StaffJourneyController` rejects unassigned meeting roster requests, checks roster/section identity, discards stale roster responses and reloads on tenant/campus/capability scope changes.
- Mobile CI `30494408130` passed the final read-only Teacher journey gate, all configured analyzers/tests, both APK builds and artifact upload.

## Checkpoint 5 evidence — durable offline sync contracts

- `school_sync_engine` defines encrypted payload envelopes; diagnostic strings report metadata and byte counts without exposing ciphertext.
- Operations are account/tenant/campus/persona scoped and carry operation ID, idempotency key, aggregate identity, base version, client creation time and encrypted payload schema metadata.
- State transitions keep saved-on-device, waiting-for-network, in-flight, synced, duplicate, conflict, rejected and requires-reconciliation outcomes explicit.
- Retry uses validated capped exponential backoff; terminal outcomes are immutable and cannot retain future retry timestamps.
- Delta cursors are account/tenant/campus scoped and cannot cross school boundaries.
- `OfflineSyncCoordinator` persists in-flight state before transport, converts transport failure to a retryable operation and preserves encrypted payload bytes.
- Tests cover defensive ciphertext copying, redacted diagnostics, scope mismatch, retry timing, accepted/duplicate/conflict terminals, cursor isolation, transport recovery and duplicate receipt rejection.
- Mobile CI `30495682242` passed the permanent read-only durable sync gate, all configured analyzers/tests, both Android debug APK builds and artifact upload.
- Root CI `30495682281` passed format, lint, boundaries, typecheck, repository tests, fresh migration replay, live Neon driver, builds, audit/licences/provenance, browser journeys and execution-artifact validation.
- Real student data used: no.
- Production deployment or database mutation performed: no.

## Server-owned contract boundary

The following proposed endpoints remain unimplemented and inactive in MOB-01:

- `/v1/mobile/bootstrap`
- `/v1/mobile/device-sessions`
- `/v1/mobile/family/**`
- `/v1/mobile/teacher/**`
- future `/v1/mobile/sync` delta and operation endpoints

MOB-01 may define and test clients, domain contracts and fail-closed UI states. The owning server modules must review and implement authorization, audit, publication/finalization rules, data minimization and persistence.

## Exact next action

Implement a platform-backed encrypted sync store with explicit key lifecycle and account/school purge semantics, then connect teacher attendance drafts to the operation queue and reconciliation states without granting client-side finalization authority. In parallel, submit bootstrap, Family, Teacher, device-session and sync endpoint proposals through the existing server-module ownership process before live account data is used. After encrypted persistence is verified, continue push/deep-link delivery, secure document exchange, accessibility/localization and store-release evidence.
