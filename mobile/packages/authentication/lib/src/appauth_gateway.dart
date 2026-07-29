import 'package:flutter_appauth/flutter_appauth.dart' as appauth;

import 'auth_models.dart';

abstract interface class AuthorizationGateway {
  Future<AuthTokenSet> authorize(MobileOidcConfiguration configuration);

  Future<AuthTokenSet> refresh(
    MobileOidcConfiguration configuration,
    String refreshToken,
  );

  Future<void> endSession(
    MobileOidcConfiguration configuration,
    String? idToken,
  );
}

final class AppAuthAuthorizationGateway implements AuthorizationGateway {
  const AppAuthAuthorizationGateway({
    appauth.FlutterAppAuth appAuth = const appauth.FlutterAppAuth(),
  }) : _appAuth = appAuth;

  final appauth.FlutterAppAuth _appAuth;

  @override
  Future<AuthTokenSet> authorize(
    MobileOidcConfiguration configuration,
  ) async {
    try {
      final response = await _appAuth.authorizeAndExchangeCode(
        appauth.AuthorizationTokenRequest(
          configuration.clientId,
          configuration.redirectUri.toString(),
          issuer: configuration.issuer.toString(),
          scopes: configuration.scopes,
        ),
      );
      return _tokenSetFromResponse(response);
    } on appauth.FlutterAppAuthUserCancelledException {
      throw const AuthUserCancelledException();
    } on appauth.FlutterAppAuthPlatformException {
      throw const AuthPlatformException('OIDC_AUTHORIZATION_FAILED');
    } on AuthException {
      rethrow;
    } on Object {
      throw const AuthPlatformException('OIDC_AUTHORIZATION_UNAVAILABLE');
    }
  }

  @override
  Future<AuthTokenSet> refresh(
    MobileOidcConfiguration configuration,
    String refreshToken,
  ) async {
    if (refreshToken.isEmpty) {
      throw const AuthProtocolException('OIDC_REFRESH_TOKEN_MISSING');
    }

    try {
      final response = await _appAuth.token(
        appauth.TokenRequest(
          configuration.clientId,
          configuration.redirectUri.toString(),
          issuer: configuration.issuer.toString(),
          refreshToken: refreshToken,
          scopes: configuration.scopes,
        ),
      );
      return _tokenSetFromResponse(response);
    } on appauth.FlutterAppAuthPlatformException {
      throw const AuthPlatformException('OIDC_REFRESH_FAILED');
    } on AuthException {
      rethrow;
    } on Object {
      throw const AuthPlatformException('OIDC_REFRESH_UNAVAILABLE');
    }
  }

  @override
  Future<void> endSession(
    MobileOidcConfiguration configuration,
    String? idToken,
  ) async {
    final postLogoutRedirectUri = configuration.postLogoutRedirectUri;
    if (idToken == null || postLogoutRedirectUri == null) {
      return;
    }

    try {
      await _appAuth.endSession(
        appauth.EndSessionRequest(
          idTokenHint: idToken,
          issuer: configuration.issuer.toString(),
          postLogoutRedirectUrl: postLogoutRedirectUri.toString(),
        ),
      );
    } on appauth.FlutterAppAuthUserCancelledException {
      return;
    } on appauth.FlutterAppAuthPlatformException {
      throw const AuthPlatformException('OIDC_END_SESSION_FAILED');
    } on Object {
      throw const AuthPlatformException('OIDC_END_SESSION_UNAVAILABLE');
    }
  }

  AuthTokenSet _tokenSetFromResponse(appauth.TokenResponse response) {
    final accessToken = response.accessToken;
    final expiresAt = response.accessTokenExpirationDateTime;
    if (accessToken == null || accessToken.isEmpty || expiresAt == null) {
      throw const AuthProtocolException('OIDC_TOKEN_RESPONSE_INCOMPLETE');
    }

    return AuthTokenSet(
      accessToken: accessToken,
      accessTokenExpiresAt: expiresAt.toUtc(),
      idToken: response.idToken,
      refreshToken: response.refreshToken,
      tokenType: response.tokenType ?? 'Bearer',
    );
  }
}
