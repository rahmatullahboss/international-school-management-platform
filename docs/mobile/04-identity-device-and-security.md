# 04 — Identity, Device and Mobile Security

## 1. Security baseline

The mobile security baseline extends the platform's OWASP ASVS-oriented controls with OWASP MASVS/MASTG verification for Android and iOS. Because the applications process children's data, ordinary mobile convenience must not override least privilege, minimization, revocation or evidence preservation.

A mobile threat model and local-data inventory are mandatory before MOB-01 feature activation.

## 2. Threats in scope

- lost, stolen, shared, rooted or jailbroken devices;
- credential phishing and embedded-WebView credential capture;
- token theft, replay and session fixation;
- malicious deep links or app-link interception;
- unauthorized persona/child/tenant switching;
- cached student, finance or health data remaining after access ends;
- backup, screenshot, clipboard, logs, crash reports or notification leakage;
- insecure local database or exported files;
- man-in-the-middle and endpoint impersonation;
- malicious/compromised dependencies and platform plugins;
- forged or duplicated offline commands;
- device clock manipulation;
- excessive push payloads and notification previews;
- app downgrade or unsupported-version use;
- reverse engineering of secrets placed in the binary.

## 3. Authentication

Use OAuth 2.0/OIDC Authorization Code flow with PKCE for public native clients.

Requirements:

- use the system browser or a secure platform browser tab;
- do not use an embedded WebView for authentication;
- use claimed HTTPS universal/app links when feasible, with exact redirect registration;
- private-use URI schemes require reverse-domain naming and collision testing;
- no client secret is treated as confidential inside the app;
- state, nonce and PKCE verifier are generated securely and validated;
- tokens are issued for the mobile client and appropriate tenant/session context;
- MFA/passkey/SSO policy remains owned by the identity platform;
- sensitive actions can trigger step-up authentication without losing safe draft state.

## 4. Session model

The app maintains a server-recognized session and device record with:

- device/session ID;
- account and tenant membership;
- available/active persona;
- assurance level and authentication time;
- app/platform/build version;
- push token references;
- created, last-used, expiry and revocation timestamps;
- device label supplied by the OS/user, with no invasive fingerprinting;
- security posture/attestation result only when approved and necessary.

Access tokens are short-lived. Refresh/session credentials are rotating and revocable. Reuse or theft signals revoke the session family according to identity-provider policy.

## 5. Secure storage

- Keychain/Keystore-backed storage holds refresh/session credentials and local encryption-key references.
- Access tokens are retained in memory where practical and never logged.
- Sensitive database encryption keys are separated from database files.
- Secrets are never stored in source, assets, remote config, analytics, preferences or plain SQLite.
- Biometric/local PIN unlock gates access to stored credentials; it is not a replacement for server authentication.
- Device credential changes and biometric enrollment changes follow platform risk policy.

## 6. Local data classes

| Class | Example | Default mobile rule |
|---|---|---|
| Public | public-safe branding/help | cacheable with integrity/freshness |
| Internal | general school announcement | authenticated, bounded retention |
| Confidential | timetable, attendance, grades, invoices | encrypted, tenant/persona scoped, allowlisted |
| Highly restricted | health, custody, safeguarding, national ID | online-only by default; explicit exception and read evidence |
| Regulated financial | payment/receipt evidence | minimal display cache; execution online-only |
| Credential/secret | tokens, keys | secure storage only; never general database/log |

Every field/resource approved for offline use records classification, retention, wipe trigger, backup rule and export behavior.

## 7. Device revocation and wipe

Triggers include:

- user logout;
- remote session/device revocation;
- membership/persona/guardian authority removal;
- tenant suspension;
- app integrity/security policy failure where approved;
- refresh-token invalidation;
- maximum offline authorization period exceeded;
- app reinstall or encryption-key loss.

On trigger, the app:

1. prevents further protected UI access;
2. cancels requests/background jobs;
3. clears tokens and device keys;
4. closes and securely removes scoped stores/downloads;
5. discards or quarantines unsent drafts according to policy;
6. records privacy-safe local diagnostics;
7. requires fresh authentication and bootstrap.

An offline device cannot receive immediate revocation. Therefore every offline dataset has an authorization lease/expiry after which protected data and commands are unavailable until online revalidation.

## 8. Backup and restore

- Sensitive databases, tokens, caches, notification data and downloaded documents are excluded from unapproved backups.
- Android backup rules and iOS data-protection/backup classes are explicitly configured and tested.
- Restoring the app to another device never restores usable authentication credentials or local encryption keys without fresh authorization.
- User-visible export is a server-authorized domain workflow, not a filesystem backup feature.

## 9. Network security

- TLS for all connections; cleartext disabled.
- Standard platform trust validation is required.
- Certificate pinning is not adopted by default because unsafe rotation can create outages; any L2/high-risk pinning decision requires documented rotation, backup pins and kill-switch strategy.
- Host allowlists, redirect validation and no arbitrary URL fetch from untrusted content.
- Sensitive responses use restrictive cache headers at the backend.
- Retry logic distinguishes safe/idempotent operations and respects rate limits.
- Device/network connectivity is a hint, never proof that a request succeeded or failed.

## 10. App links and deep links

- All routes are versioned and parsed through a single allowlisted router.
- Opaque IDs only; no names, balances, health details or tokens in links.
- Every deep link re-checks session, tenant, persona, capability, relationship and resource authorization.
- Denied/expired links use non-disclosing outcomes.
- Universal/app-link domain association files are release-tested.
- Authentication callbacks and ordinary content links use separate exact route policies.

## 11. Push security

- Push tokens are device/application identifiers, not authorization.
- Token registration and rotation are authenticated and auditable.
- Payloads contain no sensitive record content.
- Lock-screen previews use generic text for confidential workflows.
- Opening a notification fetches current authorized content.
- Foreground, background and terminated flows are tested.
- A revoked device cannot use an old push to recover data.
- Topics are not used for confidential tenant/class/student targeting unless the backend can prove isolation and lifecycle safety; per-device/user fan-out is preferred.

## 12. Platform privacy controls

- Sensitive staff screens use screenshot/app-switcher obscuring where justified and supported.
- Clipboard copy is minimized and cleared only when platform-safe; never rely on clipboard secrecy.
- Download/share actions are permission- and classification-aware.
- External browser/file-viewer handoff is explicit and auditable where required.
- Camera/photo-library permissions are requested just in time and only for approved workflows.
- No advertising SDK, cross-app tracking or sale/reuse of child data.
- Analytics uses pseudonymous identifiers, coarse device attributes and allowlisted events.

## 13. Logging and crash reporting

Allowed examples:

- app version, platform version and environment;
- module/route identifier;
- opaque correlation ID;
- stable error code;
- sync queue counts and age buckets;
- performance timings;
- pseudonymous tenant/deployment profile when approved.

Prohibited examples:

- access/refresh tokens, cookies or PKCE values;
- names, emails, phone numbers or addresses;
- message/form content;
- health, custody or safeguarding details;
- raw student/class identifiers in exported telemetry;
- invoice/payment details or document URLs;
- request/response bodies by default.

Redaction tests run in CI and staging.

## 14. Dependency and supply-chain security

- packages/plugins require licence, maintenance and privacy review;
- native binaries and transitive dependencies are included in SBOM/provenance;
- lockfile changes are reviewed;
- secret, dependency and static analysis run in CI;
- release artifacts are reproducibly associated with Git SHA, schema version and CI run;
- Android signing and Apple distribution credentials are kept in managed CI secrets with least privilege;
- store accounts require MFA and role separation;
- release signing and upload permissions are audited.

## 15. Root/jailbreak and attestation policy

Detection is imperfect and can harm accessibility or legitimate devices. The default policy is:

- do not treat device integrity as the sole authorization control;
- collect no integrity signal without privacy review;
- use risk-based restrictions only for high-risk staff/offline workflows when commercially and legally justified;
- provide a support path and avoid disclosing detection techniques;
- keep server-side revocation, short leases, minimization and encryption as primary controls.

## 16. Security verification gate

Before pilot release:

- mobile threat model approved;
- MASVS checklist mapped to tests/evidence;
- auth/PKCE and redirect review passed;
- local-storage extraction and backup tests passed;
- device revocation/offline lease tests passed;
- deep-link and notification authorization tests passed;
- log/crash/analytics PII review passed;
- dependency/SBOM/licence/provenance gates passed;
- Android/iOS security configuration reviewed;
- independent penetration test or approved pilot-level assessment completed;
- lost/stolen device and compromised account runbooks rehearsed.
