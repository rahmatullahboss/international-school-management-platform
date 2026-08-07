from pathlib import Path

source_path = Path('mobile/tool/apply_family_interaction_localization.py')
source = source_path.read_text()

# The transform script contains a Dart string with a literal `\n`. When that
# anchor is compiled as a Python triple-quoted string, the escape would become
# a real newline and fail to match the Dart source. Patch only that transform
# source anchor before executing it; do not alter the production Dart file.
needle = r"issued ${_familyDateLabel(context, document.issuedAt)}\n${document.classification.name}"
replacement = r"issued ${_familyDateLabel(context, document.issuedAt)}\\n${document.classification.name}"
if needle in source:
    source = source.replace(needle, replacement, 1)
elif replacement not in source:
    raise SystemExit('document subtitle transform-source escape anchor missing')

namespace = {
    '__name__': '__main__',
    '__file__': str(source_path),
}
exec(compile(source, str(source_path), 'exec'), namespace)
