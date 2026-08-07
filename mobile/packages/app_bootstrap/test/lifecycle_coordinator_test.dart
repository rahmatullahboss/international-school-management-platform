import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:school_app_bootstrap/school_app_bootstrap.dart';
import 'package:school_authentication/school_authentication.dart';
import 'package:school_mobile_core/mobile_core.dart';

void main() {
  final now = DateTime.utc(2026, 8, 7, 12);
  final oidc = MobileOidcConfiguration(
    clientId: 'mobile-client',
    issuer: Uri.parse('https://identity.school.test'),
    redirectUri: Uri.parse('ozzylschoolfamily:/oauthredirect'),
  );

  test(
    'memory pressure records privacy decision without blocking ready UI',
    () async {
      final store = MemoryAuthTokenStore();
      await store.write(_tokenSet(now));
      final coordinator = _coordinator(
        gateway: _ImmediateAuthorizationGateway(_tokenSet(now)),
        oidc: oidc,
        now: now,
        store: store,
      );

      await coordinator.initialize();
      expect(coordinator.state.phase, MobileApplicationPhase.ready);

      await coordinator.handlePlatformLifecycle(
        MobilePlatformLifecycleSignal.memoryPressure,
      );

      expect(coordinator.state.phase, MobileApplicationPhase.ready);
      expect(
        coordinator.lastLifecycleDecision?.reasonCode,
        'MOBILE_LIFECYCLE_MEMORY_PRESSURE',
      );
      expect(
        coordinator.lastLifecycleDecision?.obscureRestrictedContent,
        isTrue,
      );
      coordinator.dispose();
    },
  );

  test('inactive AppAuth transition does not cancel sign in', () async {
    final gateway = _DeferredAuthorizationGateway();
    final coordinator = _coordinator(
      gateway: gateway,
      oidc: oidc,
      now: now,
      store: MemoryAuthTokenStore(),
    );

    final signIn = coordinator.signIn();
    expect(coordinator.state.phase, MobileApplicationPhase.authenticating);

    await coordinator.handlePlatformLifecycle(
      MobilePlatformLifecycleSignal.inactive,
    );

    expect(coordinator.state.phase, MobileApplicationPhase.authenticating);
    expect(
      coordinator.lastLifecycleDecision?.reasonCode,
      'MOBILE_LIFECYCLE_BACKGROUND_PRIVACY',
    );

    gateway.complete(_tokenSet(now));
    await signIn;

    expect(coordinator.state.phase, MobileApplicationPhase.ready);
    coordinator.dispose();
  });
}

MobileAppCoordinator _coordinator({
  required AuthorizationGateway gateway,
  required MobileOidcConfiguration oidc,
  required DateTime now,
  required AuthTokenStore store,
}) {
  final authentication = AuthSessionManager(
    clock: () => now,
    configuration: oidc,
    gateway: gateway,
    tokenStore: store,
  );
  return MobileAppCoordinator(
    allowedPersonas: const {SchoolPersona.guardian},
    authentication: authentication,
    bootstrapLoader: _BootstrapLoader(_bootstrap()),
    correlationIdFactory: () => 'lifecycle-correlation',
    lifecycleClock: () => now,
    observePlatformLifecycle: false,
  );
}

AuthTokenSet _tokenSet(DateTime now) => AuthTokenSet(
  accessToken: 'access-token',
  accessTokenExpiresAt: now.add(const Duration(hours: 1)),
  idToken: 'id-token',
  refreshToken: 'refresh-token',
);

MobileBootstrap _bootstrap() => MobileBootstrap(
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
              capabilities: const {SchoolCapability.attendanceRead},
              persona: SchoolPersona.guardian,
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

final class _BootstrapLoader implements MobileBootstrapLoader {
  const _BootstrapLoader(this.bootstrap);

  final MobileBootstrap bootstrap;

  @override
  Future<MobileBootstrap> load({required String correlationId}) async =>
      bootstrap;
}

final class _ImmediateAuthorizationGateway implements AuthorizationGateway {
  const _ImmediateAuthorizationGateway(this.tokens);

  final AuthTokenSet tokens;

  @override
  Future<AuthTokenSet> authorize(MobileOidcConfiguration configuration) async =>
      tokens;

  @override
  Future<void> endSession(
    MobileOidcConfiguration configuration,
    String? idToken,
  ) async {}

  @override
  Future<AuthTokenSet> refresh(
    MobileOidcConfiguration configuration,
    String refreshToken,
  ) async => tokens;
}

final class _DeferredAuthorizationGateway implements AuthorizationGateway {
  final Completer<AuthTokenSet> _authorizeCompleter = Completer<AuthTokenSet>();

  void complete(AuthTokenSet tokens) => _authorizeCompleter.complete(tokens);

  @override
  Future<AuthTokenSet> authorize(MobileOidcConfiguration configuration) =>
      _authorizeCompleter.future;

  @override
  Future<void> endSession(
    MobileOidcConfiguration configuration,
    String? idToken,
  ) async {}

  @override
  Future<AuthTokenSet> refresh(
    MobileOidcConfiguration configuration,
    String refreshToken,
  ) => throw StateError('refresh is not expected in this test');
}
