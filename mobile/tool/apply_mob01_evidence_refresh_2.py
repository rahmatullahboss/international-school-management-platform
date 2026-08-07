from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label} anchor missing')
    return text.replace(old, new, 1)


plan_path = Path('docs/execution/09-mobile-stream-plan.md')
plan = plan_path.read_text()

plan = replace_once(
    plan,
    'Milestones 1 through 6 have passed on the client/native side. Milestone 7 now has passed source/static and production-composition tranches covering the restricted-data threat model, shared English/Bangla/Arabic localization runtime, reviewed Flutter Material/Cupertino framework translations, Arabic RTL, deterministic locale fallback, secure persisted locale selection, localized count copy, integer cardinal plural rules, bidirectional isolation, exact locale-aware money/time presentation, Family core read-journey translation, Staff teacher/sync-journey translation, real Flutter lifecycle-to-coordinator privacy/authorization refresh wiring, 200% text scaling, written screen-reader semantics, minimum interaction targets and native transport/file-sharing guards. Remaining Family interaction/document and other untranslated domain copy, device-level TalkBack/VoiceOver verification, Android/iOS integration tests, approved restricted-document presenters and signed store-release evidence remain pending and release blocking.',
    'Milestones 1 through 6 have passed on the client/native side. Milestone 7 now has passed source/static and production-composition tranches covering the restricted-data threat model, shared English/Bangla/Arabic localization runtime, reviewed Flutter Material/Cupertino framework translations, Arabic RTL, deterministic locale fallback, secure persisted locale selection, localized count copy, integer cardinal plural rules, bidirectional isolation, exact locale-aware money/time presentation, Family core read and interaction/document/form/consent/conversation translation, Staff teacher/sync translation, fail-closed Staff gradebook/message server boundaries, real Flutter lifecycle-to-coordinator privacy/authorization refresh wiring, 200% text scaling, written screen-reader semantics, minimum interaction targets and native transport/file-sharing guards. Remaining untranslated domain surfaces outside those completed journeys, device-level TalkBack/VoiceOver verification, Android/iOS integration tests, authoritative Staff assessment/conversation read models, approved restricted-document presenters and signed store-release evidence remain pending and release blocking.',
    'plan status',
)

plan = replace_once(
    plan,
    '   - Family and Staff production application states adopt the localization runtime, localized shell navigation/actions, generated titles and a 56-pixel state-preserving language control; Family core read journeys and Staff teacher/sync journeys now use reviewed English/Bangla/Arabic domain copy. Family fees/receipts retain exact integer money presentation and dynamic mixed-script identifiers are bidi-isolated.',
    '   - Family and Staff production application states adopt the localization runtime, localized shell navigation/actions, generated titles and a 56-pixel state-preserving language control; Family core read plus Services/Documents/Forms/Guardian Consent/Conversations/Messages journeys and Staff teacher/sync journeys now use reviewed English/Bangla/Arabic domain copy. Family fees/receipts retain exact integer money presentation and dynamic mixed-script identifiers are bidi-isolated. Staff Gradebook/Messages now show localized fail-closed server-boundary states rather than synthetic current data while authoritative mobile read models are inactive.',
    'plan milestone production localization',
)

plan = replace_once(
    plan,
    '   - Remaining untranslated interaction/document/grade-domain copy, authoritative currency fraction metadata, TalkBack, VoiceOver, Dynamic Type device passes, secure-storage device evidence, Android/iOS integration tests, native restricted-document presenters, signed release artifacts, privacy declarations and rollback evidence remain pending.',
    '   - Remaining untranslated domain copy outside the completed Family read/interaction and Staff teacher/sync/server-boundary surfaces, authoritative Staff assessment-list and teacher-conversation read models, authoritative currency fraction metadata, TalkBack, VoiceOver, Dynamic Type device passes, secure-storage device evidence, Android/iOS integration tests, native restricted-document presenters, signed release artifacts, privacy declarations and rollback evidence remain pending.',
    'plan milestone pending',
)

checkpoint_anchor = '## Server/platform-owned contract boundary\n'
checkpoints = '''## Checkpoint 18 evidence — Family interaction production localization

- Family Services, Documents/secure-grant presentation, Forms, Guardian Consent, Conversations/Messages and shared interaction-failure states now use app-owned reviewed English/Bangla/Arabic copy.
- Server-owned document classification/cache-policy, form-status and consent-status values retain their authority semantics and receive locale-aware presentation labels only.
- Dynamic student names, document/form/consent titles, filenames, form labels/options, conversation subjects/authors/bodies and reason codes are bidi-sanitized at presentation boundaries; command payload values are unchanged.
- Permanent Mobile CI `31156908030` (run #698) and root CI `31156908056` (run #2292) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8985683665`, digest `sha256:b119791367af917598afc08654cfff3ec01ca7ccccca9e00d1324e24409272fa`.

## Checkpoint 19 evidence — Staff production fixture-data boundary

- Production Staff `/gradebook` and `/messages` no longer render synthetic assessment or conversation rows as current school data.
- `TeacherJourneyRepository` currently exposes authoritative Today/roster reads plus attendance and grade-draft writes, but no authoritative assessment-list read model or teacher-conversation read contract. Those two routes therefore show reviewed localized fail-closed server-boundary states until owning server contracts are activated.
- Focused widget tests assert that known fixture rows such as `Mathematics quiz 3`, `Grade 5A guardians` and `Academic office` never render on the production Gradebook/Messages surfaces.
- Grade-draft write authority, route capability checks, attendance/sync behavior, server contracts and database ownership are unchanged.
- Permanent Mobile CI `31158040008` (run #704) and root CI `31158041226` (run #2298) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8986126640`, digest `sha256:60f253f5b328d4479969aadbb2b0c89cbc33cec4377b17a3ff56276f87f48233`.

'''
if checkpoints not in plan:
    if checkpoint_anchor not in plan:
        raise SystemExit('plan checkpoint insertion anchor missing')
    plan = plan.replace(checkpoint_anchor, checkpoints + checkpoint_anchor, 1)

old_next = 'Complete remaining untranslated Family interaction/document and other domain copy, extend exact money to authoritative currency fraction metadata, and adopt explicit-offset timestamp presentation where server read models supply the required fields. Complete Android/iOS device integration for app-switcher/privacy overlays, restricted-presentation cancellation, transient-byte purge and presenter-specific fresh-proof behavior on top of the now-wired Flutter lifecycle coordinator. Complete device-level TalkBack, VoiceOver, Dynamic Type, switch-control, contrast, reduced-motion, secure-storage and representative RTL journeys. Add Android/iOS integration tests for backgrounding, interruption, process death, low storage, notification launches, encrypted sync recovery and restricted-document cleanup. Separately obtain server/platform-owner review for Bootstrap, Family, Teacher, device-session, notification, sync and secure-document exchange activation, approved Firebase/APNs configuration and Android/iOS native document presenters. Produce signed release artifacts, privacy declarations, provenance and rollback evidence before any live account or student data is used.'
new_next = 'Complete any remaining untranslated domain surfaces outside the completed Family read/interaction and Staff teacher/sync/server-boundary journeys. Through the server/platform ownership process, add authoritative Staff assessment-list and teacher-conversation read models before Gradebook/Messages become data-bearing production screens. Extend exact money to authoritative currency fraction metadata and adopt explicit-offset timestamp presentation where server read models supply the required fields. Complete Android/iOS device integration for app-switcher/privacy overlays, restricted-presentation cancellation, transient-byte purge and presenter-specific fresh-proof behavior on top of the wired Flutter lifecycle coordinator. Complete device-level TalkBack, VoiceOver, Dynamic Type, switch-control, contrast, reduced-motion, secure-storage and representative RTL journeys. Add Android/iOS integration tests for backgrounding, interruption, process death, low storage, notification launches, encrypted sync recovery and restricted-document cleanup. Separately obtain server/platform-owner review for Bootstrap, Family, Teacher, device-session, notification, sync and secure-document exchange activation, approved Firebase/APNs configuration and Android/iOS native document presenters. Produce signed release artifacts, privacy declarations, provenance and rollback evidence before any live account or student data is used.'
plan = replace_once(plan, old_next, new_next, 'plan next action')
plan_path.write_text(plan)


evidence_path = Path('docs/mobile/accessibility-localization-release-evidence.md')
evidence = evidence_path.read_text()

evidence = replace_once(
    evidence,
    '- reviewed English/Bangla/Arabic domain copy for Family production status/Home/Attendance/Results/Fees/Messages and Staff shell/Today/roster/attendance/sync-journal states;',
    '- reviewed English/Bangla/Arabic domain copy for Family production status/Home/Attendance/Results/Fees/Messages plus Services/Documents/Forms/Guardian Consent/Conversations/Messages, and Staff shell/Today/roster/attendance/sync-journal states;',
    'evidence production copy bullet',
)

evidence = replace_once(
    evidence,
    '- bidi isolation for localized Staff teacher, subject, section, room, student and operation identifiers in addition to existing Family dynamic-value isolation.',
    '- bidi isolation for localized Staff teacher, subject, section, room, student and operation identifiers plus Family interaction student/document/form/consent/conversation/message dynamic values; Staff Gradebook/Messages show localized fail-closed server-boundary states instead of fixture data while authoritative read models are unavailable.',
    'evidence bidi/server boundary bullet',
)

evidence = replace_once(
    evidence,
    'These checks do not mean the production applications are fully translated or device certified. Family and Staff now adopt secure persisted locale selection, reviewed global framework translations, translated shell labels, Family core read-domain copy and Staff teacher/sync-domain copy. Remaining Family interaction/document and other untranslated domain surfaces, authoritative currency fraction metadata, and representative TalkBack/VoiceOver/device journeys remain incomplete. Flutter lifecycle signals are now wired into the shared coordinator for restricted-content obscuring and resumed authorization/bootstrap refresh; Android/iOS app-switcher/privacy-overlay behavior, restricted-document presenter cancellation/transient-byte cleanup and device integration evidence remain pending.',
    'These checks do not mean the production applications are fully translated or device certified. Family and Staff now adopt secure persisted locale selection, reviewed global framework translations, translated shell labels, Family core read and interaction/document/form/consent/conversation copy, Staff teacher/sync-domain copy, and localized fail-closed Staff Gradebook/Messages server-boundary states. Any remaining untranslated domain surfaces, authoritative Staff assessment/conversation read models, authoritative currency fraction metadata, and representative TalkBack/VoiceOver/device journeys remain incomplete. Flutter lifecycle signals are now wired into the shared coordinator for restricted-content obscuring and resumed authorization/bootstrap refresh; Android/iOS app-switcher/privacy-overlay behavior, restricted-document presenter cancellation/transient-byte cleanup and device integration evidence remain pending.',
    'evidence completion paragraph',
)

evidence = replace_once(
    evidence,
    '| Bangla/Arabic production copy | Shared shell catalog plus Family core read and Staff teacher/sync app-owned catalogs | Android/iOS translated-copy review | Core production adoption present; remaining interaction/domain translation pending |',
    '| Bangla/Arabic production copy | Shared shell catalog plus Family read/interaction, Staff teacher/sync and Staff server-boundary app-owned catalogs | Android/iOS translated-copy review | Family read/interaction and Staff teacher/sync/server-boundary production adoption present; remaining domains pending |',
    'evidence matrix production copy',
)

evidence = replace_once(
    evidence,
    '| Pluralized counts | Integer cardinal tests and reviewed `en`/`bn`/`ar` count catalogs used by Family read and Staff teacher/sync production surfaces | Screen-reader and translation review | Completed core surfaces no longer use English `(s)` placeholders; remaining domains pending |',
    '| Pluralized counts | Integer cardinal tests and reviewed `en`/`bn`/`ar` count catalogs used by Family read/interaction and Staff teacher/sync production surfaces | Screen-reader and translation review | Completed production surfaces no longer use English `(s)` placeholders where count copy is adopted; remaining domains pending |',
    'evidence matrix pluralized counts',
)

evidence = replace_once(
    evidence,
    '- remaining untranslated Family interaction/document and other domain surfaces beyond the reviewed Family read and Staff teacher/sync production copy;',
    '- remaining untranslated domain surfaces beyond the reviewed Family read/interaction and Staff teacher/sync/server-boundary production copy;\n- authoritative Staff assessment-list and teacher-conversation read models before Gradebook/Messages can become data-bearing production surfaces;',
    'evidence remaining domain boundary',
)

evidence_path.write_text(evidence)
