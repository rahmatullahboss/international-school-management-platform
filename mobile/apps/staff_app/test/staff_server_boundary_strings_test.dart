import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_staff_app/main.dart';
import 'package:school_staff_app/staff_server_boundary_strings.dart';

void main() {
  test('provides reviewed Staff server-boundary copy in en bn ar', () {
    final english = StaffServerBoundaryStrings.forLocale(const Locale('en'));
    final bangla = StaffServerBoundaryStrings.forLocale(const Locale('bn'));
    final arabic = StaffServerBoundaryStrings.forLocale(const Locale('ar'));

    expect(english.gradebookTitle, 'Gradebook unavailable');
    expect(english.messagesLabel, 'No substitute conversations shown');
    expect(bangla.gradebookLabel, 'বিকল্প মূল্যায়ন ডেটা দেখানো হয়নি');
    expect(bangla.messagesTitle, 'বার্তা পাওয়া যাচ্ছে না');
    expect(arabic.gradebookTitle, 'سجل الدرجات غير متاح');
    expect(arabic.messagesLabel, 'لم يتم عرض محادثات بديلة');
  });

  testWidgets('gradebook production surface never renders fixture scores', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: StaffGradebookScreen()),
    );

    expect(find.text('Gradebook unavailable'), findsOneWidget);
    expect(find.text('No substitute assessment data shown'), findsOneWidget);
    expect(find.text('Mathematics quiz 3'), findsNothing);
    expect(find.text('18 of 24 results entered · Draft'), findsNothing);
  });

  testWidgets('messages production surface never renders fixture conversations', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: StaffMessagesScreen()),
    );

    expect(find.text('Messages unavailable'), findsOneWidget);
    expect(find.text('No substitute conversations shown'), findsOneWidget);
    expect(find.text('Grade 5A guardians'), findsNothing);
    expect(find.text('Academic office'), findsNothing);
  });
}
