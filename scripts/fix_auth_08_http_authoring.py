#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/implement_auth_08_http.py')
source = path.read_text(encoding='utf-8')
old_marker = '''    marker = "    await expect(\\n      resolveAuthenticatedBrowserSession(completeBindings, cookie, async () => {"
'''
new_marker = '''    marker = "    const cookie = `${BROWSER_SESSION_COOKIE_NAME}=${issued.token}`;\\n\\n"
'''
old_replace = '''        source = source.replace(marker, context_block + marker)
'''
new_replace = '''        source = source.replace(marker, marker + context_block)
'''
if source.count(old_marker) != 1:
    raise SystemExit(f'Expected one obsolete AUTH-08 context marker, found {source.count(old_marker)}.')
if source.count(old_replace) != 1:
    raise SystemExit(f'Expected one AUTH-08 context insertion statement, found {source.count(old_replace)}.')
path.write_text(source.replace(old_marker, new_marker).replace(old_replace, new_replace), encoding='utf-8')
