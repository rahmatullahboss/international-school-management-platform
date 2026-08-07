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
    'exact locale-aware money/time presentation, Family core read and interaction/document/form/consent/conversation translation, Staff teacher/sync translation, fail-closed Staff gradebook/message server boundaries, real Flutter lifecycle-to-coordinator privacy/authorization refresh wiring, Android `FLAG_SECURE` screen-capture protection, iOS inactive/app-switcher privacy covers, 200% text scaling',
    'exact locale-aware money/time presentation, explicit UTC fallback for Family interaction timestamps without device-timezone inference, Family core read and interaction/document/form/consent/conversation translation, Staff teacher/sync translation, fail-closed Staff gradebook/message server boundaries, real Flutter lifecycle-to-coordinator privacy/authorization refresh wiring, Android `FLAG_SECURE` screen-capture protection, iOS inactive/app-switcher privacy covers, 200% text scaling',
    'plan status UTC adoption',
)

plan = replace_once(
    plan,
    '   - Reviewed Flutter global Material/Cupertino delegates, approved-locale controller, application-separated secure locale preference, localized count sentences, integer cardinal plural categories, bidi sanitization/isolation, exact integer-money presentation and explicit-offset timestamp presentation.\n',
    '   - Reviewed Flutter global Material/Cupertino delegates, approved-locale controller, application-separated secure locale preference, localized count sentences, integer cardinal plural categories, bidi sanitization/isolation, exact integer-money presentation and explicit-offset timestamp presentation. Family interaction date/time surfaces now refuse device-timezone inference and present current server instants explicitly in UTC until authoritative school offset/timezone metadata exists.\n',
    'milestone UTC adoption',
)

checkpoint_20_tail = '''- This is source/static and Android-build evidence only. Real Android screenshot/recent-task behavior and iOS app-switcher/inactive-cover behavior still require emulator/device verification before release certification.\n\n## Server/platform-owned contract boundary\n'''
checkpoint_21 = '''- This is source/static and Android-build evidence only. Real Android screenshot/recent-task behavior and iOS app-switcher/inactive-cover behavior still require emulator/device verification before release certification.\n\n## Checkpoint 21 evidence — Family explicit UTC fallback and device-timezone boundary\n\n- Family Documents, Forms, Guardian Consent and Conversations/Messages no longer call `DateTime.toLocal()` for server-owned dates or timestamps.\n- Current interaction read models provide an authoritative instant but not the authoritative school offset/timezone identifier required for school-local presentation. `FamilyUtcPresentation` therefore converts the instant to UTC, uses locale-aware Material date/time formatting and labels the result explicitly as `UTC`.\n- Focused tests verify an offset-bearing source instant is rendered using its UTC day/time, and source-level guards fail if `.toLocal()` returns to the Family interaction screen or UTC presenter.\n- The change does not modify server instants, form/consent versions, message payloads, routes, authorization, backend endpoints or database ownership. School-local presentation remains blocked until owning read models provide authoritative timezone metadata.\n- Permanent Mobile CI `31164136237` (run #725) and root CI `31164136559` (run #2323) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.\n- APK artifact `8988508687`, digest `sha256:813d9cec39c5929c181b18458ae8336c6896a5f5e86076c90c7b892ff3f20f0d`.\n\n## Server/platform-owned contract boundary\n'''
plan = replace_once(plan, checkpoint_20_tail, checkpoint_21, 'checkpoint 21 insertion')

plan = replace_once(
    plan,
    'Extend exact money to authoritative currency fraction metadata and adopt explicit-offset timestamp presentation where server read models supply the required fields.',
    'Extend exact money to authoritative currency fraction metadata and replace the explicit UTC interaction fallback with school-local explicit-offset timestamp presentation where server read models supply authoritative offset/timezone fields.',
    'next action timestamp wording',
)
plan_path.write_text(plan)


evidence_path = Path('docs/mobile/accessibility-localization-release-evidence.md')
evidence = evidence_path.read_text()

evidence = replace_once(
    evidence,
    '- reviewed pluralized count sentences on completed Family and Staff production surfaces instead of English `(s)` placeholders;\n- bidi isolation for localized Staff teacher, subject, section, room, student and operation identifiers plus Family interaction student/document/form/consent/conversation/message dynamic values; Staff Gradebook/Messages show localized fail-closed server-boundary states instead of fixture data while authoritative read models are unavailable.\n',
    evidence,
    'noop placeholder',
)
