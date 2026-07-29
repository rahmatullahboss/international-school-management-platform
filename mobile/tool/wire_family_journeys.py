#!/usr/bin/env python3
"""Wire Family repository imports and state-controller parts once."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'apps/family_app/lib/main.dart'
source = path.read_text(encoding='utf-8')

imports = [
    "import 'package:school_api_client/family_read_api.dart';",
    "import 'package:school_api_client/school_api_client.dart';",
    "import 'package:school_family_domain/school_family_domain.dart';",
]
anchor = "import 'package:school_app_bootstrap/school_app_bootstrap.dart';\n"
if anchor not in source:
    raise SystemExit('FAMILY_IMPORT_ANCHOR_REQUIRED')
for directive in reversed(imports):
    source = source.replace(directive + '\n', '')
    source = source.replace(anchor, anchor + directive + '\n', 1)

part = "part 'family_journey_controller.dart';"
source = source.replace(part + '\n', '')
production_part = "part 'production_app.dart';\n"
if production_part not in source:
    raise SystemExit('FAMILY_PRODUCTION_PART_REQUIRED')
source = source.replace(
    production_part,
    part + '\n' + production_part,
    1,
)

path.write_text(source, encoding='utf-8')
print('Family journey wiring complete.')
