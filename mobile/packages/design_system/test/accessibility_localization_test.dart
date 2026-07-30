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
      expect(
        SchoolLocalePolicy.resolveSupportedLocale(
          const Locale('fr', 'FR'),
          SchoolLocalePolicy.supportedLocales,
        ),
        SchoolLocalePolicy.fallbackLocale,
      );
    });

    test(
      'uses the first supported device preference without scope inference',
      () {
        expect(
          SchoolLocalePolicy.resolvePreferredLocales(const [
            Locale('fr', 'FR'),
            Locale('bn', 'BD'),
            Locale('ar', 'SA'),
          ], SchoolLocalePolicy.supportedLocales),
          const Locale('bn'),
        );
        expect(
          SchoolLocalePolicy.resolvePreferredLocales(const [
            Locale('fr', 'FR'),
          ], SchoolLocalePolicy.supportedLocales),
          SchoolLocalePolicy.fallbackLocale,
        );
      },
    );

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
      expect(bangla.teacherProfile, 'শিক্ষক প্রোফাইল');
      expect(arabic.home, 'الرئيسية');
      expect(arabic.signOut, 'تسجيل الخروج');
      expect(arabic.teacherProfile, 'ملف المعلم');
      expect(fallback.familyAppName, 'School Family');
    });
  });

  testWidgets('localization delegates load Arabic copy and RTL direction', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('ar', 'SA'),
        localeResolutionCallback:
            SchoolLocalizationConfiguration.localeResolutionCallback,
        localizationsDelegates:
            SchoolLocalizationConfiguration.localizationsDelegates,
        supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
        home: Builder(
          builder: (context) {
            final strings = SchoolShellStrings.of(context);
            return Scaffold(body: Center(child: Text(strings.home)));
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    final home = find.text('الرئيسية');
    expect(home, findsOneWidget);
    expect(Directionality.of(tester.element(home)), TextDirection.rtl);
    expect(
      WidgetsLocalizations.of(tester.element(home)).textDirection,
      TextDirection.rtl,
    );
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
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('ar', 'SA'),
        localeResolutionCallback:
            SchoolLocalizationConfiguration.localeResolutionCallback,
        localizationsDelegates:
            SchoolLocalizationConfiguration.localizationsDelegates,
        supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
        home: Builder(
          builder: (context) {
            final strings = SchoolShellStrings.of(context);
            return SchoolAdaptiveScaffold(
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
            );
          },
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(
      Directionality.of(tester.element(find.text('عائلة المدرسة'))),
      TextDirection.rtl,
    );
    expect(find.text('الرئيسية'), findsOneWidget);
    expect(find.text('الحضور'), findsOneWidget);

    const statusLabel = 'تم التحقق. المعلومات المدرسية المنشورة متاحة.';
    final statusSemantics = tester.widget<Semantics>(
      find.byWidgetPredicate(
        (widget) =>
            widget is Semantics && widget.properties.label == statusLabel,
      ),
    );
    expect(statusSemantics.properties.label, statusLabel);
  });

  test('bidirectional dynamic content is sanitized and isolated', () {
    const maliciousIdentifier = 'invoice\u202Ecod.exe\u2069';
    final isolated = SchoolBidirectionalText.isolate(maliciousIdentifier);

    expect(isolated, startsWith('\u2068'));
    expect(isolated, endsWith('\u2069'));
    expect(isolated, isNot(contains('\u202E')));
    expect(isolated.substring(1, isolated.length - 1), 'invoicecod.exe');
  });

  test('reduced-motion preference removes nonessential animation duration', () {
    final preferences = SchoolAccessibilityPreferences.fromMediaQuery(
      const MediaQueryData().copyWith(
        boldText: true,
        disableAnimations: true,
        highContrast: true,
        textScaler: const TextScaler.linear(2),
      ),
    );

    expect(preferences.boldText, isTrue);
    expect(preferences.highContrast, isTrue);
    expect(preferences.reduceMotion, isTrue);
    expect(
      preferences.motionDuration(const Duration(milliseconds: 250)),
      Duration.zero,
    );
    expect(preferences.textScaler.scale(10), 20);
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
