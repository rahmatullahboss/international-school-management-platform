#!/usr/bin/env python3
"""Expose the server-issued form base version on the immutable definition."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'packages/family_domain/lib/family_interactions.dart'
source = path.read_text(encoding='utf-8')
anchor = "  final FamilyFormStatus status;\n  final DateTime? dueAt;\n"
replacement = (
    "  final FamilyFormStatus status;\n"
    "  final int baseVersion;\n"
    "  final DateTime? dueAt;\n"
)
if 'final int baseVersion;' not in source.split('final class FamilyFormDefinition', 1)[1].split('final class FamilyFormSubmissionCommand', 1)[0]:
    if anchor not in source:
        raise SystemExit('Unexpected Family form definition field shape')
    source = source.replace(anchor, replacement, 1)
path.write_text(source, encoding='utf-8')
print('Family form base version exposed.')
