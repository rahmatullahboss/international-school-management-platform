import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_design_system.dart';
import 'package:school_design_system/school_localization.dart';

void main() {
  group('school locale policy', () {
    test('supports English, Bangla and Arabic with safe fallback', () {
      expect(SchoolLocalePolicy.isSupported(const Locale('en', 'GB')), isTrue);
      expect(SchoolLocalePolicy.isSupported(const Locale('bn', 'BD')), isTrue);
      expect(SchoolLocalePolicy.isSupported(const Locale('ar', 'SA')), isTrue);
      expect(SchoolLocalePolicy.isSupported(const Locale('fr', 'FR')), isFalse);
      expect(
        SchoolLocalePolicy.resolve(const Locale('fr', 'FR')),
        SchoolLanguage.english,
      );
    });

    test('uses RTL only for the approved Arabic locale', () {
      expect(
        SchoolLocalePolicy.textDirectionFor(const Locale('ar', 'SA')),
        TextDirection.rtl,
      );
      expect(
        SchoolLocalePolicy.textDirectionFor(const Locale('bn', 'BD')),
        TextDirection.ltr,
      );
      expect(
        SchoolLocalePolicy.textDirectionFor(const Locale('en', 'US')),
        TextDirection.ltr,
      );
    });

    test('provides localized shell copy without authority values', () {
      final bangla = SchoolShellStrings.forLocale(const Locale('bn', 'BD'));
      final arabic = SchoolShellStrings.forLocale(const Locale('ar', 'SA'));
      final fallback = SchoolShellStrings.forLocale(const Locale('fr', 'FR'));

      expect(bangla.attendance, 'উপস্থিতি');
      expect(bangla.signOut, 'সাইন আউট');
      expect(arabic.home, 'الرئيسية');
      expect(arabic.signOut, 'تسجيل الخروج');
      expect(fallback.familyAppName, 'School Family');
    });
  });

  testWidgets('adaptive scaffold survives 200 percent text scaling', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final strings = SchoolShellStrings.forLocale(const Locale('en', 'US'));
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: const TextScaler.linear(
              SchoolAccessibilityTargets.requiredTextScale,
            ),
          ),
          child: child!,
        ),
        home: SchoolAdaptiveScaffold(
          body: ListView(
            children: const [
              SchoolPageSection(
                description:
                    'Published information remains readable without '
                    'truncating authority or status text.',
                title: 'Family overview',
                child: SchoolPanel(
                  child: Text(
                    'Attendance, results, fees, services and conversations.',
                  ),
                ),
              ),
            ],
          ),
          destinations: const [
            SchoolDestination(
              icon: Icons.home_outlined,
              label: 'Home',
              selectedIcon: Icons.home,
            ),
            SchoolDestination(
              icon: Icons.fact_check_outlined,
              label: 'Attendance',
              selectedIcon: Icons.fact_check,
            ),
            SchoolDestination(
              icon: Icons.school_outlined,
              label: 'Results',
              selectedIcon: Icons.school,
            ),
            SchoolDestination(
              icon: Icons.receipt_long_outlined,
              label: 'Fees',
              selectedIcon: Icons.receipt_long,
            ),
            SchoolDestination(
              icon: Icons.forum_outlined,
              label: 'Messages',
              selectedIcon: Icons.forum,
            ),
          ],
          onDestinationSelected: (_) {},
          selectedIndex: 0,
          status: const SchoolStatusBanner(
            label: 'Published information',
            message: 'Verified school information is available.',
            tone: SchoolStatusTone.success,
          ),
          title: strings.familyAppName,
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Family overview'), findsOneWidget);
    expect(find.text('Published information'), findsOneWidget);
  });

  testWidgets('Arabic shell follows RTL reading order and written semantics', (
    tester,
  ) async {
    final strings = SchoolShellStrings.forLocale(const Locale('ar', 'SA'));

    await tester.pumpWidget(
      MaterialApp(
        home: Directionality(
          textDirection: SchoolLocalePolicy.textDirectionFor(
            const Locale('ar', 'SA'),
          ),
          child: SchoolAdaptiveScaffold(
            body: const Center(child: Text('معلومات منشورة')),
            destinations: [
              SchoolDestination(
                icon: Icons.home_outlined,
                label: strings.home,
                selectedIcon: Icons.home,
              ),
              SchoolDestination(
                icon: Icons.fact_check_outlined,
                label: strings.attendance,
                selectedIcon: Icons.fact_check,
              ),
            ],
            onDestinationSelected: (_) {},
            selectedIndex: 0,
            status: const SchoolStatusBanner(
              label: 'تم التحقق',
              message: 'المعلومات المدرسية المنشورة متاحة.',
              tone: SchoolStatusTone.success,
            ),
            title: strings.familyAppName,
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(
      Directionality.of(tester.element(find.text(strings.familyAppName))),
      TextDirection.rtl,
    );
    expect(find.text(strings.home), findsOneWidget);
    expect(find.text(strings.attendance), findsOneWidget);

    const statusLabel = 'تم التحقق. المعلومات المدرسية المنشورة متاحة.';
    final statusSemantics = tester.widget<Semantics>(
      find.byWidgetPredicate(
        (widget) =>
            widget is Semantics && widget.properties.label == statusLabel,
      ),
    );
    expect(statusSemantics.properties.label, statusLabel);
  });

  testWidgets('interactive controls preserve the 48 logical pixel target', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: SchoolTheme.light(),
        home: Scaffold(
          body: Center(
            child: FilledButton(
              onPressed: () {},
              child: const Text('Continue'),
            ),
          ),
        ),
      ),
    );

    final size = tester.getSize(find.byType(FilledButton));
    expect(
      size.width,
      greaterThanOrEqualTo(SchoolAccessibilityTargets.minimumInteractiveExtent),
    );
    expect(
      size.height,
      greaterThanOrEqualTo(SchoolAccessibilityTargets.minimumInteractiveExtent),
    );
  });
}
