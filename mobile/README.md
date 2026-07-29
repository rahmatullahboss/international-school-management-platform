# School Mobile Applications

This workspace contains the native Flutter clients for the International School Management Platform.

## Applications

- `apps/family_app`: guardian and student personas in one capability-aware family application.
- `apps/staff_app`: teacher-first operational application for timetable, attendance, gradebook and communication.

## Shared packages

- `packages/mobile_core`: tenant, campus, persona, capability and sync contracts.
- `packages/design_system`: Flutter implementation of the approved `DESIGN.md` operational design language.
- `packages/api_client`: authenticated, tenant-scoped HTTP client for versioned Cloudflare Worker APIs.

The mobile clients never connect directly to Neon PostgreSQL and never reproduce authoritative domain rules. They consume versioned APIs, commands and read models owned by the existing platform modules.

## Toolchain

- Flutter stable 3.44.x
- Dart 3.10 or newer
- Riverpod 3
- go_router 17

## Local verification

```bash
cd mobile
flutter pub get
dart format --output=none --set-exit-if-changed .
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

## Delivery sequence

1. Workspace, shared contracts and adaptive application shells.
2. OIDC/PKCE authentication, tenant selection, persona selection and mobile bootstrap.
3. Guardian and student read journeys.
4. Teacher timetable and offline attendance.
5. Gradebook drafts, communication, documents and push notifications.
6. Durable sync, conflict reconciliation, security hardening and store release evidence.

Production deployment, real student data and production credentials remain outside this branch.
