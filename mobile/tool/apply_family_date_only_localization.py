from pathlib import Path

main_path = Path('mobile/apps/family_app/lib/main.dart')
main = main_path.read_text()
anchor = "import 'package:school_family_app/family_interaction_strings.dart';\n"
line = "import 'package:school_family_app/family_date_only_presentation.dart';\n"
if line not in main:
    if anchor not in main:
        raise SystemExit('Family interaction import anchor missing')
    main = main.replace(anchor, line + anchor, 1)
main_path.write_text(main)

screens_path = Path('mobile/apps/family_app/lib/family_interaction_screens.dart')
screens = screens_path.read_text()
old_label = """  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    icon: const Icon(Icons.calendar_today_outlined),
    label: Text(value == null ? label : '$label · $value'),
    onPressed: () async {
      final now = DateTime.now();
      final selected = await showDatePicker(
        context: context,
        firstDate: DateTime(now.year - 1),
        initialDate: DateTime.tryParse(value ?? '') ?? now,
        lastDate: DateTime(now.year + 5),
      );
      if (selected != null) {
        onChanged(
          '${selected.year.toString().padLeft(4, '0')}-${selected.month.toString().padLeft(2, '0')}-${selected.day.toString().padLeft(2, '0')}',
        );
      }
    },
  );
"""
new_label = """  @override
  Widget build(BuildContext context) {
    final displayValue = value == null
        ? null
        : FamilyDateOnlyPresentation.display(context, value!);
    return OutlinedButton.icon(
      icon: const Icon(Icons.calendar_today_outlined),
      label: Text(displayValue == null ? label : '$label · $displayValue'),
      onPressed: () async {
        final now = DateTime.now();
        final selected = await showDatePicker(
          context: context,
          firstDate: DateTime(now.year - 1),
          initialDate: FamilyDateOnlyPresentation.parse(value) ?? now,
          lastDate: DateTime(now.year + 5),
        );
        if (selected != null) {
          onChanged(FamilyDateOnlyPresentation.encode(selected));
        }
      },
    );
  }
"""
if old_label in screens:
    screens = screens.replace(old_label, new_label, 1)
elif new_label not in screens:
    raise SystemExit('Family date field anchor missing')
screens_path.write_text(screens)
