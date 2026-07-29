# 02 — Flutter System Architecture

## 1. Architecture goals

The Flutter workspace must remain understandable to multiple agents, independently testable and insulated from backend implementation details. It follows a feature-first, layered architecture and uses one dependency graph for the Family and Staff applications.

## 2. Repository shape

The preferred location is inside the existing repository so API schemas, design tokens, documentation and integration tests remain traceable to one Git SHA.

```text
mobile/
├── pubspec.yaml
├── analysis_options.yaml
├── apps/
│   ├── family_app/
│   │   ├── lib/
│   │   ├── android/
│   │   └── ios/
│   └── staff_app/
│       ├── lib/
│       ├── android/
│       └── ios/
├── packages/
│   ├── app_core/
│   ├── app_bootstrap/
│   ├── design_system/
│   ├── localization/
│   ├── authentication/
│   ├── session_context/
│   ├── authorization_context/
│   ├── api_client/
│   ├── local_store/
│   ├── sync_engine/
│   ├── notifications/
│   ├── documents/
│   ├── observability/
│   ├── testing_support/
│   └── feature_*/
├── integration_test/
└── tool/
```

Use Dart Pub Workspaces with one committed application lockfile. Workspace packages are private unless a separate publication decision is approved.

## 3. Application composition

Each app shell owns only:

- bundle/application identifiers and platform configuration;
- environment bootstrap;
- dependency composition root;
- app-specific navigation graph;
- app-specific notification categories and privacy declarations;
- app-store assets and release metadata.

Shared packages must not inspect the running app name to decide authorization. App-shell inclusion and server capabilities determine available features.

## 4. Layering

### UI layer

- screens/views render immutable view state;
- view models/controllers translate user intent into repository/use-case calls;
- UI state includes loading, refreshing, stale, offline, syncing, partial success, conflict, unauthorized, masked and fatal states;
- widgets contain presentation behavior, not domain policy;
- navigation guards use session/capability state but the server re-authorizes every request.

### Data layer

- repositories are the single source of truth presented to the UI;
- remote services use generated API clients;
- local services own encrypted database/cache access;
- repositories merge local and remote state, apply freshness policy and expose synchronization outcomes;
- DTOs generated from OpenAPI do not leak directly into UI packages.

### Optional application/use-case layer

Use a use-case class only when a workflow coordinates several repositories or contains reusable client orchestration, such as persona switching, attendance batch submission or secure logout. Avoid a mandatory use-case wrapper around every repository method.

### No client domain duplication

The Flutter code must not calculate authoritative fees, ledger balances, grade publication, enrollment eligibility, attendance finalization or sensitive authorization. It may calculate display-only summaries when the server contract provides the source values and definition.

## 5. Dependency rules

Allowed dependency direction:

```text
app shell
  → feature UI/application
    → abstract repositories
      ← repository implementations
        → API/local/device services
```

Rules:

- feature packages cannot import another feature's private implementation;
- cross-feature navigation uses typed route contracts;
- shared core packages cannot depend on feature packages;
- generated API code is isolated behind repository interfaces;
- platform channels are isolated behind typed adapters;
- no global mutable service locator;
- dependency injection occurs at app and feature composition roots;
- circular package dependencies fail CI.

## 6. State management

The implementation stream must choose one repository-wide state-management and dependency-injection approach and record the exact decision before feature development. The selected approach must support:

- compile-time-safe dependencies;
- scoped overrides/fakes in tests;
- cancellation and disposal on tenant/persona change;
- observable async/loading/error state;
- minimal widget rebuilds;
- no hidden global mutable state.

Riverpod is the leading candidate, but package selection and version are approved at MOB-01 bootstrap after compatibility and maintenance review. The architecture is not coupled to Riverpod-specific types outside composition/UI packages.

## 7. Navigation

Use typed routes with `go_router` unless an approved spike proves a required flow cannot be expressed safely.

Navigation requirements:

- nested shells for main destinations;
- authenticated deep links;
- tenant/persona/child/class scope encoded with opaque identifiers only;
- redirect/rejection after capability or assurance changes;
- restoration of safe navigation state;
- no sensitive content in URLs;
- unknown/expired/denied links reveal no restricted record existence;
- app updates preserve supported deep-link versions.

## 8. API models and mapping

Maintain three model categories:

1. generated transport DTOs;
2. repository/application models;
3. presentation/view models.

Mapping is explicit and tested. Generated files are never edited manually. API generation records schema version, generator version and source commit.

## 9. Environment and flavors

Applications have `development`, `staging` and `production` build environments.

Environment configuration may select:

- API origin and mobile client identifier;
- logging/telemetry destination;
- push project/application identity;
- feature-preview policy;
- app name/icon suffix;
- certificate/attestation policy.

It must not contain server secrets, tenant secrets or a privileged bypass. Production configuration is reviewed and signed through CI.

## 10. Platform adapters

Adapters isolate:

- secure storage and device-bound keys;
- biometrics/local app unlock;
- network connectivity hints;
- background task scheduling;
- push notifications;
- camera/document picker;
- QR scanning;
- share/open/download behavior;
- screenshots/app-switcher privacy controls;
- device integrity/attestation where justified;
- accessibility and platform-specific settings.

Every adapter has a fake for unit/widget tests and contract tests on Android/iOS.

## 11. Design-system package

The design-system package maps `DESIGN.md` into:

- semantic color and typography theme extensions;
- spacing, radius, border and focus tokens;
- buttons, fields, status surfaces, banners, list/record rows and task containers;
- navigation components for compact and expanded layouts;
- standard loading, empty, offline, denied, masked, conflict and retry states;
- semantics helpers and text-scaling-safe layouts.

Feature packages must not hard-code colors, typography or ad-hoc status semantics.

## 12. Local persistence boundaries

Separate logical stores/namespaces for:

- unauthenticated bootstrap/public-safe configuration;
- each tenant + account + persona security context;
- Family and Staff application data;
- encrypted pending command outbox;
- downloaded document metadata/content according to policy.

Switching tenant/persona closes the active store before the new context opens. Schema migrations are versioned, forward-tested and recoverable without sending stale commands under a new context.

## 13. Performance budgets

Initial engineering budgets, to be measured and revised:

- application start produces a usable authenticated shell without waiting for all modules;
- no unbounded list or eager full-history synchronization;
- first bootstrap payload is bounded and persona-specific;
- large documents/media are lazy and cancellable;
- background work is short, resumable and battery-aware;
- rebuild and frame performance is measured on representative low-cost Android devices;
- image/document caches have size and retention limits;
- network payloads support compression, pagination and conditional/incremental retrieval.

## 14. Dependency governance

Before adding a package, record:

- business need and alternatives;
- licence and provenance;
- maintenance, release and security posture;
- Android/iOS support and minimum versions;
- data/privacy behavior;
- binary-size and startup impact;
- testability and platform-channel risk;
- replacement/exit plan.

CI runs dependency vulnerability, licence and outdated checks. Critical packages are pinned through the workspace lockfile and upgraded through reviewed PRs.
