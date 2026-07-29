#!/usr/bin/env python3
"""Apply formatter-safe test-only Staff sync lint fixes."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'apps/staff_app/test/staff_sync_controller_test.dart'
source = path.read_text(encoding='utf-8')
source = source.replace(
    "import 'package:school_api_client/school_api_client.dart';\n",
    '',
    1,
)
source = source.replace('teacherRuntime(', '_teacherRuntime(')
source = source.replace(
    'TeacherSyncRuntime _teacherRuntime({',
    'TeacherSyncRuntime _teacherRuntime({',
    1,
)
path.write_text(source, encoding='utf-8')
print('Staff sync test lints fixed.')
