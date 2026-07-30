# MOB-01 Accessibility, Localization, and Release Evidence

## Scope

This evidence register tracks the client/native portion of MOB-01 milestone 7. It is intentionally separate from server authorization, notification-provider activation, secure-document exchange activation, and platform presenter approval.

No production deployment, database mutation, provider activation, or real student data is authorized by this document.

## Current source and production-composition tranche

The shared design-system and mobile-core packages now contain:

- an explicit supported-locale policy for English (`en`), Bangla (`bn`), and Arabic (`ar`);
- deterministic English fallback for unsupported locales and first-supported device-locale resolution;
- explicit RTL direction for Arabic and LTR direction for English and Bangla;
- localized non-authority-bearing shell labels for Family and Staff navigation and account actions;
- bounded Widgets, Material, and Cupertino delegates that prevent unsupported-locale failure while framework control labels remain English until reviewed global translations are adopted;
- a presentation-only locale controller and localized Material application composition that cannot alter account, tenant, campus, persona, capability, student, or server authority;
- integer cardinal plural categories for approved English, Bangla, and Arabic presentation copy;
- bidirectional-control sanitization plus first-strong isolation for dynamic identifiers and user-controlled text;
- exact integer minor-unit money presentation with English, Bangla, and Arabic digits/separators without floating-point conversion or client-side financial calculation;
- timestamp presentation from an authoritative UTC instant, explicit whole-minute offset, and server-provided timezone identifier without device-timezone inference;
- accessibility targets of 200% text scaling and a minimum 48 logical-pixel interactive extent;
- presentation-only preferences for bold text, high contrast, and reduced motion;
- a platform-neutral privacy lifecycle policy covering backgrounding, process detachment, memory pressure, stale authorization, restricted-content obscuring, restricted-presentation cancellation, and transient-byte purge decisions.

The Family and Staff production compositions now adopt:

- the approved locale list, ordered device-locale resolution, localized generated app titles, and bounded localization delegates for configuration, access-gate, and authorized application states;
- localized capability-scoped navigation and sign-out/profile actions without changing route or authorization decisions;
- RTL-safe isolation for Family student/profile, timetable, result, invoice, receipt, and failure-reason text;
- exact integer minor-unit money formatting in the Family fees/receipts read journey, preserving the existing two-fraction-digit contract until authoritative currency metadata is added to the server read model.

The source gates verify:

- locale resolution, ordered device-locale preference, explicit locale preference, and fallback;
- Bangla and Arabic shell-copy availability;
- Arabic RTL reading direction through the configured localization runtime;
- English, Bangla, and Arabic integer cardinal plural categories;
- a five-destination adaptive mobile scaffold at 200% text scaling;
- written security/status semantics that are discoverable without color-only meaning;
- minimum interactive control dimensions;
- bidi override/isolate removal and safe re-isolation;
- exact money and explicit-offset timestamp rendering in English, Bangla, and Arabic;
- reduced-motion preference behavior without changing authorization or security decisions;
- background, process-death, memory-pressure, stale-proof, and fresh-proof lifecycle decisions with redacted reason codes only.

These checks do not mean the production applications are fully translated or device certified. Family and Staff now adopt the localization runtime and translated shell labels, but complete domain copy, reviewed global framework translations, persisted locale-selection UX, authoritative currency fraction metadata, pluralized domain sentences, and representative TalkBack/VoiceOver/device journeys remain incomplete. The lifecycle contract is platform-neutral source evidence; Android/iOS hosts still need to connect actual lifecycle and privacy-overlay signals through approved native integration tests.

## Evidence matrix

| Area | Source evidence | Device/platform evidence | Status |
| --- | --- | --- | --- |
| Written status, not color-only | `SchoolStatusBanner` semantics and widget tests | TalkBack and VoiceOver passes | Source gate present; device pass pending |
| 200% text scaling | Adaptive scaffold widget test with five destinations | Representative small/large Android and iOS devices | Source gate present; device pass pending |
| Interactive target size | Theme and widget size assertion at 48 logical pixels | Touch and switch-control validation | Source gate present; device pass pending |
| RTL direction | Arabic locale runtime, production delegates, and RTL widget tests | Android/iOS Arabic device locale journeys | Production composition present; device pass pending |
| Bangla/Arabic shell copy | Shared catalog plus Family/Staff production navigation adoption | Android/iOS translated-copy review | Production shell adoption present; full domain translation pending |
| English fallback | Unsupported-locale and ordered-device-locale tests | Device locale fallback review | Source gate present; device pass pending |
| Locale preference | Approved-locale controller and rejection tests | Persisted in-app locale-selection journey | Source controller present; UX/persistence pending |
| Framework localization fallback | Bounded Material/Cupertino delegates for `en`/`bn`/`ar` | Reviewed translated framework controls | English fallback present; translated global delegates pending |
| Plural categories | Integer cardinal category tests for English, Bangla, and Arabic | Reviewed translated pluralized domain copy | Source rules present; domain copy adoption pending |
| Bidirectional isolation | Control-character sanitization and Family production identifier isolation | Representative mixed-script content review | Production Family adoption present; broader/device pass pending |
| Exact money presentation | Integer minor-unit formatter and Family fees/receipts adoption | Screen-reader and visual review for supported currencies | Family production adoption present; authoritative currency metadata/device review pending |
| Date/time presentation | UTC instant plus explicit offset/timezone formatter tests | DST/locale/device review from authoritative read models | Source gate present; production adoption pending |
| Screen-reader navigation | Written semantics available in shared components | TalkBack traversal and VoiceOver rotor order | Pending |
| Dynamic type | 200% source test | iOS Larger Accessibility Sizes | Pending |
| Keyboard/switch access | Material focus behavior only | Android switch access and iOS switch control | Pending |
| Reduced motion | Presentation preference zeroes nonessential durations | Android/iOS platform setting verification | Source policy present; device pass pending |
| Contrast | High-contrast preference available; approved design palette | Automated and device contrast evidence | Source policy present; device pass pending |
| Background/privacy lifecycle | Fail-closed lifecycle decision tests | Android/iOS background, process death, memory pressure and recent-task/app-switcher tests | Source policy present; native wiring pending |
| Native document presentation | Presenter interface only | Secure viewer accessibility and privacy review | Blocked on platform owner |
| Android integration | Source/widget/lifecycle tests and debug APK build | Emulator/device integration tests | Pending |
| iOS integration | Static native project and lifecycle-policy checks | Simulator/device integration tests | Pending |
| Store release | Debug artifacts only | Signed release, provenance, declarations, rollback | Pending |

## Critical journey checklist

Each journey must be exercised in English, Bangla, and Arabic where translated copy exists, at normal and 200% text scale, with a screen reader enabled:

### Family

- Sign in, access selection, safe failure, and sign out.
- Student/profile switch without silent tenant, campus, or persona change.
- Timetable, attendance, published results, fees/receipts, and messages.
- Documents, forms, guardian consent, and conversations.
- Step-up verification and restricted-document open/cleanup states.
- Offline, stale response, unavailable service, and expired authorization states.
- Background/resume, process death, memory pressure, and transient-byte cleanup.

### Staff

- Sign in, access selection, safe failure, and sign out.
- Today and assigned roster navigation.
- Attendance draft edit, encrypted save, retry, duplicate, conflict, rejection, and reconciliation.
- Grade draft and message capability gating.
- Notification launch/runtime routing without scope switching.
- Background/resume, process death, memory pressure, and encrypted-draft recovery.

## Screen-reader acceptance criteria

- Every actionable icon has an accessible name and an announced disabled state when unavailable.
- Page and section titles are discoverable in a logical reading order.
- Status changes are written and announced without exposing tokens, paths, digests, ciphertext, raw URLs, or hidden stale values.
- Tables, counts, money, grades, attendance states, and timestamps have unambiguous spoken labels.
- A screen reader cannot activate a route or command that the visible capability/session does not permit.
- Focus returns to a predictable control after dialogs, errors, secure presentation, and scope changes.
- Restricted-document cleanup and failure states are announced without announcing the temporary path or integrity digest.

## Localization acceptance criteria

- Locale changes affect presentation only and never infer account, tenant, campus, persona, capability, student, or server authority.
- Unsupported locale fallback is deterministic and visible.
- Bidirectional strings isolate identifiers, dates, amounts, codes, and user-provided content.
- Exact money remains integer minor-unit data; locale formatting is presentation-only.
- Dates and times preserve the authoritative UTC instant, explicit offset, and timezone identifier without device inference.
- Plurals do not rely on English-only `(s)` suffixes in completed production copy.
- Truncation never removes status, error, consent, security, or irreversible-action meaning.
- Translation files contain no secrets, endpoints with credentials, real student data, or production provider values.
- English framework-label fallback must remain visibly documented until reviewed Material/Cupertino translations replace it.

## Android/iOS integration evidence required

- Cold start, warm start, background/resume, process death, and account removal.
- Notification opened from terminated, background, and foreground states.
- Encrypted sync recovery after interruption and key rotation.
- Restricted-document exchange interruption, oversized response, digest failure, presentation failure, and guaranteed cleanup.
- Android TalkBack, font size/display size, RTL, switch access, backup-disabled behavior, cleartext rejection, and recent-task privacy.
- iOS VoiceOver, Dynamic Type accessibility sizes, RTL, switch control, Keychain lifecycle, file protection, and app-switcher privacy.
- Actual lifecycle-signal wiring must obscure restricted content, cancel restricted presentation when required, purge transient bytes, and require a fresh proof after process detachment or stale authorization.
- Low-storage and network-transition behavior without plaintext fallback.

## Store-release evidence required

- Signed Android App Bundle and iOS archive from reviewed source.
- Release-signing separation from debug credentials.
- Build provenance, dependency inventory, license review, and reproducible version metadata.
- Android Data safety and iOS privacy manifest/declarations matched to actual behavior.
- Permission strings and store descriptions reviewed for Family and Staff separately.
- No Firebase/APNs credentials, OIDC secrets, storage credentials, or real student data in source or artifacts.
- Staged rollout, crash-free baseline, security rollback, token/provider revocation, and release retirement plan.

## Remaining implementation boundary

The localization runtime and production shell composition are now adopted. The following remain incomplete and release blocking:

- reviewed global Material/Cupertino translations, complete domain translation, pluralized domain copy, and persisted locale-selection UX;
- authoritative currency fraction metadata and broader exact-money adoption across relevant read models;
- production adoption of explicit-offset timestamp presentation;
- broader bidi-isolation adoption where additional server/user-controlled mixed-script values are introduced;
- native Android/iOS wiring of lifecycle privacy decisions and device-level verification;
- device-level TalkBack, VoiceOver, Dynamic Type, switch-control, contrast, and reduced-motion evidence;
- Android/iOS integration tests;
- approved native restricted-document presenters;
- signed store-release artifacts and declarations;
- server/platform activation and live policy evidence.
