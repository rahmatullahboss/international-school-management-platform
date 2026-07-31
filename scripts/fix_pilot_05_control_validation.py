#!/usr/bin/env python3
from pathlib import Path

for file_name in [
    'apps/platform-api/src/database-mutation-store.ts',
    'apps/platform-api/src/runtime-mutation.ts',
]:
    path = Path(file_name)
    source = path.read_text(encoding='utf-8')
    marker = "const CONTROL_CHARACTER_PATTERN = /[\\u0000-\\u001f\\u007f]/u;\n"
    helper = """function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) return true;
  }
  return false;
}
"""
    if source.count(marker) != 1:
        raise SystemExit(f'Expected one control-character marker in {file_name}.')
    source = source.replace(marker, helper)
    if source.count('CONTROL_CHARACTER_PATTERN.test(reason)') != 1:
        raise SystemExit(f'Expected one control-character use in {file_name}.')
    source = source.replace('CONTROL_CHARACTER_PATTERN.test(reason)', 'hasControlCharacters(reason)')
    path.write_text(source, encoding='utf-8')
