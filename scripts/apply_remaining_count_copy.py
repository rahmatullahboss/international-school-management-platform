from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one match in {path}, found {count}: {old[:100]!r}")
    target.write_text(source.replace(old, new, 1))


staff = "mobile/apps/staff_app/lib/teacher_production_journeys.dart"
replace_once(
    staff,
    "  String rosterStudents(int count) => _strings.rosterStudents(count);\n\n  String encryptedOperationsWaiting(int count) =>",
    "  String rosterStudents(int count) => _strings.rosterStudents(count);\n\n  String assignedMeetings(int count) => _strings.assignedMeetings(count);\n\n  String encryptedOperationsWaiting(int count) =>",
)
replace_once(
    staff,
    "    builder: (context, state) {\n      final today = state.today!;\n      return ListView(\n        children: [\n          SchoolPageSection(\n            description:\n                'Assigned meetings and substitutions for the selected school campus.',",
    "    builder: (context, state) {\n      final today = state.today!;\n      final countCopy = StaffProductionCountCopy.of(context);\n      return ListView(\n        children: [\n          SchoolPageSection(\n            description:\n                '${countCopy.assignedMeetings(today.meetings.length)} · '\n                'Assigned meetings and substitutions for the selected school campus.',",
)

family = "mobile/apps/family_app/lib/family_interaction_screens.dart"
replace_once(
    family,
    "  String openConversations(int count) => _strings.openConversations(count);\n}",
    "  String openConversations(int count) => _strings.openConversations(count);\n\n  String unreadMessages(int count) => _strings.unreadMessages(count);\n}",
)
replace_once(
    family,
    "                              '${interactions.conversations[index].unreadCount} unread · ${_familyDateTimeLabel(context, interactions.conversations[index].latestMessageAt)}',",
    "                              '${countCopy.unreadMessages(interactions.conversations[index].unreadCount)} · ${_familyDateTimeLabel(context, interactions.conversations[index].latestMessageAt)}',",
)

staff_test = "mobile/apps/staff_app/test/staff_production_count_copy_test.dart"
replace_once(
    staff_test,
    "    expect(copy.rosterStudents(1), '1 student');\n    expect(copy.rosterStudents(24), '24 students');",
    "    expect(copy.rosterStudents(1), '1 student');\n    expect(copy.rosterStudents(24), '24 students');\n    expect(copy.assignedMeetings(0), 'No assigned meetings');\n    expect(copy.assignedMeetings(2), '2 assigned meetings');",
)
replace_once(
    staff_test,
    "    expect(copy.rosterStudents(12), '১২ জন শিক্ষার্থী');",
    "    expect(copy.rosterStudents(12), '১২ জন শিক্ষার্থী');\n    expect(copy.assignedMeetings(3), '৩টি নির্ধারিত ক্লাস');",
)
replace_once(
    staff_test,
    "    expect(copy.rosterStudents(2), 'طالبان');",
    "    expect(copy.rosterStudents(2), 'طالبان');\n    expect(copy.assignedMeetings(2), 'حصتان مسندتان');",
)
replace_once(
    staff_test,
    "    expect(() => copy.rosterStudents(-1), throwsRangeError);",
    "    expect(() => copy.rosterStudents(-1), throwsRangeError);\n    expect(() => copy.assignedMeetings(-1), throwsRangeError);",
)

family_test = "mobile/apps/family_app/test/family_production_count_copy_test.dart"
replace_once(
    family_test,
    "    expect(copy.openConversations(3), '3 open conversations');",
    "    expect(copy.openConversations(3), '3 open conversations');\n    expect(copy.unreadMessages(0), 'No unread messages');\n    expect(copy.unreadMessages(2), '2 unread messages');",
)
replace_once(
    family_test,
    "    expect(copy.openConversations(4), '৪টি চলমান কথোপকথন');",
    "    expect(copy.openConversations(4), '৪টি চলমান কথোপকথন');\n    expect(copy.unreadMessages(2), '২টি অপঠিত বার্তা');",
)
replace_once(
    family_test,
    "    expect(copy.openConversations(2), 'محادثتان مفتوحتان');",
    "    expect(copy.openConversations(2), 'محادثتان مفتوحتان');\n    expect(copy.unreadMessages(2), 'رسالتان غير مقروءتين');",
)
replace_once(
    family_test,
    "    expect(() => copy.openConversations(-1), throwsRangeError);",
    "    expect(() => copy.openConversations(-1), throwsRangeError);\n    expect(() => copy.unreadMessages(-1), throwsRangeError);",
)
