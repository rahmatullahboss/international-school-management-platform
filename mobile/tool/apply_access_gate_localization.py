from pathlib import Path


def replace_count(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count == 0 and new in text:
        return text
    if count != expected:
        raise SystemExit(f'{label}: expected {expected} anchors, found {count}')
    return text.replace(old, new)


family_path = Path('mobile/apps/family_app/lib/production_app.dart')
family = family_path.read_text()
family = replace_count(
    family,
    "appName: 'School Family',",
    'application: MobileAccessApplication.family,',
    3,
    'Family access/configuration call sites',
)
family_path.write_text(family)

staff_path = Path('mobile/apps/staff_app/lib/production_app.dart')
staff = staff_path.read_text()
staff = replace_count(
    staff,
    "appName: 'School Staff',",
    'application: MobileAccessApplication.staff,',
    3,
    'Staff access/configuration call sites',
)
staff_path.write_text(staff)

bootstrap_test_path = Path('mobile/packages/app_bootstrap/test/app_bootstrap_test.dart')
test = bootstrap_test_path.read_text()
test = replace_count(
    test,
    "appName: 'School Family',",
    'application: MobileAccessApplication.family,',
    2,
    'existing access-gate test call sites',
)

material_anchor = '''MaterialApp(
        theme: SchoolTheme.light(),
        home: MobileAccessGate(
'''
material_replacement = '''MaterialApp(
        localizationsDelegates:
            SchoolLocalizationConfiguration.localizationsDelegates,
        supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
        theme: SchoolTheme.light(),
        home: MobileAccessGate(
'''
test = replace_count(
    test,
    material_anchor,
    material_replacement,
    2,
    'existing access-gate test localization configuration',
)

tap_anchor = "await tester.tap(find.text('International School').last);"
tap_replacement = '''await tester.tap(
      find.byKey(const ValueKey('access-tenant-1-campus-1-student')),
    );'''
test = replace_count(
    test,
    tap_anchor,
    tap_replacement,
    1,
    'existing access selection tap',
)
bootstrap_test_path.write_text(test)
