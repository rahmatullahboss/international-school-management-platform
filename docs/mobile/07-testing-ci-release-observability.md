# 07 — Testing, CI, Release and Observability

## 1. Quality model

Use a test pyramid with many unit and widget tests, contract tests at every platform boundary, and enough integration/device tests to cover critical journeys. Manual testing supplements but does not replace automation.

All tests use synthetic data. Production student data is prohibited in developer, CI, preview and store-review environments.

## 2. Test layers

### 2.1 Static and architecture checks

- Dart analyzer with strict options;
- formatter and import rules;
- package-boundary checks;
- generated-code drift check;
- dependency/licence/secret scanning;
- localization-key and untranslated-string checks;
- sensitive-log detector;
- platform permission/configuration checks;
- API compatibility check;
- local migration manifest validation.

### 2.2 Unit tests

Cover:

- ViewModels and use-cases;
- repositories with fake services;
- DTO/local/domain mappings;
- capability and route decisions;
- persona/tenant/child context switching;
- sync state machine, retries and backoff;
- conflict classification;
- token/session lifecycle;
- formatting, time-zone and money handling;
- redaction and telemetry policy.

### 2.3 Widget/component tests

Cover every shared and feature state:

- loading, empty, cached, stale and offline;
- unauthorized, masked and not-found-as-denied;
- validation, partial success, conflict and retry;
- long Bangla/English strings, RTL and pseudolocale;
- large text, semantics and focus order;
- phone/tablet widths and orientation;
- reduced motion;
- disabled-action explanation;
- sync and assurance banners.

Golden tests are used selectively for stable design-system surfaces and never as the only accessibility evidence.

### 2.4 Contract tests

Run generated Dart clients against a deterministic mock/contract server and reviewed OpenAPI snapshots. Verify:

- required headers and auth refresh;
- stable errors;
- unknown enum/field tolerance;
- pagination/cursors;
- idempotency and uncertain outcome recovery;
- ETag/version conflicts;
- low-bandwidth response variants;
- document/download authorization;
- notification/deep-link schemas;
- backward compatibility with supported app releases.

### 2.5 Integration tests

Critical journeys include:

- first install, login and logout;
- enterprise SSO redirect and PKCE handling;
- persona switch and cache isolation;
- guardian child switch;
- teacher timetable/roster;
- offline attendance, app termination, resume, duplicate replay and reconciliation;
- notification tap from foreground/background/terminated states;
- token expiry and refresh;
- device/session revocation while app is open;
- relationship/assignment revoked while cached;
- local database migration between supported versions;
- document upload/download and permission expiry;
- forced/recommended upgrade;
- low-storage and interrupted upload.

### 2.6 Security and resilience tests

- MASVS/MASTG mapping;
- API/authorization negative tests;
- local database extraction;
- backup and app-switcher snapshot inspection;
- deep-link/OAuth manipulation;
- TLS interception and redaction;
- rooted/jailbroken-device behavior;
- dependency/SBOM verification;
- tampered queue/duplicate commands;
- clock skew;
- OS kill/background restrictions;
- provider outage and rate limiting.

## 3. Device matrix

The supported matrix is versioned and reviewed at least quarterly. It includes:

- minimum, representative and latest supported Android versions;
- low-memory/low-cost Android reference device;
- representative mid-range Android;
- minimum and latest supported iOS versions;
- small and large phones;
- one representative tablet per platform when tablet support is released;
- Bangla/English and one RTL locale fixture;
- slow network, packet loss and offline profiles.

Unsupported devices receive an explicit store/minimum-version policy rather than undefined behavior.

## 4. CI pipeline

For every pull request:

1. resolve pinned Flutter/Dart toolchain;
2. validate Pub Workspace and lock file;
3. format/analyze/architecture checks;
4. generate and diff API/localization/code artifacts;
5. unit and widget tests with coverage;
6. contract tests;
7. Android debug build;
8. iOS simulator build where runner availability permits;
9. dependency, licence, secret and SBOM checks;
10. upload test reports and reproducible artifacts.

Protected integration/release branches add device tests, release builds, signing checks, store metadata validation, security scans and staged-environment end-to-end tests.

## 5. Branch and release model

- feature/module branches start from an exact reviewed base;
- every stream uses a fixed worktree and owned paths;
- shared foundation changes are frozen after `GATE-MOBILE-FOUNDATION-READY`;
- Family and Staff candidates are reviewed independently;
- `MOB-INTEG` integrates serially and does not redesign domain behavior;
- releases use semantic product version plus monotonically increasing platform build numbers;
- build metadata records Git SHA, OpenAPI SHA, design authority SHA, environment and dependency lock checksum.

## 6. Signing and secrets

Signing identities, certificates, provisioning profiles, keystores and store API credentials live in approved secret systems. CI uses least-privilege short-lived access where possible.

Rules:

- no signing secret in Git or build logs;
- development and production signing are separate;
- release signing access is audited;
- certificate expiry/rotation is monitored;
- compromised signing material has a runbook;
- pull requests from untrusted contexts cannot access release secrets.

## 7. Distribution stages

### Internal

Synthetic tenants, engineering/QA distribution, rapid validation.

### Closed pilot

Named design-partner schools, approved data processing, staged rollout, high-touch support and explicit feature limitations.

### Limited availability

Selected tenants/regions, standard onboarding, published supported-device policy and measured service targets.

### General availability

Requires proven upgrade, incident, backup/recovery, support, privacy, store and release processes.

Use Play Console testing tracks and TestFlight groups before production. Production rollout is phased with stop/rollback criteria.

## 8. Upgrade policy

Maintain a documented supported-version window. Server APIs remain backward compatible within that window.

- recommended upgrade: user may defer;
- required upgrade: only security/incompatible-contract cases;
- minimum version is environment/app-target specific;
- blocked versions receive a safe localized screen and support path;
- pending offline drafts are preserved before upgrade;
- database migrations are tested from every supported source version.

## 9. Observability

Mobile telemetry joins client, API, queue and provider activity through correlation IDs without collecting sensitive payloads.

Core signals:

- crash-free users/sessions;
- ANR/hang rate;
- cold/warm start and first-content time;
- API latency/failure by endpoint template;
- auth refresh and login failure categories;
- sync queue depth, age, conflict and rejection rates;
- notification delivery/open routing failures;
- local migration and cache-wipe outcomes;
- app/version/device/OS distribution;
- accessibility and localization defect trends;
- upload/download failure and retry;
- forced-upgrade exposure.

Do not collect student behavior unrelated to service operation.

## 10. SLO candidates

Pilot SLOs are measured before final targets are approved. Candidate indicators include:

- crash-free session percentage;
- successful authenticated bootstrap;
- attendance draft durability;
- accepted sync within a bounded time after connectivity returns;
- notification deep-link success;
- p95 app bootstrap/API latency on reference devices/networks;
- supportable upgrade adoption;
- zero cross-tenant/persona cache disclosures.

Security and data-integrity invariants are gates, not error-budget trade-offs.

## 11. Incident and rollback

Runbooks cover:

- bad mobile release;
- auth/redirect outage;
- push-provider outage;
- local migration failure;
- sync conflict spike;
- cross-context cache risk;
- lost/stolen staff device;
- signing credential compromise;
- third-party SDK vulnerability;
- unsupported API/minimum-version error.

Mitigations include phased rollout pause, feature flag disable, server compatibility fallback, session/device revocation, remote notification suppression and expedited store release. App-store rollback is not instantaneous, so server-side compatibility and kill switches are mandatory.

## 12. Release evidence

Every release records:

- exact source and contract SHAs;
- dependency lock/SBOM;
- build/signing provenance;
- test and security results;
- supported platform/device matrix;
- migration evidence;
- privacy/store disclosures;
- known risks and mitigations;
- rollout cohort and stop conditions;
- support and incident contacts;
- confirmation of no unauthorized production mutation.
