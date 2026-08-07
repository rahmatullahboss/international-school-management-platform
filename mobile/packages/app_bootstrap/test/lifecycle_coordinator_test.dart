import 'dart:async';

import 'package:flutter/widgets.dart';
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

  test('background obscures ready data and resume reloads access', () async {
    final store = MemoryAuthTokenStore();
    await store.write(_tokenSet(now));
    final loader = _CountingBootstrapLoader(_bootstrap());
    final coordinator = _coordinator(
      bootstrapLoader: loader,
      clock: () => now,
      gateway: _AuthorizationGateway(signInTokens: _tokenSet(now)),
      oidc: oidc,
      store: store,
    );

    await coordinator.initialize();
    expect(coordinator.state.phase, MobileApplicationPhase.ready);
    expect(loader.loadCount, 1);

    await coordinator.handlePlatformLifecycle(
      MobilePlatformLifecycleSignal.paused,
    );

    expect(coordinator.state.phase, MobileApplicationPhase.restoring);
    expect(
      coordinator.lastLifecycleDecision?.reasonCode,
      'MOBILE_LIFECYCLE_BACKGROUND_PRIVACY',
    );
    expect(coordinator.lastLifecycleDecision?.obscureRestrictedContent, isTrue);

    await coordinator.handlePlatformLifecycle(
      MobilePlatformLifecycleSignal.resumed,
    );

    expect(coordinator.state.phase, MobileApplicationPhase.ready);
    expect(loader.loadCount, 2);
    expect(
      coordinator.lastLifecycleDecision?.reasonCode,
      'MOBILE_LIFECYCLE_RESUMED',
    );
    coordinator.dispose();
  });

  test('detached lifecycle refreshes an expired stored token', () async {
    var clock = now;
    final store = MemoryAuthTokenStore();
    await store.write(_tokenSet(now));
    final gateway = _AuthorizationGateway(
      refreshTokens: _tokenSet(now.add(const Duration(hours: 3))),
      signInTokens: _tokenSet(now),
    );
    final coordinator = _coordinator(
      clock: () => clock,
      gateway: gateway,
      oidc: oidc,
      store: store,
    );

    await coordinator.initialize();
    expect(coordinator.state.phase, MobileApplicationPhase.ready);

    await coordinator.handlePlatformLifecycle(
      MobilePlatformLifecycleSignal.detached,
    );
    expect(coordinator.state.phase, MobileApplicationPhase.restoring);
    expect(
      coordinator.lastLifecycleDecision?.reasonCode,
      'MOBILE_LIFECYCLE_PROCESS_DETACHED',
    );

    clock = now.add(const Duration(hours: 2));
    await coordinator.handlePlatformLifecycle(
      MobilePlatformLifecycleSignal.resumed,
    );

    expect(gateway.refreshCount, 1);
    expect(coordinator.state.phase, MobileApplicationPhase.ready);
    expect(
      coordinator.lastLifecycleDecision?.reasonCode,
      'MOBILE_LIFECYCLE_RESUMED',
    );
    coordinator.dispose();
  });

  test(
    'memory pressure records privacy decision without blocking ready UI',
    () async {
      final store = MemoryAuthTokenStore();
      await store.write(_tokenSet(now));
      final coordinator = _coordinator(
        clock: () => now,
        gateway: _AuthorizationGateway(signInTokens: _tokenSet(now)),
        oidc: oidc,
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
      clock: () => now,
      gateway: gateway,
      oidc: oidc,
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

  testWidgets('WidgetsBinding lifecycle events reach the coordinator', (
    tester,
  ) async {
    final store = MemoryAuthTokenStore();
    await store.write(_tokenSet(now));
    final loader = _CountingBootstrapLoader(_bootstrap());
    final coordinator = _coordinator(
      bootstrapLoader: loader,
      clock: () => now,
      gateway: _AuthorizationGateway(signInTokens: _tokenSet(now)),
      observePlatformLifecycle: true,
      oidc: oidc,
      store: store,
    );

    await coordinator.initialize();
    expect(coordinator.state.phase, MobileApplicationPhase.ready);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();

    expect(coordinator.state.phase, MobileApplicationPhase.restoring);
    expect(
      coordinator.lastLifecycleDecision?.reasonCode,
      'MOBILE_LIFECYCLE_BACKGROUND_PRIVACY',
    );

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();

    expect(coordinator.state.phase, MobileApplicationPhase.ready);
    expect(loader.loadCount, 2);
    coordinator.dispose();
  });
}

MobileAppCoordinator _coordinator({
  MobileBootstrapLoader? bootstrapLoader,
  required DateTime Function() clock,
  required AuthorizationGateway gateway,
  bool observePlatformLifecycle = false,
  required MobileOidcConfiguration oidc,
  required AuthTokenStore store,
}) {
  final authentication = AuthSessionManager(
    clock: clock,
    configuration: oidc,
    gateway: gateway,
    tokenStore: store,
  );
  return MobileAppCoordinator(
    allowedPersonas: const {SchoolPersona.guardian},
    authentication: authentication,
    bootstrapLoader: bootstrapLoader ?? _BootstrapLoader(_bootstrap()),
    correlationIdFactory: () => 'lifecycle-correlation',
    lifecycleClock: clock,
    observePlatformLifecycle: observePlatformLifecycle,
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

final class _CountingBootstrapLoader implements MobileBootstrapLoader {
  _CountingBootstrapLoader(this.bootstrap);

  final MobileBootstrap bootstrap;
  int loadCount = 0;

  @override
  Future<MobileBootstrap> load({required String correlationId}) async {
    loadCount++;
    return bootstrap;
  }
}

final class _AuthorizationGateway implements AuthorizationGateway {
  _AuthorizationGateway({this.refreshTokens, required this.signInTokens});

  final AuthTokenSet? refreshTokens;
  final AuthTokenSet signInTokens;
  int refreshCount = 0;

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
  ) async {
    refreshCount++;
    return refreshTokens ?? signInTokens;
  }
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
