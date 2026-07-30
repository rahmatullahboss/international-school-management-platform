# MOB-01 — Flutter Mobile Applications

## Status

Milestones 1 through 5 have passed on the client/native side. Family read journeys and capability-scoped document, form, guardian-consent and conversation production journeys are verified. Teacher Today, assigned roster and encrypted attendance-draft production journeys are verified. Durable sync includes platform-backed AES-GCM persistence, secure key lifecycle, account/school purge, operation-journal reconciliation and production Staff queue/transport UI. Milestone 6 now includes a verified privacy-minimised notification envelope, provider-neutral notification inbox and capability-safe Family/Staff launch and runtime routing. Native Firebase/APNs adapters, strict provider timestamp normalization, notification permission and token lifecycle, secure-document exchange and step-up completion remain. All proposed mobile endpoints remain server-owned and are not live.

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
3. **Family journeys — read and interaction production journeys passed; server activation remains**
   - Multi-child guardian context, student context, timetable, attendance, published results, fees, receipts and message summaries.
   - Capability-scoped document metadata and short-lived download grants, server-versioned dynamic forms, idempotent submission, guardian consent and paginated conversations/messages.
   - Production failures hide unverifiable academic, financial and interaction data instead of substituting fixtures.
4. **Teacher journeys — production Today, roster and encrypted attendance-draft UI passed; server activation remains**
   - Assigned Today view, roster, timetable, substitutions, attendance batches and exact integer grade drafts.
   - Attendance drafts are saved to encrypted device storage, explicitly synchronized and surfaced through pending/conflict/rejected/reconciliation states.
   - Attendance finalization, grade publication and corrections remain server-authoritative.
5. **Durable offline sync — client/native passed; live server delta activation remains**
   - Encrypted payload envelopes, idempotent operation queue, scoped retry, delta cursor, duplicate handling, conflict, rejection and reconciliation states.
   - Platform-backed AES-GCM file persistence, platform secure-storage key versions, key rotation, tamper quarantine, operation journal and account/school purge.
6. **Notifications and documents — interaction UI and client routing passed; native delivery and exchange remain**
   - Device registration contracts, privacy-minimised notification envelopes, provider-neutral launch/runtime inbox, exact capability-safe routes, documents, forms, guardian consent and conversations.
   - Native Firebase/APNs adapters, explicit-offset timestamp normalization, notification permission and token lifecycle, native secure-document transfer, step-up completion and user notification preferences remain.
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
- Mobile CI `30492794318` passed the final read-only Family interaction contract gate, all configured tests, both APK builds and artifact upload.
- Root CI `30490789563` passed format, lint, boundaries, typecheck, repository tests, migrations, Neon, builds, audit/licences/provenance, browser journeys and execution-artifact validation.

## Checkpoint 4 evidence — Teacher journeys

- `school_staff_domain` defines immutable assigned meetings, substitutions, versioned rosters, attendance batch commands, exact integer grade drafts and explicit accepted/duplicate/conflict/rejected/reconciliation receipts.
- `TeacherMobileApi` proposes scoped contracts for teacher Today, meeting roster, attendance batches and grade drafts without implementing server endpoints.
- Attendance commands carry operation ID, idempotency key, base version and client creation time; the client cannot finalize attendance.
- Grade draft commands use exact integer score units and cannot publish grades.
- Production Staff Today and roster screens are repository-driven and fail closed when authorized services cannot verify assignments.
- `StaffJourneyController` rejects unassigned meeting roster requests, checks roster/section identity, discards stale roster responses and reloads on tenant/campus/capability scope changes.
- Mobile CI `30494408130` passed the final read-only Teacher journey gate, all configured analyzers/tests, both APK builds and artifact upload.

## Checkpoint 5 evidence — encrypted durable sync and Staff write journey

- `school_sync_engine` defines encrypted payload envelopes; diagnostic strings report metadata and byte counts without exposing ciphertext.
- Operations are account/tenant/campus/persona scoped and carry operation ID, idempotency key, aggregate identity, base version, client creation time and encrypted payload schema metadata.
- State transitions keep saved-on-device, waiting-for-network, in-flight, synced, duplicate, conflict, rejected and requires-reconciliation outcomes explicit.
- Retry uses validated capped exponential backoff; terminal outcomes are immutable and cannot retain future retry timestamps.
- Delta cursors are account/tenant/campus scoped and cannot cross school boundaries.
- `OfflineSyncCoordinator` persists in-flight state before transport, converts transport failure to a retryable operation and preserves encrypted payload bytes.
- `school_sync_storage` stores authenticated ciphertext in application-support files and versioned AES keys in platform secure storage; scope identities and operation payloads are not written as plaintext filenames or records.
- Storage uses atomic replacement, key rotation, scope-bound authenticated data, corruption/tamper quarantine and explicit account/school purge of files, catalog entries and key versions.
- `SyncOperationJournal` exposes only the active account/tenant/campus/persona operation history with kind/state filters and deterministic newest-first ordering.
- `school_teacher_sync` encrypts attendance and grade-draft commands, rejects operation-ID collisions, decrypts only inside the scoped transport boundary and maps server receipts to accepted, duplicate, conflict, rejected or reconciliation outcomes.
- Production Staff attendance UI binds only to an authorized versioned roster, saves encrypted drafts, synchronizes explicitly and displays pending, accepted, duplicate, conflict, rejected and reconciliation states without finalizing attendance client-side.
- Tests cover ciphertext redaction, storage reopen, retry/persona filtering, cursor persistence, key rotation, tamper quarantine, account/school purge, cross-school rejection, queue idempotency, command collision, receipt mismatch, retry backoff, grade duplicate, controller scope reset and conflict visibility.
- Mobile CI `30495682242` and root CI `30495682281` passed the durable sync contract/state-machine gate.
- Final permanent read-only Mobile CI `30501424447` passed formatting, generated/native guards, all Family/Staff/shared/domain/storage/teacher-sync analyzers and tests, both Android debug APK builds and artifact upload.
- Final root CI `30501424403` passed format, lint, boundaries, typecheck, repository tests, fresh migration replay, live Neon driver, builds, audit/licences/provenance, browser journeys and execution-artifact validation.
- Real student data used: no.
- Production deployment or database mutation performed: no.

## Checkpoint 6 evidence — Family interaction production journeys

- `FamilyInteractionController` keeps document, form, consent, conversation and message state scoped to the active account, tenant, campus, persona and student profile; slower responses from a previous child selection are discarded.
- Production navigation exposes a capability-scoped Services hub plus Conversations destination without substituting fixture data when the interaction service is unavailable.
- Document screens display authorized metadata and request opaque, short-lived download grants; raw URLs, access tokens and storage credentials are never exposed. Restricted documents remain no-store.
- Form definitions include the server-issued base version as well as schema version. Dynamic text, boolean, single-choice and date fields submit exact validated answers with idempotency and never invent a newer revision.
- Guardian consent screens require the guardian persona and `forms.consent` capability before transport, preserve the policy version and expose explicit grant or decline decisions.
- Conversation screens use scoped cursor pagination, verify conversation membership in the active directory, require `messages.send` before sending and append only server-returned messages.
- Tests cover stale child-response rejection, server-issued form-version use, student consent rejection before transport and capability-authorized conversation sending.
- Final permanent read-only Mobile CI `30518088954` passed strict formatting, clean-tree/native guards, every configured analyzer and test, both Android debug APK builds and artifact upload.
- Final root CI `30518088899` passed format, lint, boundaries, typecheck, repository tests, fresh migration replay, live Neon driver, builds, audit/licences/provenance, browser journeys and execution-artifact validation.
- Real student data used: no.
- Production deployment or database mutation performed: no.

## Checkpoint 7 evidence — privacy-minimised notification routing

- `MobileNotificationEnvelope` accepts only an allow-listed data payload containing opaque notification, application, tenant, campus, persona, kind, optional resource and bounded issued/expiry timestamps.
- Provider display titles and bodies, student or staff names, amounts, document names, message bodies, raw URLs, bearer tokens, storage credentials and arbitrary extra fields are rejected before routing.
- Lock-screen presentation is generated locally with generic Family or Staff text and diagnostics redact school scope and resource identity.
- `MobileNotificationRouteResolver` requires the exact application, active tenant, campus, persona and capability set; it never selects another school or role on behalf of a notification.
- Expired, excessively long-lived, materially future-dated, cross-application, cross-school, wrong-persona and unauthorized-capability intents fail closed without navigation.
- Resource identifiers are accepted only for Family forms and conversations and are URI-encoded before route construction. Interaction routes remain unavailable when the authorized interaction repository is not configured.
- `MobileNotificationInbox` provides a provider-neutral one-time launch intent and runtime-open stream. `MobileNotificationOpenTracker` bounds memory and suppresses duplicate provider callbacks.
- Family and Staff production apps consume an injected notification source, clear duplicate state when authorization scope changes and route only after the active session passes the resolver.
- Tests cover privacy-field rejection, redacted diagnostics, exact Family form routing, wrong-campus/persona/capability blocking, expiry/future/application rejection, Staff any-of message capability rules, one-time launch consumption and bounded duplicate handling.
- Source checkpoint Mobile CI `30519588980` passed all configured analyzers/tests, both Android debug APK builds and artifact upload.
- Permanent read-only Mobile CI `30520102717` repeated strict formatting, clean-tree/native guards, all analyzers/tests, both Android debug APK builds and artifact upload successfully.
- Root CI `30520102721` passed format, lint, boundaries, typecheck, repository tests, fresh migration replay, live Neon driver, builds, audit/licences/provenance, browser journeys and execution-artifact validation.
- Final immutable-head Mobile CI `30521496997` passed strict formatting, clean-tree/native guards, all configured analyzers/tests, both Android debug APK builds and artifact upload.
- Final immutable-head root CI `30521497150` passed the complete repository, migration, Neon, build, supply-chain, browser and execution-artifact gate.
- Cloudflare staging run `30521497079` was skipped; no application deployment occurred.
- Real student data used: no.
- Production deployment or database mutation performed: no.

## Server-owned contract boundary

The following proposed endpoints remain unimplemented and inactive in MOB-01:

- `/v1/mobile/bootstrap`
- `/v1/mobile/device-sessions`
- `/v1/mobile/family/**`
- `/v1/mobile/teacher/**`
- future `/v1/mobile/sync` delta and operation endpoints

MOB-01 may define and test clients, domain contracts and fail-closed UI states. The owning server modules must review and implement authorization, audit, publication/finalization rules, notification issuance, data minimization and persistence.

## Exact next action

Add native Firebase/APNs adapters with explicit-offset timestamp normalization and notification permission, installation-token refresh and revocation lifecycle on top of the verified provider-neutral inbox without committing provider secrets or activating server endpoints. Then implement native secure-document exchange with step-up authentication and explicit no-store handling. After that, complete restricted-data threat-model evidence, accessibility, localization/RTL, text-scaling and screen-reader verification, Android/iOS integration tests and store-release evidence. Bootstrap, Family, Teacher, device-session, notification and sync endpoint proposals must still pass the existing server-module ownership process before live account data is used.
