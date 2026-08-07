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
- approved Widgets localization plus Flutter 3.44.7 global Material and Cupertino delegates providing reviewed framework translations for English, Bangla, and Arabic;
- a presentation-only locale controller and localized Material application composition that cannot alter account, tenant, campus, persona, capability, student, or server authority;
- a locale-preference store that persists only an approved language code in application-separated secure-storage keys;
- fail-safe locale restoration that clears invalid values, follows device preference after read failure, preserves the current locale after write failure, and exposes redacted reason codes only;
- an accessible 56 logical-pixel language control that cycles device preference, English, Bangla, and Arabic without opening or authorizing a route;
- state-preserving locale recomposition so changing language does not recreate the authorized application coordinator or page state;
- integer cardinal plural categories and reviewed count sentences for approved English, Bangla, and Arabic presentation copy;
- bidirectional-control sanitization plus first-strong isolation for dynamic identifiers and user-controlled text;
- exact integer minor-unit money presentation with English, Bangla, and Arabic digits/separators without floating-point conversion or client-side financial calculation;
- timestamp presentation from an authoritative UTC instant, explicit whole-minute offset, and server-provided timezone identifier without device-timezone inference;
- accessibility targets of 200% text scaling and a minimum 48 logical-pixel interactive extent;
- presentation-only preferences for bold text, high contrast, and reduced motion;
- a platform-neutral privacy lifecycle policy covering backgrounding, process detachment, memory pressure, stale authorization, restricted-content obscuring, restricted-presentation cancellation, and transient-byte purge decisions;
- production `MobileAppCoordinator` wiring from real Flutter lifecycle signals to restricted-content obscuring and OIDC restore/refresh before bootstrap capability state returns on resume;
- native privacy composition with Android `FLAG_SECURE` on both application windows and iOS inactive/app-switcher covers on both SceneDelegates, guarded against source drift.

The Family and Staff production compositions now adopt:

- the approved locale list, ordered device-locale resolution, localized generated app titles, and bounded localization delegates for configuration, access-gate, and authorized application states;
- application-separated secure locale preferences loaded before production application composition;
- the accessible language cycle control without writing tenant, campus, persona, capability, student, token, endpoint, or other authority-bearing values;
- localized capability-scoped navigation and sign-out/profile actions without changing route or authorization decisions;
- RTL-safe isolation for Family student/profile, timetable, result, invoice, receipt, and failure-reason text;
- exact integer minor-unit money formatting in the Family fees/receipts read journey, preserving the existing two-fraction-digit contract until authoritative currency metadata is added to the server read model;
- explicit UTC presentation for Family interaction dates/timestamps while authoritative school offset/timezone metadata is absent; device timezone is never inferred for those server instants;
- reviewed English/Bangla/Arabic domain copy for Family production status/Home/Attendance/Results/Fees/Messages plus Services/Documents/Forms/Guardian Consent/Conversations/Messages, and Staff shell/Today/roster/attendance/sync-journal states;
- reviewed pluralized count sentences on completed Family and Staff production surfaces instead of English `(s)` placeholders;
- bidi isolation for localized Staff teacher, subject, section, room, student and operation identifiers plus Family interaction student/document/form/consent/conversation/message dynamic values; Staff Gradebook/Messages show localized fail-closed server-boundary states instead of fixture data while authoritative read models are unavailable.

The source gates verify:

- locale resolution, ordered device-locale preference, persisted approved locale preference, and fallback;
- invalid preference clearing, read-failure fallback, write-failure rollback, and reason-code-only diagnostics;
- Bangla and Arabic shell-copy availability;
- Arabic RTL reading direction through the configured localization runtime;
- state preservation while the shared Material localization changes;
- the language control's written semantics, enabled state, displayed value, and minimum interactive size;
- English, Bangla, and Arabic integer cardinal categories and localized digits in reviewed count sentences;
- a five-destination adaptive mobile scaffold at 200% text scaling;
- written security/status semantics that are discoverable without color-only meaning;
- minimum interactive control dimensions;
- bidi override/isolate removal and safe re-isolation;
- exact money and explicit-offset timestamp rendering in English, Bangla, and Arabic;
- Family interaction UTC fallback converts current server instants with `toUtc()`, labels `UTC`, and source-level tests reject any return of `toLocal()`;
- reduced-motion preference behavior without changing authorization or security decisions;
- background, process-death, memory-pressure, stale-proof, and fresh-proof lifecycle decisions with redacted reason codes only;
- real Flutter lifecycle propagation into the shared coordinator, background/detach obscuring, resumed OIDC restore/refresh, AppAuth inactive continuity, and nonblocking memory pressure;
- non-default Bangla/Arabic Material/Cupertino framework-localization implementations while preserving the explicit School reading direction.

These checks do not mean the production applications are fully translated or device certified. Family and Staff now adopt secure persisted locale selection, reviewed global framework translations, translated shell labels, Family core read and interaction/document/form/consent/conversation copy, Staff teacher/sync-domain copy, and localized fail-closed Staff Gradebook/Messages server-boundary states. Any remaining untranslated domain surfaces, authoritative Staff assessment/conversation read models, authoritative currency fraction metadata, and representative TalkBack/VoiceOver/device journeys remain incomplete. Family interaction timestamps now use an explicit UTC fallback rather than device timezone inference; school-local presentation remains blocked on authoritative offset/timezone metadata. Flutter lifecycle signals are wired into the shared coordinator, Android windows now use `FLAG_SECURE`, and iOS SceneDelegates now install inactive/app-switcher privacy covers. Device verification plus restricted-document presenter cancellation/transient-byte cleanup evidence remain pending.

## Evidence matrix

| Area | Source evidence | Device/platform evidence | Status |
| --- | --- | --- | --- |
| Written status, not color-only | `SchoolStatusBanner` semantics and widget tests | TalkBack and VoiceOver passes | Source gate present; device pass pending |
| 200% text scaling | Adaptive scaffold widget test with five destinations | Representative small/large Android and iOS devices | Source gate present; device pass pending |
| Interactive target size | Theme assertions plus 56-pixel language-control test | Touch and switch-control validation | Source gate present; device pass pending |
| RTL direction | Arabic locale runtime, production delegates, and RTL widget tests | Android/iOS Arabic device locale journeys | Production composition present; device pass pending |
| Bangla/Arabic production copy | Shared shell catalog plus Family read/interaction, Staff teacher/sync and Staff server-boundary app-owned catalogs | Android/iOS translated-copy review | Family read/interaction and Staff teacher/sync/server-boundary production adoption present; remaining domains pending |
| English fallback | Unsupported-locale and ordered-device-locale tests | Device locale fallback review | Source gate present; device pass pending |
| Locale preference | Secure approved-code storage, invalid/read/write recovery, live recomposition, and separate Family/Staff keys | Cold restart, backup/restore, account removal, and platform secure-storage review | Production persistence present; device evidence pending |
| Framework localization | Flutter 3.44.7 global Material/Cupertino delegates for `en`/`bn`/`ar` with widget verification | Android/iOS translated framework-control review | Global translated delegates adopted; device review pending |
| Pluralized counts | Integer cardinal tests and reviewed `en`/`bn`/`ar` count catalogs used by Family read/interaction and Staff teacher/sync production surfaces | Screen-reader and translation review | Completed production surfaces no longer use English `(s)` placeholders where count copy is adopted; remaining domains pending |
| Bidirectional isolation | Control-character sanitization plus Family and Staff production dynamic-identifier isolation | Representative mixed-script content review | Core Family/Staff production adoption present; broader/device pass pending |
| Exact money presentation | Integer minor-unit formatter and Family fees/receipts adoption | Screen-reader and visual review for supported currencies | Family production adoption present; authoritative currency metadata/device review pending |
| Date/time presentation | UTC instant plus explicit offset/timezone formatter tests and Family explicit-UTC fallback tests | DST/locale/device review from authoritative school-local read models | Family interaction UTC fallback adopted; school-local explicit-offset presentation blocked on server timezone metadata |
| Screen-reader navigation | Written semantics available in shared components and locale control | TalkBack traversal and VoiceOver rotor order | Pending device evidence |
| Dynamic type | 200% source test | iOS Larger Accessibility Sizes | Pending |
| Keyboard/switch access | Material focus behavior only | Android switch access and iOS switch control | Pending |
| Reduced motion | Presentation preference zeroes nonessential durations | Android/iOS platform setting verification | Source policy present; device pass pending |
| Contrast | High-contrast preference available; approved design palette | Automated and device contrast evidence | Source policy present; device pass pending |
| Background/privacy lifecycle | Fail-closed policy, Flutter lifecycle-to-coordinator wiring, Android `FLAG_SECURE`, iOS inactive privacy covers and native drift guards | Android/iOS background, process death, screenshot/recent-task/app-switcher and presenter-cleanup tests | Native composition present; device/presenter verification pending |
| Native document presentation | Presenter interface only | Secure viewer accessibility and privacy review | Blocked on platform owner |
| Android integration | Source/widget/lifecycle tests and debug APK build | Emulator/device integration tests | Pending |
| iOS integration | Static native project and lifecycle-policy checks | Simulator/device integration tests | Pending |
| Store release | Debug artifacts only | Signed release, provenance, declarations, rollback | Pending |

## Critical journey checklist

Each journey must be exercised in English, Bangla, and Arabic where translated copy exists, at normal and 200% text scale, with a screen reader enabled:

### Family

- Cold start with device locale, persisted English, persisted Bangla, persisted Arabic, invalid preference, and unavailable preference storage.
- Change language while retaining the active route, authorized coordinator, selected persona, and visible page state.
- Sign in, access selection, safe failure, and sign out.
- Student/profile switch without silent tenant, campus, or persona change.
- Timetable, attendance, published results, fees/receipts, and messages.
- Documents, forms, guardian consent, and conversations.
- Step-up verification and restricted-document open/cleanup states.
- Offline, stale response, unavailable service, and expired authorization states.
- Background/resume, process death, memory pressure, and transient-byte cleanup.

### Staff

- Cold start and live language change without losing attendance drafts or changing assigned authority.
- Sign in, access selection, safe failure, and sign out.
- Today and assigned roster navigation.
- Attendance draft edit, encrypted save, retry, duplicate, conflict, rejection, and reconciliation.
- Grade draft and message capability gating.
- Notification launch/runtime routing without scope switching.
- Background/resume, process death, memory pressure, and encrypted-draft recovery.

## Screen-reader acceptance criteria

- Every actionable icon has an accessible name and an announced disabled state when unavailable.
- The language control announces the current presentation preference and the next preference before activation.
- Locale-storage failures are announced without exposing the stored value, storage key, platform path, account, or token.
- Page and section titles are discoverable in a logical reading order.
- Status changes are written and announced without exposing tokens, paths, digests, ciphertext, raw URLs, or hidden stale values.
- Tables, counts, money, grades, attendance states, and timestamps have unambiguous spoken labels.
- A screen reader cannot activate a route or command that the visible capability/session does not permit.
- Focus returns to a predictable control after dialogs, errors, secure presentation, and scope changes.
- Restricted-document cleanup and failure states are announced without announcing the temporary path or integrity digest.

## Localization acceptance criteria

- Locale changes affect presentation only and never infer account, tenant, campus, persona, capability, student, or server authority.
- Persisted locale state contains only an approved language code and uses keys separate from authentication/session storage.
- Invalid or unavailable locale storage fails safely to device preference without substituting authority data.
- Unsupported locale fallback is deterministic and visible.
- Bidirectional strings isolate identifiers, dates, amounts, codes, and user-provided content.
- Exact money remains integer minor-unit data; locale formatting is presentation-only.
- Dates and times preserve the authoritative UTC instant, explicit offset, and timezone identifier without device inference.
- Plurals do not rely on English-only `(s)` suffixes in completed production copy.
- Truncation never removes status, error, consent, security, or irreversible-action meaning.
- Translation files contain no secrets, endpoints with credentials, real student data, or production provider values.
- Global Material/Cupertino translations remain constrained to the approved locale list and require representative Android/iOS device review before release evidence is complete.

## Android/iOS integration evidence required

- Cold start, warm start, background/resume, process death, account removal, and secure locale restoration.
- Notification opened from terminated, background, and foreground states.
- Encrypted sync recovery after interruption and key rotation.
- Restricted-document exchange interruption, oversized response, digest failure, presentation failure, and guaranteed cleanup.
- Android TalkBack, font size/display size, RTL, switch access, backup-disabled behavior, cleartext rejection, secure locale persistence, and recent-task privacy.
- iOS VoiceOver, Dynamic Type accessibility sizes, RTL, switch control, Keychain lifecycle, secure locale persistence, file protection, and app-switcher privacy.
- The wired Flutter coordinator, Android `FLAG_SECURE`, and iOS inactive privacy cover must be exercised on representative Android/iOS devices for background/detach obscuring, resumed authorization refresh, screenshot/recent-task blocking and app-switcher privacy; presenter-specific restricted-presentation cancellation and transient-byte purge still require native integration evidence.
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

The localization runtime, production shell composition, and secure persisted locale selector are now adopted. The following remain incomplete and release blocking:

- remaining untranslated domain surfaces beyond the reviewed Family read/interaction and Staff teacher/sync/server-boundary production copy;
- authoritative Staff assessment-list and teacher-conversation read models before Gradebook/Messages can become data-bearing production surfaces;
- remaining pluralized domain copy outside the completed production count sentences;
- authoritative currency fraction metadata and broader exact-money adoption across relevant read models;
- authoritative school offset/timezone metadata and replacement of the current Family explicit UTC fallback with school-local explicit-offset presentation where those fields are supplied;
- broader bidi-isolation adoption where additional server/user-controlled mixed-script values are introduced;
- device verification of the wired lifecycle coordinator, Android `FLAG_SECURE` screenshot/recent-task protection and iOS inactive/app-switcher privacy cover, plus presenter-specific cancellation/transient-byte cleanup integration;
- device-level TalkBack, VoiceOver, Dynamic Type, switch-control, contrast, reduced-motion, secure-storage and representative RTL evidence;
- Android/iOS integration tests;
- approved native restricted-document presenters;
- signed store-release artifacts and declarations;
- server/platform activation and live policy evidence.
