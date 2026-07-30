#!/usr/bin/env python3
from pathlib import Path

path = Path('apps/platform-api/src/auth-backchannel.test.ts')
source = path.read_text(encoding='utf-8')
old = """function successProcessor(): OidcBackchannelProcessor {
  return vi.fn(async () => {
"""
new = """function successProcessor(): OidcBackchannelProcessor {
  return vi.fn<OidcBackchannelProcessor>(async () => {
"""
if source.count(old) != 1:
    raise SystemExit(f'Expected one AUTH-07 processor mock, found {source.count(old)}.')
path.write_text(source.replace(old, new), encoding='utf-8')
