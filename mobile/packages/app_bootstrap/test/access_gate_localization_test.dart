import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_app_bootstrap/school_app_bootstrap.dart';
import 'package:school_design_system/school_design_system.dart';
import 'package:school_mobile_core/mobile_core.dart';

void main() {
  testWidgets('Family signed-out access gate renders reviewed Bangla copy', (
    tester,
  ) async {
    await tester.pumpWidget(
      localizedApp(
        locale: const Locale('bn'),
        home: MobileAccessGate(
          application: MobileAccessApplication.family,
          onRetry: () async {},
          onSelectAccess: (_) {},
          onSignIn: () async {},
          onSignOut: () async {},
          state: const MobileApplicationState.signedOut(),
        ),
      ),
    );

    expect(find.text('স্কুল ফ্যামিলি'), oneWidget);
    expect(find.text('চালিয়ে যেতে সাইন ইন করুন'), oneWidget);
    expect(find.text('নিরাপদভাবে সাইন ইন করুন'), oneWidget);
    expect(find.text('Sign in to continue'), findsNothing);
  });

  testWidgets('Arabic configuration failure localizes app and support copy', (
    tester,
  ) async {
    await tester.pumpWidget(
      localizedApp(
        locale: const Locale('ar'),
        home: const MobileConfigurationFailureScreen(
          application: MobileAccessApplication.staff,
          reasonCode: 'STAFF_CONFIGURATION_REQUIRED',
        ),
      ),
    );

    expect(find.text('طاقم المدرسة'), oneWidget);
    expect(find.text('يلزم إعداد التطبيق'), oneWidget);
    expect(find.textContaining('رمز الدعم'), oneWidget);
    expect(find.textContaining('STAFF_CONFIGURATION_REQUIRED'), oneWidget);
    expect(
      Directionality.of(tester.element(find.byType(Scaffold))),
      TextDirection.rtl,
    );
  });

  testWidgets('access chooser localizes persona without changing authority', (
    tester,
  ) async {
    MobileAccessOption? selected;
    const option = MobileAccessOption(
      campusId: 'campus-1',
      campusName: 'Main Campus',
      persona: SchoolPersona.student,
      tenantId: 'tenant-1',
      tenantName: 'International School',
    );
    final bootstrap = MobileBootstrap(
      accountId: 'account-1',
      locale: 'bn-BD',
      schools: [
        TenantAccess(
          campuses: [
            CampusAccess(
              campusId: option.campusId,
              campusName: option.campusName,
              personas: [
                PersonaAccess(
                  capabilities: const <String>{},
                  persona: option.persona,
                ),
              ],
            ),
          ],
          tenantId: option.tenantId,
          tenantName: option.tenantName,
        ),
      ],
      timeZone: 'Asia/Dhaka',
    );

    await tester.pumpWidget(
      localizedApp(
        locale: const Locale('bn'),
        home: MobileAccessGate(
          application: MobileAccessApplication.family,
          onRetry: () async {},
          onSelectAccess: (value) => selected = value,
          onSignIn: () async {},
          onSignOut: () async {},
          state: MobileApplicationState.choosingAccess(
            accessOptions: const [option],
            bootstrap: bootstrap,
          ),
        ),
      ),
    );

    expect(find.textContaining('International School'), oneWidget);
    expect(find.textContaining('Main Campus'), oneWidget);
    expect(find.textContaining('শিক্ষার্থী'), oneWidget);
    expect(find.textContaining('Student'), findsNothing);

    await tester.tap(
      find.byKey(const ValueKey('access-tenant-1-campus-1-student')),
    );
    await tester.pump();

    expect(selected?.tenantId, option.tenantId);
    expect(selected?.campusId, option.campusId);
    expect(selected?.persona, option.persona);
  });

  test('access gate source keeps reviewed copy out of the widget contract', () {
    final source = File('lib/src/access_gate.dart').readAsStringSync();

    expect(source, isNot(contains("'Sign in securely'")));
    expect(source, isNot(contains("'Authorized access only'")));
    expect(source, isNot(contains("'Application configuration required'")));
    expect(source, contains('MobileAccessStrings.forLocale'));
  });
}

MaterialApp localizedApp({required Locale locale, required Widget home}) =>
    MaterialApp(
      home: home,
      locale: locale,
      localizationsDelegates:
          SchoolLocalizationConfiguration.localizationsDelegates,
      supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
      theme: SchoolTheme.light(),
    );
