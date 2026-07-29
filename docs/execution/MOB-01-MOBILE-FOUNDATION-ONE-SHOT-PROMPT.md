# MOB-01 — Native Mobile Shared Foundation

Use this prompt only after `GATE-MOBILE-DOCS-APPROVED` passes and the coordinator records the exact reviewed starting SHA.

## Prompt

Repository `rahmatullahboss/international-school-management-platform`-এ `MOB-01 — Native Mobile Shared Foundation` শুরু করো। প্রথমে current workspace, repository instructions, `PRODUCT.md`, `DESIGN.md`, `docs/README.md`, `docs/mobile/README.md` এবং পুরো `docs/mobile/**`, `docs/adr/ADR-007-flutter-mobile-product-strategy.md`, `docs/execution/mobile-program-board.json`, `docs/execution/mobile-progress-tracker.md`, platform architecture/security/execution contracts এবং active EXP-01 state পড়বে। Existing dirty change reset, discard, overwrite বা reformat করবে না। Real production student data ব্যবহার করবে না।

Coordinator-recorded exact reviewed base SHA থেকে branch `program/mobile-foundation-v1` এবং fixed worktree `.worktrees/mob-01-foundation` create/verify/resume করবে। Flutter-only foundation-এর জন্য direct Neon/database access বা Neon branch প্রয়োজন নেই; backend schema change প্রয়োজন হলে কাজ থামিয়ে owning platform stream-এর contract-change request তৈরি করবে। Production deploy, store publish, signing mutation বা real tenant access আলাদা authorization ছাড়া করবে না।

এক agent হিসেবে সম্পূর্ণ MOB-01 end-to-end execute করো। ছোট কাজ, screen, adapter, test বা internal milestone-এর জন্য অন্য implementation agent তৈরি করবে না।

## Objective

One governed Dart Pub Workspace থেকে `School Family` এবং `School Staff` empty but production-shaped application shells এবং frozen shared mobile foundation তৈরি করা, যাতে পরে Family ও Staff whole-module streams আলাদা owned paths-এ parallel কাজ করতে পারে। Mobile client versioned permission-aware APIs consume করবে; database table inspect/read করবে না এবং domain business rule duplicate করবে না।

## Owned paths

```text
mobile/pubspec.yaml
mobile/analysis_options.yaml
mobile/tool/**
mobile/packages/core_*/**
mobile/packages/design_system/**
mobile/packages/testing_support/**
mobile/apps/family_app/**          # foundation/bootstrap shell only
mobile/apps/staff_app/**           # foundation/bootstrap shell only
.github/workflows/mobile-*
docs/mobile/foundation/**
your own section of docs/execution/mobile-progress-tracker.md
```

Do not implement final Family or Staff feature packages inside this stream.

## Ordered milestones

### 1. Workspace, toolchain and reproducible builds

- Pin a reviewed Flutter stable and Dart version through repository policy.
- Create Dart Pub Workspace with one lock file and explicit package registration.
- Create Android/iOS Family and Staff targets with development, staging and production environment configuration; roles are not flavours.
- Establish strict analyzer, formatter, generated-code, dependency, licence, secret and architecture checks.
- Add deterministic local/CI commands and contribution instructions.
- Build both empty apps for Android and iOS/simulator where CI supports it.

Checkpoint: reproducible empty shells and workspace verification pass.

### 2. Architecture boundaries and dependency injection

- Implement View/ViewModel, Repository/Service and optional use-case contracts.
- Establish one approved state-management/DI implementation after a documented spike.
- Add machine-enforced package/import boundaries.
- Ban direct plugin/API/database implementation imports from UI/feature packages.
- Provide test overrides/fakes for every external adapter.

Checkpoint: boundary negative tests and representative architecture tests pass.

### 3. Design system, adaptive shells and localization

- Translate approved `PRODUCT.md`/`DESIGN.md` semantic tokens into Flutter theme/extensions and core components.
- Implement Family and Staff adaptive shells, safe persona/context placeholders, network/sync/assurance states and typed navigation registry.
- Add localization generation, English and Bangla fixtures, RTL/pseudolocale/long-content fixtures and accessibility semantics.
- Run repository design workflow: shape, critique, audit, harden and polish. Record phone/tablet, TalkBack/VoiceOver, keyboard, text-scale and reduced-motion evidence.

Checkpoint: shared design/accessibility/localization foundation passes.

### 4. Authentication, session and capability foundation

- Implement OAuth 2.0/OIDC Authorization Code with PKCE using external/system browser through an adapter.
- Implement secure token storage, refresh/revocation, session inventory client, app-target/device registration and redacted diagnostics.
- Implement session/persona/capability context models from a reviewed identity contract or clearly marked simulator.
- Implement safe logout, tenant/persona switch teardown and namespace wipe.
- Add deep-link validation and assurance/step-up contract foundation.

Checkpoint: auth redirect, token lifecycle, revocation, persona isolation and negative tests pass.

### 5. Generated API client and contract testing

- Establish canonical OpenAPI snapshot input and deterministic Dart client generation.
- Do not edit generated code manually.
- Wrap generated transport with narrow service interfaces, cancellation, timeouts, safe retry, correlation and stable error mapping.
- Implement mock/contract server and compatibility tests including unknown enum/field tolerance, pagination, idempotency and conflicts.
- Record exact OpenAPI SHA/fixture status in build metadata.

Checkpoint: generation drift and contract test gates pass.

### 6. Encrypted local database and sync engine

- Select the local database/encryption implementation through documented benchmark, licence, maintenance and platform review.
- Implement tenant/actor/persona/resource namespaces, local migrations, secure key references and cache wipe.
- Implement feature-agnostic sync primitives: command queue state machine, cursors, retries with jitter, conflict/result models and foreground/resume orchestration.
- Use synthetic attendance commands to prove duplicate-safe replay, timeout-after-commit recovery, partial result and conflict handling. Do not encode final ACAD business rules.
- Treat Android/iOS background scheduling as optional adapters; correctness must work without background execution.

Checkpoint: storage extraction/migration and sync state-machine tests pass.

### 7. Notifications, files, platform adapters and observability

- Implement push token/device adapter, generic non-sensitive notification payload parsing, foreground/background/terminated routing and authenticated deep-link handoff.
- Implement application-private file/download/upload adapter contracts, camera/file/QR permission abstractions without final feature workflows.
- Implement privacy-safe crash/telemetry adapter, allowlist logging and redaction tests.
- Record third-party SDK data flows, permissions, subprocessors, licences and replacement plans.

Checkpoint: adapter tests, privacy review and notification lifecycle tests pass.

### 8. CI, security, performance and foundation freeze

- Run analyzer, format, architecture, unit, widget, contract, integration, generated drift, localization, dependency/licence, secret, SBOM and Android/iOS build checks.
- Run OWASP MASVS-aligned foundation checks, OAuth/deep-link manipulation tests, local extraction/backup review and sensitive-log inspection.
- Benchmark cold/warm start, first content, bundle size, memory and representative local/sync operations on approved reference devices.
- Publish foundation interfaces, owned paths, dependency decisions, known risks, support/runbook and exact final SHA.
- Update mobile program board/tracker and mark `GATE-MOBILE-FOUNDATION-READY` only with evidence.

Checkpoint: shared foundation reviewed and frozen; Family/Staff streams receive exact base and contract requirements.

## Mandatory implementation rules

- No direct Neon/PostgreSQL access from Flutter.
- No business calculations or authorization decisions copied from platform modules.
- No sensitive content in push payloads, logs, analytics or crash reports.
- No global mutable user-data singleton.
- No generic `common` package.
- No hand-edited generated client.
- No assumption that background execution runs promptly.
- No last-write-wins for high-risk records.
- No production credentials or signing material in repository/PR contexts.
- Every dependency addition requires purpose, licence, maintenance, privacy and permission review.
- Simulator contracts must be clearly marked and cannot pass a product feature gate.

## Required tests

Include unit, widget, contract, integration and platform tests for:

- login/logout/refresh/revocation;
- malicious redirect/deep link;
- tenant/persona switch isolation;
- secure storage and cache namespace;
- local database migration/recovery;
- duplicate/partial/conflict sync state;
- offline/app-kill/resume behavior;
- notification states and authenticated route revalidation;
- accessibility, Bangla/English, RTL, long content and text scaling;
- architecture import violations;
- generated contract compatibility;
- sensitive-log/telemetry redaction;
- low-cost Android performance.

## Checkpoint and handoff

After every coherent milestone run focused checks, update your tracker evidence, commit and push owned changes, then continue automatically. Stop only at a documented hard contract boundary, safe context limit after a checkpoint, or complete stream boundary.

Final report must include:

- stream ID, branch and fixed worktree;
- exact starting base and final HEAD;
- platform/OpenAPI/PRODUCT/DESIGN SHAs;
- milestones/checkpoint SHAs;
- owned paths changed;
- dependency/licence/SDK register;
- test/build/device/performance evidence;
- security/privacy/accessibility/localization evidence;
- simulators and unresolved contract assumptions;
- gate verdict and exact next stream action;
- clean/dirty state;
- confirmation of no production/store mutation and no real production data.
