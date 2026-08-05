# 05 — Authentication, Device Security and Privacy

## 1. Security baseline

The mobile applications use the platform identity and policy layer. OWASP MASVS is the mobile verification baseline; OWASP ASVS remains applicable to the server/API. Security controls are mapped to storage, cryptography, authentication, network, platform interaction, code quality, resilience and privacy.

No mobile control replaces server-side tenant, capability, relationship, assignment, purpose or assurance enforcement.

## 2. Native authentication

Use OAuth 2.0/OIDC Authorization Code flow with PKCE through an external user agent/system browser. Embedded credential webviews, resource-owner password flow and client secrets in the app are prohibited.

The authorization design includes:

- claimed HTTPS/app links where feasible and protected redirect handling;
- exact redirect URI registration;
- state and nonce validation;
- PKCE verifier/challenge;
- short-lived access tokens;
- rotated/revocable refresh tokens according to identity-provider capability;
- audience, issuer and expiry validation;
- logout and global/session-specific revocation;
- enterprise SSO compatibility;
- account-link verification for staff/guardian overlap.

## 3. Token storage

Token material is stored only through platform-protected credential storage such as Android Keystore-backed storage and iOS Keychain-backed storage. Tokens are not stored in logs, preferences, relational cache, crash reports, analytics or clipboard.

The app treats itself as a public client. Public client identifiers are not secrets. Signing keys, service credentials and provider secrets remain server-side.

## 4. Local authentication

Biometric or device-credential prompts may unlock an existing local session or sensitive screen. They do not replace remote authentication, server assurance or authorization.

Policy may require local re-authentication after inactivity, app backgrounding, device lock or access to approved sensitive surfaces. Biometric failure always has a reviewed recovery path that does not weaken identity controls.

## 5. Step-up assurance

Sensitive operations may require AAL2/MFA or recent authentication, including:

- changing high-impact account/security settings;
- viewing or downloading approved highly restricted data;
- initiating refunds or sensitive approvals if ever added;
- device/session revocation affecting other devices;
- protected exports;
- break-glass or emergency access.

The API returns a stable `required_assurance` error and resumable challenge reference. The client must not infer that biometrics automatically satisfy server assurance.

## 6. Device registration and session inventory

Each installation receives a server-issued device record containing minimum operational metadata:

- opaque device ID;
- app target and environment;
- platform and OS family/version;
- app version/build;
- push token reference;
- locale/time zone;
- notification permission state;
- first/last seen;
- trust/management signals where legally and technically appropriate;
- revoked/expired status.

Avoid persistent hardware fingerprinting. Device records exist for session security, notification delivery, support and incident response—not behavioral tracking.

Users can view and revoke active sessions/devices. Staff-device loss has a documented rapid-revocation and cache-wipe path.

## 7. Local data protection

- Structured caches and drafts are encrypted at rest.
- Encryption keys are protected by platform secure storage and scoped to application/installation.
- Sensitive files use application-private storage and explicit expiry.
- OS backup of sensitive app data is disabled or constrained by reviewed platform configuration.
- Clipboard, share sheet, screenshots, app-switcher snapshots and external file opening are restricted per data classification.
- Rooted/jailbroken-device signals may inform risk policy but cannot be the sole security boundary.
- Debug builds and test certificates cannot access production.

## 8. Network security

- TLS is mandatory.
- Platform certificate validation remains enabled.
- No trust-all development code is shipped.
- Requests use bounded timeouts and cancellation.
- Tokens and sensitive headers are redacted.
- Certificate pinning is not assumed by default; adopt only with a rotation and outage strategy after threat-model review.
- Deep links and universal/app links are treated as untrusted input and re-authorized server-side.

## 9. Push privacy

Push providers receive only the minimum delivery metadata. Notification payloads contain an opaque notification ID, safe category and route hint. They do not contain student names, medical information, message text, grades, balances, custody status or other sensitive details.

Opening a notification:

1. establishes/refreshes session;
2. validates app, tenant and active persona;
3. parses and validates the deep link;
4. rechecks capability and relationship;
5. fetches content from the authoritative API;
6. records read/acknowledgement where applicable.

Notification previews use generic wording according to classification and user preference.

## 10. Privacy and third-party SDKs

Third-party SDKs are default-deny. Each dependency records:

- purpose and owner;
- data accessed/collected;
- network destinations and subprocessors;
- consent requirement;
- retention and deletion behavior;
- platform permissions;
- licence and update policy;
- replacement/disable plan.

Advertising SDKs, cross-app tracking, unrelated analytics and training on school data are prohibited. Product analytics is allowlisted, minimized and disabled for sensitive content.

## 11. Platform permissions

Request permissions just in time and only for approved workflows:

- notifications;
- camera for document/QR workflows;
- photo/file selection;
- optional biometrics;
- location only if a later lawful use case passes review.

Contacts, microphone, broad storage, background location, advertising ID and similar permissions are denied unless a separately approved feature proves necessity and lawful basis.

Denial must leave a usable fallback where possible.

## 12. Sensitive data handling

Highly restricted health, safeguarding, custody and counseling data remains denied by default. Mobile display requires:

- explicit persona and purpose;
- minimum necessary fields;
- assurance requirement;
- no broad local persistence;
- read/disclosure audit where applicable;
- screenshot/share/download policy;
- incident and retention behavior.

A broad school-admin role never implies access.

## 13. Logging and observability

Use structured allowlist logging. Allowed examples include event name, app version, platform, anonymous installation reference, endpoint template, duration, result category and correlation ID.

Prohibited examples include tokens, cookies, authorization headers, names, IDs that directly identify children, message bodies, document content, health details, precise balances, passwords and form responses.

Crash reports pass through redaction and sampling. Debug logging is compile-time/environment controlled and cannot be remotely enabled in production without approval and expiry.

## 14. Supply-chain controls

- committed lock file;
- automated dependency and licence scanning;
- SBOM for each release;
- plugin permission/network review;
- provenance/checksum where available;
- no abandoned or unmaintained security-critical dependency without mitigation;
- reviewed upgrades and rollback path;
- generated code and build-tool pinning;
- secret scanning and signed release artifacts.

## 15. Threat scenarios

Minimum threat model covers:

- stolen/lost staff device;
- malicious or shared family device;
- token or redirect interception;
- deep-link manipulation;
- cross-tenant/persona cache leakage;
- stale guardian authority or teacher assignment;
- offline queue tampering/replay;
- insecure backup or exported file;
- push-content disclosure;
- malicious dependency/SDK;
- screenshot/app-switcher leakage;
- rooted/jailbroken device;
- debugging/proxy abuse;
- account linking takeover;
- support access abuse;
- forced-upgrade denial of service.

## 16. Security release evidence

Before pilot:

- MASVS control mapping and applicable MASTG tests;
- server ASVS/API checks;
- authorization and tenant negative tests;
- secure-storage and backup verification;
- deep-link and OAuth review;
- local database extraction test;
- network interception test;
- dependency/SBOM report;
- privacy disclosure and store data-safety forms;
- lost-device and credential-revocation exercise;
- independent penetration test or documented pilot exception approved by the owner.
