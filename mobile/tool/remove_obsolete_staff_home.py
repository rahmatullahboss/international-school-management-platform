#!/usr/bin/env python3
"""Remove the superseded hard-coded authorized Staff home view."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'apps/staff_app/lib/production_app.dart'
source = path.read_text(encoding='utf-8')
marker = '\nclass _AuthorizedStaffHomeScreen extends StatelessWidget {'
if marker in source:
    source = source.split(marker, 1)[0].rstrip() + '\n'
elif '_AuthorizedStaffHomeScreen' in source:
    raise SystemExit('Unexpected obsolete Staff home declaration shape')
path.write_text(source, encoding='utf-8')
print('Obsolete Staff home view removed.')
