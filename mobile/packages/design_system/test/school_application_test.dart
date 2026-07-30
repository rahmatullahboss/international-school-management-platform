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

  test('persisted locale initializes and cycles approved language codes', () async {
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
  });

  test('invalid stored locale is cleared without exposing the value', () async {
    final store = MemorySchoolLocalePreferenceStore(languageCode: 'fr');
    final controller = SchoolLocaleController(preferenceStore: store);

    await controller.initialize();

    expect(controller.followsDeviceLocale, isTrue);
    expect(store.languageCode, isNull);
    expect(
      controller.lastErrorCode,
      'MOBILE_LOCALE_PREFERENCE_INVALID',
    );
  });

  test('failed preference write keeps the active locale unchanged', () async {
    final controller = SchoolLocaleController(
      initialLocale: const Locale('en'),
      preferenceStore: _FailingLocalePreferenceStore(),
    );

    await controller.selectLocaleAndPersist(const Locale('bn'));

    expect(controller.locale, const Locale('en'));
    expect(
      controller.lastErrorCode,
      'MOBILE_LOCALE_PREFERENCE_WRITE_FAILED',
    );
  });

  test('runtime preference overrides the device locale resolver', () {
    SchoolLocaleRuntime.prefer(const Locale('ar'));

    expect(
      SchoolLocalizationConfiguration.localeListResolutionCallback(
        const [Locale('bn', 'BD')],
        SchoolLocalizationConfiguration.supportedLocales,
      ),
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

  testWidgets('preference host cycles locale and preserves an accessible target', (
    tester,
  ) async {
    final store = MemorySchoolLocalePreferenceStore(languageCode: 'bn');
    final controller = SchoolLocaleController(preferenceStore: store);
    await controller.initialize();

    await tester.pumpWidget(
      SchoolLocalePreferenceHost(
        controller: controller,
        appBuilder: (context, localeController) => MaterialApp(
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
    expect(find.text('বাংলা'), findsOneWidget);
    expect(tester.getSize(find.text('বাংলা').first).height, lessThan(56));

    await tester.tap(find.text('বাংলা'));
    await tester.pumpAndSettle();

    expect(store.languageCode, 'ar');
    expect(find.text('الرئيسية'), findsOneWidget);
    expect(find.text('ع'), findsOneWidget);

    final control = find.bySemanticsLabel(
      'Language preference: Arabic. Activate to use device language.',
    );
    expect(control, findsOneWidget);
    expect(tester.getSize(control).width, greaterThanOrEqualTo(48));
    expect(tester.getSize(control).height, greaterThanOrEqualTo(48));
  });
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
