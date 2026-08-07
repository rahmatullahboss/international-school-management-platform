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
    'Milestones 1 through 6 have passed on the client/native side. Milestone 7 now has passed source/static and production-composition tranches covering the restricted-data threat model, shared English/Bangla/Arabic localization runtime, reviewed Flutter Material/Cupertino framework translations, Arabic RTL, deterministic locale fallback, secure persisted locale selection, localized count copy, integer cardinal plural rules, bidirectional isolation, exact locale-aware money/time presentation, Family core read and interaction/document/form/consent/conversation translation, Staff teacher/sync translation, fail-closed Staff gradebook/message server boundaries, real Flutter lifecycle-to-coordinator privacy/authorization refresh wiring, 200% text scaling, written screen-reader semantics, minimum interaction targets and native transport/file-sharing guards. Remaining untranslated domain surfaces outside those completed journeys, device-level TalkBack/VoiceOver verification, Android/iOS integration tests, authoritative Staff assessment/conversation read models, approved restricted-document presenters and signed store-release evidence remain pending and release blocking.',
    'Milestones 1 through 6 have passed on the client/native side. Milestone 7 now has passed source/static and production-composition tranches covering the restricted-data threat model, shared English/Bangla/Arabic localization runtime, reviewed Flutter Material/Cupertino framework translations, Arabic RTL, deterministic locale fallback, secure persisted locale selection, localized count copy, integer cardinal plural rules, bidirectional isolation, exact locale-aware money/time presentation, Family core read and interaction/document/form/consent/conversation translation, Staff teacher/sync translation, fail-closed Staff gradebook/message server boundaries, real Flutter lifecycle-to-coordinator privacy/authorization refresh wiring, Android `FLAG_SECURE` screen-capture protection, iOS inactive/app-switcher privacy covers, 200% text scaling, written screen-reader semantics, minimum interaction targets and native transport/file-sharing guards. Remaining untranslated domain surfaces outside those completed journeys, device-level TalkBack/VoiceOver and native privacy verification, Android/iOS integration tests, authoritative Staff assessment/conversation read models, approved restricted-document presenters and signed store-release evidence remain pending and release blocking.',
    'plan status native privacy',
)

plan = replace_once(
    plan,
    '   - Android cleartext traffic disabled; iOS arbitrary transport loads, file sharing and open-in-place disabled; CI drift guards enforce the settings.',
    '   - Android cleartext traffic and backup are disabled and both activities set `FLAG_SECURE`; iOS arbitrary transport loads, file sharing and open-in-place are disabled and both SceneDelegates install an opaque privacy cover while inactive. CI drift guards enforce the native settings and preserve Flutter scene-callback forwarding.',
    'plan milestone native guard',
)

checkpoint_anchor = '## Server/platform-owned contract boundary\n'
checkpoint = '''## Checkpoint 20 evidence — native screen-capture and app-switcher privacy composition

- Both Android applications set `WindowManager.LayoutParams.FLAG_SECURE` in their sole `MainActivity`, blocking operating-system screenshots/screen recording and protecting recent-task thumbnails at the native window boundary.
- Both iOS `SceneDelegate` implementations add an opaque system-background cover when the scene resigns active and remove it only after the scene becomes active again, preventing inactive/app-switcher snapshots from retaining the Flutter surface.
- The iOS delegates forward `sceneWillResignActive` and `sceneDidBecomeActive` to `FlutterSceneDelegate` so plugin lifecycle propagation remains intact.
- `mobile/tool/verify_native_projects.py` now fails closed if Android `FLAG_SECURE` is removed/cleared, if iOS privacy-cover hooks drift, or if Flutter scene-callback forwarding is dropped.
- Permanent Mobile CI `31160559691` (run #712) and root CI `31160559990` (run #2308) passed the complete gates, including native drift verification, every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.
- APK artifact `8987082482`, digest `sha256:8dd705c63b33f7dccfbf1194cfa52032b007b91866b637cf434f2fd0382e1b5b`.
- This is source/static and Android-build evidence only. Real Android screenshot/recent-task behavior and iOS app-switcher/inactive-cover behavior still require emulator/device verification before release certification.

'''
if checkpoint not in plan:
    if checkpoint_anchor not in plan:
        raise SystemExit('checkpoint 20 insertion anchor missing')
    plan = plan.replace(checkpoint_anchor, checkpoint + checkpoint_anchor, 1)

plan = replace_once(
    plan,
    'Complete Android/iOS device integration for app-switcher/privacy overlays, restricted-presentation cancellation, transient-byte purge and presenter-specific fresh-proof behavior on top of the wired Flutter lifecycle coordinator.',
    'Verify the implemented Android `FLAG_SECURE` and iOS inactive/app-switcher privacy-cover behavior on representative devices, and complete presenter-specific restricted-presentation cancellation, transient-byte purge and fresh-proof integration on top of the wired Flutter lifecycle coordinator.',
    'plan next native privacy',
)
plan_path.write_text(plan)


evidence_path = Path('docs/mobile/accessibility-localization-release-evidence.md')
evidence = evidence_path.read_text()

evidence = replace_once(
    evidence,
    '- production `MobileAppCoordinator` wiring from real Flutter lifecycle signals to restricted-content obscuring and OIDC restore/refresh before bootstrap capability state returns on resume.',
    '- production `MobileAppCoordinator` wiring from real Flutter lifecycle signals to restricted-content obscuring and OIDC restore/refresh before bootstrap capability state returns on resume;\n- native privacy composition with Android `FLAG_SECURE` on both application windows and iOS inactive/app-switcher covers on both SceneDelegates, guarded against source drift.',
    'evidence native privacy source bullet',
)

evidence = replace_once(
    evidence,
    'These checks do not mean the production applications are fully translated or device certified. Family and Staff now adopt secure persisted locale selection, reviewed global framework translations, translated shell labels, Family core read and interaction/document/form/consent/conversation copy, Staff teacher/sync-domain copy, and localized fail-closed Staff Gradebook/Messages server-boundary states. Any remaining untranslated domain surfaces, authoritative Staff assessment/conversation read models, authoritative currency fraction metadata, and representative TalkBack/VoiceOver/device journeys remain incomplete. Flutter lifecycle signals are now wired into the shared coordinator for restricted-content obscuring and resumed authorization/bootstrap refresh; Android/iOS app-switcher/privacy-overlay behavior, restricted-document presenter cancellation/transient-byte cleanup and device integration evidence remain pending.',
    'These checks do not mean the production applications are fully translated or device certified. Family and Staff now adopt secure persisted locale selection, reviewed global framework translations, translated shell labels, Family core read and interaction/document/form/consent/conversation copy, Staff teacher/sync-domain copy, and localized fail-closed Staff Gradebook/Messages server-boundary states. Any remaining untranslated domain surfaces, authoritative Staff assessment/conversation read models, authoritative currency fraction metadata, and representative TalkBack/VoiceOver/device journeys remain incomplete. Flutter lifecycle signals are wired into the shared coordinator, Android windows now use `FLAG_SECURE`, and iOS SceneDelegates now install inactive/app-switcher privacy covers. Device verification plus restricted-document presenter cancellation/transient-byte cleanup evidence remain pending.',
    'evidence native privacy completion paragraph',
)

evidence = replace_once(
    evidence,
    '| Background/privacy lifecycle | Fail-closed policy plus real Flutter lifecycle-to-coordinator wiring, background/detach obscuring and resumed OIDC restore/refresh tests | Android/iOS background, process death, recent-task/app-switcher and presenter-cleanup tests | Production coordinator wiring present; device/presenter integration pending |',
    '| Background/privacy lifecycle | Fail-closed policy, Flutter lifecycle-to-coordinator wiring, Android `FLAG_SECURE`, iOS inactive privacy covers and native drift guards | Android/iOS background, process death, screenshot/recent-task/app-switcher and presenter-cleanup tests | Native composition present; device/presenter verification pending |',
    'evidence matrix lifecycle',
)

evidence = replace_once(
    evidence,
    '- The wired Flutter coordinator must be exercised on Android/iOS for background/detach obscuring and resumed authorization refresh; presenter-specific restricted-presentation cancellation, transient-byte purge and app-switcher privacy still require native integration evidence.',
    '- The wired Flutter coordinator, Android `FLAG_SECURE`, and iOS inactive privacy cover must be exercised on representative Android/iOS devices for background/detach obscuring, resumed authorization refresh, screenshot/recent-task blocking and app-switcher privacy; presenter-specific restricted-presentation cancellation and transient-byte purge still require native integration evidence.',
    'evidence integration requirement',
)

evidence = replace_once(
    evidence,
    '- Android/iOS device verification of the wired lifecycle coordinator plus native app-switcher/privacy-overlay and presenter-specific cancellation/transient-byte cleanup integration;',
    '- device verification of the wired lifecycle coordinator, Android `FLAG_SECURE` screenshot/recent-task protection and iOS inactive/app-switcher privacy cover, plus presenter-specific cancellation/transient-byte cleanup integration;',
    'evidence remaining native privacy',
)

evidence_path.write_text(evidence)
