import 'dart:async';

import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_mobile_core/notification_routing.dart';
import 'package:test/test.dart';

void main() {
  test('accepts only privacy-minimised notification fields', () {
    final envelope = MobileNotificationEnvelope.fromData(
      familyData(kind: MobileNotificationKind.familyDocuments),
    );

    expect(envelope.presentation.title, 'School Family update');
    expect(envelope.presentation.body, isNot(contains('student')));
    expect(envelope.toString(), contains('[REDACTED]'));
    expect(envelope.toString(), isNot(contains('tenant-1')));

    expect(
      () => MobileNotificationEnvelope.fromData({
        ...familyData(kind: MobileNotificationKind.familyDocuments),
        'title': 'Amina report is ready',
      }),
      throwsA(
        isA<MobileNotificationContractException>().having(
          (error) => error.code,
          'code',
          'MOBILE_NOTIFICATION_FIELDS_FORBIDDEN',
        ),
      ),
    );
  });

  test('requires explicit offsets for notification timestamps', () {
    expect(
      () => MobileNotificationEnvelope.fromData({
        ...familyData(kind: MobileNotificationKind.familyHome),
        'issuedAt': '2026-07-30T06:00:00',
      }),
      throwsA(
        isA<MobileNotificationContractException>().having(
          (error) => error.code,
          'code',
          'MOBILE_NOTIFICATION_DATETIME_OFFSET_REQUIRED:issuedAt',
        ),
      ),
    );
  });

  test('routes Family forms only inside exact authorized scope', () {
    final envelope = MobileNotificationEnvelope.fromData(
      familyData(
        kind: MobileNotificationKind.familyForms,
        resourceId: 'form:transport.2026',
      ),
    );
    const resolver = MobileNotificationRouteResolver();
    final allowed = resolver.resolve(
      application: MobileNotificationApplication.family,
      envelope: envelope,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: familySession(
        capabilities: const {SchoolCapability.formsConsent},
      ),
    );

    expect(allowed.isAllowed, isTrue);
    expect(allowed.location, '/forms/form%3Atransport.2026');

    final wrongCampus = resolver.resolve(
      application: MobileNotificationApplication.family,
      envelope: envelope,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: familySession(
        campusId: 'campus-2',
        capabilities: const {SchoolCapability.formsConsent},
      ),
    );
    expect(wrongCampus.status, MobileNotificationRouteStatus.wrongSchoolScope);
    expect(wrongCampus.location, isNull);
  });

  test('never switches persona or bypasses capabilities', () {
    final consent = MobileNotificationEnvelope.fromData(
      familyData(kind: MobileNotificationKind.familyConsent),
    );
    const resolver = MobileNotificationRouteResolver();

    final student = resolver.resolve(
      application: MobileNotificationApplication.family,
      envelope: consent,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: familySession(
        capabilities: const {SchoolCapability.formsConsent},
        persona: SchoolPersona.student,
      ),
    );
    expect(student.status, MobileNotificationRouteStatus.wrongPersona);

    final noCapability = resolver.resolve(
      application: MobileNotificationApplication.family,
      envelope: MobileNotificationEnvelope.fromData(
        familyData(kind: MobileNotificationKind.familyDocuments),
      ),
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: familySession(capabilities: const <String>{}),
    );
    expect(
      noCapability.status,
      MobileNotificationRouteStatus.missingCapability,
    );
  });

  test('blocks expired, future and wrong-application intents', () {
    final envelope = MobileNotificationEnvelope.fromData(
      familyData(kind: MobileNotificationKind.familyHome),
    );
    const resolver = MobileNotificationRouteResolver();
    final session = familySession(capabilities: const <String>{});

    expect(
      resolver
          .resolve(
            application: MobileNotificationApplication.family,
            envelope: envelope,
            now: DateTime.utc(2026, 7, 30, 7),
            session: session,
          )
          .status,
      MobileNotificationRouteStatus.expired,
    );
    expect(
      resolver
          .resolve(
            application: MobileNotificationApplication.family,
            envelope: envelope,
            now: DateTime.utc(2026, 7, 30, 5, 50),
            session: session,
          )
          .status,
      MobileNotificationRouteStatus.notYetValid,
    );
    expect(
      resolver
          .resolve(
            application: MobileNotificationApplication.staff,
            envelope: envelope,
            now: DateTime.utc(2026, 7, 30, 6, 5),
            session: session,
          )
          .status,
      MobileNotificationRouteStatus.wrongApplication,
    );
  });

  test('routes Staff intents using any-of message capability rules', () {
    final envelope = MobileNotificationEnvelope.fromData(
      staffData(kind: MobileNotificationKind.staffMessages),
    );
    const resolver = MobileNotificationRouteResolver();

    final allowed = resolver.resolve(
      application: MobileNotificationApplication.staff,
      envelope: envelope,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: staffSession(
        capabilities: const {SchoolCapability.messagesSend},
      ),
    );
    expect(allowed.location, '/messages');

    final blocked = resolver.resolve(
      application: MobileNotificationApplication.staff,
      envelope: envelope,
      now: DateTime.utc(2026, 7, 30, 6, 5),
      session: staffSession(capabilities: const <String>{}),
    );
    expect(blocked.status, MobileNotificationRouteStatus.missingCapability);
  });

  test(
    'inbox consumes launch intent once and tracker bounds duplicates',
    () async {
      final first = MobileNotificationEnvelope.fromData(
        familyData(kind: MobileNotificationKind.familyHome),
      );
      final second = MobileNotificationEnvelope.fromData(
        familyData(
          kind: MobileNotificationKind.familyMessages,
          notificationId: 'notification-2',
        ),
      );
      final inbox = MobileNotificationInbox(initial: first);

      expect(inbox.takeInitial(), same(first));
      expect(inbox.takeInitial(), isNull);

      final opened = <MobileNotificationEnvelope>[];
      final subscription = inbox.openedNotifications.listen(opened.add);
      inbox.addOpened(second);
      await Future<void>.delayed(Duration.zero);
      expect(opened, [second]);

      final tracker = MobileNotificationOpenTracker(maximumTracked: 1);
      expect(tracker.claim(first.notificationId), isTrue);
      expect(tracker.claim(first.notificationId), isFalse);
      expect(tracker.claim(second.notificationId), isTrue);
      expect(tracker.claim(first.notificationId), isTrue);

      await subscription.cancel();
      await inbox.close();
    },
  );

  test('rejects resources on routes that never need record identifiers', () {
    expect(
      () => MobileNotificationEnvelope.fromData(
        familyData(
          kind: MobileNotificationKind.familyDocuments,
          resourceId: 'document-1',
        ),
      ),
      throwsA(
        isA<MobileNotificationContractException>().having(
          (error) => error.code,
          'code',
          'MOBILE_NOTIFICATION_RESOURCE_FORBIDDEN',
        ),
      ),
    );
  });
}

Map<String, Object?> familyData({
  required MobileNotificationKind kind,
  String notificationId = 'notification-1',
  String? resourceId,
}) => <String, Object?>{
  'notificationId': notificationId,
  'application': MobileNotificationApplication.family.name,
  'tenantId': 'tenant-1',
  'campusId': 'campus-1',
  'persona': SchoolPersona.guardian.name,
  'kind': kind.name,
  if (resourceId != null) 'resourceId': resourceId,
  'issuedAt': '2026-07-30T06:00:00Z',
  'expiresAt': '2026-07-30T06:30:00Z',
};

Map<String, Object?> staffData({required MobileNotificationKind kind}) =>
    <String, Object?>{
      'notificationId': 'staff-notification-1',
      'application': MobileNotificationApplication.staff.name,
      'tenantId': 'tenant-1',
      'campusId': 'campus-1',
      'persona': SchoolPersona.teacher.name,
      'kind': kind.name,
      'issuedAt': '2026-07-30T06:00:00Z',
      'expiresAt': '2026-07-30T06:30:00Z',
    };

SchoolSession familySession({
  required Set<String> capabilities,
  String campusId = 'campus-1',
  SchoolPersona persona = SchoolPersona.guardian,
}) => SchoolSession(
  accountId: 'account-1',
  activePersona: persona,
  availablePersonas: {persona},
  campusId: campusId,
  capabilities: capabilities,
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);

SchoolSession staffSession({required Set<String> capabilities}) =>
    SchoolSession(
      accountId: 'account-1',
      activePersona: SchoolPersona.teacher,
      availablePersonas: const {SchoolPersona.teacher},
      campusId: 'campus-1',
      capabilities: capabilities,
      locale: 'en-BD',
      tenantId: 'tenant-1',
      timeZone: 'Asia/Dhaka',
    );
