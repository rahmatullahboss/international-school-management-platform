# 09 — Agent Ownership and Handoff Contract

## 1. Ownership principle

One agent owns one complete mobile stream end-to-end. Internal milestones, screens, endpoints, widgets, tests, dependency upgrades and defects are not separate agent assignments.

Maximum normal parallelism after foundation is two implementation streams: Family and Staff. Integration remains serial.

## 2. Stream ownership

### `MOB-00` — Documentation and coordination

Owns:

- `docs/mobile/**`;
- mobile ADRs;
- `docs/execution/mobile-*` planning artifacts;
- reviewed base/contract records;
- mobile gate decisions and tracker consistency.

It does not implement feature code inside active mobile stream paths.

### `MOB-01` — Mobile foundation

Owns:

```text
mobile/pubspec.yaml
mobile/analysis_options.yaml
mobile/tool/**
mobile/packages/core_*/**
mobile/packages/design_system/**
mobile/packages/testing_support/**
mobile/apps/*/platform bootstrap only
.github/workflows/mobile-*
```

Responsibilities:

- toolchain and workspace;
- shared architecture and dependency boundaries;
- auth/session/persona/capability foundation;
- API generation;
- local database and sync engine;
- notification/deep-link/device adapters;
- design tokens/components;
- observability/redaction;
- test kit, CI, build and release skeleton.

After `GATE-MOBILE-FOUNDATION-READY`, these paths are frozen for feature streams.

### `MOB-02` — Family application

Owns:

```text
mobile/apps/family_app/**
mobile/packages/family_*/**
docs/mobile/modules/family/**
```

Responsibilities:

- guardian and student shells/composition;
- household and child context;
- timetable, attendance, results, fees, forms, documents, messages and notifications;
- family-specific offline/read policies;
- accessibility, localization, performance and tests;
- store metadata and runbooks for Family.

### `MOB-03` — Staff application

Owns:

```text
mobile/apps/staff_app/**
mobile/packages/staff_*/**
docs/mobile/modules/staff/**
```

Responsibilities:

- teacher shell/composition;
- timetable, class roster and offline attendance;
- approved grade drafts, alerts, communication, upload/scan workflows;
- staff-specific device/session and restricted-data behavior;
- accessibility, localization, performance and tests;
- store metadata and runbooks for Staff.

### `MOB-INTEG` — Mobile integration and release

Owns:

```text
mobile/integration_test/**
mobile/release/**
mobile/generated/approved-contracts/**
docs/mobile/releases/**
coordinator-approved integration wiring
```

May resolve only:

- mechanical imports/exports;
- generated final contract snapshots;
- workspace registration;
- integration test wiring;
- release configuration composition;
- documentation links and release evidence.

It cannot redesign feature behavior, authorization, sync conflict policy or local-data classification.

## 3. Shared package rule

A feature stream cannot modify frozen `core_*`, `design_system` or `testing_support` packages directly.

When a missing shared capability blocks work, create:

```text
docs/mobile/contract-change-requests/<stream>-<short-name>.md
```

The request records:

- requesting stream and checkpoint;
- current interface;
- exact extension required;
- compatible alternative considered;
- Family/Staff impact;
- security/privacy impact;
- API/local migration impact;
- tests and rollout;
- foundation/coordinator decision.

Compatible extensions are implemented by the foundation owner or a serialized foundation-maintenance checkpoint, then consumed from a reviewed SHA.

## 4. Platform contract rule

Mobile streams consume platform APIs and events. They cannot edit platform domain tables or reproduce domain rules.

A missing backend capability uses the existing platform contract-change process and identifies the owning stream: SIS, FIN, ACAD, OPS, CARE, INT, EXP or Foundation.

Mobile work stops at that semantic boundary unless independent milestones can continue safely with an approved simulator.

## 5. Generated artifacts

Generated OpenAPI clients, localization output and platform build files have explicit owners.

- source schema/config is reviewed;
- generation is deterministic;
- generated output is never hand-edited;
- integration may regenerate from the final approved source;
- feature streams cannot hide behavior in generated patches.

## 6. Agent startup checklist

Every mobile agent must:

1. read repository instructions and current workspace state;
2. read `PRODUCT.md`, `DESIGN.md`, platform architecture/security/execution documents and all `docs/mobile/**` relevant to the stream;
3. verify exact Git branch, base SHA, worktree and owned paths;
4. verify platform/OpenAPI/design authority SHAs;
5. inspect dirty state without reset, discard or overwrite;
6. confirm active gates and unresolved contract assumptions;
7. use synthetic data only;
8. record the initial state before writing.

## 7. Milestone behavior

The owning agent performs specification refinement, implementation, design critique, security review, tests, documentation and handoff for the whole stream.

After each coherent milestone:

- run focused checks;
- update stream evidence;
- commit owned changes;
- push branch;
- continue automatically to the next milestone unless a documented hard stop exists.

Do not spawn micro-agents for individual screens, tests or defects.

## 8. Conflict policy

An agent must not:

- reset or force-push another stream;
- overwrite dirty work;
- cherry-pick unreviewed feature code from another stream;
- change frozen shared packages silently;
- edit generated files by hand;
- weaken security/offline policy to make a test pass;
- use real student data;
- deploy production or publish stores without separate authorization.

Mechanical integration conflicts may be resolved by `MOB-INTEG`. Semantic conflicts return to the owning stream or an approved ADR/contract decision.

## 9. Completion report

Every stream completion report contains:

- stream ID;
- branch and fixed worktree;
- starting base and final HEAD;
- platform/OpenAPI/design authority SHAs;
- milestones completed/remaining;
- checkpoint SHAs;
- changed owned paths;
- dependency and licence changes;
- tests/builds and device matrix;
- accessibility/localization/offline evidence;
- security/privacy evidence;
- release/store evidence where applicable;
- known risks and follow-up;
- dirty/uncommitted state;
- confirmation of no unauthorized production/store mutation.

## 10. Definition of done

A mobile stream is complete only when:

- all ordered milestones are checkpointed;
- worktree is clean;
- package boundaries pass;
- generated contracts match reviewed sources;
- local migrations replay from supported versions;
- unit, widget, contract, integration, accessibility and security checks pass;
- runbooks and module documentation agree with code;
- no unresolved unapproved contract change remains;
- exact final SHA and artifacts are recorded.
