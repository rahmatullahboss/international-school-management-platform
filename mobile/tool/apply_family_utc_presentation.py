from pathlib import Path

main_path = Path('mobile/apps/family_app/lib/main.dart')
main = main_path.read_text()
interaction_import = "import 'package:school_family_app/family_interaction_strings.dart';\n"
production_import = "import 'package:school_family_app/family_production_strings.dart';\n"
utc_import = "import 'package:school_family_app/family_utc_presentation.dart';\n"

if utc_import not in main:
    if production_import not in main:
        raise SystemExit('Family production strings import anchor missing')
    main = main.replace(production_import, production_import + utc_import, 1)
else:
    current_order = interaction_import + utc_import + production_import
    preferred_order = interaction_import + production_import + utc_import
    if current_order in main:
        main = main.replace(current_order, preferred_order, 1)
    elif preferred_order not in main:
        raise SystemExit('Family app import-order anchor missing')
main_path.write_text(main)

screens_path = Path('mobile/apps/family_app/lib/family_interaction_screens.dart')
screens = screens_path.read_text()
old = """String _familyDateLabel(BuildContext context, DateTime value) =>
    MaterialLocalizations.of(context).formatMediumDate(value.toLocal());

String _familyDateTimeLabel(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final localizations = MaterialLocalizations.of(context);
  return '${localizations.formatMediumDate(local)} · ${localizations.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
}
"""
new = """String _familyDateLabel(BuildContext context, DateTime value) =>
    FamilyUtcPresentation.date(context, value);

String _familyDateTimeLabel(BuildContext context, DateTime value) =>
    FamilyUtcPresentation.dateTime(context, value);
"""
if old in screens:
    screens = screens.replace(old, new, 1)
elif new not in screens:
    raise SystemExit('Family device-timezone helper anchor missing')
screens_path.write_text(screens)
