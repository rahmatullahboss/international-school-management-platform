from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    return text.replace(old, new)


plan_path = Path('docs/execution/09-mobile-stream-plan.md')
plan = plan_path.read_text()
plan = replace_once(
    plan,
    "Milestones 1 through 6 have passed on the client/native side. Milestone 7 now has passed source/static and production-composition tranches covering the restricted-data threat model, shared English/Bangla/Arabic localization runtime, Arabic RTL, deterministic locale fallback, secure persisted locale selection, localized count copy, integer cardinal plural rules, bidirectional isolation, exact locale-aware money/time presentation, Family/Staff localized production shells, 200% text scaling, written screen-reader semantics, minimum interaction targets, fail-closed platform lifecycle decisions and native transport/file-sharing guards. Complete translated domain copy, reviewed global framework translations, device-level TalkBack/VoiceOver verification, Android/iOS integration tests, approved restricted-document presenters and signed store-release evidence remain pending and release blocking.",
    "Milestones 1 through 6 have passed on the client/native side. Milestone 7 now has passed source/static and production-composition tranches covering the restricted-data threat model, shared English/Bangla/Arabic localization runtime, reviewed Flutter Material/Cupertino framework translations, Arabic RTL, deterministic locale fallback, secure persisted locale selection, localized count copy, integer cardinal plural rules, bidirectional isolation, exact locale-aware money/time presentation, Family core read-journey translation, Staff teacher/sync-journey translation, real Flutter lifecycle-to-coordinator privacy/authorization refresh wiring, 200% text scaling, written screen-reader semantics, minimum interaction targets and native transport/file-sharing guards. Remaining Family interaction/document and other untranslated domain copy, device-level TalkBack/VoiceOver verification, Android/iOS integration tests, approved restricted-document presenters and signed store-release evidence remain pending and release blocking.",
    'plan status',
)
plan = replace_once(
    plan,
    "   - Bounded framework-label fallback delegates, approved-locale controller, application-separated secure locale preference, localized count sentences, integer cardinal plural categories, bidi sanitization/isolation, exact integer-money presentation and explicit-offset timestamp presentation.\n   - Family and Staff production application states adopt the localization runtime, localized shell navigation/actions, generated titles and a 56-pixel state-preserving language control; Family fees/receipts adopt exact integer money presentation and dynamic read-model values use bidi isolation.\n   - Invalid/read/write locale-preference states fail safely using reason codes without storing authority values; Staff pending-attendance status uses reviewed pluralized copy.\n   - Source tests for 200% text scaling, written status semantics, minimum 48 logical-pixel controls, reduced motion and lifecycle privacy decisions.",
    "   - Reviewed Flutter global Material/Cupertino delegates, approved-locale controller, application-separated secure locale preference, localized count sentences, integer cardinal plural categories, bidi sanitization/isolation, exact integer-money presentation and explicit-offset timestamp presentation.\n   - Family and Staff production application states adopt the localization runtime, localized shell navigation/actions, generated titles and a 56-pixel state-preserving language control; Family core read journeys and Staff teacher/sync journeys now use reviewed English/Bangla/Arabic domain copy. Family fees/receipts retain exact integer money presentation and dynamic mixed-script identifiers are bidi-isolated.\n   - Invalid/read/write locale-preference states fail safely using reason codes without storing authority values; production count sentences use reviewed pluralized copy instead of English `(s)` placeholders.\n   - `MobileAppCoordinator` receives real Flutter lifecycle signals, obscures ready capability state while backgrounded/detached, and revalidates or refreshes OIDC authorization before bootstrap state is restored on resume. AppAuth inactive transitions remain non-destructive and memory-pressure decisions remain nonblocking.\n   - Source tests for 200% text scaling, written status semantics, minimum 48 logical-pixel controls, reduced motion, lifecycle policy decisions and lifecycle-to-coordinator wiring.",
    'plan milestone 7 implementation',
)
plan = replace_once(
    plan,
    "   - Complete translated domain copy, reviewed global framework translations, authoritative currency fraction metadata, TalkBack, VoiceOver, Dynamic Type device passes, secure-storage device evidence, Android/iOS integration tests, native restricted-document presenters, signed release artifacts, privacy declarations and rollback evidence remain pending.",
    "   - Remaining untranslated interaction/document/grade-domain copy, authoritative currency fraction metadata, TalkBack, VoiceOver, Dynamic Type device passes, secure-storage device evidence, Android/iOS integration tests, native restricted-document presenters, signed release artifacts, privacy declarations and rollback evidence remain pending.",
    'plan milestone 7 remaining',
)
plan = replace_once(
    plan,
    "- `school_design_system` provides ordered supported-locale resolution, localized shell delegates, Arabic RTL Widgets localization and bounded English framework-label fallback delegates for Material/Cupertino controls.",
    "- `school_design_system` provides ordered supported-locale resolution, localized shell delegates, Arabic RTL Widgets localization and reviewed Flutter global Material/Cupertino delegates for the approved English, Bangla and Arabic locales.",
    'plan checkpoint 11 framework',
)
plan = replace_once(
    plan,
    "## Server/platform-owned contract boundary",
    """## Checkpoint 14 evidence — reviewed Flutter framework translations

- The approved `en`/`bn`/`ar` localization configuration now uses Flutter 3.44.7 `GlobalMaterialLocalizations.delegate` and `GlobalCupertinoLocalizations.delegate` instead of English-only framework fallbacks while preserving the explicit School locale policy and Arabic RTL direction.
- Widget tests verify Bangla and Arabic load non-default Material/Cupertino localization implementations and preserve the School reading direction.
- Permanent Mobile CI `31141660444` (run #659) passed formatting, every analyzer/test, both Android debug APK builds and artifact upload. Root CI `31141660580` (run #2212) passed the complete repository gate including browser journeys and execution-artifact validation.
- APK artifact `8980142250`, digest `sha256:f2b4ce3223dca0cb194b750b89fd3a11699b9850e8ce7cc5b05800adac330381`.
- Production deployment, database mutation, provider activation and real student data use: none.

## Checkpoint 15 evidence — production lifecycle resume refresh wiring

- `MobileAppCoordinator` implements `WidgetsBindingObserver` and maps resumed, inactive, hidden, paused, detached and memory-pressure signals into the existing privacy lifecycle policy.
- Ready capability/bootstrap state is obscured for background/detach boundaries. Resume restores the persisted OIDC session, refreshes expired tokens through the existing authentication gateway and reloads bootstrap/capability state before returning to ready UI.
- Detached/background boundaries invalidate stale in-flight generation. AppAuth authentication transitions are not cancelled merely because the authorization UI temporarily makes the application inactive. Memory pressure records a privacy decision without deadlocking ready UI.
- Tests cover paused/resumed reload, detached + expired-token refresh, real `WidgetsBinding` propagation, AppAuth inactive continuity and nonblocking memory pressure.
- Permanent Mobile CI `31142212341` (run #664) and root CI `31142212379` (run #2220) passed; both Android debug APKs built and uploaded.
- APK artifact `8980310448`, digest `sha256:518f242187cd9202f25aace0b2256739d4079575157fc43e8867a091cc78a969`.
- Native restricted-document presenter cancellation/transient-byte cleanup still requires presenter-specific Android/iOS integration and device evidence.

## Checkpoint 16 evidence — Family production domain localization

- Family production loading/error/ready status, Home, Attendance, Published Results, Fees/Receipts and Messages now use app-owned reviewed English/Bangla/Arabic copy.
- Existing `SchoolCountStrings` supplies published-result, unread-message and finalized-session sentences; English `(s)` placeholders are no longer used for those completed read journeys.
- Dynamic student, grade, invoice and receipt values remain server-authored and bidi-isolated; routes, capabilities and academic/financial authority are unchanged.
- Permanent Mobile CI `31143470621` (run #674) and root CI `31143470607` (run #2241) passed the complete mobile/root gates, including both APK builds and browser E2E.
- APK artifact `8980736379`, digest `sha256:601cb254e41c8f323dd2e6ddf7f6dbb9e61fdfddb1be76caff9db9ff44378449`.

## Checkpoint 17 evidence — Staff production domain localization

- Staff production shell sync status, Today, assigned-roster failure/selection, attendance draft controls, attendance marks and device sync-journal states now use app-owned reviewed English/Bangla/Arabic copy.
- `StaffProductionCountCopy` remains the count-sentence source for assigned meetings, roster students and attendance operations; English `(s)` sync placeholders are removed from the completed production surfaces.
- Server-authored teacher, subject, section, room, student and operation identifiers remain dynamic and are bidi-isolated in localized rendering. Attendance acceptance/locking and sync reconciliation authority remain server-owned.
- Permanent Mobile CI `31144396458` (run #681) and root CI `31144396055` (run #2258) passed the complete gates, including both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8981081049`, digest `sha256:cb0723c102cefa28c9061c31b2ab2ec44653d0d808c6153de1ec2d59bdd8f003`.

## Server/platform-owned contract boundary""",
    'plan new checkpoints',
)
plan = replace_once(
    plan,
    "Complete reviewed domain translations and broader pluralized copy, replace bounded English framework labels with reviewed Material/Cupertino translations, extend exact money to authoritative currency fraction metadata, and adopt explicit-offset timestamp presentation where server read models supply the required fields. Wire platform lifecycle signals to privacy overlays, restricted-presentation cancellation, transient-byte purge and fresh-proof enforcement on Android/iOS. Complete device-level TalkBack, VoiceOver, Dynamic Type, switch-control, contrast, reduced-motion, secure-storage and representative RTL journeys. Add Android/iOS integration tests for backgrounding, interruption, process death, low storage, notification launches, encrypted sync recovery and restricted-document cleanup. Separately obtain server/platform-owner review for Bootstrap, Family, Teacher, device-session, notification, sync and secure-document exchange activation, approved Firebase/APNs configuration and Android/iOS native document presenters. Produce signed release artifacts, privacy declarations, provenance and rollback evidence before any live account or student data is used.",
    "Complete remaining untranslated Family interaction/document and other domain copy, extend exact money to authoritative currency fraction metadata, and adopt explicit-offset timestamp presentation where server read models supply the required fields. Complete Android/iOS device integration for app-switcher/privacy overlays, restricted-presentation cancellation, transient-byte purge and presenter-specific fresh-proof behavior on top of the now-wired Flutter lifecycle coordinator. Complete device-level TalkBack, VoiceOver, Dynamic Type, switch-control, contrast, reduced-motion, secure-storage and representative RTL journeys. Add Android/iOS integration tests for backgrounding, interruption, process death, low storage, notification launches, encrypted sync recovery and restricted-document cleanup. Separately obtain server/platform-owner review for Bootstrap, Family, Teacher, device-session, notification, sync and secure-document exchange activation, approved Firebase/APNs configuration and Android/iOS native document presenters. Produce signed release artifacts, privacy declarations, provenance and rollback evidence before any live account or student data is used.",
    'plan exact next action',
)
plan_path.write_text(plan)


evidence_path = Path('docs/mobile/accessibility-localization-release-evidence.md')
evidence = evidence_path.read_text()
evidence = replace_once(
    evidence,
    "- bounded Widgets, Material, and Cupertino delegates that prevent unsupported-locale failure while framework control labels remain English until reviewed global translations are adopted;",
    "- approved Widgets localization plus Flutter 3.44.7 global Material and Cupertino delegates providing reviewed framework translations for English, Bangla, and Arabic;",
    'evidence framework bullet',
)
evidence = replace_once(
    evidence,
    "- a platform-neutral privacy lifecycle policy covering backgrounding, process detachment, memory pressure, stale authorization, restricted-content obscuring, restricted-presentation cancellation, and transient-byte purge decisions.",
    "- a platform-neutral privacy lifecycle policy covering backgrounding, process detachment, memory pressure, stale authorization, restricted-content obscuring, restricted-presentation cancellation, and transient-byte purge decisions;\n- production `MobileAppCoordinator` wiring from real Flutter lifecycle signals to restricted-content obscuring and OIDC restore/refresh before bootstrap capability state returns on resume.",
    'evidence lifecycle source bullet',
)
evidence = replace_once(
    evidence,
    "- a reviewed pluralized Staff attendance-change status sentence instead of an English `(s)` placeholder.",
    "- reviewed English/Bangla/Arabic domain copy for Family production status/Home/Attendance/Results/Fees/Messages and Staff shell/Today/roster/attendance/sync-journal states;\n- reviewed pluralized count sentences on completed Family and Staff production surfaces instead of English `(s)` placeholders;\n- bidi isolation for localized Staff teacher, subject, section, room, student and operation identifiers in addition to existing Family dynamic-value isolation.",
    'evidence production adoption bullet',
)
evidence = replace_once(
    evidence,
    "- background, process-death, memory-pressure, stale-proof, and fresh-proof lifecycle decisions with redacted reason codes only.",
    "- background, process-death, memory-pressure, stale-proof, and fresh-proof lifecycle decisions with redacted reason codes only;\n- real Flutter lifecycle propagation into the shared coordinator, background/detach obscuring, resumed OIDC restore/refresh, AppAuth inactive continuity, and nonblocking memory pressure;\n- non-default Bangla/Arabic Material/Cupertino framework-localization implementations while preserving the explicit School reading direction.",
    'evidence source gate lifecycle',
)
evidence = replace_once(
    evidence,
    "These checks do not mean the production applications are fully translated or device certified. Family and Staff now adopt secure persisted locale selection and translated shell labels, but complete domain copy, reviewed global framework translations, broader pluralized domain sentences, authoritative currency fraction metadata, and representative TalkBack/VoiceOver/device journeys remain incomplete. The lifecycle contract is platform-neutral source evidence; Android/iOS hosts still need to connect actual lifecycle and privacy-overlay signals through approved native integration tests.",
    "These checks do not mean the production applications are fully translated or device certified. Family and Staff now adopt secure persisted locale selection, reviewed global framework translations, translated shell labels, Family core read-domain copy and Staff teacher/sync-domain copy. Remaining Family interaction/document and other untranslated domain surfaces, authoritative currency fraction metadata, and representative TalkBack/VoiceOver/device journeys remain incomplete. Flutter lifecycle signals are now wired into the shared coordinator for restricted-content obscuring and resumed authorization/bootstrap refresh; Android/iOS app-switcher/privacy-overlay behavior, restricted-document presenter cancellation/transient-byte cleanup and device integration evidence remain pending.",
    'evidence incomplete paragraph',
)
evidence = replace_once(
    evidence,
    "| Framework localization fallback | Bounded Material/Cupertino delegates for `en`/`bn`/`ar` | Reviewed translated framework controls | English fallback present; translated global delegates pending |",
    "| Framework localization | Flutter 3.44.7 global Material/Cupertino delegates for `en`/`bn`/`ar` with widget verification | Android/iOS translated framework-control review | Global translated delegates adopted; device review pending |",
    'evidence matrix framework',
)
evidence = replace_once(
    evidence,
    "| Bangla/Arabic shell copy | Shared catalog plus Family/Staff production navigation adoption | Android/iOS translated-copy review | Production shell adoption present; full domain translation pending |",
    "| Bangla/Arabic production copy | Shared shell catalog plus Family core read and Staff teacher/sync app-owned catalogs | Android/iOS translated-copy review | Core production adoption present; remaining interaction/domain translation pending |",
    'evidence matrix domain copy',
)
evidence = replace_once(
    evidence,
    "| Pluralized counts | Integer cardinal tests and reviewed `en`/`bn`/`ar` count catalog; Staff pending-attendance status adopted | Screen-reader and translation review | Initial production adoption present; broader domain copy pending |",
    "| Pluralized counts | Integer cardinal tests and reviewed `en`/`bn`/`ar` count catalogs used by Family read and Staff teacher/sync production surfaces | Screen-reader and translation review | Completed core surfaces no longer use English `(s)` placeholders; remaining domains pending |",
    'evidence matrix counts',
)
evidence = replace_once(
    evidence,
    "| Bidirectional isolation | Control-character sanitization and Family production identifier isolation | Representative mixed-script content review | Production Family adoption present; broader/device pass pending |",
    "| Bidirectional isolation | Control-character sanitization plus Family and Staff production dynamic-identifier isolation | Representative mixed-script content review | Core Family/Staff production adoption present; broader/device pass pending |",
    'evidence matrix bidi',
)
evidence = replace_once(
    evidence,
    "| Background/privacy lifecycle | Fail-closed lifecycle decision tests | Android/iOS background, process death, memory pressure and recent-task/app-switcher tests | Source policy present; native wiring pending |",
    "| Background/privacy lifecycle | Fail-closed policy plus real Flutter lifecycle-to-coordinator wiring, background/detach obscuring and resumed OIDC restore/refresh tests | Android/iOS background, process death, recent-task/app-switcher and presenter-cleanup tests | Production coordinator wiring present; device/presenter integration pending |",
    'evidence matrix lifecycle',
)
evidence = replace_once(
    evidence,
    "- English framework-label fallback must remain visibly documented until reviewed Material/Cupertino translations replace it.",
    "- Global Material/Cupertino translations remain constrained to the approved locale list and require representative Android/iOS device review before release evidence is complete.",
    'evidence localization criterion',
)
evidence = replace_once(
    evidence,
    "- Actual lifecycle-signal wiring must obscure restricted content, cancel restricted presentation when required, purge transient bytes, and require a fresh proof after process detachment or stale authorization.",
    "- The wired Flutter coordinator must be exercised on Android/iOS for background/detach obscuring and resumed authorization refresh; presenter-specific restricted-presentation cancellation, transient-byte purge and app-switcher privacy still require native integration evidence.",
    'evidence integration lifecycle',
)
evidence = replace_once(
    evidence,
    "- reviewed global Material/Cupertino translations and complete domain translation;\n- broader pluralized domain copy beyond the reviewed count catalog and Staff attendance-change status;",
    "- remaining untranslated Family interaction/document and other domain surfaces beyond the reviewed Family read and Staff teacher/sync production copy;\n- remaining pluralized domain copy outside the completed production count sentences;",
    'evidence remaining translation',
)
evidence = replace_once(
    evidence,
    "- native Android/iOS wiring of lifecycle privacy decisions and device-level verification;",
    "- Android/iOS device verification of the wired lifecycle coordinator plus native app-switcher/privacy-overlay and presenter-specific cancellation/transient-byte cleanup integration;",
    'evidence remaining lifecycle',
)
evidence_path.write_text(evidence)
