# MOB-01 — Native Mobile Applications

## Status

**Planned; not executable until the activation gate is recorded.**

## Fixed resources

- Repository: `rahmatullahboss/international-school-management-platform`
- Planned branch: `module/native-mobile-applications`
- Planned worktree: `.worktrees/mob-01-mobile`
- Database ownership: none
- Database branch: not required by architecture; coordinator must update/approve the execution artifact rule before activation
- Starting base: exact reviewed Wave 3 integration or exact approved mobile-contract base SHA, to be recorded
- Backend schema: exact reviewed mobile OpenAPI/read-model version, to be recorded

## Entry gate

`GATE-MOBILE-CONTRACTS-READY` passes only when:

1. EXP-01 is reviewed and its required persona/API/read-model contracts are integrated, or an equivalent compatible contract gate is approved.
2. Exact starting Git SHA and backend schema SHA/version are recorded.
3. ADR-007 and `docs/mobile/**` are approved.
4. Mobile threat model, data classification and offline allowlist are approved.
5. Family/Staff application identity, store ownership and release responsibility are approved.
6. Core execution artifacts support a client-only stream without invented database ownership.
7. No active stream owns overlapping `mobile/**` paths.

## Universal execution contract

The MOB-01 agent must:

1. Read repository instructions, `PRODUCT.md`, `DESIGN.md`, approved ADRs, `docs/execution/**`, `docs/mobile/**`, relevant module contracts and current progress/agent boards.
2. Verify exact branch, base SHA, worktree, owned paths and backend schema/environment before writing.
3. Preserve existing dirty work and never reset, discard, overwrite or reformat another owner's changes.
4. Own the complete mobile stream end-to-end. Do not spawn implementation agents for internal milestones, screens, packages, tests or documentation.
5. Use test-first or characterization-first work for authorization context, sync, security, migration and regression invariants.
6. Consume versioned APIs/read models only. Never connect Flutter directly to Neon or module tables.
7. Never duplicate server accounting, grading, enrollment, publication, attendance-finalization or authorization rules.
8. Raise a contract-change request when required server behavior is absent; stop at that boundary rather than inventing it.
9. Use synthetic data only in development, CI and preview environments.
10. After each meaningful milestone, run focused checks, checkpoint-commit owned changes, update evidence and continue automatically.
11. Record design evidence for every UI-bearing checkpoint using `PRODUCT.md`, `DESIGN.md` and mobile design requirements.
12. Do not submit stores, enable production clients, mutate production or access real school data without separate authorization.
13. Stop only at a documented hard stop, context limit after a safe checkpoint or complete stream boundary.

## Owned paths

Planned ownership:

```text
mobile/**
tests/mobile/**
docs/modules/mobile/**
docs/mobile/completion/**
mobile-specific generated contract snapshots within mobile/**
mobile-only CI registrations/workflows approved through foundation governance
```

Not owned:

```text
packages/modules/**
apps/web-*/**
packages/database/**
module migrations
EXP-01 feature paths
foundation shared contracts outside approved extension points
PRODUCT.md / DESIGN.md after activation unless a reviewed contract change grants it
```

## Objective

Deliver production-shaped Flutter applications for School Family and School Staff, using one Dart Pub Workspace and shared packages, with secure identity/device lifecycle, capability-driven interfaces, offline-safe approved workflows, generated versioned API clients, accessibility/localization, observability, CI and staged store-release evidence.

## Ordered milestones

### 0 — Activation verification and contract inventory

- Verify `GATE-MOBILE-CONTRACTS-READY` evidence.
- Record exact base SHA, API schema version, environment and ownership.
- Inventory every Family/Staff journey against command/query/read-model owner.
- Record missing contract changes and continue only independent work.
- Checkpoint: activation evidence complete and no speculative backend coupling.

### 1 — Flutter workspace and engineering foundation

- Create Dart Pub Workspace with `family_app`, `staff_app` and approved shared packages.
- Configure supported Flutter/Dart versions, format/analyze/lints, generated-code policy, package boundaries and dependency governance.
- Add Android/iOS development/staging/production environments, synthetic configuration and CI builds.
- Add unit/widget/integration test harness, fakes, coverage, SBOM/licence/vulnerability/provenance controls.
- Checkpoint: reproducible development builds and CI pass with empty app shells.

### 2 — Shared design, localization and adaptive experience

- Map reviewed semantic tokens into Flutter themes/components.
- Build compact/medium/expanded shells, capability-aware navigation and context switchers.
- Implement standard loading, stale, offline, syncing, partial-success, conflict, denied, masked and read-only states.
- Add localization generation, English/Bangla/RTL fixtures, text scaling, semantics and reduced-motion support.
- Run critique/audit/hardening/polish evidence.
- Checkpoint: representative synthetic persona shells pass design/accessibility/adaptive tests.

### 3 — Identity, session, device and API runtime

- Implement system-browser OAuth/OIDC Authorization Code with PKCE.
- Implement secure token/key storage, session/persona/tenant context, step-up, logout and remote revocation.
- Register device/app/push identity through reviewed contracts.
- Generate API client from exact reviewed schema; isolate DTOs and implement stable error/correlation handling.
- Add negative tests for tenant/persona/relationship/capability changes and deep-link authorization.
- Checkpoint: synthetic login → bootstrap → persona switch → revocation journey passes Android/iOS tests.

### 4 — Encrypted local store, sync and notifications

- Implement scoped encrypted local database and migrations.
- Implement authorization leases, allowlisted cache, command outbox, retry/backoff, partial results and explicit conflicts.
- Implement push registration, foreground/background/terminated handling and authenticated deep links using opaque payloads.
- Add backup/log/crash/notification leakage tests.
- Checkpoint: offline synthetic workflow, duplicate replay, scope removal, lease expiry and local migration tests pass.

### 5 — School Family application

- Implement guardian household/multi-child context.
- Implement authorized timetable, attendance, published results, fees/invoices/receipts/payment handoff, forms/consent, absence notices, documents, notification inbox and secure communication.
- Implement student persona with age-appropriate timetable, attendance, published results, resources/documents, announcements and permitted requests.
- Preserve server publication, relationship, finance and document authorization rules.
- Test one/no/multiple children, dual guardian/teacher account, relationship removal, denied records, low bandwidth and app upgrades.
- Checkpoint: complete Family MVP journeys pass contract/device/accessibility/localization tests.

### 6 — School Staff application

- Implement teacher today/timetable, assigned classes and roster.
- Implement offline-safe attendance capture, command evidence, sync/reconciliation and conflict recovery.
- Implement permitted grade drafts, communication, selected alerts and approved camera/QR workflows.
- Keep broad health/safeguarding and dense ERP workflows out of scope.
- Test assignment removal, session finalization, duplicate commands, large roster, lost device and morning burst behavior.
- Checkpoint: complete Staff MVP journeys pass contract/device/security/performance tests.

### 7 — System hardening and release evidence

- Run full format/analyze/unit/widget/contract/integration/device suites.
- Run security/MASVS, accessibility, Bangla/RTL/long-content, adaptive/foldable, low-cost device, performance, migration, backup/leakage and compatibility tests.
- Verify privacy-safe logs/telemetry, alerts and runbooks.
- Produce signed internal release candidates only through protected CI.
- Prepare accurate store privacy/permissions/age-rating metadata and synthetic screenshots without submitting production.
- Publish completion report with exact final SHA, API schema, build numbers, evidence, known risks and pilot-ready/blocked verdict.

## Required test scenarios

At minimum:

- PKCE browser login and callback manipulation;
- session expiry, refresh reuse detection and remote revocation;
- account with multiple tenants/personas;
- guardian with one/multiple/no linked children;
- teacher outside assigned class;
- student requesting unpublished records;
- offline attendance, duplicate replay, conflict and finalization;
- app/process kill during local transaction/sync;
- authorization lease expiration and device clock rollback;
- notification tap from foreground/background/terminated state;
- sensitive link/payload non-disclosure;
- local database migration from every supported app version;
- backup/temp/log/crash/screenshot leakage;
- Android/iOS and low-cost/large-screen profiles;
- TalkBack/VoiceOver, 200% text scale, keyboard/switch access, reduced motion;
- English, Bangla, RTL and long names/content;
- supported old client with new backend and controlled minimum-version block.

## Checkpoint evidence format

```text
Date/time:
Stream: MOB-01
Milestone completed:
Git branch:
Worktree:
Starting base SHA:
Backend API schema/version:
Checkpoint SHA:
Changed owned paths:
Focused checks and results:
Android/iOS build/device evidence:
Security/offline evidence:
UI/design evidence: authorities, brief, critique, audit, detector, accessibility, responsive/RTL, harden, polish
Contract changes/open dependencies:
Gate outcome:
Exact next milestone:
Dirty/uncommitted state:
Production/store mutation performed: no
```

## Hard stops

- activation gate or exact base/schema missing;
- wrong/shared branch or worktree;
- overlapping dirty/unowned changes;
- missing reviewed backend contract;
- requirement to access database/private tables or duplicate server logic;
- unapproved local storage/data classification;
- failed tenant/persona isolation, auth, idempotency, sync, migration or security invariant;
- real data, production mutation or app-store submission required without approval;
- unapproved dependency/licence/privacy risk;
- context limit after safe checkpoint;
- complete stream boundary reached.

## Completion boundary

MOB-01 is complete when Family and Staff MVP journeys are functional through reviewed APIs, offline/security/accessibility/localization/release gates pass, worktree is clean, exact final SHA/API schema/build evidence is recorded, no unapproved contract change remains and the program has an explicit internal-pilot-ready or blocked verdict. Production publication remains a separate owner authorization.
