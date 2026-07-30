# School Mobile Applications

This workspace contains the native Flutter clients for the International School Management Platform.

## Applications

- `apps/family_app`: guardian and student personas in one capability-aware family application.
- `apps/staff_app`: teacher-first operational application for timetable, attendance, gradebook and communication.

## Shared packages

- `packages/mobile_core`: tenant, campus, persona, capability, sync and fail-closed platform-lifecycle contracts.
- `packages/design_system`: Flutter implementation of the approved `DESIGN.md` operational design language, shared localization runtime, exact locale-aware presentation helpers and accessibility source gates.
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

## Localization and accessibility source gate

The shared source runtime currently verifies:

- English, Bangla and Arabic shell labels with deterministic English fallback and ordered device-locale resolution;
- explicit Arabic RTL and English/Bangla LTR direction through bounded Widgets localization;
- source-tranche Material/Cupertino fallbacks that keep framework control labels English instead of failing on Bangla or Arabic;
- bidirectional-control sanitization and first-strong isolation for identifiers and user-controlled text;
- exact integer minor-unit money presentation with English, Bangla and Arabic digits/separators and no floating-point financial conversion;
- explicit-offset timestamp presentation from authoritative UTC instants and server-provided timezone identifiers without device-timezone inference;
- adaptive navigation and written status at 200% text scaling;
- written semantics that do not depend on color alone;
- minimum 48 logical-pixel interactive controls;
- presentation-only bold-text, high-contrast and reduced-motion preferences.

The mobile-core lifecycle policy separately verifies fail-closed decisions for backgrounding, process detachment, stale/fresh authorization, memory pressure, restricted-content obscuring, presentation cancellation and transient-byte purge. Android/iOS hosts still need approved wiring and device integration evidence.

This is not full production localization or device certification. Production composition adoption, reviewed global Material/Cupertino translations, complete domain copy and plurals, TalkBack/VoiceOver passes, Android/iOS integration tests and signed store-release evidence remain required.

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

## Delivery sequence

1. Workspace, shared contracts and adaptive application shells.
2. OIDC/PKCE authentication, tenant selection, persona selection and mobile bootstrap.
3. Guardian and student read journeys.
4. Teacher timetable and offline attendance.
5. Gradebook drafts, communication, documents and push notifications.
6. Durable sync, conflict reconciliation and secure-document exchange.
7. Restricted-data threat modelling, accessibility/localization source gates, platform-lifecycle policy and native security guards.
8. Remaining production localization composition, platform-owner activation, device integration, screen-reader certification and signed store release.
