# Native Mobile Application Threat Model

- **Status:** Baseline proposed; approval required for `GATE-MOBILE-CONTRACTS-READY`
- **Date:** 2026-07-29
- **Applications:** School Family and School Staff
- **Method:** Asset/trust-boundary and misuse-case review aligned to platform threat modeling, OWASP MASVS/MASTG and RFC 8252

## 1. Scope

This model covers installed Android/iOS applications, their local data, authentication/browser redirects, API traffic, push delivery, deep links, background work, platform plugins, app-store distribution and support/revocation workflows.

It does not replace server/domain threat models. Server-side tenant isolation, RLS, policy, finance, academic history, document and student-support controls remain authoritative.

## 2. Security objectives

1. A mobile client cannot expand a user's server-authorized scope.
2. A lost, stolen, shared or revoked device does not retain standing access to child data.
3. Offline retry cannot duplicate or silently overwrite school records.
4. Authentication credentials and sensitive data do not leak through storage, backup, logs, notifications, links or platform handoff.
5. A malicious/old client cannot bypass publication, finalization, relationship, assurance or version controls.
6. Every sensitive mobile action is attributable through server correlation/audit evidence.
7. Family and Staff app release/signing channels cannot be abused to distribute unauthorized builds.

## 3. Assets

- access/session/refresh credentials and PKCE state;
- device/session registration and push tokens;
- tenant, membership, persona, relationship, class/campus and assurance context;
- student/guardian/staff identifiers and contact information;
- timetable, roster, attendance drafts/results and grade drafts/published results;
- invoices, balances, receipts and payment intents/links;
- forms, consent, messages, notifications and documents;
- minimized emergency/health indicators when approved;
- encrypted local database, outbox and encryption keys;
- app-link/redirect domains and association files;
- app-store accounts, signing/upload credentials and release artifacts;
- logs, crash reports, analytics, support diagnostics and SBOM/provenance.

## 4. Actors

- legitimate guardian, student, teacher and approved staff user;
- school tenant administrator and platform support operator;
- person with temporary physical access to a shared/unlocked device;
- thief holding a lost/stolen device;
- malicious app claiming a redirect/deep link or reading public storage/clipboard;
- network attacker or hostile Wi-Fi;
- compromised dependency/plugin or build runner;
- attacker with stolen credentials/token;
- authorized user attempting excess access to another child/class/tenant;
- outdated or modified client;
- insider with store/signing/support access.

## 5. Trust boundaries

1. User ↔ native application UI.
2. Native app ↔ system browser/identity provider.
3. Native app ↔ operating-system secure storage/local filesystem/database.
4. Native app ↔ Cloudflare API edge.
5. Native app ↔ FCM/APNs and operating-system notification UI.
6. Native app ↔ camera/files/share/external viewer plugins.
7. CI/source repository ↔ signing/store distribution.
8. Mobile telemetry SDK/provider ↔ platform observability.
9. Offline device state ↔ later authenticated synchronization.

## 6. Key misuse cases and controls

| Misuse case | Primary controls | Required evidence |
|---|---|---|
| Embedded login captures credentials | External browser/AppAuth flow; PKCE; no WebView auth | Android/iOS auth tests and code/config review |
| Malicious app intercepts callback | Claimed HTTPS links where feasible; exact redirect allowlist; state/nonce/PKCE | Redirect manipulation tests |
| Token extracted from storage | Keychain/Keystore-backed secure storage; short-lived access token; rotating revocable session | Storage extraction and revocation tests |
| User switches to unauthorized child/persona | Server-provided capabilities/relationships; context-scoped stores; cancel/reset on switch | Negative tenant/persona/child tests |
| Lost device keeps offline roster | Encrypted store; authorization lease; remote revocation; expiry/wipe | Lost-device and lease-expiry rehearsal |
| Backup restores sensitive database/credentials | Backup exclusions/data-protection classes; keys not restorable as usable auth | Android/iOS backup/restore tests |
| Push reveals health/finance/student content | Opaque ID/type payload; generic lock-screen text; fetch after authorization | Payload/privacy review in all app states |
| Deep link reveals restricted record | Opaque identifiers; central allowlisted router; server re-authorization; non-disclosing errors | Expired/denied link tests |
| Duplicate offline attendance | Stable idempotency keys; original result replay; server uniqueness/invariants | Duplicate/reordered batch tests |
| Conflict silently overwrites attendance/grade/form | Version preconditions; explicit conflict UI; no generic last-write-wins | Conflict and finalization tests |
| Revoked user sends queued commands under new context | Queue scoped to tenant/account/persona/device; cancel/quarantine on logout/switch | Revocation/switch with pending outbox tests |
| Device clock extends offline access | Trusted server time reference; conservative rollback handling; lease revalidation | Clock rollback/forward tests |
| Logs/crash analytics leak PII | Allowlisted telemetry; redaction; no bodies/tokens/IDs; synthetic tests | Telemetry capture inspection |
| Screenshot/app switcher leaks staff data | Approved screen privacy controls; generic notifications; short timeout/local lock | Platform-specific manual tests |
| Share/open exports protected file | Classification-aware authorization; short-lived intent; explicit user action; audit | Document handoff tests |
| Malicious/abandoned plugin compromises app | Dependency governance, SBOM, provenance, static/vulnerability/licence review, adapter isolation | CI evidence and periodic review |
| Modified/outdated app bypasses policy | Server-side authorization, minimum/supported version policy, signed stores, integrity signals only as supplemental | Compatibility and tampered-client tests |
| Store/signing account compromised | MFA, least privilege, role separation, managed CI secrets, protected branch/tag and artifact provenance | Access review and release audit |
| Rooted/jailbroken device exposes data | Encryption/minimization/lease primary; risk policy and attestation only if approved | Device-policy tests and support path |
| Network attacker reads/modifies traffic | TLS, platform trust, no cleartext, host/redirect allowlist; pinning only with approved rotation design | Network security tests |
| App caches highly restricted record | Deny-by-default offline classification; repository/store allowlist; cleanup/tombstone | Local inventory and extraction test |

## 7. Family-specific risks

- Shared family devices and saved sessions.
- Guardian relationship/custody changes while offline.
- A guardian viewing another guardian's private contact/payment context.
- Student persona accessing guardian-only finance or consent controls.
- Child-facing notifications revealing sensitive attendance/grade/fee information.
- Direct child account age/consent and recovery rules varying by country.

Controls:

- visible active persona/child;
- short/local app unlock and remote device inventory;
- relationship-scoped server reads and tombstones;
- separate student/guardian navigation and store scopes;
- generic push previews;
- country/legal review before direct student activation.

## 8. Staff-specific risks

- Offline roster/emergency contact on portable devices.
- Teacher assignment changes during the day.
- Unauthorized browsing beyond assigned class.
- Attendance conflicts/finalization and duplicate morning submissions.
- Screenshot/share of roster or selected health indicators.
- Device shared among staff or left unlocked.

Controls:

- shortest practical offline retention and authorization lease;
- assignment-scoped bootstrap and server revalidation;
- no broad directory/cache;
- explicit sync/finalization/conflict states;
- screen/app-switcher protection where justified;
- local re-lock, remote revocation and device policy.

## 9. Privacy and data minimization review

For every offline or telemetry field record:

- business purpose;
- classification;
- app/persona and scope;
- source contract;
- whether local persistence is required;
- encryption/key boundary;
- retention/expiry/wipe triggers;
- backup/export/share behavior;
- log/analytics prohibition;
- legal/country review where relevant.

No field is approved merely because the backend response contains it.

## 10. Security test profiles

### Baseline

- MASVS storage, crypto, auth, network, platform, code and privacy controls applicable to the feature;
- normal non-rooted Android/iOS devices;
- low-cost Android and shared-device scenarios;
- foreground/background/terminated app states;
- supported old/new app versions.

### Elevated staff/offline profile

- local database extraction and backup;
- process kill/reboot during pending commands;
- device clock manipulation;
- revoked assignment/session while offline;
- screenshot/app switcher/share behavior;
- rooted/jailbroken behavior according to approved policy;
- high-volume/large roster and morning retry load.

## 11. Incident scenarios and runbooks

Required runbooks:

- lost/stolen device;
- compromised account/token;
- malicious or leaked mobile build;
- app-link/auth callback takeover;
- sensitive push/log/crash disclosure;
- offline command corruption/duplicate/conflict incident;
- bad local database migration;
- signing/store account compromise;
- vulnerable dependency/plugin;
- backend minimum-version emergency block.

Each runbook defines detection, containment, revocation, evidence, affected-scope query, user/school communication, recovery and post-incident action.

## 12. Residual risks

- Immediate remote wipe cannot be guaranteed while a device is offline; minimization, encryption and lease expiry reduce exposure.
- Root/jailbreak detection is bypassable and may exclude legitimate users; it is supplemental.
- Mobile OS notification and screenshot controls vary; highly sensitive content remains online-only and absent from push.
- A user with legitimate screen access can photograph information; least privilege, short sessions and school policy remain necessary.
- Third-party store/platform/provider behavior changes require continuous review.

## 13. Approval gate

This threat model is approved only when security, platform, product and mobile owners sign off on:

- assets/trust boundaries;
- offline field allowlist and lease periods;
- app-link/auth design;
- local database/encryption/key design;
- notification/document/telemetry policy;
- Family/Staff role and device assumptions;
- MASVS/MASTG verification matrix;
- incident and release-signing controls;
- launch-country child/privacy requirements.

Approval records the exact document SHA and required follow-up tests. Material changes to offline data, identity flow, push content, target roles, analytics or platform plugins require threat-model review.
