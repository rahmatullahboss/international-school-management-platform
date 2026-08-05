# ADR-007 — Flutter Mobile Product Strategy

- **Status:** Proposed
- **Date:** 2026-07-29
- **Decision owners:** Product owner, platform architecture owner, mobile program coordinator
- **Related:** `PRODUCT.md`, `DESIGN.md`, `docs/mobile/`, ADR-001, ADR-002, ADR-005 and ADR-006

## Context

The platform already defines teacher, guardian and student journeys across responsive web/PWA surfaces. Native mobile adds value for device-integrated, low-bandwidth and time-sensitive work: notifications, offline attendance, camera/document capture, quick timetable access and family communication.

A native program can fail if it becomes a second product with copied domain rules, direct database access, incompatible authorization or uncontrolled local caching. A single universal app can also mix staff and family security, navigation, release and device-management concerns. Separate independent codebases would duplicate architecture and raise maintenance cost.

The platform is still completing EXP-01 persona experiences. Mobile work therefore needs a staged parallel model that discovers native risks early without depending on unstable feature contracts.

## Decision

1. Use **Flutter** for Android and iOS native applications.
2. Maintain **one Dart Pub Workspace** and one governed shared mobile foundation.
3. Produce **two installable applications**:
   - **School Family** for guardian and student personas;
   - **School Staff** for teacher-first and later explicitly approved staff personas.
4. Keep administration, finance, admissions, HR, operations, support and broad reporting **web/PWA first**.
5. Treat persona as runtime, capability-aware session context. Do not encode roles as build flavours.
6. Use platform application APIs and generated OpenAPI clients. **No direct Neon/database access** and no duplicated authoritative domain logic in Dart.
7. Use View/ViewModel, Repository/Service and optional use-case layers with inward dependency direction and adapter-wrapped plugins.
8. Make offline support feature-specific. The server remains authoritative; attendance is the first required queued-write workflow.
9. Use OAuth 2.0/OIDC Authorization Code with PKCE through the external/system browser.
10. Apply OWASP MASVS/MASTG, platform privacy controls, encrypted local storage and minimal push payloads.
11. Allow mobile documentation and shared foundation work to proceed while EXP-01 continues, using reviewed identity contracts and synthetic feature contracts.
12. Start final Family/Staff feature work only when their exact persona/API contract families are reviewed.
13. Freeze shared mobile foundation paths before Family and Staff streams run in parallel; integrate them serially.

## Repository and ownership consequences

Proposed shape:

```text
mobile/
  apps/family_app
  apps/staff_app
  packages/core_*
  packages/design_system
  packages/family_*
  packages/staff_*
```

- `MOB-01` owns workspace/shared foundation.
- `MOB-02` owns Family app and Family feature packages.
- `MOB-03` owns Staff app and Staff feature packages.
- `MOB-INTEG` owns serial integration and release evidence.

Shared package changes after foundation freeze require a contract-change request.

## Parallelism consequence

Mobile does not wait for a final database. It waits for stable application contracts.

Safe early work includes workspace/CI, design system, authentication, generated-client pipeline, encrypted storage, sync state machine, push/deep-link adapters, simulators and tests.

Feature implementation waits for reviewed session/persona, relationship, assignment, publication, notification, document and conflict contracts. Release waits for reviewed platform/mobile integration evidence.

## Alternatives considered

### One universal native app for all roles

Rejected as the initial product because it mixes family/staff security and release policies, increases navigation complexity and encourages admin ERP scope creep. The shared workspace already provides code reuse without one binary.

### Three independent apps for guardian, student and teacher

Rejected because guardian and student share family context and many read journeys; separate codebases/binaries increase maintenance and store overhead. Student presentation remains separate within the Family app.

### Responsive PWA only

Retained as an important channel but insufficient for the full target: robust offline attendance, push/device lifecycle, camera/scan workflows and app-store distribution benefit from native integration.

### Separate native iOS and Android codebases

Rejected for the initial team because it doubles implementation and contract maintenance. It may be revisited only if measured platform-specific constraints cannot be satisfied through Flutter and adapter code.

### Mobile after the entire web product is finished

Rejected because it postpones high-risk validation of auth redirects, offline sync, device security, low-cost performance and store operations. Staged contract-driven concurrency provides earlier evidence without duplicating business logic.

## Consequences

### Positive

- one shared architecture and dependency set;
- separate family/staff security and release policies;
- earlier validation of native/offline risks;
- parallel work after stable boundaries;
- generated contract compatibility;
- replaceable plugins/providers;
- controlled local data and privacy.

### Negative

- shared foundation requires strong ownership and freeze discipline;
- two app-store products require separate metadata, signing and support;
- contract-first work adds initial documentation/testing effort;
- offline synchronization remains complex and cannot be generic;
- platform APIs must maintain compatibility with supported app versions.

## Compliance and security impact

Native apps increase disclosure risk through device storage, screenshots, push providers, backups, third-party SDKs and lost devices. The mobile program must maintain a data allowlist, secure credentials, device/session revocation, privacy SDK register, MASVS evidence and incident runbooks.

No advertising, unrelated tracking or AI training on school data is introduced.

## Validation

This decision is validated by:

- empty Family/Staff shells built from one workspace;
- architecture-boundary tests;
- OAuth/PKCE and persona-switch tests;
- generated-client compatibility tests;
- encrypted local database and migration tests;
- offline attendance duplicate/conflict tests;
- low-cost Android and representative iOS performance evidence;
- accessibility/localization evidence;
- mobile security and store-readiness review.

## Revisit triggers

Revisit when a persona needs materially incompatible distribution/security policy, shared bundle/performance targets cannot be met, Flutter cannot satisfy a required platform capability, a dedicated mobile BFF becomes justified by measured API composition cost, or enterprise managed-device/white-label requirements create a new deployment profile.
