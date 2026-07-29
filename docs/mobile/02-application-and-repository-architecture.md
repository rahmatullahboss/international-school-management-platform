# 02 — Application and Repository Architecture

## 1. Architecture decision

Use a feature-oriented Flutter monorepo with explicit UI, application/domain and data boundaries. The structure follows current Flutter guidance: Views and ViewModels in the UI layer, Repositories as sources of truth, Services for external systems, and use-cases only where cross-repository or complex business orchestration is needed.

The client remains a presentation and workflow client. Authoritative domain rules remain in platform application services.

## 2. Repository shape

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
│   ├── core_app/
│   ├── core_auth/
│   ├── core_authorization/
│   ├── core_api/
│   ├── core_database/
│   ├── core_sync/
│   ├── core_notifications/
│   ├── core_observability/
│   ├── core_localization/
│   ├── design_system/
│   ├── testing_support/
│   ├── family_*/
│   └── staff_*/
├── tool/
├── integration_test/
└── docs/
```

Use Dart Pub Workspaces with one shared dependency resolution and one committed lock file. The Flutter and Dart SDK versions are pinned by repository policy and upgraded through reviewed dependency changes.

## 3. Layer rules

### 3.1 Presentation

Contains:

- Views/widgets;
- ViewModels/controllers;
- navigation destinations;
- presentation models;
- formatting and accessibility semantics;
- UI-only state.

Rules:

- Views contain no network, database or authorization calls.
- ViewModels expose immutable state and commands.
- Widgets do not deserialize API payloads.
- Screen visibility may improve UX but never grants access.
- Display logic may format values but may not calculate authoritative balances, grades or policy outcomes.

### 3.2 Application/domain

Use-cases are introduced only when a feature coordinates multiple repositories, performs a reusable client workflow or enforces a client-side invariant such as safe sync sequencing.

Examples:

- switch active persona safely;
- submit attendance batch and reconcile results;
- revoke a device session and wipe scoped cache;
- consume notification deep link after capability revalidation.

Do not reproduce enrollment, accounting, grading, attendance-finalization or safeguarding rules in this layer.

### 3.3 Data

Repositories are the only data entry point for features. A repository may coordinate:

- generated API service;
- encrypted local database;
- secure credential store;
- operating-system plugin adapter;
- synchronization queue;
- cached read model.

Services are thin adapters and cannot become hidden repositories or business-rule containers.

## 4. Dependency direction

```text
View -> ViewModel -> UseCase (optional) -> Repository interface
Repository implementation -> API/local/plugin services
```

Dependencies point inward toward stable interfaces. Platform plugins, HTTP clients, local database engines, analytics providers and push providers are wrapped behind ports so they can be replaced without feature rewrites.

No feature package imports another feature's internal implementation. Shared behavior moves to an approved core package only after ownership review; a generic `common` dumping ground is prohibited.

## 5. State management and dependency injection

Use one approved reactive state-management and dependency-injection mechanism across the workspace. The foundation implementation may use Riverpod, but the architecture contract is the important authority:

- immutable state;
- explicit loading/error/data/sync states;
- dependency overrides for tests;
- scoped disposal on logout, persona switch and tenant switch;
- no global mutable singleton containing user data;
- no provider reads from domain entities outside the owning feature boundary.

The selected package version is frozen in `pubspec.lock` after the foundation spike and changed only through dependency review.

## 6. Navigation

Navigation is declarative and capability-aware. Use a typed route model with:

- application shell routes;
- persona-specific route registries;
- authenticated redirects;
- deep-link parsing and validation;
- restoration where safe;
- phone and tablet navigation variants.

A route request must resolve active tenant, persona, resource scope and required capability before displaying content. Deep links carry opaque resource references only; the destination reloads authorized data from the server.

Persona switching is a security boundary:

1. cancel in-flight requests;
2. close feature scopes;
3. clear memory state;
4. switch local-data namespace;
5. refresh capability/session context;
6. rebuild navigation;
7. reject stale deep links.

Guardian child switching changes resource context, not persona. Every child must remain inside the server-provided active relationship set.

## 7. Models

Maintain separate model types when responsibilities differ:

- generated transport DTO;
- local persistence record;
- domain/application model;
- presentation model.

Mapping occurs at repository boundaries. Do not pass generated DTOs directly into widgets or persist them blindly. Persisted schemas are versioned independently from server transport schemas.

All money values use integer minor units or a reviewed decimal representation plus ISO currency. Dates distinguish instant, local date, local time and academic period. IDs are opaque strings.

## 8. API client

Generate the transport client from the reviewed OpenAPI contract. Generated code is not edited manually.

The API layer provides:

- base URL and environment selection;
- authentication and token refresh;
- tenant, persona, locale and correlation headers;
- idempotency keys for eligible commands;
- request timeout and cancellation;
- bounded retry only for safe/retryable failures;
- stable error-code mapping;
- redacted request diagnostics;
- certificate/TLS platform defaults.

Feature repositories depend on narrow service interfaces rather than a single unbounded API client.

## 9. Environment and flavour model

Flavours represent environments and distribution configuration, not roles:

- development;
- staging;
- production.

Application targets represent Family and Staff. Each target/flavour pair has explicit bundle/application IDs, app names, icons, API environment, push configuration and signing configuration.

No production secret is stored in Dart source, assets or repository configuration. Public client identifiers are treated as public; confidential credentials remain server-side.

## 10. Design-system architecture

Translate the approved product tokens into Flutter semantic tokens and `ThemeExtension` values. Feature packages consume semantic tokens and shared components; they do not embed ad hoc colours, spacing or typography.

Shared components cover primitives and recurring states, not business-specific mega-widgets. Feature composition remains within the owning package.

## 11. Performance budgets

Foundation gates define measured budgets for:

- cold and warm start;
- first meaningful content;
- app bundle size;
- memory on supported low-cost Android hardware;
- roster rendering and scrolling;
- local query latency;
- sync batch duration;
- image/document upload memory;
- crash-free sessions and ANR rate.

Optimization follows profiling. Avoid premature isolates, custom rendering or cache duplication without evidence.

## 12. Architecture enforcement

CI must reject:

- feature-to-feature internal imports;
- UI imports of transport or database implementations;
- direct plugin use outside adapter packages;
- unscoped global state;
- direct database access outside repositories;
- manual changes to generated API code;
- sensitive logging calls;
- non-localized user-facing strings outside approved exceptions;
- dependency additions without license and privacy metadata.

## 13. Definition of done

The foundation architecture is ready when both empty application shells build for Android and iOS, dependency boundaries are machine-checked, generated-client and local-database migrations run, persona switching clears state, design tokens render, tests can override every external adapter and CI reproduces signed-testable artifacts without production credentials.
