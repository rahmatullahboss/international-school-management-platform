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
    'Family core read and interaction/document/form/consent/conversation translation, Staff teacher/sync translation,',
    'Family core read and interaction/document/form/consent/conversation translation with locale-aware date-only form presentation, Staff teacher/sync translation,',
    'plan status date-only presentation',
)
plan = replace_once(
    plan,
    'Family fees/receipts retain exact integer money presentation and dynamic mixed-script identifiers are bidi-isolated.',
    'Family fees/receipts retain exact integer money presentation, Family form date-only answers retain ISO `yyyy-MM-dd` payloads while rendering through the active locale, and dynamic mixed-script identifiers are bidi-isolated.',
    'milestone date-only presentation',
)
checkpoint_anchor = '''- APK artifact `8989891963`, digest `sha256:293ecffd569df82f56dbf53047ece7ea26f2c4bc5484da56111e3411392e318c`.\n\n## Server/platform-owned contract boundary\n'''
checkpoint = '''- APK artifact `8989891963`, digest `sha256:293ecffd569df82f56dbf53047ece7ea26f2c4bc5484da56111e3411392e318c`.\n\n## Checkpoint 23 evidence — Family form date-only localized presentation\n\n- Family form date fields no longer display selected answers as raw ISO `yyyy-MM-dd`; the visible date is formatted with the active Material locale.\n- The form answer contract remains exact ISO calendar dates. `FamilyDateOnlyPresentation` strictly parses date-only values and encodes the selected calendar date back to `yyyy-MM-dd` without converting through device or school timezones.\n- Focused tests verify Bangla locale rendering, exact ISO encoding, rejection of rollover/timestamp values and source-level guards against `toLocal()`/`toUtc()` in the date-only presenter.\n- Form field IDs, schema/base versions, submitted answer semantics, routes, authorization, backend endpoints and database ownership are unchanged.\n- Permanent Mobile CI `31169833678` (run #746) and root CI `31169833680` (run #2348) passed the complete gates, including every analyzer/test, both Android debug APK builds, artifact upload, browser E2E and execution-artifact validation.\n- APK artifact `8990720882`, digest `sha256:f7b9dcee4974a03b3a893349ceffde9a02223fb14783b9916a574ad10b51f833`.\n\n## Server/platform-owned contract boundary\n'''
plan = replace_once(plan, checkpoint_anchor, checkpoint, 'checkpoint 23 insertion')
plan_path.write_text(plan)


evidence_path = Path('docs/mobile/accessibility-localization-release-evidence.md')
evidence = evidence_path.read_text()
evidence = replace_once(
    evidence,
    '- explicit UTC presentation for Family interaction dates/timestamps while authoritative school offset/timezone metadata is absent; device timezone is never inferred for those server instants;\n',
    '- explicit UTC presentation for Family interaction dates/timestamps while authoritative school offset/timezone metadata is absent; device timezone is never inferred for those server instants;\n- locale-aware Family form date-only presentation while retaining exact ISO `yyyy-MM-dd` answer payloads and performing no timezone conversion;\n',
    'production date-only evidence',
)
evidence = replace_once(
    evidence,
    '- Family interaction UTC fallback converts current server instants with `toUtc()`, labels `UTC`, and source-level tests reject any return of `toLocal()`;\n',
    evidence_marker := '- Family interaction UTC fallback converts current server instants with `toUtc()`, labels `UTC`, and source-level tests reject any return of `toLocal()`;\n- Family form date-only tests verify locale-aware Bangla display, strict ISO parsing/encoding and reject timezone conversion in the date-only presenter;\n',
    'source date-only evidence',
)
evidence = replace_once(
    evidence,
    '| Date/time presentation | UTC instant plus explicit offset/timezone formatter tests and Family explicit-UTC fallback tests | DST/locale/device review from authoritative school-local read models | Family interaction UTC fallback adopted; school-local explicit-offset presentation blocked on server timezone metadata |',
    '| Date/time presentation | UTC instant plus explicit offset/timezone formatter tests, Family explicit-UTC fallback tests and locale-aware date-only form tests | DST/locale/device review from authoritative school-local read models | Family interaction UTC fallback and form date-only locale presentation adopted; school-local explicit-offset instant presentation blocked on server timezone metadata |',
    'matrix date-only evidence',
)
evidence_path.write_text(evidence)
