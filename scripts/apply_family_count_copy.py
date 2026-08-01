from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one match in {path}, found {count}: {old[:80]!r}")
    target.write_text(source.replace(old, new, 1))


replace_once(
    "mobile/apps/family_app/lib/main.dart",
    "import 'package:school_design_system/school_application.dart';\nimport 'package:school_design_system/school_design_system.dart';",
    "import 'package:school_design_system/school_application.dart';\nimport 'package:school_design_system/school_count_strings.dart';\nimport 'package:school_design_system/school_design_system.dart';",
)

replace_once(
    "mobile/apps/family_app/lib/family_interaction_screens.dart",
    "part of 'main.dart';\n\nclass _FamilyServicesScreen extends StatelessWidget {",
    "part of 'main.dart';\n\nfinal class FamilyProductionCountCopy {\n  FamilyProductionCountCopy.forLocale(Locale locale)\n    : _strings = SchoolCountStrings.forLocale(locale);\n\n  factory FamilyProductionCountCopy.of(BuildContext context) =>\n      FamilyProductionCountCopy.forLocale(Localizations.localeOf(context));\n\n  final SchoolCountStrings _strings;\n\n  String documentsAvailable(int count) => _strings.documentsAvailable(count);\n\n  String formsAwaitingResponse(int count) =>\n      _strings.formsAwaitingResponse(count);\n\n  String openConversations(int count) => _strings.openConversations(count);\n}\n\nclass _FamilyServicesScreen extends StatelessWidget {",
)

replace_once(
    "mobile/apps/family_app/lib/family_interaction_screens.dart",
    "          return ListView(\n            children: [\n              SchoolPageSection(\n                description:\n                    'Only metadata is shown. Restricted files remain no-store and raw download credentials are never exposed.',\n                title: '${directory.activeStudent.displayName} documents',",
    "          final countCopy = FamilyProductionCountCopy.of(context);\n          return ListView(\n            children: [\n              SchoolPageSection(\n                description:\n                    '${countCopy.documentsAvailable(interactions.documents.length)} · '\n                    'Only metadata is shown. Restricted files remain no-store and raw download credentials are never exposed.',\n                title: '${directory.activeStudent.displayName} documents',",
)

replace_once(
    "mobile/apps/family_app/lib/family_interaction_screens.dart",
    "          return ListView(\n            children: [\n              SchoolPageSection(\n                description:\n                    'Submission uses the server-issued base and schema versions. The client does not infer a newer revision.',\n                title: '${directory.activeStudent.displayName} forms',",
    "          final countCopy = FamilyProductionCountCopy.of(context);\n          final openFormCount = interactions.forms\n              .where((form) => form.status == FamilyFormStatus.open)\n              .length;\n          return ListView(\n            children: [\n              SchoolPageSection(\n                description:\n                    '${countCopy.formsAwaitingResponse(openFormCount)} · '\n                    'Submission uses the server-issued base and schema versions. The client does not infer a newer revision.',\n                title: '${directory.activeStudent.displayName} forms',",
)

replace_once(
    "mobile/apps/family_app/lib/family_interaction_screens.dart",
    "          return ListView(\n            children: [\n              SchoolPageSection(\n                description:\n                    'Conversation access follows the active school relationship and capability scope.',\n                title: '${directory.activeStudent.displayName} conversations',",
    "          final countCopy = FamilyProductionCountCopy.of(context);\n          return ListView(\n            children: [\n              SchoolPageSection(\n                description:\n                    '${countCopy.openConversations(interactions.conversations.length)} · '\n                    'Conversation access follows the active school relationship and capability scope.',\n                title: '${directory.activeStudent.displayName} conversations',",
)
