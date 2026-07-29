# 10 — Decision Log and Risk Register

## 1. Accepted planning decisions

| ID | Decision | Status |
|---|---|---|
| `MOB-D001` | One Flutter workspace produces two apps: Family and Staff | accepted for review |
| `MOB-D002` | Guardian and student share Family app with separate persona presentation | accepted for review |
| `MOB-D003` | Admin/finance/operations remain web/PWA first | accepted for review |
| `MOB-D004` | Mobile consumes versioned APIs; no direct database access | mandatory |
| `MOB-D005` | Flutter architecture uses View/ViewModel, Repository/Service and optional use-cases | accepted for review |
| `MOB-D006` | Dart Pub Workspaces and one lock file manage the mobile monorepo | accepted for review |
| `MOB-D007` | Roles are runtime persona/capability context, not build flavours | mandatory |
| `MOB-D008` | Offline support is allowlisted per feature; repository is source-of-truth coordinator | mandatory |
| `MOB-D009` | Attendance is the first required offline-write workflow | accepted for review |
| `MOB-D010` | Native OAuth uses external browser Authorization Code + PKCE | mandatory |
| `MOB-D011` | Push payloads contain no sensitive school content | mandatory |
| `MOB-D012` | OWASP MASVS/MASTG is the mobile security baseline | accepted for review |
| `MOB-D013` | Mobile foundation may run in parallel with EXP-01 using reviewed/synthetic contracts | accepted for review |
| `MOB-D014` | Family and Staff streams may run in parallel only after shared foundation freeze | accepted for review |
| `MOB-D015` | Final mobile integration is serial and tied to reviewed platform contracts | mandatory |

Package/provider selections remain adapter-backed and are finalized by `MOB-01` spikes, licence review and measured acceptance. Architecture must not depend on a package's internal types outside its adapter.

## 2. Open decisions before foundation implementation

| ID | Decision needed | Required evidence | Owner |
|---|---|---|---|
| `MOB-O001` | Flutter/Dart supported version policy | current stable support, CI runners, plugin compatibility | MOB-01 |
| `MOB-O002` | State management/DI implementation | testability, disposal/scoping, maintenance, performance | MOB-01 |
| `MOB-O003` | Local encrypted database implementation | encryption, migrations, performance, licences, platform support | MOB-01 |
| `MOB-O004` | OAuth/OIDC client adapter | RFC 8252 compliance, SSO, redirect handling, maintenance | MOB-01/FND |
| `MOB-O005` | Push provider implementation | FCM/APNs support, privacy, delivery telemetry, regional terms | MOB-01/EXP |
| `MOB-O006` | Background-work adapter | Android/iOS constraints, plugin quality, no correctness dependence | MOB-01 |
| `MOB-O007` | Crash/telemetry provider | redaction, consent, data residency, sampling, cost | MOB-01 |
| `MOB-O008` | Minimum OS/device matrix | target market devices, security support, performance benchmarks | Product/MOB-01 |
| `MOB-O009` | App names/bundle IDs/store ownership | brand approval and legal/store accounts | Owner |
| `MOB-O010` | Launch locales | pilot-country and customer validation | Product/INT |

## 3. Risk scoring

Probability and impact use Low/Medium/High/Critical. Critical security/data-integrity risks block release regardless of schedule.

## 4. Architecture and delivery risks

| Risk | Probability | Impact | Mitigation | Gate/owner |
|---|---|---|---|---|
| API churn while EXP-01 evolves | High | High | contract-family gates, generated snapshots, compatibility tests, simulators | EXP/MOB contracts |
| Mobile duplicates domain rules | Medium | Critical | generated APIs, repository boundaries, architecture tests, code review | all gates |
| Shared-package conflicts across agents | High | High | foundation freeze, explicit paths, contract-change requests, serial integration | MOB-01/MOB-INTEG |
| One universal app becomes too complex | Medium | High | two binaries, bounded persona scope, admin web-first | product review |
| Too many independent app codebases | Medium | High | one Pub Workspace and shared core | MOB-01 |
| Package/provider lock-in | Medium | Medium | ports/adapters, licence review, replacement tests | MOB-01 |
| App-store review/release delays | Medium | High | internal tracks/TestFlight, staged rollout, server compatibility | pilot gate |
| Background sync assumed reliable | High | High | foreground/resume correctness, explicit pending state, OS scheduler optional | sync gate |
| Low-end Android performance | High | High | reference device budgets, profiling, bounded payloads/cache | performance gate |

## 5. Security and privacy risks

| Risk | Probability | Impact | Mitigation | Gate/owner |
|---|---|---|---|---|
| Cross-tenant/persona local cache leak | Medium | Critical | encrypted namespaces, context switch teardown, negative tests, wipe | security gate |
| Lost/stolen teacher device | High | Critical | short sessions, device inventory/revocation, encrypted cache, runbook | Staff/pilot |
| Stale guardian authority/teacher assignment | Medium | Critical | server reauthorization, bounded cache TTL, sync revocation/tombstone | contract/sync |
| Sensitive push disclosure | Medium | Critical | opaque payloads, generic preview, server fetch after auth | notification gate |
| OAuth redirect/token interception | Medium | Critical | external browser, PKCE, claimed links, state/nonce validation | auth gate |
| Third-party SDK data collection | Medium | High | default-deny SDK register, consent/data-flow review, SBOM | foundation/pilot |
| Insecure local backup/export | Medium | Critical | platform backup policy, private encrypted files, extraction tests | security gate |
| Logs/crash reports contain school data | Medium | Critical | allowlist telemetry, redaction tests, no payload logging | all releases |
| Rooted/jailbroken device bypass | Medium | High | defense in depth, server controls, risk policy, no sole reliance | security review |
| Shared family device exposes another child | Medium | High | explicit child context, local re-auth policy, safe previews | Family gate |

## 6. Offline/data-integrity risks

| Risk | Probability | Impact | Mitigation | Gate/owner |
|---|---|---|---|---|
| Duplicate attendance after retry | High | Critical | idempotency keys, stable item IDs, server original result | attendance gate |
| Silent overwrite after conflict | Medium | Critical | version preconditions, explicit reconciliation, no generic LWW | sync gate |
| Pending draft lost during upgrade/migration | Medium | High | migration matrix, transactional queue, recovery/export | release gate |
| Clock skew changes records | Medium | High | server authoritative time, client time as observation only | sync gate |
| Cache shown as current | Medium | High | freshness metadata and visible stale state | UI tests |
| Queue grows indefinitely | Medium | Medium | expiry, bounded retries, user/support reconciliation | observability |
| Local database corruption/low storage | Medium | High | integrity checks, cache rebuild, draft recovery, runbook | resilience tests |

## 7. Product risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Staff app expands into full admin ERP | High | High | teacher-first scope and use-case approval for every persona |
| Student experience copies guardian UI | Medium | High | age-appropriate content/design review and separate persona tests |
| Mobile built before real workflow validation | Medium | High | design-partner testing and measured daily tasks |
| Excess notification engagement | Medium | High | preference, urgency classification, quiet hours and no dark patterns |
| Inconsistent web/mobile terminology | Medium | Medium | shared glossary, translation keys and contract vocabulary |

## 8. Operational risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Signing key/certificate expiry | Medium | Critical | managed secrets, alerts, rotation drill and restricted access |
| Push provider outage | Medium | Medium | notification inbox as authority, retry/status, email/SMS alternatives server-side |
| Bad release cannot roll back quickly | Medium | High | phased rollout, feature flags, compatibility window, expedited fix runbook |
| Unsupported app versions fragment API | High | High | support window, telemetry, additive contracts and minimum-version policy |
| Store privacy disclosure mismatch | Medium | Critical | SDK/data-flow inventory and release checklist |

## 9. Revisit triggers

Reopen the architecture decision when:

- a materially different persona requires incompatible security/distribution policy;
- Family or Staff bundle/performance cannot meet targets despite modular loading;
- platform APIs cannot provide bounded mobile read models without a dedicated BFF;
- measured scale requires separate notification/sync infrastructure;
- country/store policy requires a different distribution profile;
- Flutter or a critical plugin cannot meet supported platform/security requirements;
- enterprise customers require managed-device distribution or dedicated app branding.

## 10. Review cadence

The risk register is reviewed at every gate, before each store release, after major dependency/toolchain upgrades and after any security, privacy, sync or production incident. Closed risks retain evidence rather than being deleted.
