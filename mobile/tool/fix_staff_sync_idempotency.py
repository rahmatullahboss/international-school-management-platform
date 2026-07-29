#!/usr/bin/env python3
"""Collapse duplicate Staff sync wiring introduced by checkpoint reruns."""

import re
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'apps/staff_app/lib/production_app.dart'
source = path.read_text(encoding='utf-8')

source = re.sub(
    r'(  late StaffAttendanceSyncController _sync;\n)+',
    '  late StaffAttendanceSyncController _sync;\n',
    source,
    count=1,
)

constructor = """    _sync = StaffAttendanceSyncController(
      repository: widget.repository,
      runtimeLoader: widget.syncRuntimeLoader,
      session: widget.session,
    );
"""
source = re.sub(
    r'(    _sync = StaffAttendanceSyncController\(\n'
    r'      repository: widget\.repository,\n'
    r'      runtimeLoader: widget\.syncRuntimeLoader,\n'
    r'      session: widget\.session,\n'
    r'    \);\n)+',
    constructor,
    source,
    count=1,
)
source = re.sub(
    r'(    unawaited\(_sync\.initialize\(\)\);\n)+',
    '    unawaited(_sync.initialize());\n',
    source,
    count=1,
)
source = re.sub(
    r'(            syncRuntimeLoader: widget\.syncRuntimeLoader,\n)+',
    '            syncRuntimeLoader: widget.syncRuntimeLoader,\n',
    source,
    count=1,
)

path.write_text(source, encoding='utf-8')
print('Staff sync wiring canonicalized.')
