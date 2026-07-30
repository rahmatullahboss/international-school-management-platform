# MOB-01 — Flutter Mobile Applications

## Status

Milestones 1 through 6 have passed on the client/native side. Milestone 7 now has passed source/static tranches covering the restricted-data threat model, shared English/Bangla/Arabic localization runtime, Arabic RTL, deterministic locale fallback, bidirectional isolation, exact locale-aware money/time presentation, 200% text scaling, written screen-reader semantics, minimum interaction targets, fail-closed platform lifecycle decisions and native transport/file-sharing guards. Production composition adoption, complete translated domain copy, device-level TalkBack/VoiceOver verification, Android/iOS integration tests, approved restricted-document presenters and signed store-release evidence remain pending and release blocking.

Family read and interaction journeys, Teacher Today/roster, encrypted attendance drafts, durable sync, privacy-minimised notification routing, the secret-free Firebase/APNs lifecycle and step-up authenticated secure-document exchange are verified. All proposed mobile endpoints, Firebase/APNs project activation and platform-specific document presenters remain server/platform-owned and inactive. No production deployment, database mutation, provider activation or real student data is authorized by this stream.

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

The applications consume versioned platform APIs and read models. They must not connect directly to Neon, read module-private tables, duplicate authoritative academic or financial calculations, silently change server contracts or weaken tenant/capability enforcement.

## Owned paths

- `mobile/**`
- `docs/mobile/**`
- `docs/execution/09-mobile-stream-plan.md`
- `.github/workflows/mobile-ci.yml`

Backend APIs, notification issuance, identity policy, server authorization and shared platform contracts remain owned by their existing modules and require an approved contract-change process.

## Ordered milestones

1. **Workspace and shared foundation — passed**
   - Dart workspace, strict analysis, shared contracts, design system, API transport and read-only CI.
   - Adaptive Family and Staff application shells.
2. **Authentication and bootstrap — client/native passed; server activation remains**
   - OIDC authorization-code flow with PKCE, secure token storage, refresh/end-session, account-scoped bootstrap and capability sessions.
   - Android/iOS projects, separate identifiers/redirect schemes, Android API 23 secure-storage baseline, disabled backup, release-signing guard and iOS Keychain Sharing.
3. **Family journeys — read and interaction production journeys passed; server activation remains**
   - Multi-child/student context, timetable, attendance, published results, exact money, fees/receipts and messages.
   - Capability-scoped documents, forms, guardian consent and paginated conversations.
4. **Teacher journeys — production Today, roster and encrypted attendance-draft UI passed; server activation remains**
   - Assigned meetings, substitutions, versioned roster, attendance batches and exact integer grade drafts.
   - Attendance finalization, grade publication and corrections remain server-authoritative.
5. **Durable offline sync — client/native passed; live server delta activation remains**
   - Encrypted operations, idempotency, retry/backoff, cursors, conflict/rejection/reconciliation and scoped journal.
   - AES-GCM persistence, platform key lifecycle, rotation, tamper quarantine and account/school purge.
6. **Notifications and documents — client/native contracts and journeys passed; live activation remains**
   - Privacy-minimised notification envelopes, exact capability-safe routing and secret-free Firebase/APNs lifecycle.
   - Transient OIDC step-up proof, opaque short-lived grant exchange, no-redirect HTTPS transport, bounded streaming, integrity verification and explicit no-store cleanup.
   - Firebase/APNs project credentials, live notification issuance, the server exchange endpoint and approved native document presenters remain inactive.
7. **Security, accessibility and release verification — source/static tranches passed; device/store evidence pending**
   - Restricted-data threat model and trust-boundary/abuse-case evidence.
   - Shared English, Bangla and Arabic shell runtime with deterministic English fallback, ordered device-locale resolution and explicit Arabic RTL.
   - Bounded framework-label fallback delegates, bidi sanitization/isolation, exact integer-money presentation and explicit-offset timestamp presentation.
   - Source tests for 200% text scaling, written status semantics, minimum 48 logical-pixel controls, reduced motion and lifecycle privacy decisions.
   - Android cleartext traffic disabled; iOS arbitrary transport loads, file sharing and open-in-place disabled; CI drift guards enforce the settings.
   - Production composition, complete translated domain copy, TalkBack, VoiceOver, Dynamic Type device passes, Android/iOS integration tests, native restricted-document presenters, signed release artifacts, privacy declarations and rollback evidence remain pending.

## Checkpoint 1 evidence — shared foundation

- `school_mobile_core`, `school_design_system` and `school_api_client` establish scoped mobile contracts, adaptive UI and authenticated API transport.
- Mobile CI `30480303165` passed the configured formatting, analysis and tests.
- Root CI `30480303673` passed repository verification, migrations, Neon, browser journeys and artifact validation.

## Checkpoint 2 evidence — authentication, native platforms and bootstrap

- `school_authentication` implements AppAuth authorization-code exchange, refresh/end-session and redacted secure-token storage.
- `school_app_bootstrap` coordinates restore, sign-in, authorized access selection, capability sessions and safe sign-out.
- Native identifiers, redirect schemes, Android API 23/backup/signing guards and iOS URL/Keychain configuration are committed and statically verified.
- Device-session contracts are account-scoped, idempotent and exclude hardware/advertising identifiers and unrestricted personal identifiers.
- Mobile CI `30481736792`, `30482768167`, `30486745809`, `30488155470` and `30488862416` passed the authentication, bootstrap, native and device-session gates.
- Root CI `30481735986` and `30482768058` passed the corresponding repository gates.

## Checkpoint 3 evidence — Family read models and production journeys

- Immutable Family profiles, timetable, finalized attendance summaries, published results, exact minor-unit money, fees/receipts and message summaries are defined.
- Production Family UI is repository-driven, rejects cross-scope/malformed data, discards stale child responses and hides unverifiable values instead of substituting fixtures.
- Document metadata exposes opaque grants rather than permanent URLs; forms use server-issued versions; consent remains guardian-authoritative; conversations are scoped and paginated.
- Mobile CI `30489830914`, `30490789540` and `30492794318` passed Family domain, production UI and interaction contracts.
- Root CI `30490789563` passed the complete repository gate.

## Checkpoint 4 evidence — Teacher journeys

- Teacher Today, substitutions, assigned/versioned rosters, attendance commands and grade drafts are immutable and scoped.
- Client commands carry operation/idempotency/base-version identities but cannot finalize attendance or publish grades.
- Production Staff journeys fail closed and discard stale/unassigned roster responses.
- Mobile CI `30494408130` passed all configured analyzers/tests and both APK builds.

## Checkpoint 5 evidence — encrypted durable sync and Staff write journey

- Sync operations are account/tenant/campus/persona scoped and expose explicit queued, retrying, synced, duplicate, conflict, rejected and reconciliation states.
- Platform-backed storage uses AES-GCM, secure versioned keys, atomic replacement, rotation, tamper quarantine and account/school purge.
- Teacher attendance/grade payloads remain encrypted until scoped transport; production attendance UI uses only authorized rosters and explicit synchronization.
- Mobile CI `30495682242` and root CI `30495682281` passed the durable sync gate.
- Permanent read-only Mobile CI `30501424447` and root CI `30501424403` passed the full checkpoint.

## Checkpoint 6 evidence — Family interaction production journeys

- Family document, form, consent, conversation and message state is scoped to the active account/school/persona/student and protects against stale responses.
- The Services and Conversations UI is capability-scoped and fail closed.
- Dynamic forms submit exact validated answers with server-issued base/schema versions; guardian consent and message send authority are checked before transport.
- Mobile CI `30518088954` and root CI `30518088899` passed the permanent production interaction gate.

## Checkpoint 7 evidence — privacy-minimised notification routing

- Notification data accepts only opaque allow-listed fields; names, amounts, filenames, message bodies, display text, raw URLs, bearer tokens and storage credentials are rejected.
- Routing requires the exact app, tenant, campus, persona, capability set and validity window and never switches school or role.
- Launch/runtime inbox handling and bounded duplicate suppression are verified in both apps.
- Source Mobile CI `30519588980`, permanent read-only Mobile CI `30520102717`, root CI `30520102721`, immutable-head Mobile CI `30521496997` and root CI `30521497150` passed.
- Staging `30521497079` was skipped.

## Checkpoint 8 evidence — secret-free native notification provider lifecycle

- `school_native_notifications` provides an inactive-by-default Firebase Messaging/APNs boundary without Firebase options, APNs credentials or provider secrets.
- Android uses FCM tokens; Apple uses APNs tokens. Permission denial blocks registration; refresh registers the new scoped session before revoking the previous one; explicit revocation removes the server session before deleting the provider token.
- Provider timestamps require explicit `Z` or `±HH:MM` offsets and payloads are normalized through the privacy-minimised contract.
- Source Mobile CI `30525975216`, root CI `30525975223`, permanent read-only Mobile CI `30526970294` and root CI `30526970286` passed.
- Staging `30525975268` and `30526970393` were skipped.

## Checkpoint 9 evidence — step-up authenticated secure-document exchange

- `school_authentication` provides transient AppAuth step-up authorization using a fresh login prompt, `max_age=0`, nonce and optional ACR values. Step-up access tokens are redacted, bounded to a short proof window and are not written into the normal persisted session.
- `school_secure_documents` proposes `POST /v1/mobile/family/document-download-grants/{grantId}/exchange` over HTTPS with redirects disabled, scoped headers, idempotency and a bearer token selected from ordinary or step-up authorization according to the grant.
- Responses must be `200`, `Cache-Control: no-store`, contain the expected document identity, bounded content length, allow-listed media type and SHA-256 digest. Streams exceeding the declared/maximum size or failing digest/length checks are rejected.
- Restricted documents require a single-use grant and no-store classification. Completed and concurrent grant replay is blocked.
- Bytes are written to an opaque random temporary lease, presented only through an injected native presenter interface and deleted in `finally` after presentation or any failure. Paths, bearer tokens and digests are redacted from diagnostics.
- Family UI exposes **Verify and open securely** for step-up grants, clears consumed grants, reports no-store cleanup and remains disabled/fail closed when the secure runtime/presenter is not configured.
- Tests cover transient proof expiry, step-up token selection, integrity success/failure, lease cleanup, replay blocking, restricted-policy rejection and Family controller grant consumption.
- Source Mobile CI `30535072709` passed formatting, every configured analyzer/test, both Android debug APK builds and artifact upload. Root CI `30535072784` passed format, lint, boundaries, tests, migrations, AUTH revocation contracts, Neon, builds, supply-chain checks and browser journeys.
- Final permanent read-only Mobile CI `30535727677` repeated formatting, clean-tree/native guards, every app/shared/domain/storage/notification/secure-document analyzer and test, both APK builds and artifact upload.
- Final root CI `30535727688` passed the complete repository gate. Cloudflare staging `30535727669` was skipped.
- Real student data used: no.
- Production deployment or database mutation performed: no.

## Checkpoint 10 evidence — restricted-data, accessibility, localization and native release guards

- `docs/mobile/restricted-data-threat-model.md` records protected assets, trust boundaries, spoofing/tampering/repudiation/disclosure/denial/elevation threats, client mitigations, abuse cases, owner activation gates, residual risks and release blockers.
- `school_design_system` adds an explicit `en`/`bn`/`ar` shell policy, deterministic English fallback and Arabic RTL without inferring tenant, account, campus, persona, student or authorization scope.
- Source tests verify Bangla/Arabic copy, RTL direction, a five-destination adaptive shell at 200% text scaling, explicit written status semantics and 48 logical-pixel interactive controls.
- Android manifests prohibit cleartext transport and backup. iOS manifests prohibit arbitrary transport loads, unrestricted file sharing and open-in-place document access. `verify_native_projects.py` fails closed if these settings drift.
- `docs/mobile/accessibility-localization-release-evidence.md` records the source evidence matrix, critical journeys, screen-reader/localization acceptance criteria, platform integration requirements and store-release blockers.
- Implementation Mobile CI `30543231293`, root CI `30543231291`, final documentation-head Mobile CI `30543798656` and root CI `30543798732` passed. Staging `30543798808` was skipped.
- Production deployment, database mutation, notification-provider activation, secure-document server activation and real student data use: none.

## Checkpoint 11 evidence — localization runtime, exact presentation and lifecycle interruption foundation

- `school_design_system` now provides ordered supported-locale resolution, localized shell delegates, Arabic RTL Widgets localization and bounded English framework-label fallback delegates for Material/Cupertino controls.
- Dynamic identifiers and user-controlled text strip directional overrides/isolate controls and are re-enclosed with first-strong isolation.
- Exact money presentation accepts integer minor units only, localizes digits/separators for English, Bangla and Arabic and never performs floating-point conversion or authoritative financial calculation.
- Timestamp presentation requires an authoritative UTC instant, explicit whole-minute offset and printable server-provided timezone identifier; it does not infer the school timezone from the device.
- Accessibility preferences expose bold text, high contrast and reduced motion without affecting authorization, sync, document-security or authority decisions.
- `school_mobile_core` adds platform-neutral lifecycle decisions for backgrounding, process detachment, memory pressure and stale/fresh authorization. Restricted content can be obscured, presentation cancelled and transient bytes purged using redacted reason codes only.
- Tests cover unsupported/ordered locale resolution, delegates, RTL, bidi spoofing, integer money, explicit offsets, backgrounding, process death, memory pressure and authorization refresh.
- Production composition wiring, complete translated domain copy, reviewed global framework translations, native lifecycle wiring and device certification remain incomplete.
- The implementation and final documentation-head run IDs are recorded in PR #41 after immutable-head gates complete.
- Production deployment, database mutation, provider activation and real student data use: none.

## Server/platform-owned contract boundary

The following proposed endpoints remain unimplemented and inactive in MOB-01:

- `/v1/mobile/bootstrap`
- `/v1/mobile/device-sessions`
- `/v1/mobile/family/**`, including the proposed document-grant exchange route
- `/v1/mobile/teacher/**`
- future `/v1/mobile/sync` delta and operation endpoints

MOB-01 may define and test clients, domain contracts and fail-closed UI. Owning server/platform modules must review and implement authorization, audit, notification issuance, provider project configuration, exchange response headers/integrity policy, native viewer/presenter integration, data minimization and persistence.

## Exact next action

Adopt the reviewed localization configuration and localized shell strings in Family and Staff production composition, then complete translated domain copy, plural rules and locale-selection UX. Wire platform lifecycle signals to privacy overlays, restricted-presentation cancellation, transient-byte purge and fresh-proof enforcement on Android/iOS. Complete device-level TalkBack, VoiceOver, Dynamic Type, switch-control, contrast, reduced-motion and representative RTL journeys. Add Android/iOS integration tests for backgrounding, interruption, process death, low storage, notification launches, encrypted sync recovery and restricted-document cleanup. Separately obtain server/platform-owner review for Bootstrap, Family, Teacher, device-session, notification, sync and secure-document exchange activation, approved Firebase/APNs configuration and Android/iOS native document presenters. Produce signed release artifacts, privacy declarations, provenance and rollback evidence before any live account or student data is used.
