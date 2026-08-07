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
    'shared English/Bangla/Arabic localization runtime, reviewed Flutter Material/Cupertino framework translations,',
    'shared English/Bangla/Arabic localization runtime, localized Family/Staff pre-authentication access/configuration gates, reviewed Flutter Material/Cupertino framework translations,',
    'status access gate localization',
)
plan = replace_once(
    plan,
    '   - Family and Staff production application states adopt the localization runtime, localized shell navigation/actions, generated titles and a 56-pixel state-preserving language control;',
    '   - Family and Staff pre-authentication/bootstrap access and configuration-failure states plus authorized production application states adopt the localization runtime. Visible Family/Staff application names, access phase/status/action/failure copy and guardian/student/teacher presentation labels use reviewed English/Bangla/Arabic copy; server-authored tenant/campus names and support codes are bidi-isolated without changing authority. Authorized application states retain localized shell navigation/actions, generated titles and a 56-pixel state-preserving language control;',
    'milestone access gate localization',
)
plan = replace_once(
    plan,
    'Remaining untranslated domain copy outside the completed Family read/interaction and Staff teacher/sync/server-boundary surfaces,',
    'Remaining untranslated domain copy outside the completed pre-auth/access-gate, Family read/interaction and Staff teacher/sync/server-boundary surfaces,',
    'remaining access gate wording',
)
checkpoint_anchor = '''- APK artifact `8988508687`, digest `sha256:813d9cec39c5929c181b18458ae8336c6896a5f5e86076c90c7b892ff3f20f0d`.\n\n## Server/platform-owned contract boundary\n'''
checkpoint = '''- APK artifact `8988508687`, digest `sha256:813d9cec39c5929c181b18458ae8336c6896a5f5e86076c90c7b892ff3f20f0d`.\n\n## Checkpoint 22 evidence — shared pre-auth/access-gate localization\n\n- `MobileAccessGate` and `MobileConfigurationFailureScreen` now use reviewed English/Bangla/Arabic app-owned copy for application names, bootstrap/access phase titles, sign-in/sign-out actions, configuration failures and safe account-access reasons.\n- Access-option tenant and campus names remain server-authored and are bidi-isolated at presentation boundaries; guardian/student/teacher labels are localized presentation-only without changing the underlying `SchoolPersona`.\n- Focused widget tests cover Bangla signed-out copy, Arabic RTL configuration failure, localized student persona presentation and preservation of the originally selected tenant/campus/persona authority values. Source guards reject the prior hardcoded access-gate literals.\n- OIDC behavior, bootstrap contracts, capability/session selection, tenant/campus/persona authority, backend endpoints and database ownership are unchanged.\n- Permanent Mobile CI `31167740324` (run #736) and root CI `31167740383` (run #2336) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.\n- APK artifact `8989891963`, digest `sha256:293ecffd569df82f56dbf53047ece7ea26f2c4bc5484da56111e3411392e318c`.\n\n## Server/platform-owned contract boundary\n'''
plan = replace_once(plan, checkpoint_anchor, checkpoint, 'checkpoint 22 insertion')
plan = replace_once(
    plan,
    'Complete any remaining untranslated domain surfaces outside the completed Family read/interaction and Staff teacher/sync/server-boundary journeys.',
    'Complete any remaining untranslated domain surfaces outside the completed pre-auth/access-gate, Family read/interaction and Staff teacher/sync/server-boundary journeys.',
    'next action access gate wording',
)
plan_path.write_text(plan)


evidence_path = Path('docs/mobile/accessibility-localization-release-evidence.md')
evidence = evidence_path.read_text()
evidence = replace_once(
    evidence,
    '- localized capability-scoped navigation and sign-out/profile actions without changing route or authorization decisions;\n',
    '- localized shared pre-authentication access/configuration gates with Family/Staff app names, bootstrap/access phase copy, safe failure copy, sign-in/sign-out actions and guardian/student/teacher presentation labels; tenant/campus names and support codes remain server-authored and are bidi-isolated without changing authority;\n- localized capability-scoped navigation and sign-out/profile actions without changing route or authorization decisions;\n',
    'production access gate evidence',
)
evidence = replace_once(
    evidence,
    '- Bangla and Arabic shell-copy availability;\n',
    '- Bangla and Arabic shell-copy availability;\n- Bangla signed-out access-gate rendering, Arabic RTL configuration-failure rendering, localized persona presentation and preservation of selected tenant/campus/persona authority;\n',
    'source gate access evidence',
)
evidence = replace_once(
    evidence,
    'Family and Staff now adopt secure persisted locale selection, reviewed global framework translations, translated shell labels, Family core read and interaction/document/form/consent/conversation copy, Staff teacher/sync-domain copy, and localized fail-closed Staff Gradebook/Messages server-boundary states.',
    'Family and Staff now adopt secure persisted locale selection, reviewed global framework translations, translated shared pre-auth/access/configuration gates and shell labels, Family core read and interaction/document/form/consent/conversation copy, Staff teacher/sync-domain copy, and localized fail-closed Staff Gradebook/Messages server-boundary states.',
    'narrative access gate evidence',
)
evidence = replace_once(
    evidence,
    '| Bangla/Arabic production copy | Shared shell catalog plus Family read/interaction, Staff teacher/sync and Staff server-boundary app-owned catalogs | Android/iOS translated-copy review | Family read/interaction and Staff teacher/sync/server-boundary production adoption present; remaining domains pending |',
    '| Bangla/Arabic production copy | Shared pre-auth/access-gate and shell catalogs plus Family read/interaction, Staff teacher/sync and Staff server-boundary app-owned catalogs | Android/iOS translated-copy review | Pre-auth/access-gate, Family read/interaction and Staff teacher/sync/server-boundary production adoption present; remaining domains pending |',
    'matrix access gate evidence',
)
evidence = replace_once(
    evidence,
    '- remaining untranslated domain surfaces beyond the reviewed Family read/interaction and Staff teacher/sync/server-boundary production copy;\n',
    '- remaining untranslated domain surfaces beyond the reviewed pre-auth/access-gate, Family read/interaction and Staff teacher/sync/server-boundary production copy;\n',
    'remaining access gate evidence',
)
evidence_path.write_text(evidence)
