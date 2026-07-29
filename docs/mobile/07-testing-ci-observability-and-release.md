# 07 — Testing, CI, Observability and Release

## 1. Quality principle

Mobile quality gates are part of every vertical slice. The release process must prove behavior on real Android/iOS environments, not only Dart unit tests or emulator screenshots.

## 2. Test layers

### Static and architecture

- `dart format` and analysis/lints;
- package-boundary and circular-dependency checks;
- generated-file drift detection;
- localization key and unused-resource validation;
- design-token/raw-color detector;
- dependency, licence, secret and vulnerability scanning;
- SBOM/provenance generation;
- native Android/iOS configuration checks.

### Unit tests

Every service, repository, mapper, view model/controller, sync state machine, retry policy, conflict resolver and security-context transition has focused tests using fakes.

### Widget tests

Cover:

- views and components;
- dependency composition and routing guards;
- loading, stale, offline, denied, masked, read-only, partial-success and conflict states;
- text scaling, RTL, Bangla/long content and semantics;
- duplicate-tap prevention and preserved input;
- persona/child/class context visibility.

### Contract tests

- generated client matches reviewed OpenAPI;
- stable error-code mapping;
- idempotency, pagination, concurrency and version policy;
- notification/deep-link payload schema;
- sync pull/push partial-result handling;
- old/new supported app compatibility;
- synthetic backend fixtures match server behavior.

### Integration/device tests

Use Flutter `integration_test` for app-level journeys and a native-capable test framework where platform dialogs, notifications, app links, biometrics or background behavior must be exercised.

Critical journeys:

1. system-browser login with PKCE;
2. logout and remote device revocation;
3. tenant/persona switch and state isolation;
4. guardian child switch and authorization;
5. teacher attendance online;
6. teacher attendance offline, duplicate replay and conflict;
7. background/terminated notification deep link;
8. document upload/download authorization;
9. session expiry and step-up with draft preservation;
10. local database migration across supported versions;
11. unsupported/minimum app version behavior;
12. accessibility and localization smoke on both platforms.

### Security tests

Map OWASP MASVS/MASTG controls to automated/manual evidence:

- local storage extraction and backup leakage;
- token/key/log/crash/analytics leakage;
- TLS/endpoint validation;
- WebView-login prohibition;
- redirect/deep-link interception and manipulation;
- screenshot/app-switcher/clipboard behavior where applicable;
- device revocation and offline lease expiration;
- dependency/plugin and release-signing review;
- rooted/jailbroken device behavior according to approved policy;
- notification content privacy.

### Performance and reliability

Measure on representative low-cost Android, current Android/iOS and at least one tablet/large-screen profile:

- cold/warm start;
- frame/render stability and input responsiveness;
- memory and battery/network use;
- large roster/list bounds;
- local database and migration time;
- sync throughput, backlog and recovery;
- image/document cache size;
- application binary size;
- crash-free sessions and ANR/hang rate.

## 3. CI pipeline

Recommended jobs:

1. documentation and architecture validation;
2. format/analyze/boundary checks;
3. unit and widget tests with coverage;
4. generated API client verification;
5. localization/design-system checks;
6. Android debug/profile build and tests;
7. iOS simulator build and tests on macOS runner;
8. integration/device tests against synthetic staging;
9. dependency/licence/SBOM/provenance/security checks;
10. signed release-candidate build after protected approval;
11. artifact retention with Git SHA, schema SHA and environment metadata.

Pull requests do not receive production credentials. Fork/untrusted workflows cannot access signing or staging secrets.

## 4. Branch and release policy

- feature work occurs only in the stream-owned branch/worktree;
- the mobile stream starts from an exact reviewed base;
- checkpoint commits correspond to coherent milestones and evidence;
- release tags are created from reviewed integration commits, never arbitrary developer heads;
- Family and Staff have independent version/build numbers and staged rollout;
- emergency fixes still pass minimum security, contract and smoke gates;
- no force-push/rewrite of reviewed release history;
- store submission and production backend enablement require separate authorization.

## 5. Environments

### Development

- local/fake services and synthetic data;
- no production credentials or customer data;
- debug telemetry only with privacy-safe payloads.

### Shared integration

- reviewed synthetic backend contracts;
- device/emulator tests;
- destructive reset permitted only through approved scripts.

### Staging

- regional production-shaped configuration;
- synthetic or separately approved pilot data;
- push, app links, auth and store/internal-test distribution;
- security/performance/recovery evidence.

### Production

- exact approved API origin, identity client, push project and links;
- managed signing/upload credentials;
- staged rollout and kill/disable controls;
- no debug endpoints or verbose payload logging.

## 6. Observability

Mobile signals include:

- app version/build/platform/environment;
- startup, route and API latency;
- stable error codes and correlation IDs;
- crash, hang and ANR indicators;
- sync queue length/age/outcomes;
- notification registration/delivery/open outcome;
- local migration result;
- device/session revocation outcome;
- dependency/release metadata.

Dimensions are minimized and pseudonymous. Student/guardian names, message/form content, tokens, document URLs, health details and raw finance data are prohibited.

## 7. Initial mobile objectives

Engineering targets, not contractual commitments until measured:

- core cached shell remains usable during ordinary network loss;
- attendance local save completes promptly for normal class size;
- normal attendance batch is accepted within the platform target when online;
- no duplicate logical attendance record after repeated retry;
- critical push is registered/handled across foreground/background/terminated states;
- supported upgrades preserve authorized pending drafts/commands;
- release candidate is crash-free in synthetic pilot journeys;
- app remains responsive on the approved low-cost Android baseline.

Exact numeric mobile startup, crash-free and sync SLOs are set after instrumented baseline tests.

## 8. Alerts and support diagnostics

Actionable alerts/tickets:

- crash/hang regression by version;
- authentication callback or app-link failure;
- push-token registration/delivery degradation;
- unsupported API/client-version spike;
- sync backlog/conflict/retry growth;
- local migration failure;
- tenant/persona isolation anomaly;
- sensitive telemetry/redaction failure;
- release-signing/store pipeline failure.

Support diagnostics expose only approved metadata, correlation IDs and state summaries. They do not export the local database or sensitive payloads.

## 9. Runbooks

Required before pilot:

- login/SSO/app-link failure;
- lost or stolen device;
- compromised account/session revocation;
- push outage or token invalidation;
- offline attendance conflict/backlog;
- bad app release and staged rollback/halt;
- backend contract incompatibility;
- local database migration failure;
- sensitive telemetry or notification incident;
- store rejection/privacy declaration correction;
- certificate/signing/key rotation;
- minimum-version security block.

## 10. Store-release checklist

For each application/platform:

- reviewed product name, bundle ID, icon and screenshots using synthetic data;
- privacy policy/support contact and accurate store data declarations;
- child/family audience and age-rating review;
- permissions justified and requested just in time;
- no advertising/tracking SDK;
- export/encryption declarations reviewed;
- universal/app links verified;
- production auth redirect and push configuration verified;
- signing/upload roles and MFA reviewed;
- release notes/localizations approved;
- security/accessibility/performance evidence attached;
- staged rollout, monitoring and rollback/kill plan approved.

## 11. Definition of done

A mobile feature/release is complete only when:

- reviewed server contract exists;
- authorization/data classification/offline policy is documented;
- implementation follows package boundaries;
- unit, widget, contract and critical device tests pass;
- accessibility/localization/adaptive states pass;
- telemetry is privacy-safe and supportable;
- security controls and dependency evidence pass;
- runbook/release documentation is updated;
- exact Git/API schema/app build evidence is recorded;
- no unauthorized production mutation or real-data use occurred.
