# MOB-01 — Flutter Mobile Applications

## Status

Milestones 1 through 6 have passed on the client/native side. Milestone 7 now has passed source/static and production-composition tranches covering the restricted-data threat model, shared English/Bangla/Arabic localization runtime, localized Family/Staff pre-authentication access/configuration gates, reviewed Flutter Material/Cupertino framework translations, Arabic RTL, deterministic locale fallback, secure persisted locale selection, localized count copy, integer cardinal plural rules, bidirectional isolation, exact locale-aware money/time presentation, explicit UTC fallback for Family interaction timestamps without device-timezone inference, Family core read and interaction/document/form/consent/conversation translation with locale-aware date-only form presentation, Staff teacher/sync translation, fail-closed Staff gradebook/message server boundaries, real Flutter lifecycle-to-coordinator privacy/authorization refresh wiring, Android `FLAG_SECURE` screen-capture protection, iOS inactive/app-switcher privacy covers, 200% text scaling, written screen-reader semantics, minimum interaction targets and native transport/file-sharing guards. Remaining untranslated domain surfaces outside those completed journeys, device-level TalkBack/VoiceOver and native privacy verification, Android/iOS integration tests, authoritative Staff assessment/conversation read models, approved restricted-document presenters and signed store-release evidence remain pending and release blocking.

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
   - Android/iOS projects, separate identifiers/redirect schemes, the Flutter 3.44.7-supported Android API 24 baseline, disabled backup, release-signing guard and iOS Keychain Sharing.
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
7. **Security, accessibility and release verification — source/static and production-composition tranches passed; device/store evidence pending**
   - Restricted-data threat model and trust-boundary/abuse-case evidence.
   - Shared English, Bangla and Arabic shell runtime with deterministic English fallback, ordered device-locale resolution and explicit Arabic RTL.
   - Reviewed Flutter global Material/Cupertino delegates, approved-locale controller, application-separated secure locale preference, localized count sentences, integer cardinal plural categories, bidi sanitization/isolation, exact integer-money presentation and explicit-offset timestamp presentation. Family interaction date/time surfaces now refuse device-timezone inference and present current server instants explicitly in UTC until authoritative school offset/timezone metadata exists.
   - Family and Staff pre-authentication/bootstrap access and configuration-failure states plus authorized production application states adopt the localization runtime. Visible Family/Staff application names, access phase/status/action/failure copy and guardian/student/teacher presentation labels use reviewed English/Bangla/Arabic copy; server-authored tenant/campus names and support codes are bidi-isolated without changing authority. Authorized application states retain localized shell navigation/actions, generated titles and a 56-pixel state-preserving language control; Family core read plus Services/Documents/Forms/Guardian Consent/Conversations/Messages journeys and Staff teacher/sync journeys now use reviewed English/Bangla/Arabic domain copy. Family fees/receipts retain exact integer money presentation, Family form date-only answers retain ISO `yyyy-MM-dd` payloads while rendering through the active locale, and dynamic mixed-script identifiers are bidi-isolated. Staff Gradebook/Messages now show localized fail-closed server-boundary states rather than synthetic current data while authoritative mobile read models are inactive.
   - Invalid/read/write locale-preference states fail safely using reason codes without storing authority values; production count sentences use reviewed pluralized copy instead of English `(s)` placeholders.
   - `MobileAppCoordinator` receives real Flutter lifecycle signals, obscures ready capability state while backgrounded/detached, and revalidates or refreshes OIDC authorization before bootstrap state is restored on resume. AppAuth inactive transitions remain non-destructive and memory-pressure decisions remain nonblocking.
   - Source tests for 200% text scaling, written status semantics, minimum 48 logical-pixel controls, reduced motion, lifecycle policy decisions and lifecycle-to-coordinator wiring.
   - Android cleartext traffic and backup are disabled and both activities set `FLAG_SECURE`; iOS arbitrary transport loads, file sharing and open-in-place are disabled and both SceneDelegates install an opaque privacy cover while inactive. CI drift guards enforce the native settings and preserve Flutter scene-callback forwarding.
   - Remaining untranslated domain copy outside the completed pre-auth/access-gate, Family read/interaction and Staff teacher/sync/server-boundary surfaces, authoritative Staff assessment-list and teacher-conversation read models, authoritative currency fraction metadata, TalkBack, VoiceOver, Dynamic Type device passes, secure-storage device evidence, Android/iOS integration tests, native restricted-document presenters, signed release artifacts, privacy declarations and rollback evidence remain pending.

## Checkpoint 1 evidence — shared foundation

- `school_mobile_core`, `school_design_system` and `school_api_client` establish scoped mobile contracts, adaptive UI and authenticated API transport.
- Mobile CI `30480303165` passed the configured formatting, analysis and tests.
- Root CI `30480303673` passed repository verification, migrations, Neon, browser journeys and artifact validation.

## Checkpoint 2 evidence — authentication, native platforms and bootstrap

- `school_authentication` implements AppAuth authorization-code exchange, refresh/end-session and redacted secure-token storage.
- `school_app_bootstrap` coordinates restore, sign-in, authorized access selection, capability sessions and safe sign-out.
- Native identifiers, redirect schemes, the Flutter 3.44.7 Android API 24 baseline, backup/signing guards and iOS URL/Keychain configuration are committed and statically verified.
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

- `school_design_system` provides ordered supported-locale resolution, localized shell delegates, Arabic RTL Widgets localization and reviewed Flutter global Material/Cupertino delegates for the approved English, Bangla and Arabic locales.
- Dynamic identifiers and user-controlled text strip directional overrides/isolate controls and are re-enclosed with first-strong isolation.
- Exact money presentation accepts integer minor units only, localizes digits/separators for English, Bangla and Arabic and never performs floating-point conversion or authoritative financial calculation.
- Timestamp presentation requires an authoritative UTC instant, explicit whole-minute offset and printable server-provided timezone identifier; it does not infer the school timezone from the device.
- Accessibility preferences expose bold text, high contrast and reduced motion without affecting authorization, sync, document-security or authority decisions.
- `school_mobile_core` adds platform-neutral lifecycle decisions for backgrounding, process detachment, memory pressure and stale/fresh authorization. Restricted content can be obscured, presentation cancelled and transient bytes purged using redacted reason codes only.
- Tests cover unsupported/ordered locale resolution, delegates, RTL, bidi spoofing, integer money, explicit offsets, backgrounding, process death, memory pressure and authorization refresh.
- Implementation Mobile CI `30549823469`, root CI `30549823141`, final documentation Mobile CI `30550467097` and root CI `30550467072` passed. Staging `30550467603` was skipped.
- Production deployment, database mutation, provider activation and real student data use: none.

## Checkpoint 12 evidence — production localization composition and exact Family presentation

- `school_design_system` adds a localized Material application composition, an approved-locale controller and integer cardinal plural categories for English, Bangla and Arabic. Locale preferences remain presentation-only and cannot select or infer any account/school/persona/capability authority.
- Family and Staff configuration-failure, access-gate and authorized application roots now use the approved locale list, ordered device-locale resolution, bounded delegates and localized generated application titles.
- Family and Staff capability-scoped navigation, profile actions and sign-out labels now use shared localized shell strings while route and authorization decisions remain unchanged.
- Family production values including student/profile labels, timetable items, results, invoice/receipt references and journey status identifiers use bidi sanitization/isolation.
- Family fees/receipts now format exact integer minor units through `SchoolExactMoneyFormatter`; the existing two-fraction-digit contract is preserved until authoritative currency fraction metadata is added to the server read model.
- Attendance count copy uses the approved integer cardinal plural-category source rules instead of an English-only `(s)` suffix.
- Implementation head `a7e26d9ef4ca906b9d37fee56c1973a3646d962c`: Mobile CI `30558182491` passed formatting, native drift checks, every analyzer/test, both Android debug APK builds and artifact upload. Root CI `30558168912` passed the complete repository gate.
- APK artifact `8765934949`, digest `sha256:6ecb0b70fce4b294e6bd9be4303e24f9bd5f01388369978aa60e85324b91ea2f`.
- Final documentation-head Mobile CI `30558945829`, root CI `30558946767` and artifact `8766235645` passed; staging `30558948161` was skipped.
- Production deployment, database mutation, provider activation and real student data use: none.

## Checkpoint 13 evidence — persisted locale selection and reviewed count sentences

- Family and Staff load presentation locale preferences before production composition from separate secure-storage keys. Stored values are limited to approved language codes and cannot carry account, tenant, campus, persona, capability, student, token, endpoint or other authority data.
- The visible 56 logical-pixel language control cycles device preference, English, Bangla and Arabic and exposes the current and next preference through written semantics.
- Invalid stored language codes are cleared. Read failure follows device preference. Write failure preserves the active locale. Diagnostics expose bounded reason codes only.
- Locale changes update Material localization without recreating the authorized application coordinator or losing page state.
- `SchoolCountStrings` supplies reviewed English, Bangla and Arabic count sentences with localized digits and Arabic cardinal categories. Negative counts are rejected.
- Staff pending-attendance status now uses reviewed singular/plural copy instead of an English `(s)` placeholder.
- Implementation head `d065e6439e32490e6ebe0535664e9dea72437afc`: Mobile CI `30564264280` passed formatting, native drift checks, every analyzer/test, state-preserving locale and semantics tests, both Android debug APK builds and artifact upload. Root CI `30564264098` passed the complete repository gate; staging `30564265365` was skipped.
- APK artifact `8768391851`, digest `sha256:55f3aa8272161317aba8f82e92baf16fa02c3403818c282567a82f81bdc5fbed`.
- Final documentation-head run IDs are recorded in PR #41 after immutable-head gates complete.
- Production deployment, database mutation, provider activation and real student data use: none.

## Checkpoint 14 evidence — reviewed Flutter framework translations

- The approved `en`/`bn`/`ar` localization configuration now uses Flutter 3.44.7 `GlobalMaterialLocalizations.delegate` and `GlobalCupertinoLocalizations.delegate` instead of English-only framework fallbacks while preserving the explicit School locale policy and Arabic RTL direction.
- Widget tests verify Bangla and Arabic load non-default Material/Cupertino localization implementations and preserve the School reading direction.
- Permanent Mobile CI `31141660444` (run #659) passed formatting, every analyzer/test, both Android debug APK builds and artifact upload. Root CI `31141660580` (run #2212) passed the complete repository gate including browser journeys and execution-artifact validation.
- APK artifact `8980142250`, digest `sha256:f2b4ce3223dca0cb194b750b89fd3a11699b9850e8ce7cc5b05800adac330381`.
- Production deployment, database mutation, provider activation and real student data use: none.

## Checkpoint 15 evidence — production lifecycle resume refresh wiring

- `MobileAppCoordinator` implements `WidgetsBindingObserver` and maps resumed, inactive, hidden, paused, detached and memory-pressure signals into the existing privacy lifecycle policy.
- Ready capability/bootstrap state is obscured for background/detach boundaries. Resume restores the persisted OIDC session, refreshes expired tokens through the existing authentication gateway and reloads bootstrap/capability state before returning to ready UI.
- Detached/background boundaries invalidate stale in-flight generation. AppAuth authentication transitions are not cancelled merely because the authorization UI temporarily makes the application inactive. Memory pressure records a privacy decision without deadlocking ready UI.
- Tests cover paused/resumed reload, detached + expired-token refresh, real `WidgetsBinding` propagation, AppAuth inactive continuity and nonblocking memory pressure.
- Permanent Mobile CI `31142212341` (run #664) and root CI `31142212379` (run #2220) passed; both Android debug APKs built and uploaded.
- APK artifact `8980310448`, digest `sha256:518f242187cd9202f25aace0b2256739d4079575157fc43e8867a091cc78a969`.
- Native restricted-document presenter cancellation/transient-byte cleanup still requires presenter-specific Android/iOS integration and device evidence.

## Checkpoint 16 evidence — Family production domain localization

- Family production loading/error/ready status, Home, Attendance, Published Results, Fees/Receipts and Messages now use app-owned reviewed English/Bangla/Arabic copy.
- Existing `SchoolCountStrings` supplies published-result, unread-message and finalized-session sentences; English `(s)` placeholders are no longer used for those completed read journeys.
- Dynamic student, grade, invoice and receipt values remain server-authored and bidi-isolated; routes, capabilities and academic/financial authority are unchanged.
- Permanent Mobile CI `31143470621` (run #674) and root CI `31143470607` (run #2241) passed the complete mobile/root gates, including both APK builds and browser E2E.
- APK artifact `8980736379`, digest `sha256:601cb254e41c8f323dd2e6ddf7f6dbb9e61fdfddb1be76caff9db9ff44378449`.

## Checkpoint 17 evidence — Staff production domain localization

- Staff production shell sync status, Today, assigned-roster failure/selection, attendance draft controls, attendance marks and device sync-journal states now use app-owned reviewed English/Bangla/Arabic copy.
- `StaffProductionCountCopy` remains the count-sentence source for assigned meetings, roster students and attendance operations; English `(s)` sync placeholders are removed from the completed production surfaces.
- Server-authored teacher, subject, section, room, student and operation identifiers remain dynamic and are bidi-isolated in localized rendering. Attendance acceptance/locking and sync reconciliation authority remain server-owned.
- Permanent Mobile CI `31144396458` (run #681) and root CI `31144396055` (run #2258) passed the complete gates, including both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8981081049`, digest `sha256:cb0723c102cefa28c9061c31b2ab2ec44653d0d808c6153de1ec2d59bdd8f003`.

## Checkpoint 18 evidence — Family interaction production localization

- Family Services, Documents/secure-grant presentation, Forms, Guardian Consent, Conversations/Messages and shared interaction-failure states now use app-owned reviewed English/Bangla/Arabic copy.
- Server-owned document classification/cache-policy, form-status and consent-status values retain their authority semantics and receive locale-aware presentation labels only.
- Dynamic student names, document/form/consent titles, filenames, form labels/options, conversation subjects/authors/bodies and reason codes are bidi-sanitized at presentation boundaries; command payload values are unchanged.
- Permanent Mobile CI `31156908030` (run #698) and root CI `31156908056` (run #2292) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8985683665`, digest `sha256:b119791367af917598afc08654cfff3ec01ca7ccccca9e00d1324e24409272fa`.

## Checkpoint 19 evidence — Staff production fixture-data boundary

- Production Staff `/gradebook` and `/messages` no longer render synthetic assessment or conversation rows as current school data.
- `TeacherJourneyRepository` currently exposes authoritative Today/roster reads plus attendance and grade-draft writes, but no authoritative assessment-list read model or teacher-conversation read contract. Those two routes therefore show reviewed localized fail-closed server-boundary states until owning server contracts are activated.
- Focused widget tests assert that known fixture rows such as `Mathematics quiz 3`, `Grade 5A guardians` and `Academic office` never render on the production Gradebook/Messages surfaces.
- Grade-draft write authority, route capability checks, attendance/sync behavior, server contracts and database ownership are unchanged.
- Permanent Mobile CI `31158040008` (run #704) and root CI `31158041226` (run #2298) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8986126640`, digest `sha256:60f253f5b328d4479969aadbb2b0c89cbc33cec4377b17a3ff56276f87f48233`.

## Checkpoint 20 evidence — native screen-capture and app-switcher privacy composition

- Both Android applications set `WindowManager.LayoutParams.FLAG_SECURE` in their sole `MainActivity`, blocking operating-system screenshots/screen recording and protecting recent-task thumbnails at the native window boundary.
- Both iOS `SceneDelegate` implementations add an opaque system-background cover when the scene resigns active and remove it only after the scene becomes active again, preventing inactive/app-switcher snapshots from retaining the Flutter surface.
- The iOS delegates forward `sceneWillResignActive` and `sceneDidBecomeActive` to `FlutterSceneDelegate` so plugin lifecycle propagation remains intact.
- `mobile/tool/verify_native_projects.py` now fails closed if Android `FLAG_SECURE` is removed/cleared, if iOS privacy-cover hooks drift, or if Flutter scene-callback forwarding is dropped.
- Permanent Mobile CI `31160559691` (run #712) and root CI `31160559990` (run #2308) passed the complete gates, including native drift verification, every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8987082482`, digest `sha256:8dd705c63b33f7dccfbf1194cfa52032b007b91866b637cf434f2fd0382e1b5b`.
- This is source/static and Android-build evidence only. Real Android screenshot/recent-task behavior and iOS app-switcher/inactive-cover behavior still require emulator/device verification before release certification.

## Checkpoint 21 evidence — Family explicit UTC fallback and device-timezone boundary

- Family Documents, Forms, Guardian Consent and Conversations/Messages no longer call `DateTime.toLocal()` for server-owned dates or timestamps.
- Current interaction read models provide an authoritative instant but not the authoritative school offset/timezone identifier required for school-local presentation. `FamilyUtcPresentation` therefore converts the instant to UTC, uses locale-aware Material date/time formatting and labels the result explicitly as `UTC`.
- Focused tests verify an offset-bearing source instant is rendered using its UTC day/time, and source-level guards fail if `.toLocal()` returns to the Family interaction screen or UTC presenter.
- The change does not modify server instants, form/consent versions, message payloads, routes, authorization, backend endpoints or database ownership. School-local presentation remains blocked until owning read models provide authoritative timezone metadata.
- Permanent Mobile CI `31164136237` (run #725) and root CI `31164136559` (run #2323) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8988508687`, digest `sha256:813d9cec39c5929c181b18458ae8336c6896a5f5e86076c90c7b892ff3f20f0d`.

## Checkpoint 22 evidence — shared pre-auth/access-gate localization

- `MobileAccessGate` and `MobileConfigurationFailureScreen` now use reviewed English/Bangla/Arabic app-owned copy for application names, bootstrap/access phase titles, sign-in/sign-out actions, configuration failures and safe account-access reasons.
- Access-option tenant and campus names remain server-authored and are bidi-isolated at presentation boundaries; guardian/student/teacher labels are localized presentation-only without changing the underlying `SchoolPersona`.
- Focused widget tests cover Bangla signed-out copy, Arabic RTL configuration failure, localized student persona presentation and preservation of the originally selected tenant/campus/persona authority values. Source guards reject the prior hardcoded access-gate literals.
- OIDC behavior, bootstrap contracts, capability/session selection, tenant/campus/persona authority, backend endpoints and database ownership are unchanged.
- Permanent Mobile CI `31167740324` (run #736) and root CI `31167740383` (run #2336) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8989891963`, digest `sha256:293ecffd569df82f56dbf53047ece7ea26f2c4bc5484da56111e3411392e318c`.

## Checkpoint 23 evidence — Family form date-only localized presentation

- Family form date fields no longer display selected answers as raw ISO `yyyy-MM-dd`; the visible date is formatted with the active Material locale.
- The form answer contract remains exact ISO calendar dates. `FamilyDateOnlyPresentation` strictly parses date-only values and encodes the selected calendar date back to `yyyy-MM-dd` without converting through device or school timezones.
- Focused tests verify Bangla locale rendering, exact ISO encoding, rejection of rollover/timestamp values and source-level guards against `toLocal()`/`toUtc()` in the date-only presenter.
- Form field IDs, schema/base versions, submitted answer semantics, routes, authorization, backend endpoints and database ownership are unchanged.
- Permanent Mobile CI `31169833678` (run #746) and root CI `31169833680` (run #2348) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8990720882`, digest `sha256:f7b9dcee4974a03b3a893349ceffde9a02223fb14783b9916a574ad10b51f833`.

## Server/platform-owned contract boundary

The following proposed endpoints remain unimplemented and inactive in MOB-01:

- `/v1/mobile/bootstrap`
- `/v1/mobile/device-sessions`
- `/v1/mobile/family/**`, including the proposed document-grant exchange route
- `/v1/mobile/teacher/**`
- future `/v1/mobile/sync` delta and operation endpoints

MOB-01 may define and test clients, domain contracts and fail-closed UI. Owning server/platform modules must review and implement authorization, audit, notification issuance, provider project configuration, exchange response headers/integrity policy, native viewer/presenter integration, data minimization and persistence.

## Exact next action

Complete any remaining untranslated domain surfaces outside the completed pre-auth/access-gate, Family read/interaction and Staff teacher/sync/server-boundary journeys. Through the server/platform ownership process, add authoritative Staff assessment-list and teacher-conversation read models before Gradebook/Messages become data-bearing production screens. Extend exact money to authoritative currency fraction metadata and replace the explicit UTC interaction fallback with school-local explicit-offset timestamp presentation where server read models supply authoritative offset/timezone fields. Verify the implemented Android `FLAG_SECURE` and iOS inactive/app-switcher privacy-cover behavior on representative devices, and complete presenter-specific restricted-presentation cancellation, transient-byte purge and fresh-proof integration on top of the wired Flutter lifecycle coordinator. Complete device-level TalkBack, VoiceOver, Dynamic Type, switch-control, contrast, reduced-motion, secure-storage and representative RTL journeys. Add Android/iOS integration tests for backgrounding, interruption, process death, low storage, notification launches, encrypted sync recovery and restricted-document cleanup. Separately obtain server/platform-owner review for Bootstrap, Family, Teacher, device-session, notification, sync and secure-document exchange activation, approved Firebase/APNs configuration and Android/iOS native document presenters. Produce signed release artifacts, privacy declarations, provenance and rollback evidence before any live account or student data is used.
