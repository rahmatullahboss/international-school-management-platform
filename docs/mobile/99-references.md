# 99 — Mobile Research References

**Research reviewed:** 2026-07-29  
**Policy:** prefer official standards, platform documentation and primary project documentation. Package versions are selected and locked during the foundation spike after licence, maintenance, privacy and compatibility review.

## Flutter and Dart

- Flutter, **Guide to app architecture** — UI/data layers, Views, ViewModels, Repositories, Services and optional domain/use-case layer: https://docs.flutter.dev/app-architecture/guide
- Flutter, **Architecture recommendations**: https://docs.flutter.dev/app-architecture/recommendations
- Flutter, **Offline-first support** — repositories coordinate local/remote sources and feature-specific read/write/sync choices: https://docs.flutter.dev/app-architecture/design-patterns/offline-first
- Flutter, **Best practices for adaptive design**: https://docs.flutter.dev/ui/adaptive-responsive/best-practices
- Flutter, **Internationalizing Flutter apps**: https://docs.flutter.dev/ui/internationalization
- Flutter, **Accessibility**: https://docs.flutter.dev/ui/accessibility-and-internationalization/accessibility
- Flutter, **Testing Flutter apps** — unit, widget and integration testing guidance: https://docs.flutter.dev/testing/overview
- Flutter, **Creating flavours for Flutter**: https://docs.flutter.dev/deployment/flavors
- Dart, **Pub workspaces (monorepo support)** — one shared package resolution for a workspace: https://dart.dev/tools/pub/workspaces

## Identity and protocol security

- IETF BCP 212 / RFC 8252, **OAuth 2.0 for Native Apps** — external user agent and PKCE for public native clients: https://datatracker.ietf.org/doc/rfc8252/
- IETF RFC 7636, **Proof Key for Code Exchange by OAuth Public Clients**: https://datatracker.ietf.org/doc/rfc7636/
- OpenID Foundation, **OpenID Connect Core 1.0**: https://openid.net/specs/openid-connect-core-1_0.html

## Mobile application security

- OWASP, **Mobile Application Security Verification Standard (MASVS)**: https://mas.owasp.org/MASVS/
- OWASP, **Mobile Application Security Testing Guide (MASTG)**: https://mas.owasp.org/MASTG/
- OWASP, **MASVS authentication controls**: https://mas.owasp.org/MASVS/07-MASVS-AUTH/
- OWASP, **MASVS privacy controls/checklist**: https://mas.owasp.org/checklists/MASVS-PRIVACY/
- OWASP, **Application Security Verification Standard (ASVS)** for server/API controls: https://owasp.org/www-project-application-security-verification-standard/

## Background work and notifications

- Android Developers, **WorkManager** — recommended Android library for persistent scheduled work subject to OS constraints: https://developer.android.com/reference/androidx/work/WorkManager.html
- Apple Developer, **Background Tasks**: https://developer.apple.com/documentation/backgroundtasks
- Firebase, **Receive messages in Flutter apps** — foreground/background/terminated handling and notification interaction: https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages
- Firebase, **Get started with FCM in Flutter apps**: https://firebase.google.com/docs/cloud-messaging/flutter/get-started

## API and interoperability

- OpenAPI Initiative, **OpenAPI Specification**: https://spec.openapis.org/oas/latest.html
- OpenAPI Generator, **Dart generators**: https://openapi-generator.tech/docs/generators/

## Platform privacy and release references

- Android Developers, **Data and file storage overview**: https://developer.android.com/training/data-storage
- Android Developers, **App data and files backup**: https://developer.android.com/identity/data/autobackup
- Apple Developer, **Keychain Services**: https://developer.apple.com/documentation/security/keychain_services
- Apple Developer, **Protecting the user's privacy**: https://developer.apple.com/documentation/uikit/protecting-the-user-s-privacy
- Google Play, **User Data policy**: https://support.google.com/googleplay/android-developer/answer/10144311
- Apple, **App privacy details**: https://developer.apple.com/app-store/app-privacy-details/

## Repository authorities used

- `PRODUCT.md`
- `DESIGN.md`
- `docs/03-product-requirements-and-feature-catalog.md`
- `docs/04-architecture-options-and-decision.md`
- `docs/05-system-architecture.md`
- `docs/07-internationalization-compliance-security.md`
- `docs/09-delivery-roadmap.md`
- `docs/10-testing-operations-and-slo.md`
- `docs/11-risks-decisions-and-guardrails.md`
- `docs/execution/02-module-stream-full-prompts.md`
- `docs/execution/03-agent-board.json`
- `docs/execution/04-progress-tracker.md`
- `docs/execution/05-module-ownership-and-integration-contracts.md`

## Research interpretation

The references define principles, not a licence to copy example applications blindly. The foundation stream records exact Flutter/Dart/plugin versions, licences, checksums and approved deviations at implementation time. Architecture decisions remain adapter-backed so that a package or provider can be replaced without changing product/domain contracts.
