#!/usr/bin/env python3
"""Wire the existing demo libraries to their production bootstrap parts."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "apps"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    if old not in source:
        raise SystemExit(f"ENTRYPOINT_MARKER_REQUIRED:{label}")
    return source.replace(old, new, 1)


def wire(path: Path, app: str) -> None:
    source = path.read_text(encoding="utf-8")
    source = replace_once(
        source,
        "import 'package:flutter/material.dart';",
        "import 'dart:async';\n\nimport 'package:flutter/material.dart';",
        f"{app}-dart-async",
    )
    source = replace_once(
        source,
        "import 'package:flutter/material.dart';",
        "import 'package:flutter/foundation.dart';\nimport 'package:flutter/material.dart';",
        f"{app}-foundation",
    )
    source = replace_once(
        source,
        "import 'package:go_router/go_router.dart';",
        "import 'package:go_router/go_router.dart';\n"
        "import 'package:school_app_bootstrap/school_app_bootstrap.dart';\n"
        "import 'package:school_authentication/school_authentication.dart';",
        f"{app}-bootstrap-imports",
    )

    if app == "family":
        source = replace_once(
            source,
            "import 'package:school_mobile_core/mobile_core.dart';\n",
            "import 'package:school_mobile_core/mobile_core.dart';\n\npart 'production_app.dart';\n",
            "family-part",
        )
        source = replace_once(
            source,
            "void main() {\n  runApp(const ProviderScope(child: FamilyApp()));\n}",
            "void main() {\n  runApp(const ProviderScope(child: FamilyProductionApp()));\n}",
            "family-main",
        )
    else:
        source = replace_once(
            source,
            "import 'package:school_design_system/school_design_system.dart';\n",
            "import 'package:school_design_system/school_design_system.dart';\n"
            "import 'package:school_mobile_core/mobile_core.dart';\n\n"
            "part 'production_app.dart';\n",
            "staff-part",
        )
        source = replace_once(
            source,
            "void main() {\n  runApp(const ProviderScope(child: StaffApp()));\n}",
            "void main() {\n  runApp(const ProviderScope(child: StaffProductionApp()));\n}",
            "staff-main",
        )

    path.write_text(source, encoding="utf-8")


def fix_part(app: str) -> None:
    path = ROOT / f"{app}_app/lib/production_app.dart"
    source = path.read_text(encoding="utf-8")
    source = source.replace(
        "paths.indexOf(location).clamp(0, paths.length - 1),",
        "paths.indexOf(location).clamp(0, paths.length - 1).toInt(),",
    )
    source = source.replace(
        "          child: child,\n          coordinator:",
        "          coordinator:",
    )
    if app == "family":
        source = source.replace(
            "          session: session,\n        ),",
            "          session: session,\n          child: child,\n        ),",
            1,
        )
    else:
        source = source.replace(
            "            session: session,\n          ),",
            "            session: session,\n            child: child,\n          ),",
            1,
        )
    path.write_text(source, encoding="utf-8")


def main() -> None:
    wire(ROOT / "family_app/lib/main.dart", "family")
    wire(ROOT / "staff_app/lib/main.dart", "staff")
    fix_part("family")
    fix_part("staff")
    print("Production entrypoints wired.")


if __name__ == "__main__":
    main()
