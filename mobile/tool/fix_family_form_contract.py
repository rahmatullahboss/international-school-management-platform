#!/usr/bin/env python3
"""Canonicalize the server-versioned Family form definition contract."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'packages/family_domain/lib/family_interactions.dart'
source = path.read_text(encoding='utf-8')
summary_start, remainder = source.split('final class FamilyFormSummary', 1)
summary_body, after_summary = remainder.split('final class FamilyFormFieldDefinition', 1)
summary_body = summary_body.replace('  final int baseVersion;\n', '', 1)
source = (
    summary_start
    + 'final class FamilyFormSummary'
    + summary_body
    + 'final class FamilyFormFieldDefinition'
    + after_summary
)
definition_start, definition_tail = source.split('final class FamilyFormDefinition', 1)
definition_body, after_definition = definition_tail.split(
    'final class FamilyFormSubmissionCommand',
    1,
)
definition_body = definition_body.replace(
    '    required FamilyFormStatus status,\n',
    '    required this.status,\n',
    1,
)
definition_body = definition_body.replace('       status = status,\n', '', 1)
if '  final int baseVersion;\n' not in definition_body:
    anchor = '  final FamilyFormStatus status;\n'
    if anchor not in definition_body:
        raise SystemExit('Unexpected Family form definition field shape')
    definition_body = definition_body.replace(
        anchor,
        anchor + '  final int baseVersion;\n',
        1,
    )
source = (
    definition_start
    + 'final class FamilyFormDefinition'
    + definition_body
    + 'final class FamilyFormSubmissionCommand'
    + after_definition
)
path.write_text(source, encoding='utf-8')
print('Family form contract canonicalized.')
