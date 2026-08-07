final class MobileOidcConfiguration {
  MobileOidcConfiguration({
    required String clientId,
    required Uri issuer,
    required Uri redirectUri,
    Uri? postLogoutRedirectUri,
    List<String> scopes = const <String>[
      'openid',
      'profile',
      'email',
      'offline_access',
      'school_api',
    ],
  }) : clientId = clientId.trim(),
       issuer = issuer,
       redirectUri = redirectUri,
       postLogoutRedirectUri = postLogoutRedirectUri,
       scopes = List<String>.unmodifiable(scopes) {
    if (this.clientId.isEmpty) {
      throw const AuthConfigurationException('OIDC_CLIENT_ID_REQUIRED');
    }
    if (issuer.scheme != 'https' || issuer.host.isEmpty) {
      throw const AuthConfigurationException('OIDC_ISSUER_HTTPS_REQUIRED');
    }
    if (!redirectUri.hasScheme) {
      throw const AuthConfigurationException('OIDC_REDIRECT_SCHEME_REQUIRED');
    }
    if (redirectUri.scheme != redirectUri.scheme.toLowerCase()) {
      throw const AuthConfigurationException(
        'OIDC_REDIRECT_SCHEME_LOWERCASE_REQUIRED',
      );
    }
    if (postLogoutRedirectUri != null && !postLogoutRedirectUri.hasScheme) {
      throw const AuthConfigurationException(
        'OIDC_POST_LOGOUT_REDIRECT_SCHEME_REQUIRED',
      );
    }
    if (!this.scopes.contains('openid')) {
      throw const AuthConfigurationException('OIDC_OPENID_SCOPE_REQUIRED');
    }
    if (this.scopes.any((scope) => scope.trim().isEmpty)) {
      throw const AuthConfigurationException('OIDC_SCOPE_EMPTY');
    }
  }

  factory MobileOidcConfiguration.fromEnvironment() {
    const issuerValue = String.fromEnvironment('SCHOOL_OIDC_ISSUER');
    const clientIdValue = String.fromEnvironment('SCHOOL_OIDC_CLIENT_ID');
    const redirectValue = String.fromEnvironment('SCHOOL_OIDC_REDIRECT_URI');
    const logoutRedirectValue = String.fromEnvironment(
      'SCHOOL_OIDC_POST_LOGOUT_REDIRECT_URI',
    );
    const scopeValue = String.fromEnvironment(
      'SCHOOL_OIDC_SCOPES',
      defaultValue: 'openid profile email offline_access school_api',
    );

    if (issuerValue.isEmpty || clientIdValue.isEmpty || redirectValue.isEmpty) {
      throw const AuthConfigurationException(
        'OIDC_COMPILE_TIME_CONFIGURATION_REQUIRED',
      );
    }

    return MobileOidcConfiguration(
      clientId: clientIdValue,
      issuer: Uri.parse(issuerValue),
      redirectUri: Uri.parse(redirectValue),
      postLogoutRedirectUri: logoutRedirectValue.isEmpty
          ? null
          : Uri.parse(logoutRedirectValue),
      scopes: scopeValue
          .split(' ')
          .where((scope) => scope.isNotEmpty)
          .toList(growable: false),
    );
  }

  final String clientId;
  final Uri issuer;
  final Uri redirectUri;
  final Uri? postLogoutRedirectUri;
  final List<String> scopes;
}

final class AuthTokenSet {
  AuthTokenSet({
    required this.accessToken,
    required this.accessTokenExpiresAt,
    this.idToken,
    this.refreshToken,
    this.tokenType = 'Bearer',
  }) {
    if (accessToken.isEmpty) {
      throw const AuthProtocolException('OIDC_ACCESS_TOKEN_MISSING');
    }
  }

  factory AuthTokenSet.fromJson(Map<String, Object?> json) {
    final accessToken = json['accessToken'];
    final expiresAt = json['accessTokenExpiresAt'];
    final idToken = json['idToken'];
    final refreshToken = json['refreshToken'];
    final tokenType = json['tokenType'];

    if (accessToken is! String || expiresAt is! String) {
      throw const AuthProtocolException('OIDC_STORED_TOKEN_INVALID');
    }

    return AuthTokenSet(
      accessToken: accessToken,
      accessTokenExpiresAt: DateTime.parse(expiresAt).toUtc(),
      idToken: idToken is String ? idToken : null,
      refreshToken: refreshToken is String ? refreshToken : null,
      tokenType: tokenType is String ? tokenType : 'Bearer',
    );
  }

  final String accessToken;
  final DateTime accessTokenExpiresAt;
  final String? idToken;
  final String? refreshToken;
  final String tokenType;

  bool isUsableAt(
    DateTime now, {
    Duration refreshSkew = const Duration(minutes: 1),
  }) => accessTokenExpiresAt.isAfter(now.toUtc().add(refreshSkew));

  AuthTokenSet mergeRefresh(AuthTokenSet refreshed) => AuthTokenSet(
    accessToken: refreshed.accessToken,
    accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
    idToken: refreshed.idToken ?? idToken,
    refreshToken: refreshed.refreshToken ?? refreshToken,
    tokenType: refreshed.tokenType,
  );

  Map<String, Object?> toJson() => <String, Object?>{
    'accessToken': accessToken,
    'accessTokenExpiresAt': accessTokenExpiresAt.toUtc().toIso8601String(),
    'idToken': idToken,
    'refreshToken': refreshToken,
    'tokenType': tokenType,
  };

  @override
  String toString() =>
      'AuthTokenSet(accessToken: [REDACTED], refreshToken: ${refreshToken == null ? 'absent' : '[REDACTED]'}, idToken: ${idToken == null ? 'absent' : '[REDACTED]'}, expiresAt: ${accessTokenExpiresAt.toUtc().toIso8601String()})';
}

sealed class AuthException implements Exception {
  const AuthException(this.code);

  final String code;

  @override
  String toString() => 'AuthException($code)';
}

final class AuthConfigurationException extends AuthException {
  const AuthConfigurationException(super.code);
}

final class AuthProtocolException extends AuthException {
  const AuthProtocolException(super.code);
}

final class AuthPlatformException extends AuthException {
  const AuthPlatformException(super.code);
}

final class AuthUserCancelledException extends AuthException {
  const AuthUserCancelledException() : super('OIDC_USER_CANCELLED');
}
