#!/usr/bin/env python3
"""Wire and normalize the signed-in mobile application composition."""

from __future__ import annotations

from pathlib import Path

MOBILE_ROOT = Path(__file__).resolve().parents[1]
APPS_ROOT = MOBILE_ROOT / "apps"
BOOTSTRAP_ROOT = MOBILE_ROOT / "packages/app_bootstrap"

DART_ASYNC = "import 'dart:async';"
FLUTTER_FOUNDATION = "import 'package:flutter/foundation.dart';"
APP_BOOTSTRAP = "import 'package:school_app_bootstrap/school_app_bootstrap.dart';"
AUTHENTICATION = "import 'package:school_authentication/school_authentication.dart';"
MOBILE_CORE = "import 'package:school_mobile_core/mobile_core.dart';"


def normalize_app_imports(source: str, *, staff: bool) -> str:
    lines = source.splitlines()
    remove = {DART_ASYNC, FLUTTER_FOUNDATION, APP_BOOTSTRAP, AUTHENTICATION}
    if staff:
        remove.add(MOBILE_CORE)
    lines = [line for line in lines if line not in remove]
    while lines and lines[0] == "":
        lines.pop(0)

    source = "\n".join(lines) + "\n"
    source = f"{DART_ASYNC}\n\n{FLUTTER_FOUNDATION}\n" + source
    go_router = "import 'package:go_router/go_router.dart';\n"
    if go_router not in source:
        raise SystemExit("ENTRYPOINT_MARKER_REQUIRED:go-router")
    source = source.replace(
        go_router,
        go_router + f"{APP_BOOTSTRAP}\n{AUTHENTICATION}\n",
        1,
    )
    if staff:
        design = "import 'package:school_design_system/school_design_system.dart';\n"
        if design not in source:
            raise SystemExit("ENTRYPOINT_MARKER_REQUIRED:staff-design-system")
        source = source.replace(design, design + f"{MOBILE_CORE}\n", 1)
    return source


def ensure_once(source: str, marker: str, insertion: str, label: str) -> str:
    if insertion in source:
        return source
    if marker not in source:
        raise SystemExit(f"ENTRYPOINT_MARKER_REQUIRED:{label}")
    return source.replace(marker, marker + insertion, 1)


def wire_family() -> None:
    path = APPS_ROOT / "family_app/lib/main.dart"
    source = normalize_app_imports(path.read_text(encoding="utf-8"), staff=False)
    source = ensure_once(
        source,
        f"{MOBILE_CORE}\n",
        "\npart 'production_app.dart';\n",
        "family-part",
    )
    source = source.replace(
        "void main() {\n  runApp(const ProviderScope(child: FamilyApp()));\n}",
        "void main() {\n  runApp(const ProviderScope(child: FamilyProductionApp()));\n}",
        1,
    )
    path.write_text(source, encoding="utf-8")


def wire_staff() -> None:
    path = APPS_ROOT / "staff_app/lib/main.dart"
    source = normalize_app_imports(path.read_text(encoding="utf-8"), staff=True)
    source = ensure_once(
        source,
        f"{MOBILE_CORE}\n",
        "\npart 'production_app.dart';\n",
        "staff-part",
    )
    source = source.replace(
        "void main() {\n  runApp(const ProviderScope(child: StaffApp()));\n}",
        "void main() {\n  runApp(const ProviderScope(child: StaffProductionApp()));\n}",
        1,
    )
    path.write_text(source, encoding="utf-8")


def fix_parts() -> None:
    for app in ("family", "staff"):
        path = APPS_ROOT / f"{app}_app/lib/production_app.dart"
        source = path.read_text(encoding="utf-8")
        source = source.replace(
            "paths.indexOf(location).clamp(0, paths.length - 1),",
            "paths.indexOf(location).clamp(0, paths.length - 1).toInt(),",
        )
        source = source.replace(
            "_AuthorizedStaffShell(\n"
            "            child: child,\n"
            "            coordinator: widget.coordinator,\n"
            "            location: state.uri.path,\n"
            "            session: session,\n"
            "            child: child,\n"
            "          )",
            "_AuthorizedStaffShell(\n"
            "            coordinator: widget.coordinator,\n"
            "            location: state.uri.path,\n"
            "            session: session,\n"
            "            child: child,\n"
            "          )",
        )
        path.write_text(source, encoding="utf-8")


def normalize_package_imports(path: Path, ordered_imports: list[str]) -> None:
    source = path.read_text(encoding="utf-8")
    lines = source.splitlines()
    import_set = set(ordered_imports)
    lines = [line for line in lines if line not in import_set]
    while lines and lines[0] == "":
        lines.pop(0)
    path.write_text("\n".join(ordered_imports) + "\n\n" + "\n".join(lines) + "\n", encoding="utf-8")


def fix_bootstrap_package() -> None:
    access_gate = BOOTSTRAP_ROOT / "lib/src/access_gate.dart"
    source = access_gate.read_text(encoding="utf-8").replace(
        "SchoolStatusTone.danger",
        "SchoolStatusTone.error",
    )
    access_gate.write_text(source, encoding="utf-8")
    normalize_package_imports(
        access_gate,
        [
            "import 'dart:async';",
            "import 'package:flutter/material.dart';",
            "import 'package:school_app_bootstrap/src/coordinator.dart';",
            "import 'package:school_design_system/school_design_system.dart';",
        ],
    )

    coordinator = BOOTSTRAP_ROOT / "lib/src/coordinator.dart"
    source = coordinator.read_text(encoding="utf-8").replace(
        "accessTokenProvider: () async => await authentication.validAccessToken(),",
        "accessTokenProvider: authentication.validAccessToken,",
    )
    coordinator.write_text(source, encoding="utf-8")
    normalize_package_imports(
        coordinator,
        [
            "import 'package:flutter/foundation.dart';",
            "import 'package:school_api_client/mobile_bootstrap_api.dart';",
            "import 'package:school_api_client/school_api_client.dart';",
            "import 'package:school_app_bootstrap/src/runtime_configuration.dart';",
            "import 'package:school_authentication/school_authentication.dart';",
            "import 'package:school_mobile_core/mobile_core.dart';",
        ],
    )

    test = BOOTSTRAP_ROOT / "test/app_bootstrap_test.dart"
    source = test.read_text(encoding="utf-8").replace(
        "onSignIn: () async => signInCount++,",
        "onSignIn: () async {\n            signInCount++;\n          },",
    )
    test.write_text(source, encoding="utf-8")


def main() -> None:
    wire_family()
    wire_staff()
    fix_parts()
    fix_bootstrap_package()
    print("Signed-in mobile composition normalized.")


if __name__ == "__main__":
    main()
