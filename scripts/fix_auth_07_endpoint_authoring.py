#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/implement_auth_07_endpoint.py')
source = path.read_text(encoding='utf-8')
old = "  it('keeps the logout route fail-closed when durable identity configuration is absent', async () => {"
new = "  it('fails logout closed when its origin or registry configuration is unavailable', async () => {"
if source.count(old) != 1:
    raise SystemExit(f'Expected one obsolete index test marker, found {source.count(old)}.')
path.write_text(source.replace(old, new), encoding='utf-8')
