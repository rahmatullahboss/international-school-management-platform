#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/implement_auth_08_http.py')
source = path.read_text(encoding='utf-8')
old = """    marker = "    await expect(\\n      resolveAuthenticatedBrowserSession(completeBindings, cookie, async () => {"
"""
new = """    marker = "    await expect(\\n      resolveAuthenticatedBrowserSession(completeBindings, cookie"
"""
if source.count(old) != 1:
    raise SystemExit(f'Expected one obsolete AUTH-08 boundary marker, found {source.count(old)}.')
path.write_text(source.replace(old, new), encoding='utf-8')
