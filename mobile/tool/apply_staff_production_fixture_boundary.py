from pathlib import Path
import re

path = Path('mobile/apps/staff_app/lib/main.dart')
text = path.read_text()

import_anchor = "import 'package:school_staff_app/staff_production_strings.dart';\n"
import_line = "import 'package:school_staff_app/staff_server_boundary_strings.dart';\n"
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit('staff strings import anchor missing')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

replacement = r'''class StaffGradebookScreen extends StatelessWidget {
  const StaffGradebookScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final strings = StaffServerBoundaryStrings.forLocale(
      Localizations.localeOf(context),
    );
    return ListView(
      children: [
        SchoolPageSection(
          description: strings.gradebookDescription,
          title: strings.gradebookTitle,
          child: SchoolStatusBanner(
            label: strings.gradebookLabel,
            message: strings.gradebookMessage,
            tone: SchoolStatusTone.information,
          ),
        ),
      ],
    );
  }
}

class StaffMessagesScreen extends StatelessWidget {
  const StaffMessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final strings = StaffServerBoundaryStrings.forLocale(
      Localizations.localeOf(context),
    );
    return ListView(
      children: [
        SchoolPageSection(
          description: strings.messagesDescription,
          title: strings.messagesTitle,
          child: SchoolStatusBanner(
            label: strings.messagesLabel,
            message: strings.messagesMessage,
            tone: SchoolStatusTone.information,
          ),
        ),
      ],
    );
  }
}

class _AttendanceRow'''

pattern = re.compile(
    r'class StaffGradebookScreen extends StatelessWidget \{.*?\nclass _AttendanceRow',
    re.S,
)
if replacement not in text:
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit(f'gradebook/messages fixture block expected once, replaced {count}')

path.write_text(text)
