# 08 — Delivery Sequence and Parallel Execution

## 1. Decision

Flutter work does **not** need to wait until every web screen is complete. It also must **not** be built by examining the database after web completion.

The correct dependency is stable, reviewed application contracts—not completion of all visual web work and not direct database schemas.

Development is split into contract-safe parallel foundation and contract-bound feature implementation.

## 2. Current program context

- Wave 2 domains are reviewed and integrated.
- EXP-01 is actively composing admin, teacher, guardian and student journeys over those domain contracts.
- Mobile requires the same persona composition, notification, document, reporting and offline semantics.
- Therefore MOB-01 feature activation depends on reviewed EXP-01/Wave 3 API/read-model contracts.

## 3. Stage A — safe parallel mobile foundation

May begin while EXP-01 is active:

1. documentation, ADR and threat-model preparation;
2. Flutter/Dart Pub Workspace bootstrap;
3. Family and Staff empty app shells;
4. format/analyze/test/build CI;
5. package-boundary checks;
6. design token/theme/component foundations;
7. localization, RTL and accessibility harness;
8. OAuth/OIDC PKCE proof with synthetic identity environment;
9. secure storage/device-session abstractions;
10. generated OpenAPI client pipeline against reviewed/provisional schemas;
11. fake repositories and synthetic fixtures;
12. encrypted local database and generic outbox/sync state machine;
13. push registration/deep-link harness without domain-sensitive payloads;
14. Android/iOS flavor, signing and internal-distribution preparation;
15. dependency/SBOM/licence/provenance controls.

Stage A cannot claim complete user journeys and cannot create production backend contracts.

## 4. Stage B — MOB-01 activation

Starts only after the coordinator records:

- exact reviewed Wave 3 integration or approved mobile-contract base SHA;
- reviewed mobile OpenAPI/read-model schema SHA/version;
- mobile threat model and local-data allowlist approval;
- app-shell/bundle identity and store-account ownership;
- exact branch, worktree and environment/preview bindings;
- no overlapping active owner on mobile paths.

Stage B binds real reviewed contracts and completes Family/Staff journeys.

## 5. Why database-first sequencing is prohibited

A database schema does not encode the full mobile contract:

- authorization and relationship rules;
- tenant/region routing;
- masking and non-disclosure;
- publication/finalization state;
- idempotency and concurrency;
- error/retry semantics;
- audit/disclosure behavior;
- version/deprecation policy;
- mobile-safe bounded projections.

Direct database coupling would bypass RLS/application policy, break module ownership and force mobile rewrites whenever internal tables evolve.

## 6. Workstream ownership

### Coordinator/mobile architecture stream

Owns before MOB-01 activation:

- `docs/mobile/**`;
- mobile ADRs;
- mobile threat model and contract-change requests;
- machine-readable mobile board/workpack;
- cross-stream contract inventory and gate evidence.

It does not implement inside EXP/domain-owned paths.

### EXP-01

Owns web persona composition, communications, documents, reports and PWA. It may expose/extend reviewed mobile-consumable application contracts through its own ownership process. It does not own Flutter implementation.

### Domain streams

Own domain commands, queries, events and invariants. Mobile requests missing capabilities through contract changes, never private-table reads.

### MOB-01

After activation owns:

- `mobile/**`;
- `tests/mobile/**` if created outside `mobile/`;
- `docs/modules/mobile/**` or its completion report;
- mobile-only CI workflows/registrations approved by foundation;
- generated mobile client snapshots and fixtures within mobile ownership.

MOB-01 cannot change domain modules, web apps, migrations or frozen shared contracts without approval.

## 7. Recommended Git resources

Planned executable stream:

```text
Stream: MOB-01
Branch: module/native-mobile-applications
Worktree: .worktrees/mob-01-mobile
Database branch: none by default
Backend integration environment: reviewed Wave 3 integration environment
```

MOB-01 should not receive a Neon branch unless it owns backend migrations, which this architecture intentionally avoids. If a mobile-specific backend adapter becomes necessary, it remains a platform/EXP/domain contract change and receives the owner-appropriate branch rather than giving Flutter direct database ownership.

The core execution validator currently expects one Neon branch per module stream. Before activation, the coordinator must either:

- update the execution artifact schema to support `database_branch_required: false` for client-only streams; or
- define a non-owning synthetic integration branch strictly for end-to-end evidence.

Do not create an unnecessary database schema merely to satisfy an old validator assumption.

## 8. Milestone sequence

### M0 — architecture and contract freeze

- approve documentation/ADR/threat model;
- inventory existing/provisional APIs;
- freeze application portfolio and ownership;
- record exact activation gate.

### M1 — workspace and engineering foundation

- Dart Pub Workspace;
- app shells/packages;
- CI, lints, boundaries, fakes;
- dependency/licence/SBOM controls;
- Android/iOS development builds.

### M2 — shared experience foundation

- design system;
- localization/RTL/accessibility;
- adaptive navigation;
- standard state/recovery components;
- synthetic persona shells.

### M3 — identity, device and API runtime

- PKCE auth;
- session/persona/device lifecycle;
- generated API clients;
- stable errors/correlation;
- remote revocation and secure logout.

### M4 — offline and notification foundation

- encrypted local stores;
- scoped cache/outbox;
- synchronization state machine;
- push/deep-link handling;
- background and migration tests.

### M5 — School Family

- guardian household/multi-child journeys;
- student persona;
- published academic/attendance/finance reads;
- forms, documents, communication and payment handoff.

### M6 — School Staff

- teacher timetable/roster;
- offline attendance and reconciliation;
- permitted grade drafts, communication, alerts and capture tools.

### M7 — hardening and release evidence

- full security/accessibility/localization/performance/device matrix;
- compatibility and recovery;
- store privacy/signing/internal-test evidence;
- runbooks, completion report and reviewed final SHA.

## 9. Parallelism inside the mobile program

The repository's rule remains one agent per complete module stream. MOB-01 is one coherent stream because Family and Staff share architecture, security, API, offline and release infrastructure.

Do not create independent implementation agents for:

- auth;
- sync engine;
- individual screens;
- guardian/student/teacher subfeatures;
- tests or documentation.

If future scale requires multiple mobile streams, split only at a reviewed ownership boundary with non-overlapping paths and stable contracts, for example:

- `MOB-FAMILY-01` and `MOB-STAFF-01` after a separate `MOB-FND-01` is integrated;
- never three agents editing one shared Flutter workspace foundation concurrently.

For the current team/project, one MOB-01 agent is lower risk.

## 10. Coordination protocol

Every checkpoint records:

- stream/milestone;
- exact base and HEAD;
- branch/worktree;
- backend API schema/environment version;
- changed owned paths;
- focused and full checks;
- design/security/offline evidence;
- contract changes requested/approved;
- pending web/domain dependency;
- exact next milestone;
- dirty state;
- production mutation: no unless separately authorized.

## 11. Hard stops

MOB-01 stops at the boundary when:

- activation gate/base/schema is missing or changed without review;
- branch/worktree/ownership is wrong;
- an active agent has overlapping mobile/shared paths;
- required server behavior does not exist;
- implementation would duplicate server domain logic;
- local storage classification/retention is unapproved;
- security, tenant/persona isolation, idempotency, sync or migration invariant fails;
- real customer data or production/store action is required without authorization;
- platform package/licence/privacy review is unresolved;
- context limit is reached after a safe checkpoint;
- the complete stream boundary is reached.

## 12. Recommended owner actions

### Now

- review/merge the mobile documentation PR;
- let EXP-01 continue without altering its branch ownership;
- require EXP milestones to publish mobile-consumable API/read-model notes;
- optionally start only Stage A foundation after architecture approval.

### After EXP-01 completion

- perform Wave 3 integration and contract freeze;
- approve mobile threat model/API profile;
- update execution board/validator for a client-only MOB-01 stream;
- start MOB-01 from the exact reviewed base;
- integrate and release through staged internal testing before pilot schools.

## 13. Readiness matrix

| Work | Can start during EXP-01? | Required dependency |
|---|---:|---|
| Documentation/ADR/threat model | Yes | Current reviewed architecture |
| Flutter workspace/CI | Yes | Approved ADR/ownership |
| Design tokens/accessibility harness | Yes | `DESIGN.md` |
| PKCE/device/session proof | Yes | Foundation identity contract/test environment |
| Generic encrypted store/sync engine | Yes | Approved local-data model |
| Generated provisional API client | Yes | Marked schema + fake server |
| Guardian/teacher domain features | Partially | Reviewed APIs/read models for each journey |
| Full end-to-end Family/Staff apps | No | Reviewed Wave 3/mobile API profile |
| Production/store release | No | Pilot/security/release authorization |
