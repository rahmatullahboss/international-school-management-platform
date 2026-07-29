import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_design_system.dart';

void main() {
  test('theme keeps the approved operational action color', () {
    expect(SchoolTheme.light().colorScheme.primary, SchoolColors.actionTeal);
  });

  testWidgets('status banner exposes its written status', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: SchoolTheme.light(),
        home: const Scaffold(
          body: SchoolStatusBanner(
            label: 'Saved on device',
            message: 'Two changes are waiting to sync.',
            tone: SchoolStatusTone.warning,
          ),
        ),
      ),
    );

    expect(find.text('Saved on device'), findsOneWidget);
    expect(find.text('Two changes are waiting to sync.'), findsOneWidget);
    expect(find.byIcon(Icons.warning_amber_outlined), findsOneWidget);
  });
}
