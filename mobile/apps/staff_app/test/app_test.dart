import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_staff_app/main.dart';

void main() {
  testWidgets('marks attendance locally and completes the demo sync', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: StaffApp()));
    await tester.pumpAndSettle();

    expect(find.text('Teacher day'), findsOneWidget);

    await tester.tap(find.text('Attendance'));
    await tester.pumpAndSettle();
    expect(find.text('Attendance draft'), findsOneWidget);

    await tester.tap(find.text('Absent').first);
    await tester.pumpAndSettle();
    expect(
      find.text('1 attendance change(s) are waiting to sync.'),
      findsOneWidget,
    );

    await tester.tap(find.text('Complete demo sync (1)'));
    await tester.pumpAndSettle();
    expect(find.text('All changes synced'), findsOneWidget);
  });
}
