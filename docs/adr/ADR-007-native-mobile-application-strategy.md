# ADR-007 — Native Mobile Application Strategy

- **Status:** Proposed for architecture review
- **Date:** 2026-07-29
- **Decision owners:** Product, platform architecture, security and experience leads
- **Depends on:** ADR-001, ADR-002, ADR-003, ADR-004, ADR-006; reviewed Wave 2 integration; reviewed EXP-01 contracts before feature activation

## Context

The platform already defines teacher, guardian and student journeys, low-bandwidth behavior, offline-safe attendance, capability-aware navigation, push-capable notifications and native mobile applications as a planned maturity capability. `PRODUCT.md` still describes the platform as web-only, while the architecture and requirements describe family, student and staff mobile applications. This mismatch must be resolved before implementation agents create incompatible clients.

The mobile clients will handle child, academic, financial and selected health-related context. They must preserve the existing platform invariants:

- the server is the authority for authorization and domain rules;
- clients consume versioned commands, queries and bounded read models;
- clients never read Neon or module-owned tables directly;
- tenant, campus, relationship, persona, purpose and assurance context remain explicit;
- financial, published academic and finalized attendance history is amended or reversed, not overwritten;
- retries are idempotent and offline conflicts are reconciled explicitly;
- sensitive data is minimized, encrypted and removable from a lost or revoked device.

## Decision

### Application portfolio

Use **one Flutter workspace and shared package graph**, producing two separately distributed applications:

1. **School Family** — guardian and student personas.
2. **School Staff** — teacher-first and later explicitly approved staff personas.

Administration, finance, admissions, HR, procurement, safeguarding case management and dense operational reporting remain web/PWA-first unless a separate mobile workflow is approved.

Guardian and student are combined because they share household/student publication read models, communication, documents and low-complexity self-service. Teacher/staff is separated because it has different device trust, offline roster, attendance, notification, support and incident-response requirements.

### Codebase model

- One repository-local Dart Pub Workspace.
- Separate app shells and bundle identifiers for Family and Staff.
- Shared packages for design tokens, localization, authentication, authorization context, generated API clients, local storage, synchronization, notifications, observability and test fixtures.
- Feature packages are included only in the app shells that need them.
- Environment flavors are `development`, `staging` and `production`; roles are not flavors.

### Client architecture

Adopt Flutter's recommended layered architecture:

- UI layer: views and view models/controllers;
- data layer: repositories and local/remote services;
- optional use-case/domain layer only for complex client orchestration;
- dependency injection at composition roots;
- repositories as the single source of truth for local and remote data;
- generated, versioned API DTOs separated from UI models;
- capability-driven navigation using server-provided context.

Client code may enforce usability constraints but must not reproduce server authorization, accounting, grading or enrollment policy.

### Integration boundary

The mobile apps consume a mobile-facing API composition layer over existing module contracts. The composition layer may aggregate bounded read models but may not join private module tables or become a second source of truth.

Required platform contracts include:

- session, membership, persona and device context;
- capability and assurance requirements;
- mobile bootstrap and incremental synchronization cursors;
- idempotent command submission with optimistic concurrency metadata;
- device registration, push token lifecycle and remote revocation;
- signed, short-lived document retrieval;
- stable localized error codes and reconciliation outcomes;
- version/deprecation policy and generated OpenAPI client artifacts.

### Offline policy

Offline access is allowlist-based, not a general cache of every successful response.

Allowed initial offline workflows:

- staff: assigned timetable, class roster, attendance session, attendance drafts and tightly minimized emergency indicators;
- family/student: recent timetable, published attendance, published results, recent announcements, draft forms and previously authorized documents where policy permits.

Online-only initial workflows include payment execution, grade publication, finalized attendance correction, privileged approvals, broad financial administration and highly restricted health/safeguarding narratives.

Offline writes use an encrypted local outbox containing tenant, actor, persona, device, idempotency key, aggregate/version precondition, command type, minimized encrypted payload and retry state. Generic last-write-wins is prohibited for school records.

### Identity and device security

- OAuth/OIDC Authorization Code with PKCE through the system browser or platform browser tab.
- No embedded WebView login and no confidential client secret in the application binary.
- Short-lived access tokens and revocable rotating refresh/session credentials.
- Secrets and device-bound material stored through Keychain/Keystore-backed storage.
- Device/session inventory, remote revocation, local cache wipe and re-authentication/step-up support.
- Sensitive notification payloads contain opaque identifiers only; content is fetched after authorization.
- Sensitive local databases are excluded from backups or protected by an approved restore design.
- Logs, analytics, traces and crash reports use allowlisted metadata and never contain student names, message bodies, credentials, health narratives or raw payment details.

### Design and accessibility

`DESIGN.md` remains the visual authority. Mobile maps its semantic colors, typography intent, spacing, status vocabulary and evidence rules into Flutter theme extensions and components. Mobile layouts adapt to available window size rather than device labels or orientation assumptions. Touch, keyboard, screen reader, text scaling, RTL, long content, reduced motion, foldable and multi-window behavior are release requirements.

### Delivery and activation

Documentation and platform-enabling work may proceed in parallel with EXP-01. Domain-integrated mobile feature implementation is gated by reviewed Wave 3 contracts.

Permitted before the activation gate:

- Flutter workspace and CI bootstrap;
- design-token mapping and component foundations;
- authentication/device-session proof using synthetic identity fixtures;
- generated API client pipeline against reviewed or provisional schemas;
- encrypted local storage and generic sync engine;
- fake repositories, fixtures, accessibility harness and release automation.

Not permitted before the activation gate:

- coupling to database schemas;
- inventing unreviewed domain endpoints;
- copying web component business logic into Flutter;
- shipping production mobile clients;
- storing real student data in development or test environments.

`MOB-01` becomes executable only after the coordinator records:

- `GATE-WAVE-3-INTEGRATED` or an explicitly reviewed mobile-contract gate;
- exact reviewed API/read-model schema versions;
- approved mobile threat model and local-data allowlist;
- approved app-store identity, privacy declarations and release ownership;
- exact Git base SHA and compatible backend environment.

## Alternatives considered

### One universal app for every role

Rejected. It creates excessive navigation and permission complexity, increases sensitive-code/data exposure on family devices and couples unrelated release cadences.

### Three independent apps and codebases

Rejected. It duplicates authentication, design, localization, sync, API and release infrastructure and increases contract drift.

### Wait until the web product is completely finished

Rejected. Architecture, security, CI and shared foundations can proceed safely in parallel. Waiting would delay discovery of mobile-specific API, offline and device constraints.

### Build directly from database tables after web completion

Rejected. It violates module ownership, authorization and versioned API contracts and would make schema evolution unsafe.

### Flutter web replacing the existing React web applications

Rejected. The native initiative is a client extension, not a rewrite of the established web experience.

## Consequences

### Positive

- Shared engineering investment without combining incompatible user experiences.
- Stable backend ownership and one source of business truth.
- Early discovery of offline, auth, notification and accessibility constraints.
- Independent store release and security policy for family and staff applications.
- Clear multi-agent ownership and integration gates.

### Costs and risks

- Two app-store products and release tracks.
- A shared workspace requires disciplined package boundaries and dependency governance.
- Offline functionality adds conflict, encryption, migration and support complexity.
- Mobile API composition must remain bounded and cannot become a shadow backend.
- Platform and store privacy requirements must be maintained for each target country and age group.

## Verification

This decision is accepted only when the documentation validator and human review confirm:

- no conflict with active EXP-01 ownership;
- every mobile workflow maps to a server-owned contract;
- local data is explicitly classified and allowlisted;
- negative authorization, duplicate replay and device-revocation tests are specified;
- release gates include mobile security, accessibility, localization and store compliance;
- implementation agents have exact branches, owned paths, base SHAs and hard stops.

## Research basis

- Flutter architecture recommendations: https://docs.flutter.dev/app-architecture/recommendations
- Flutter architecture guide: https://docs.flutter.dev/app-architecture/guide
- Flutter offline-first pattern: https://docs.flutter.dev/app-architecture/design-patterns/offline-first
- Flutter adaptive design guidance: https://docs.flutter.dev/ui/adaptive-responsive/best-practices
- Flutter testing guidance: https://docs.flutter.dev/testing/overview
- Dart Pub Workspaces: https://dart.dev/tools/pub/workspaces
- OAuth 2.0 for Native Apps, RFC 8252: https://datatracker.ietf.org/doc/html/rfc8252
- OWASP MASVS: https://mas.owasp.org/MASVS/
- Firebase Cloud Messaging for Flutter: https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages
