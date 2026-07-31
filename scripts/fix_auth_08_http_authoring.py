#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/implement_auth_08_http.py')
source = path.read_text(encoding='utf-8')
marker = '''    marker = "    await expect(\\n      resolveAuthenticatedBrowserSession(completeBindings, cookie, async () => {"
'''
if source.count(marker) != 1:
    raise SystemExit(f'Expected one exact AUTH-08 boundary marker, found {source.count(marker)}.')
