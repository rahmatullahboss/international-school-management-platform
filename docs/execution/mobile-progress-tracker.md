# Native Mobile Program Progress Tracker

**Program:** `international-school-mobile-v1`  
**Updated:** 2026-07-29  
**Documentation branch:** `docs/mobile-architecture-v1`  
**Starting base:** `3ddfcf22a237fe3025c4c456005812641b4397af`  
**Current state:** documentation baseline proposed; no Flutter implementation, production deployment, store publication or production-data mutation performed.

## Gate status

| Gate | Status | Required evidence |
|---|---|---|
| `GATE-MOBILE-DOCS-APPROVED` | pending review | ADR, product scope, architecture, API, sync, security, design, testing, execution and ownership documents accepted |
| `GATE-EXP-CONTRACTS-STABLE` | pending by contract family | reviewed persona/API contract snapshots and compatibility tests |
| `GATE-MOBILE-FOUNDATION-READY` | blocked | workspace, CI, auth, API generation, local DB, sync, design, adapters and test kit verified |
| `GATE-FAMILY-APP-READY` | blocked | guardian/student journeys and evidence complete |
| `GATE-STAFF-APP-READY` | blocked | teacher/offline attendance journeys and evidence complete |
| `GATE-MOBILE-INTEGRATED` | blocked | reviewed app candidates integrated against reviewed platform contracts |
| `GATE-MOBILE-PILOT-READY` | blocked | signing, store, privacy, security, staged rollout and incident evidence complete |

## Stream status

| Stream | Wave | Status | Base | Next action | Blocking condition |
|---|---:|---|---|---|---|
| `MOB-00` | 0 | documentation active | `3ddfcf22a237fe3025c4c456005812641b4397af` | review documentation PR and decide gate | owner/architecture review |
| `MOB-01` | 1 | blocked | exact reviewed base to be recorded | execute shared mobile foundation | `GATE-MOBILE-DOCS-APPROVED` |
| `MOB-02` | 2 | blocked | reviewed MOB-01 + Family contract snapshot | execute Family app | foundation + Family contracts |
| `MOB-03` | 2 | blocked | reviewed MOB-01 + Staff contract snapshot | execute Staff app | foundation + Staff contracts |
| `MOB-INTEG` | 3 | blocked | reviewed app/platform candidates | serial integration and pilot evidence | Family + Staff completion |

## Platform contract checkpoints

| Contract family | Status | Owning platform stream | Enables |
|---|---|---|---|
| session/persona/capability | pending reviewed snapshot | FND/EXP | both app shells |
| guardian household/relationship | pending reviewed snapshot | SIS/EXP | Family guardian core |
| student self/publication | pending reviewed snapshot | SIS/ACAD/EXP | Family student core |
| teacher assignment/timetable | pending reviewed snapshot | ACAD/EXP | Staff shell/schedule |
| roster/attendance sync | pending reviewed snapshot | ACAD/EXP | offline attendance |
| notification/device/deep link | pending reviewed snapshot | FND/EXP | push journeys |
| document authorization | pending reviewed snapshot | FND/EXP | document journeys |
| messaging membership/retention | pending reviewed snapshot | EXP | secure messaging |
| billing read/payment initiation | pending reviewed snapshot | FIN/EXP | Family fees/payments |

## Checkpoint evidence template

```text
Date/time:
Stream:
Milestone completed:
Git branch:
Worktree:
Starting base:
Checkpoint SHA:
Platform/OpenAPI/DESIGN/PRODUCT SHAs:
Changed owned paths:
Focused checks and results:
Android/iOS builds:
Offline/sync evidence:
Accessibility/localization evidence:
Security/privacy evidence:
Dependency/licence changes:
Gate outcome:
Exact next milestone:
Dirty/uncommitted state:
Production/store mutation performed: no
Real production data used: no
```

## MOB-00 initial evidence

Date/time: 2026-07-29T17:41:00+06:00  
Stream: `MOB-00`  
Milestone: documentation and research baseline started  
Branch: `docs/mobile-architecture-v1`  
Starting base: `3ddfcf22a237fe3025c4c456005812641b4397af`  
Scope: mobile product decision, Flutter architecture, API readiness, offline sync, security/privacy, design/accessibility/localization, testing/release/observability, parallel execution, agent ownership, risks, ADR, references and execution artifacts  
Research: current official Flutter/Dart architecture and workspace guidance, RFC 8252, OWASP MASVS, Android WorkManager, Apple Background Tasks and Firebase Cloud Messaging  
Gate outcome: `GATE-MOBILE-DOCS-APPROVED` remains pending owner review  
Production/store mutation performed: no  
Real production data used: no

## Coordinator rules

- Contract-family gates are independent; do not claim all EXP contracts stable from one completed screen.
- Record exact SHAs, not branch names alone.
- Keep simulator assumptions visible until replaced by reviewed contracts.
- Do not start Family/Staff streams from unreviewed shared foundation.
- Do not integrate both app streams concurrently.
- No production deployment, app-store publication or real school data without separate authorization.
