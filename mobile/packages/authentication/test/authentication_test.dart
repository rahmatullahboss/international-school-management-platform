import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:school_authentication/school_authentication.dart';

void main() {
  final configuration = MobileOidcConfiguration(
    clientId: 'school-mobile',
    issuer: Uri.parse('https://identity.school.example'),
    redirectUri: Uri.parse('schoolapp://oauth/callback'),
    postLogoutRedirectUri: Uri.parse('schoolapp://oauth/logout'),
  );
  final now = DateTime.utc(2026, 7, 29, 12);

  group('MobileOidcConfiguration', () {
    test('requires an HTTPS issuer and openid scope', () {
      expect(
        () => MobileOidcConfiguration(
          clientId: 'mobile',
          issuer: Uri.parse('http://identity.example'),
          redirectUri: Uri.parse('schoolapp://oauth/callback'),
        ),
        throwsA(
          isA<AuthConfigurationException>().having(
            (error) => error.code,
            'code',
            'OIDC_ISSUER_HTTPS_REQUIRED',
          ),
        ),
      );

      expect(
        () => MobileOidcConfiguration(
          clientId: 'mobile',
          issuer: Uri.parse('https://identity.example'),
          redirectUri: Uri.parse('schoolapp://oauth/callback'),
          scopes: const ['profile'],
        ),
        throwsA(
          isA<AuthConfigurationException>().having(
            (error) => error.code,
            'code',
            'OIDC_OPENID_SCOPE_REQUIRED',
          ),
        ),
      );
    });
  });

  group('AuthTokenSet', () {
    test('never exposes bearer material from toString', () {
      final tokens = tokenSet(
        now: now,
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
        idToken: 'id-secret',
      );

      final rendered = tokens.toString();
      expect(rendered, isNot(contains('access-secret')));
      expect(rendered, isNot(contains('refresh-secret')));
      expect(rendered, isNot(contains('id-secret')));
      expect(rendered, contains('[REDACTED]'));
    });

    test('round-trips secure-storage JSON', () {
      final original = tokenSet(now: now, accessToken: 'access');
      final restored = AuthTokenSet.fromJson(original.toJson());

      expect(restored.accessToken, original.accessToken);
      expect(restored.accessTokenExpiresAt, original.accessTokenExpiresAt);
      expect(restored.refreshToken, original.refreshToken);
    });
  });

  group('AuthSessionManager', () {
    test(
      'restores a still-valid access token without a network call',
      () async {
        final gateway = FakeAuthorizationGateway();
        final store = MemoryAuthTokenStore();
        await store.write(tokenSet(now: now, accessToken: 'cached'));
        final manager = AuthSessionManager(
          gateway: gateway,
          configuration: configuration,
          tokenStore: store,
          clock: () => now,
        );

        final session = await manager.restore();

        expect(session.phase, AuthSessionPhase.authenticated);
        expect(session.tokens?.accessToken, 'cached');
        expect(gateway.refreshCalls, 0);
      },
    );

    test(
      'refreshes an expiring token and preserves a rotated-or-existing refresh token',
      () async {
        final gateway = FakeAuthorizationGateway(
          refreshedTokens: tokenSet(
            now: now,
            accessToken: 'refreshed',
            refreshToken: null,
          ),
        );
        final store = MemoryAuthTokenStore();
        await store.write(
          tokenSet(
            now: now.subtract(const Duration(hours: 2)),
            accessToken: 'expired',
            refreshToken: 'existing-refresh',
          ),
        );
        final manager = AuthSessionManager(
          gateway: gateway,
          configuration: configuration,
          tokenStore: store,
          clock: () => now,
        );

        final session = await manager.restore();
        final persisted = await store.read();

        expect(session.tokens?.accessToken, 'refreshed');
        expect(session.tokens?.refreshToken, 'existing-refresh');
        expect(persisted?.accessToken, 'refreshed');
        expect(gateway.refreshCalls, 1);
      },
    );

    test('coalesces concurrent restore refreshes', () async {
      final release = Completer<void>();
      final gateway = FakeAuthorizationGateway(
        refreshBarrier: release.future,
        refreshedTokens: tokenSet(now: now, accessToken: 'new-access'),
      );
      final store = MemoryAuthTokenStore();
      await store.write(
        tokenSet(
          now: now.subtract(const Duration(hours: 2)),
          accessToken: 'expired',
        ),
      );
      final manager = AuthSessionManager(
        gateway: gateway,
        configuration: configuration,
        tokenStore: store,
        clock: () => now,
      );

      final first = manager.restore();
      final second = manager.restore();
      await Future<void>.delayed(Duration.zero);
      expect(gateway.refreshCalls, 1);

      release.complete();
      final sessions = await Future.wait([first, second]);
      expect(sessions.every((session) => session.isAuthenticated), isTrue);
      expect(gateway.refreshCalls, 1);
    });

    test('clears local tokens when refresh fails', () async {
      final gateway = FakeAuthorizationGateway(
        refreshError: const AuthPlatformException('OIDC_REFRESH_FAILED'),
      );
      final store = MemoryAuthTokenStore();
      await store.write(
        tokenSet(
          now: now.subtract(const Duration(hours: 2)),
          accessToken: 'expired',
        ),
      );
      final manager = AuthSessionManager(
        gateway: gateway,
        configuration: configuration,
        tokenStore: store,
        clock: () => now,
      );

      final session = await manager.restore();

      expect(session.phase, AuthSessionPhase.failed);
      expect(session.reasonCode, 'OIDC_REFRESH_FAILED');
      expect(await store.read(), isNull);
    });

    test(
      'treats browser cancellation as signed out rather than failed',
      () async {
        final manager = AuthSessionManager(
          gateway: FakeAuthorizationGateway(
            authorizeError: const AuthUserCancelledException(),
          ),
          configuration: configuration,
          tokenStore: MemoryAuthTokenStore(),
          clock: () => now,
        );

        final session = await manager.signIn();

        expect(session.phase, AuthSessionPhase.signedOut);
        expect(session.reasonCode, 'OIDC_USER_CANCELLED');
      },
    );

    test(
      'clears local credentials before remote end-session completes',
      () async {
        final store = MemoryAuthTokenStore();
        await store.write(tokenSet(now: now, accessToken: 'access'));
        final manager = AuthSessionManager(
          gateway: FakeAuthorizationGateway(
            endSessionError: const AuthPlatformException(
              'OIDC_END_SESSION_FAILED',
            ),
          ),
          configuration: configuration,
          tokenStore: store,
          clock: () => now,
        );

        final session = await manager.signOut();

        expect(session.phase, AuthSessionPhase.signedOut);
        expect(
          session.reasonCode,
          'LOCAL_SIGN_OUT_COMPLETE_REMOTE_SESSION_RETAINED',
        );
        expect(await store.read(), isNull);
      },
    );
  });
}

AuthTokenSet tokenSet({
  required DateTime now,
  required String accessToken,
  String? refreshToken = 'refresh',
  String? idToken = 'id-token',
}) => AuthTokenSet(
  accessToken: accessToken,
  accessTokenExpiresAt: now.add(const Duration(hours: 1)),
  idToken: idToken,
  refreshToken: refreshToken,
);

final class FakeAuthorizationGateway implements AuthorizationGateway {
  FakeAuthorizationGateway({
    this.authorizeError,
    this.endSessionError,
    this.refreshBarrier,
    this.refreshError,
    AuthTokenSet? authorizedTokens,
    AuthTokenSet? refreshedTokens,
  }) : authorizedTokens =
           authorizedTokens ??
           AuthTokenSet(
             accessToken: 'authorized',
             accessTokenExpiresAt: DateTime.utc(2026, 7, 29, 14),
             refreshToken: 'refresh',
           ),
       refreshedTokens =
           refreshedTokens ??
           AuthTokenSet(
             accessToken: 'refreshed',
             accessTokenExpiresAt: DateTime.utc(2026, 7, 29, 14),
             refreshToken: 'rotated-refresh',
           );

  final AuthException? authorizeError;
  final AuthException? endSessionError;
  final Future<void>? refreshBarrier;
  final AuthException? refreshError;
  final AuthTokenSet authorizedTokens;
  final AuthTokenSet refreshedTokens;

  int refreshCalls = 0;

  @override
  Future<AuthTokenSet> authorize(MobileOidcConfiguration configuration) async {
    final error = authorizeError;
    if (error != null) {
      throw error;
    }
    return authorizedTokens;
  }

  @override
  Future<void> endSession(
    MobileOidcConfiguration configuration,
    String? idToken,
  ) async {
    final error = endSessionError;
    if (error != null) {
      throw error;
    }
  }

  @override
  Future<AuthTokenSet> refresh(
    MobileOidcConfiguration configuration,
    String refreshToken,
  ) async {
    refreshCalls += 1;
    final barrier = refreshBarrier;
    if (barrier != null) {
      await barrier;
    }
    final error = refreshError;
    if (error != null) {
      throw error;
    }
    return refreshedTokens;
  }
}
