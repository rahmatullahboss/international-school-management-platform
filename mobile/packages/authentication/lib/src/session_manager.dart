import 'appauth_gateway.dart';
import 'auth_models.dart';
import 'secure_token_store.dart';

typedef AuthClock = DateTime Function();

enum AuthSessionPhase { signedOut, authenticated, failed }

final class AuthSessionSnapshot {
  const AuthSessionSnapshot._({
    required this.phase,
    this.reasonCode,
    this.tokens,
  });

  const AuthSessionSnapshot.signedOut({String? reasonCode})
    : this._(phase: AuthSessionPhase.signedOut, reasonCode: reasonCode);

  const AuthSessionSnapshot.authenticated(AuthTokenSet tokens)
    : this._(phase: AuthSessionPhase.authenticated, tokens: tokens);

  const AuthSessionSnapshot.failed(String reasonCode)
    : this._(phase: AuthSessionPhase.failed, reasonCode: reasonCode);

  final AuthSessionPhase phase;
  final String? reasonCode;
  final AuthTokenSet? tokens;

  bool get isAuthenticated => phase == AuthSessionPhase.authenticated;
}

final class AuthSessionManager {
  AuthSessionManager({
    required AuthorizationGateway gateway,
    required MobileOidcConfiguration configuration,
    required AuthTokenStore tokenStore,
    AuthClock? clock,
  }) : _gateway = gateway,
       _configuration = configuration,
       _tokenStore = tokenStore,
       _clock = clock ?? DateTime.now;

  final AuthorizationGateway _gateway;
  final MobileOidcConfiguration _configuration;
  final AuthTokenStore _tokenStore;
  final AuthClock _clock;

  Future<AuthSessionSnapshot>? _restoreInFlight;

  Future<AuthSessionSnapshot> restore() {
    final active = _restoreInFlight;
    if (active != null) {
      return active;
    }

    final operation = _restoreInternal();
    _restoreInFlight = operation;
    return operation.whenComplete(() {
      if (identical(_restoreInFlight, operation)) {
        _restoreInFlight = null;
      }
    });
  }

  Future<AuthSessionSnapshot> signIn() async {
    try {
      final tokens = await _gateway.authorize(_configuration);
      await _tokenStore.write(tokens);
      return AuthSessionSnapshot.authenticated(tokens);
    } on AuthUserCancelledException catch (error) {
      return AuthSessionSnapshot.signedOut(reasonCode: error.code);
    } on AuthException catch (error) {
      return AuthSessionSnapshot.failed(error.code);
    }
  }

  Future<AuthSessionSnapshot> signOut() async {
    final tokens = await _tokenStore.read();
    await _tokenStore.clear();

    try {
      await _gateway.endSession(_configuration, tokens?.idToken);
      return const AuthSessionSnapshot.signedOut();
    } on AuthException {
      return const AuthSessionSnapshot.signedOut(
        reasonCode: 'LOCAL_SIGN_OUT_COMPLETE_REMOTE_SESSION_RETAINED',
      );
    }
  }

  Future<String> validAccessToken() async {
    final session = await restore();
    final tokens = session.tokens;
    if (!session.isAuthenticated || tokens == null) {
      throw const AuthPlatformException('AUTHENTICATION_REQUIRED');
    }
    return tokens.accessToken;
  }

  Future<AuthSessionSnapshot> _restoreInternal() async {
    AuthTokenSet? stored;
    try {
      stored = await _tokenStore.read();
    } on AuthException catch (error) {
      return AuthSessionSnapshot.failed(error.code);
    }

    if (stored == null) {
      return const AuthSessionSnapshot.signedOut();
    }
    if (stored.isUsableAt(_clock())) {
      return AuthSessionSnapshot.authenticated(stored);
    }

    final refreshToken = stored.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) {
      await _tokenStore.clear();
      return const AuthSessionSnapshot.signedOut(
        reasonCode: 'OIDC_SESSION_EXPIRED',
      );
    }

    try {
      final response = await _gateway.refresh(_configuration, refreshToken);
      final refreshed = stored.mergeRefresh(response);
      await _tokenStore.write(refreshed);
      return AuthSessionSnapshot.authenticated(refreshed);
    } on AuthException catch (error) {
      await _tokenStore.clear();
      return AuthSessionSnapshot.failed(error.code);
    }
  }
}
