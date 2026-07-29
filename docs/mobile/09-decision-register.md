# 09 — Mobile Decision Register

## Approved/proposed decisions

| ID | Decision | Status | Rationale |
|---|---|---|---|
| MOB-D001 | One Flutter workspace, two distributable apps | Proposed in ADR-007 | Shared infrastructure with separate family/staff security and release surfaces |
| MOB-D002 | Guardian and student share School Family app | Proposed | Shared publication/household services; capability-driven persona UI |
| MOB-D003 | Teacher-first School Staff app | Proposed | Distinct offline roster, device trust and daily workflow |
| MOB-D004 | Admin/finance/HR/restricted case work remains web-first | Proposed | Dense/sensitive workflows are not justified on early mobile releases |
| MOB-D005 | Mobile consumes versioned APIs/read models only | Required existing architecture | Preserves domain ownership, policy and schema evolution |
| MOB-D006 | No direct Neon access and no mobile-owned backend tables | Required | Client-only stream; backend contracts remain module/EXP/platform owned |
| MOB-D007 | Dart Pub Workspace | Proposed | One dependency resolution and analyzable package graph |
| MOB-D008 | Layered MVVM-style UI/data architecture with repositories | Proposed from Flutter guidance | Separation, testability and offline coordination |
| MOB-D009 | Offline allowlist and encrypted scoped stores | Required | Minimization and revocation for child data |
| MOB-D010 | No generic last-write-wins | Required | Attendance, grades, forms and finance need evidence-aware reconciliation |
| MOB-D011 | OAuth/OIDC Authorization Code + PKCE via external browser | Required | Native-app best current practice |
| MOB-D012 | Environment flavors, not role flavors | Proposed | Roles/personas are server session context; environments are build configuration |
| MOB-D013 | Capability-driven navigation | Required existing architecture | Role names alone are insufficient for relationship/class/assurance scopes |
| MOB-D014 | Mobile foundation may run parallel with EXP-01 | Proposed | Safe when limited to contract-independent foundations/fakes |
| MOB-D015 | Domain-integrated features wait for reviewed Wave 3/mobile contracts | Required gate | Prevents speculative API/database coupling |
| MOB-D016 | One whole-module MOB-01 agent for initial implementation | Proposed | Avoid shared Flutter foundation conflicts and duplicated context |
| MOB-D017 | Separate staged store releases for Family and Staff | Proposed | Independent risk, audience and release cadence |
| MOB-D018 | FCM/APNs through backend notification authority | Proposed | Device delivery without putting sensitive content in push payloads |
| MOB-D019 | OWASP MASVS/MASTG mobile verification | Required | Extends platform security baseline to installed clients |
| MOB-D020 | Production/store actions require separate authorization | Required | Documentation and implementation do not authorize release |

## Decisions to finalize before Stage A implementation

1. Minimum supported Flutter/Dart versions and upgrade policy.
2. State management/dependency injection package and exact version.
3. Local relational database/encryption implementation and key-management design.
4. OIDC/AppAuth Flutter package and redirect-link implementation.
5. Generated OpenAPI client tool/generator and output policy.
6. Push provider project/application ownership and privacy configuration.
7. Android/iOS minimum OS versions and approved low-cost device baseline.
8. App names, bundle IDs, icons and internal distribution accounts.
9. Mobile CI runners, signing custody and secret-access roles.
10. Telemetry/crash provider or self-hosted alternative and data-processing review.

These choices must be recorded at MOB-01 Milestone 1 with licence, maintenance, privacy and exit-plan evidence. Architecture documents intentionally avoid hard-coding unreviewed package versions.

## Decisions to finalize before MOB-01 activation

1. Exact reviewed Wave 3/mobile API schema SHA/version.
2. Mobile API composition ownership and deprecation window.
3. Mobile threat model and MASVS profile.
4. Offline resource/field allowlist, authorization lease and retention values.
5. Staff emergency-contact/health indicator minimum dataset.
6. Grade-entry offline/online boundary.
7. Document offline retention and share/open policy.
8. Guardian/student age, consent and direct-service legal settings by launch country.
9. Payment handoff/provider application-link behavior.
10. Client-only stream representation in core execution board/validator.

## Decisions to finalize before pilot/store release

1. Launch country, supported locales and local legal/privacy review.
2. Privacy policy, store data-safety/privacy declarations and age rating.
3. Independent mobile security assessment scope.
4. Crash-free/startup/sync SLOs after baseline measurement.
5. Mandatory versus recommended update policy and emergency block process.
6. Root/jailbreak/device-integrity policy.
7. Certificate pinning decision; default is no pinning without operational justification.
8. Staged rollout cohorts, monitoring thresholds and halt/rollback owner.
9. Support model for lost devices, account recovery, offline conflicts and accessibility.
10. Production signing/upload/store roles and separation of duties.

## Contract inventory required from EXP-01/domain owners

| Journey | Required owner contract |
|---|---|
| Session/persona navigation | Foundation identity/policy + EXP persona composition |
| Guardian household/children | SIS relationship read models + EXP composition |
| Student/teacher timetable | ACAD scheduling queries |
| Attendance view/capture/sync | ACAD attendance query/command/idempotency/conflict contracts |
| Published grades/report cards | ACAD gradebook/records publication models |
| Fees/invoices/receipts/payment | FIN authorized read models and payment intent/handoff |
| Forms/consent | SIS/EXP workflow/form commands and version behavior |
| Messages/announcements | EXP communications contracts |
| Documents | Foundation/EXP document authorization intents |
| Notifications/device tokens | Foundation/EXP notification/device contracts |
| Selected alerts | CARE/ACAD minimized disclosure contracts |
| Reporting totals | EXP governed metric/read-model contracts |

## Change-control rule

A decision becomes `approved` only through a reviewed ADR, contract-change decision or coordinator gate record. Implementation convenience, package defaults or a single agent's assumptions do not change architecture.

For an incompatible change, create a contract-change request containing:

- current decision/contract and exact SHA;
- requested change and business reason;
- alternatives considered;
- affected apps/packages/modules and data migrations;
- security/privacy/offline/release impact;
- compatibility and rollout plan;
- tests/evidence required;
- owner decision.
