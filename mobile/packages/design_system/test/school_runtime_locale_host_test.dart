import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_application.dart';
import 'package:school_design_system/school_localization.dart';

void main() {
  tearDown(() => SchoolLocaleRuntime.prefer(null));

  testWidgets(
    'preference host recomposes shared Material localization without app reset',
    (tester) async {
      final store = MemorySchoolLocalePreferenceStore(languageCode: 'bn');
      final controller = SchoolLocaleController(preferenceStore: store);
      await controller.initialize();

      await tester.pumpWidget(
        SchoolLocalePreferenceHost(
          controller: controller,
          appBuilder: (context, localeController) => SchoolLocalizedMaterialApp(
            titleBuilder: (strings) => strings.familyAppName,
            home: const _StateProbe(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('হোম'), findsOneWidget);
      await tester.tap(find.text('Increment'));
      await tester.pumpAndSettle();
      expect(find.text('Count 1'), findsOneWidget);

      await tester.tap(find.text('বাংলা'));
      await tester.pumpAndSettle();

      expect(store.languageCode, 'ar');
      expect(find.text('الرئيسية'), findsOneWidget);
      expect(find.text('Count 1'), findsOneWidget);
    },
  );
}

final class _StateProbe extends StatefulWidget {
  const _StateProbe();

  @override
  State<_StateProbe> createState() => _StateProbeState();
}

final class _StateProbeState extends State<_StateProbe> {
  int _count = 0;

  @override
  Widget build(BuildContext context) {
    final strings = SchoolShellStrings.of(context);
    return Scaffold(
      body: Column(
        children: [
          Text(strings.home),
          Text('Count $_count'),
          FilledButton(
            onPressed: () => setState(() => _count += 1),
            child: const Text('Increment'),
          ),
        ],
      ),
    );
  }
}
