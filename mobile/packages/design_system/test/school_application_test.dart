import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_application.dart';
import 'package:school_design_system/school_localization.dart';

void main() {
  tearDown(() => SchoolLocaleRuntime.prefer(null));

  test('locale controller follows device locale until explicitly selected', () {
    final controller = SchoolLocaleController();

    expect(controller.followsDeviceLocale, isTrue);
    expect(controller.locale, isNull);

    controller.selectLocale(const Locale('bn', 'BD'));
    expect(controller.followsDeviceLocale, isFalse);
    expect(controller.locale, const Locale('bn'));

    controller.followDeviceLocale();
    expect(controller.followsDeviceLocale, isTrue);
    expect(controller.locale, isNull);
  });

  test('locale controller rejects unsupported explicit locales', () {
    expect(
      () => SchoolLocaleController(initialLocale: const Locale('fr', 'FR')),
      throwsArgumentError,
    );

    final controller = SchoolLocaleController();
    expect(
      () => controller.selectLocale(const Locale('fr', 'FR')),
      throwsArgumentError,
    );
  });

  test(
    'persisted locale initializes and cycles approved language codes',
    () async {
      final store = MemorySchoolLocalePreferenceStore(languageCode: 'bn');
      final controller = SchoolLocaleController(preferenceStore: store);

      expect(controller.isInitialized, isFalse);
      await controller.initialize();

      expect(controller.locale, const Locale('bn'));
      expect(SchoolLocaleRuntime.preferredLocale, const Locale('bn'));

      await controller.cycleAndPersist();
      expect(controller.locale, const Locale('ar'));
      expect(store.languageCode, 'ar');

      await controller.cycleAndPersist();
      expect(controller.followsDeviceLocale, isTrue);
      expect(store.languageCode, isNull);
    },
  );

  test('invalid stored locale is cleared without exposing the value', () async {
    final store = MemorySchoolLocalePreferenceStore(languageCode: 'fr');
    final controller = SchoolLocaleController(preferenceStore: store);

    await controller.initialize();

    expect(controller.followsDeviceLocale, isTrue);
    expect(store.languageCode, isNull);
    expect(controller.lastErrorCode, 'MOBILE_LOCALE_PREFERENCE_INVALID');
  });

  test('failed preference write keeps the active locale unchanged', () async {
    final controller = SchoolLocaleController(
      initialLocale: const Locale('en'),
      preferenceStore: _FailingLocalePreferenceStore(),
    );

    await controller.selectLocaleAndPersist(const Locale('bn'));

    expect(controller.locale, const Locale('en'));
    expect(controller.lastErrorCode, 'MOBILE_LOCALE_PREFERENCE_WRITE_FAILED');
  });

  test('runtime preference overrides the device locale resolver', () {
    SchoolLocaleRuntime.prefer(const Locale('ar'));

    expect(
      SchoolLocalizationConfiguration.localeListResolutionCallback(const [
        Locale('bn', 'BD'),
      ], SchoolLocalizationConfiguration.supportedLocales),
      const Locale('ar'),
    );
  });

  testWidgets('localized application switches Bangla and Arabic presentation', (
    tester,
  ) async {
    final controller = SchoolLocaleController(
      initialLocale: const Locale('bn', 'BD'),
    );

    await tester.pumpWidget(
      SchoolLocalizedMaterialApp(
        localeController: controller,
        titleBuilder: (strings) => strings.familyAppName,
        home: Builder(
          builder: (context) {
            final strings = SchoolShellStrings.of(context);
            return Scaffold(body: Center(child: Text(strings.home)));
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('হোম'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('হোম'))),
      TextDirection.ltr,
    );

    controller.selectLocale(const Locale('ar', 'SA'));
    await tester.pumpAndSettle();

    expect(find.text('الرئيسية'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('الرئيسية'))),
      TextDirection.rtl,
    );
  });

  testWidgets(
    'preference host explicitly selects and persists presentation language',
    (tester) async {
      final store = MemorySchoolLocalePreferenceStore(languageCode: 'bn');
      final controller = SchoolLocaleController(preferenceStore: store);
      await controller.initialize();

      await tester.pumpWidget(
        SchoolLocalePreferenceHost(
          controller: controller,
          appBuilder: (context, localeController) => MaterialApp(
            locale: localeController.locale,
            localeListResolutionCallback:
                SchoolLocalizationConfiguration.localeListResolutionCallback,
            localizationsDelegates:
                SchoolLocalizationConfiguration.localizationsDelegates,
            supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(child: Text(SchoolShellStrings.of(context).home)),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('হোম'), findsOneWidget);
      final launcher = find.byKey(const ValueKey('school-locale-control'));
      expect(tester.getSize(launcher).width, greaterThanOrEqualTo(48));
      expect(tester.getSize(launcher).height, greaterThanOrEqualTo(48));

      await tester.tap(launcher);
      await tester.pumpAndSettle();

      expect(find.text('Language'), findsOneWidget);
      expect(
        find.text(
          'Display language only. Account, school and permissions stay unchanged.',
        ),
        findsOneWidget,
      );
      for (final key in const [
        'school-locale-choice-device',
        'school-locale-choice-en',
        'school-locale-choice-bn',
        'school-locale-choice-ar',
      ]) {
        final option = find.byKey(ValueKey(key));
        expect(option, findsOneWidget);
        expect(tester.getSize(option).height, greaterThanOrEqualTo(48));
      }

      await tester.tap(find.byKey(const ValueKey('school-locale-choice-ar')));
      await tester.pumpAndSettle();

      expect(store.languageCode, 'ar');
      expect(controller.locale, const Locale('ar'));
      expect(find.text('الرئيسية'), findsOneWidget);
      expect(find.text('Language'), findsNothing);

      const semanticLabel =
          'Language preference. Current: Arabic. Activate to choose language.';
      final control = find.byWidgetPredicate(
        (widget) =>
            widget is Semantics && widget.properties.label == semanticLabel,
      );
      expect(control, findsOneWidget);
      final semantics = tester.widget<Semantics>(control);
      expect(semantics.properties.button, isTrue);
      expect(semantics.properties.enabled, isTrue);
      expect(semantics.properties.value, 'ع');

      await tester.tap(launcher);
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(const ValueKey('school-locale-choice-device')),
      );
      await tester.pumpAndSettle();

      expect(store.languageCode, isNull);
      expect(controller.followsDeviceLocale, isTrue);
    },
  );

  testWidgets(
    'failed explicit locale write keeps picker open and prior locale active',
    (tester) async {
      final controller = SchoolLocaleController(
        initialLocale: const Locale('en'),
        preferenceStore: _FailingLocalePreferenceStore(),
      );

      await tester.pumpWidget(
        SchoolLocalePreferenceHost(
          controller: controller,
          appBuilder: (context, localeController) => MaterialApp(
            locale: localeController.locale,
            localeListResolutionCallback:
                SchoolLocalizationConfiguration.localeListResolutionCallback,
            localizationsDelegates:
                SchoolLocalizationConfiguration.localizationsDelegates,
            supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
            home: const Scaffold(body: SizedBox()),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('school-locale-control')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('school-locale-choice-bn')));
      await tester.pumpAndSettle();

      expect(controller.locale, const Locale('en'));
      expect(controller.lastErrorCode, 'MOBILE_LOCALE_PREFERENCE_WRITE_FAILED');
      expect(find.text('Language'), findsOneWidget);
      expect(
        find.text(
          'Language preference was not saved. Your previous setting is still active.',
        ),
        findsOneWidget,
      );
    },
  );
}

final class _FailingLocalePreferenceStore
    implements SchoolLocalePreferenceStore {
  @override
  Future<String?> readLanguageCode() async => 'en';

  @override
  Future<void> writeLanguageCode(String? languageCode) async {
    throw StateError('write unavailable');
  }
}
