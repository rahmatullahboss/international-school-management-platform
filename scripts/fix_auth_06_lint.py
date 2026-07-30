#!/usr/bin/env python3
from pathlib import Path

path = Path('packages/policy/src/oauth-transaction.ts')
source = path.read_text(encoding='utf-8')
old = """function validAcrValues(values: readonly string[] | undefined): boolean {
  return (
    values === undefined ||
    (values.length > 0 &&
      values.length <= MAX_ACR_VALUES &&
      values.every(
        (value) =>
          value.length > 0 &&
          value.length <= MAX_ACR_VALUE_LENGTH &&
          /^[^\\s\\u0000-\\u001F\\u007F]+$/u.test(value),
      ))
  );
}
"""
new = """function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function validAcrValues(values: readonly string[] | undefined): boolean {
  return (
    values === undefined ||
    (values.length > 0 &&
      values.length <= MAX_ACR_VALUES &&
      values.every(
        (value) =>
          value.length > 0 &&
          value.length <= MAX_ACR_VALUE_LENGTH &&
          !/\\s/u.test(value) &&
          !hasControlCharacter(value),
      ))
  );
}
"""
if source.count(old) != 1:
    raise SystemExit(f'Expected one AUTH-06 ACR validator, found {source.count(old)}.')
path.write_text(source.replace(old, new), encoding='utf-8')
