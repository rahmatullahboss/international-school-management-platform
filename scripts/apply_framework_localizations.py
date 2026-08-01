from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(
            f"expected exactly one match in {path}, found {count}: {old[:120]!r}"
        )
    target.write_text(source.replace(old, new, 1))


localization = Path("mobile/packages/design_system/lib/school_localization.dart")
source = localization.read_text()
source = source.replace(
    "import 'package:flutter/cupertino.dart';\n"
    "import 'package:flutter/foundation.dart';\n"
    "import 'package:flutter/material.dart';\n",
    "import 'package:flutter/foundation.dart';\n"
    "import 'package:flutter/material.dart';\n"
    "import 'package:flutter_localizations/flutter_localizations.dart';\n",
    1,
)
start_marker = "/// Widgets-level localization that supplies the approved reading direction."
end_marker = "/// Shared MaterialApp/WidgetsApp localization configuration."
start = source.find(start_marker)
end = source.find(end_marker)
if start < 0 or end < 0 or end <= start:
    raise SystemExit("framework fallback localization block markers were not found")
source = source[:start] + source[end:]
old_delegates = """    SchoolShellStrings.delegate,\n    SchoolWidgetsLocalizations.delegate,\n    _SchoolMaterialLocalizationsDelegate(),\n    _SchoolCupertinoLocalizationsDelegate(),\n"""
new_delegates = """    SchoolShellStrings.delegate,\n    GlobalMaterialLocalizations.delegate,\n    GlobalWidgetsLocalizations.delegate,\n    GlobalCupertinoLocalizations.delegate,\n"""
if source.count(old_delegates) != 1:
    raise SystemExit("expected one bounded framework delegate list")
source = source.replace(old_delegates, new_delegates, 1)
source = source.replace(
    end_marker,
    """/// Shared MaterialApp/WidgetsApp localization configuration.\n///\n/// Flutter's first-party global delegates provide translated Material, Widgets\n/// and Cupertino framework labels plus reading direction for approved locales.\n/// This remains presentation-only and does not influence school authority.\n""",
    1,
)
localization.write_text(source)

replace_once(
    "mobile/packages/design_system/pubspec.yaml",
    "  flutter:\n    sdk: flutter\n  flutter_secure_storage: ^10.3.1\n",
    "  flutter:\n    sdk: flutter\n  flutter_localizations:\n    sdk: flutter\n  flutter_secure_storage: ^10.3.1\n",
)

test_path = Path(
    "mobile/packages/design_system/test/school_framework_localizations_test.dart"
)
if test_path.exists():
    raise SystemExit(f"refusing to overwrite existing test file: {test_path}")
test_path.write_text(
    """import 'package:flutter/cupertino.dart';\n"
    "import 'package:flutter/material.dart';\n"
    "import 'package:flutter_localizations/flutter_localizations.dart';\n"
    "import 'package:flutter_test/flutter_test.dart';\n"
    "import 'package:school_design_system/school_localization.dart';\n"
    "\n"
    "final class _FrameworkSnapshot {\n"
    "  const _FrameworkSnapshot({\n"
    "    required this.cupertino,\n"
    "    required this.direction,\n"
    "    required this.material,\n"
    "  });\n"
    "\n"
    "  final CupertinoLocalizations cupertino;\n"
    "  final TextDirection direction;\n"
    "  final MaterialLocalizations material;\n"
    "}\n"
    "\n"
    "Future<_FrameworkSnapshot> _frameworkSnapshot(\n"
    "  WidgetTester tester,\n"
    "  Locale locale,\n"
    ") async {\n"
    "  late _FrameworkSnapshot snapshot;\n"
    "  await tester.pumpWidget(\n"
    "    MaterialApp(\n"
    "      locale: locale,\n"
    "      localizationsDelegates:\n"
    "          SchoolLocalizationConfiguration.localizationsDelegates,\n"
    "      supportedLocales: SchoolLocalizationConfiguration.supportedLocales,\n"
    "      home: Builder(\n"
    "        builder: (context) {\n"
    "          snapshot = _FrameworkSnapshot(\n"
    "            cupertino: CupertinoLocalizations.of(context),\n"
    "            direction: Directionality.of(context),\n"
    "            material: MaterialLocalizations.of(context),\n"
    "          );\n"
    "          return const SizedBox.shrink();\n"
    "        },\n"
    "      ),\n"
    "    ),\n"
    "  );\n"
    "  await tester.pumpAndSettle();\n"
    "  return snapshot;\n"
    "}\n"
    "\n"
    "void main() {\n"
    "  test('global framework delegates support every approved locale', () {\n"
    "    for (final locale in SchoolLocalePolicy.supportedLocales) {\n"
    "      expect(GlobalMaterialLocalizations.delegate.isSupported(locale), isTrue);\n"
    "      expect(GlobalWidgetsLocalizations.delegate.isSupported(locale), isTrue);\n"
    "      expect(GlobalCupertinoLocalizations.delegate.isSupported(locale), isTrue);\n"
    "    }\n"
    "  });\n"
    "\n"
    "  testWidgets('Bangla and Arabic use translated framework localizations', (\n"
    "    tester,\n"
    "  ) async {\n"
    "    final english = await _frameworkSnapshot(tester, const Locale('en'));\n"
    "    final bangla = await _frameworkSnapshot(tester, const Locale('bn'));\n"
    "    final arabic = await _frameworkSnapshot(tester, const Locale('ar'));\n"
    "\n"
    "    expect(bangla.material, isNot(isA<DefaultMaterialLocalizations>()));\n"
    "    expect(bangla.cupertino, isNot(isA<DefaultCupertinoLocalizations>()));\n"
    "    expect(arabic.material, isNot(isA<DefaultMaterialLocalizations>()));\n"
    "    expect(arabic.cupertino, isNot(isA<DefaultCupertinoLocalizations>()));\n"
    "\n"
    "    expect(bangla.material.cancelButtonLabel,\n"
    "        isNot(english.material.cancelButtonLabel));\n"
    "    expect(arabic.material.cancelButtonLabel,\n"
    "        isNot(english.material.cancelButtonLabel));\n"
    "    expect(bangla.direction, TextDirection.ltr);\n"
    "    expect(arabic.direction, TextDirection.rtl);\n"
    "  });\n"
    "}\n"""
)
