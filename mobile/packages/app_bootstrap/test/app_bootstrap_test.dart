import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_app_bootstrap/school_app_bootstrap.dart';
import 'package:school_authentication/school_authentication.dart';
import 'package:school_design_system/school_design_system.dart';
import 'package:school_mobile_core/mobile_core.dart';

void main() {
  final now = DateTime.utc(2026, 7, 30, 1);
  final oidc = MobileOidcConfiguration(
    clientId: 'mobile-client',
    issuer: Uri.parse('https://identity.school.test'),
    redirectUri: Uri.parse('ozzylschoolfamily:/oauthredirect'),
  );

  group('MobileRuntimeConfiguration', () {
    test('requires the native redirect scheme to match the OIDC build', () {
      expect(
        () => MobileRuntimeConfiguration(
          apiBaseUri: Uri.parse('https://api.school.test/v1/'),
          expectedRedirectScheme: 'ozzylschoolstaff',
          oidc: oidc,
        ),
        throwsA(
          isA<MobileRuntimeConfigurationException>().having(
            (error) => error.code,
            'code',
            'MOBILE_REDIRECT_SCHEME_MISMATCH',
          ),
        ),
      );
    });
  });

  group('MobileAppCoordinator', () {
    test('restores an empty token store as signed out', () async {
      final coordinator = coordinatorFor(
        allowedPersonas: const {SchoolPersona.guardian},
        bootstrap: familyBootstrap(),
        oidc: oidc,
        now: now,
      );

      await coordinator.initialize();

      expect(coordinator.state.phase, MobileApplicationPhase.signedOut);
      coordinator.dispose();
    });

    test('signs in and activates one authorized family access', () async {
      final coordinator = coordinatorFor(
        allowedPersonas: const {SchoolPersona.guardian},
        bootstrap: familyBootstrap(),
        oidc: oidc,
        now: now,
        signInTokens: tokenSet(now),
      );

      await coordinator.signIn();

      expect(coordinator.state.phase, MobileApplicationPhase.ready);
      expect(
        coordinator.state.session?.activePersona,
        SchoolPersona.guardian,
      );
      expect(
        coordinator.state.session?.can(SchoolCapability.billingRead),
        isTrue,
      );
      coordinator.dispose();
    });

    test('offers multiple authorized accesses and activates a selection', () async {
      final store = MemoryAuthTokenStore();
      await store.write(tokenSet(now));
      final coordinator = coordinatorFor(
        allowedPersonas: const {
          SchoolPersona.guardian,
          SchoolPersona.student,
        },
        bootstrap: familyBootstrap(),
        oidc: oidc,
        now: now,
        store: store,
      );

      await coordinator.initialize();

      expect(
        coordinator.state.phase,
        MobileApplicationPhase.choosingAccess,
      );
      expect(coordinator.state.accessOptions, hasLength(2));

      final student = coordinator.state.accessOptions.singleWhere(
        (option) => option.persona == SchoolPersona.student,
      );
      coordinator.selectAccess(student);

      expect(coordinator.state.phase, MobileApplicationPhase.ready);
      expect(
        coordinator.state.session?.activePersona,
        SchoolPersona.student,
      );
      expect(
        coordinator.state.session?.can(SchoolCapability.billingRead),
        isFalse,
      );
      coordinator.dispose();
    });

    test('filters family personas out of the staff application', () async {
      final store = MemoryAuthTokenStore();
      await store.write(tokenSet(now));
      final coordinator = coordinatorFor(
        allowedPersonas: const {SchoolPersona.teacher},
        bootstrap: familyBootstrap(includeTeacher: true),
        oidc: oidc,
        now: now,
        store: store,
      );

      await coordinator.initialize();

      expect(coordinator.state.phase, MobileApplicationPhase.ready);
      expect(
        coordinator.state.session?.activePersona,
        SchoolPersona.teacher,
      );
      coordinator.dispose();
    });

    test('switches persona through the original bootstrap capabilities', () async {
      final store = MemoryAuthTokenStore();
      await store.write(tokenSet(now));
      final coordinator = coordinatorFor(
        allowedPersonas: const {
          SchoolPersona.guardian,
          SchoolPersona.student,
        },
        bootstrap: familyBootstrap(),
        oidc: oidc,
        now: now,
        store: store,
      );
      await coordinator.initialize();
      coordinator.selectAccess(
        coordinator.state.accessOptions.singleWhere(
          (option) => option.persona == SchoolPersona.guardian,
        ),
      );

      coordinator.switchPersona(SchoolPersona.student);

      expect(
        coordinator.state.session?.activePersona,
        SchoolPersona.student,
      );
      expect(
        coordinator.state.session?.can(SchoolCapability.billingRead),
        isFalse,
      );
      coordinator.dispose();
    });
  });

  testWidgets('access gate exposes sign-in and authorized access actions', (
    tester,
  ) async {
    var signInCount = 0;
    MobileAccessOption? selected;
    final bootstrap = familyBootstrap();
    final options = [
      const MobileAccessOption(
        campusId: 'campus-1',
        campusName: 'Main Campus',
        persona: SchoolPersona.guardian,
        tenantId: 'tenant-1',
        tenantName: 'International School',
      ),
      const MobileAccessOption(
        campusId: 'campus-1',
        campusName: 'Main Campus',
        persona: SchoolPersona.student,
        tenantId: 'tenant-1',
        tenantName: 'International School',
      ),
    ];

    await tester.pumpWidget(
      MaterialApp(
        theme: SchoolTheme.light(),
        home: MobileAccessGate(
          appName: 'School Family',
          onRetry: () async {},
          onSelectAccess: (option) => selected = option,
          onSignIn: () async => signInCount++,
          onSignOut: () async {},
          state: const MobileApplicationState.signedOut(),
        ),
      ),
    );
    await tester.tap(find.byKey(const Key('mobile-sign-in')));
    await tester.pump();
    expect(signInCount, 1);

    await tester.pumpWidget(
      MaterialApp(
        theme: SchoolTheme.light(),
        home: MobileAccessGate(
          appName: 'School Family',
          onRetry: () async {},
          onSelectAccess: (option) => selected = option,
          onSignIn: () async {},
          onSignOut: () async {},
          state: MobileApplicationState.choosingAccess(
            accessOptions: options,
            bootstrap: bootstrap,
          ),
        ),
      ),
    );
    await tester.tap(find.text('International School').last);
    await tester.pump();
    expect(selected?.persona, SchoolPersona.student);
  });
}

MobileAppCoordinator coordinatorFor({
  required Set<SchoolPersona> allowedPersonas,
  required MobileBootstrap bootstrap,
  required MobileOidcConfiguration oidc,
  required DateTime now,
  AuthTokenStore? store,
  AuthTokenSet? signInTokens,
}) {
  final gateway = FakeAuthorizationGateway(
    signInTokens: signInTokens ?? tokenSet(now),
  );
  final authentication = AuthSessionManager(
    clock: () => now,
    configuration: oidc,
    gateway: gateway,
    tokenStore: store ?? MemoryAuthTokenStore(),
  );
  return MobileAppCoordinator(
    allowedPersonas: allowedPersonas,
    authentication: authentication,
    bootstrapLoader: FakeBootstrapLoader(bootstrap),
    correlationIdFactory: () => 'correlation-1',
  );
}

AuthTokenSet tokenSet(DateTime now) => AuthTokenSet(
  accessToken: 'access-token',
  accessTokenExpiresAt: now.add(const Duration(hours: 1)),
  idToken: 'id-token',
  refreshToken: 'refresh-token',
);

MobileBootstrap familyBootstrap({bool includeTeacher = false}) => MobileBootstrap(
  accountId: 'account-1',
  locale: 'en-BD',
  schools: [
    TenantAccess(
      campuses: [
        CampusAccess(
          campusId: 'campus-1',
          campusName: 'Main Campus',
          personas: [
            PersonaAccess(
              capabilities: const {
                SchoolCapability.attendanceRead,
                SchoolCapability.billingRead,
              },
              persona: SchoolPersona.guardian,
            ),
            PersonaAccess(
              capabilities: const {
                SchoolCapability.attendanceRead,
                SchoolCapability.gradesReadPublished,
              },
              persona: SchoolPersona.student,
            ),
            if (includeTeacher)
              PersonaAccess(
                capabilities: const {
                  SchoolCapability.attendanceTake,
                  SchoolCapability.gradesWrite,
                },
                persona: SchoolPersona.teacher,
              ),
          ],
        ),
      ],
      tenantId: 'tenant-1',
      tenantName: 'International School',
    ),
  ],
  timeZone: 'Asia/Dhaka',
);

final class FakeBootstrapLoader implements MobileBootstrapLoader {
  const FakeBootstrapLoader(this.bootstrap);

  final MobileBootstrap bootstrap;

  @override
  Future<MobileBootstrap> load({required String correlationId}) async =>
      bootstrap;
}

final class FakeAuthorizationGateway implements AuthorizationGateway {
  const FakeAuthorizationGateway({required this.signInTokens});

  final AuthTokenSet signInTokens;

  @override
  Future<AuthTokenSet> authorize(MobileOidcConfiguration configuration) async =>
      signInTokens;

  @override
  Future<void> endSession(
    MobileOidcConfiguration configuration,
    String? idToken,
  ) async {}

  @override
  Future<AuthTokenSet> refresh(
    MobileOidcConfiguration configuration,
    String refreshToken,
  ) async => signInTokens;
}
