from pathlib import Path

main_path = Path('mobile/apps/family_app/lib/main.dart')
main = main_path.read_text()
import_anchor = "import 'package:school_family_app/family_interaction_strings.dart';\n"
import_line = "import 'package:school_family_app/family_utc_presentation.dart';\n"
if import_line not in main:
    if import_anchor not in main:
        raise SystemExit('Family interaction strings import anchor missing')
    main = main.replace(import_anchor, import_anchor + import_line, 1)
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
