# School Mobile Applications

This workspace contains the native Flutter clients for the International School Management Platform.

## Applications

- `apps/family_app`: guardian and student personas in one capability-aware family application.
- `apps/staff_app`: teacher-first operational application for timetable, attendance, gradebook and communication.

## Shared packages

- `packages/mobile_core`: tenant, campus, persona, capability, sync and fail-closed platform-lifecycle contracts.
- `packages/design_system`: Flutter implementation of the approved `DESIGN.md` operational design language, shared localization runtime, secure locale preference, localized count copy, exact locale-aware presentation helpers, cardinal plural rules and accessibility source gates.
- `packages/api_client`: authenticated, tenant-scoped HTTP client for versioned Cloudflare Worker APIs.
- `packages/authentication`: OIDC/PKCE, secure session lifecycle and transient step-up proof.
- `packages/sync_engine`, `packages/sync_storage` and `packages/teacher_sync`: scoped durable offline operations, encrypted persistence and Teacher reconciliation.
- `packages/native_notifications`: inactive-by-default privacy-minimised FCM/APNs boundary.
- `packages/secure_documents`: short-lived grant exchange, bounded integrity-verified streaming and no-store temporary lifecycle.

The mobile clients never connect directly to Neon PostgreSQL and never reproduce authoritative domain rules. They consume versioned APIs, commands and read models owned by the existing platform modules.

## Security and release boundary

- Android backup and cleartext transport are disabled for both applications.
- iOS arbitrary transport loads, file sharing and open-in-place document access are disabled.
- OIDC/provider credentials, notification-provider activation, server authorization, authoritative audit issuance and platform-specific restricted-document presentation remain outside this branch.
- No production deployment, database mutation, provider activation or real student data is authorized by this workspace.

Security and release evidence:

- `docs/mobile/restricted-data-threat-model.md`
- `docs/mobile/accessibility-localization-release-evidence.md`
- `docs/mobile/secure-document-exchange-contract.md`
- `docs/mobile/native-notification-provider-activation.md`

## Localization and accessibility production tranche

The shared runtime and production applications now provide:

- English, Bangla and Arabic shell labels with deterministic English fallback and ordered device-locale resolution;
- explicit Arabic RTL and English/Bangla LTR direction through bounded Widgets localization;
- bounded Material/Cupertino fallbacks that keep framework control labels English instead of failing on Bangla or Arabic;
- a presentation-only locale controller that accepts approved locales only and never changes account, tenant, campus, persona, capability, student or server authority;
- application-separated secure locale preferences containing only `en`, `bn`, `ar`, or no stored override;
- invalid/read/write preference recovery with redacted reason codes and no stored authority values;
- a 56 logical-pixel language control that cycles device preference, English, Bangla and Arabic while preserving the authorized application and page state;
- integer cardinal plural categories and reviewed localized count sentences for English, Bangla and Arabic;
- Family and Staff production app titles, navigation, profile actions and sign-out labels wired to the shared runtime;
- Staff pending-attendance status using a reviewed plural sentence instead of an English `(s)` placeholder;
- bidirectional-control sanitization and first-strong isolation for identifiers and user-controlled text, including Family production student, timetable, result and invoice/receipt values;
- exact integer minor-unit money presentation in the Family fees/receipts journey with English, Bangla and Arabic digits/separators and no floating-point financial conversion;
- explicit-offset timestamp presentation helpers from authoritative UTC instants and server-provided timezone identifiers without device-timezone inference;
- adaptive navigation and written status at 200% text scaling;
- written semantics that do not depend on color alone;
- minimum 48 logical-pixel interactive controls;
- presentation-only bold-text, high-contrast and reduced-motion preferences.

The mobile-core lifecycle policy separately verifies fail-closed decisions for backgrounding, process detachment, stale/fresh authorization, memory pressure, restricted-content obscuring, presentation cancellation and transient-byte purge. Android/iOS hosts still need approved wiring and device integration evidence.

This is not complete domain translation or device certification. Reviewed global Material/Cupertino translations, broader translated and pluralized domain copy, authoritative currency fraction metadata, production timestamp adoption, TalkBack/VoiceOver passes, secure-storage lifecycle tests, Android/iOS integration tests and signed store-release evidence remain required.

## Toolchain

- Flutter stable 3.44.x
- Dart 3.10 or newer
- Riverpod 3
- go_router 17

## Local verification

```bash
cd mobile
flutter pub get
dart format .
git diff --exit-code
python3 tool/verify_native_projects.py
flutter analyze apps/family_app
flutter analyze apps/staff_app
flutter analyze packages/design_system
dart analyze packages/mobile_core
dart analyze packages/api_client
flutter test apps/family_app
flutter test apps/staff_app
flutter test packages/design_system
dart test packages/mobile_core
```

The permanent GitHub Actions gate also analyzes and tests authentication, bootstrap, Family/Staff domains, sync, storage, notifications and secure documents, then builds both Android debug APKs and uploads the artifacts with repository permissions restricted to `contents: read`.

## Firebase development distribution

Android development builds use the dedicated Firebase project `school-management-mobile-dev`; the MFS Firebase project is not shared. The registered Android applications are `com.ozzyl.school.family` and `com.ozzyl.school.staff`, and development releases are distributed to the `owner-testers` Firebase App Distribution group.

The server-side delivery command is:

```bash
mobile/tool/distribute_android_dev.sh
```

The script prefers the ignored repo-local Flutter toolchain at `.tooling/flutter/bin/flutter` and otherwise accepts `FLUTTER_BIN`. It generates a unique Android build number, builds both debug APKs, and uploads both releases to Firebase App Distribution with commit/build release notes. A compatible authenticated Firebase CLI session is required.

Optional live-runtime compile-time values can be supplied through `SCHOOL_API_BASE_URL`, `SCHOOL_OIDC_ISSUER`, `SCHOOL_OIDC_CLIENT_ID`, `SCHOOL_OIDC_SCOPES`, `SCHOOL_OIDC_POST_LOGOUT_REDIRECT_URI`, `SCHOOL_FAMILY_OIDC_REDIRECT_URI`, and `SCHOOL_STAFF_OIDC_REDIRECT_URI`. These values are not invented by the mobile delivery script: when the reviewed OIDC/platform runtime is inactive, the production applications continue to fail closed rather than bypass authentication.

Firebase App Distribution is a development/test delivery channel only. It does not authorize production notification-provider activation, production identity changes, database mutation, or store release.

## Delivery sequence

1. Workspace, shared contracts and adaptive application shells.
2. OIDC/PKCE authentication, tenant selection, persona selection and mobile bootstrap.
3. Guardian and student read journeys.
4. Teacher timetable and offline attendance.
5. Gradebook drafts, communication, documents and push notifications.
6. Durable sync, conflict reconciliation and secure-document exchange.
7. Restricted-data threat modelling, accessibility/localization runtime, production shell composition, persisted locale preference, platform-lifecycle policy and native security guards.
8. Remaining complete domain translation, platform-owner activation, device integration, screen-reader certification and signed store release.
