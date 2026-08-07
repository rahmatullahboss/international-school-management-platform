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

# Apply bounded repairs that are easier to express after the large transform
# has produced the final Dart structure. These change presentation only.
screens_path = Path('mobile/apps/family_app/lib/family_interaction_screens.dart')
screens = screens_path.read_text()

repairs = [
    (
        """if (!interactions.secureDocumentExchangeAvailable)
                          const Padding(""",
        """if (!interactions.secureDocumentExchangeAvailable)
                          Padding(""",
        'secure presenter dynamic padding',
    ),
    (
        'const Text(strings.noAuthorizedDocumentMetadata)',
        'Text(strings.noAuthorizedDocumentMetadata)',
        'dynamic empty-document copy',
    ),
    (
        'message: interactions.documentsReasonCode!,',
        """message: SchoolBidirectionalText.isolate(
                            interactions.documentsReasonCode!,
                          ),""",
        'document reason isolation',
    ),
    (
        """        builder: (context, _) {
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.loading ||""",
        """        builder: (context, _) {
          final strings = FamilyInteractionStrings.forLocale(
            Localizations.localeOf(context),
          );
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.loading ||""",
        'conversation detail strings',
    ),
]
for old, new, label in repairs:
    if old in screens:
        screens = screens.replace(old, new, 1)
    elif new not in screens:
        raise SystemExit(f'{label} repair anchor missing')

screens_path.write_text(screens)
