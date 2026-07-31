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

runtime_path = Path('apps/platform-api/src/runtime-mutation.ts')
runtime_source = runtime_path.read_text(encoding='utf-8')
old_status = """function errorResult(
  status: RuntimeMutationHttpResult extends { readonly ok: false; readonly status: infer S }
    ? S
    : never,
  code: string,
  message: string,
): RuntimeMutationHttpResult {
"""
new_status = """type RuntimeMutationErrorStatus = 400 | 401 | 403 | 404 | 409 | 503;

function errorResult(
  status: RuntimeMutationErrorStatus,
  code: string,
  message: string,
): RuntimeMutationHttpResult {
"""
if runtime_source.count(old_status) != 1:
    raise SystemExit('Expected one runtime mutation error status helper.')
runtime_path.write_text(runtime_source.replace(old_status, new_status), encoding='utf-8')
