import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_application.dart';
import 'package:school_design_system/school_localization.dart';

void main() {
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
}
