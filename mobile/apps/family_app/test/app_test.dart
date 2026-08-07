import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_family_app/main.dart';

void main() {
  testWidgets('switches from guardian to student without exposing fees', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: FamilyApp()));
    await tester.pumpAndSettle();

    expect(find.text('Family overview'), findsOneWidget);
    expect(find.text('Fees'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.switch_account_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Student profile'));
    await tester.pumpAndSettle();

    expect(find.text('My school day'), findsOneWidget);
    expect(find.text('Fees'), findsNothing);
  });
}
