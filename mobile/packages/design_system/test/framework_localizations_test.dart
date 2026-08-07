import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_localization.dart';

void main() {
  testWidgets(
    'loads reviewed Flutter framework translations for Bangla and Arabic',
    (tester) async {
      const probeKey = Key('framework-localization-probe');

      for (final locale in const [Locale('bn', 'BD'), Locale('ar', 'SA')]) {
        MaterialLocalizations? material;
        CupertinoLocalizations? cupertino;

        await tester.pumpWidget(
          MaterialApp(
            locale: locale,
            localeResolutionCallback:
                SchoolLocalizationConfiguration.localeResolutionCallback,
            localizationsDelegates:
                SchoolLocalizationConfiguration.localizationsDelegates,
            supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
            home: Builder(
              builder: (context) {
                material = MaterialLocalizations.of(context);
                cupertino = CupertinoLocalizations.of(context);
                return const SizedBox(key: probeKey);
              },
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(material, isNotNull);
        expect(cupertino, isNotNull);
        expect(material, isNot(isA<DefaultMaterialLocalizations>()));
        expect(cupertino, isNot(isA<DefaultCupertinoLocalizations>()));
        expect(
          WidgetsLocalizations.of(
            tester.element(find.byKey(probeKey)),
          ).textDirection,
          SchoolLocalePolicy.textDirectionFor(locale),
        );
      }
    },
  );
}
