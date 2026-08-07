from pathlib import Path

source_path = Path('mobile/tool/apply_family_interaction_localization.py')
source = source_path.read_text()

# The transform script contains Dart strings with a literal `\n`. When those
# anchors/replacements are compiled as Python triple-quoted strings, the escape
# would become a real newline. Preserve the Dart escape in both match and
# generated-output fragments before executing the transform source.
def preserve_literal_newline(anchor: str, label: str) -> None:
    global source
    replacement = anchor.replace(r'\n', r'\\n')
    if anchor in source:
        source = source.replace(anchor, replacement, 1)
    elif replacement not in source:
        raise SystemExit(f'{label} transform-source escape anchor missing')


preserve_literal_newline(
    r"issued ${_familyDateLabel(context, document.issuedAt)}\n${document.classification.name}",
    'document subtitle match',
)
preserve_literal_newline(
    r"${FamilyInteractionStrings.issuedFor(locale, _familyDateLabel(context, document.issuedAt))}\n'",
    'document subtitle output',
)
preserve_literal_newline(
    r"${_familyDateTimeLabel(context, message.sentAt)}\n${message.body}",
    'message dynamic isolate match',
)
preserve_literal_newline(
    r"${_familyDateTimeLabel(context, message.sentAt)}\n'",
    'message dynamic isolate output',
)

namespace = {
    '__name__': '__main__',
    '__file__': str(source_path),
}
exec(compile(source, str(source_path), 'exec'), namespace)
