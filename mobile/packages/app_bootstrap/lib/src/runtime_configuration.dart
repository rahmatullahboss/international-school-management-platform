import 'package:school_authentication/school_authentication.dart';

final class MobileRuntimeConfiguration {
  MobileRuntimeConfiguration({
    required this.apiBaseUri,
    required this.oidc,
    required String expectedRedirectScheme,
  }) : expectedRedirectScheme = expectedRedirectScheme.trim().toLowerCase() {
    if (apiBaseUri.scheme != 'https' || apiBaseUri.host.isEmpty) {
      throw const MobileRuntimeConfigurationException(
        'MOBILE_API_BASE_HTTPS_REQUIRED',
      );
    }
    if (this.expectedRedirectScheme.isEmpty) {
      throw const MobileRuntimeConfigurationException(
        'MOBILE_REDIRECT_SCHEME_REQUIRED',
      );
    }
    if (oidc.redirectUri.scheme != this.expectedRedirectScheme) {
      throw const MobileRuntimeConfigurationException(
        'MOBILE_REDIRECT_SCHEME_MISMATCH',
      );
    }
    final logoutRedirect = oidc.postLogoutRedirectUri;
    if (logoutRedirect != null &&
        logoutRedirect.scheme != this.expectedRedirectScheme) {
      throw const MobileRuntimeConfigurationException(
        'MOBILE_LOGOUT_REDIRECT_SCHEME_MISMATCH',
      );
    }
  }

  factory MobileRuntimeConfiguration.fromEnvironment({
    required String expectedRedirectScheme,
  }) {
    const apiBaseValue = String.fromEnvironment('SCHOOL_API_BASE_URL');
    if (apiBaseValue.isEmpty) {
      throw const MobileRuntimeConfigurationException(
        'MOBILE_API_BASE_CONFIGURATION_REQUIRED',
      );
    }

    final apiBaseUri = Uri.tryParse(apiBaseValue);
    if (apiBaseUri == null) {
      throw const MobileRuntimeConfigurationException(
        'MOBILE_API_BASE_INVALID',
      );
    }

    return MobileRuntimeConfiguration(
      apiBaseUri: apiBaseUri,
      expectedRedirectScheme: expectedRedirectScheme,
      oidc: MobileOidcConfiguration.fromEnvironment(),
    );
  }

  final Uri apiBaseUri;
  final MobileOidcConfiguration oidc;
  final String expectedRedirectScheme;
}

final class MobileRuntimeConfigurationException implements Exception {
  const MobileRuntimeConfigurationException(this.code);

  final String code;

  @override
  String toString() => 'MobileRuntimeConfigurationException($code)';
}
