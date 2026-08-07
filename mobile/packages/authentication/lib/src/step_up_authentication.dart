import 'dart:convert';
import 'dart:math';

import 'package:flutter_appauth/flutter_appauth.dart' as appauth;
import 'package:school_authentication/src/auth_models.dart';

typedef StepUpClock = DateTime Function();
typedef StepUpNonceFactory = String Function();

final class StepUpAuthenticationRequest {
  StepUpAuthenticationRequest({
    required String nonce,
    required String purpose,
    Iterable<String> acrValues = const <String>[],
  }) : acrValues = List<String>.unmodifiable(
         acrValues.map((value) => _requiredStepUp(value, 'acrValue')),
       ),
       nonce = _requiredStepUp(nonce, 'nonce'),
       purpose = _requiredStepUp(purpose, 'purpose') {
    if (!RegExp(r'^[A-Za-z0-9_.:-]{16,256}$').hasMatch(this.nonce)) {
      throw const AuthProtocolException('OIDC_STEP_UP_NONCE_INVALID');
    }
    if (!RegExp(r'^[A-Za-z0-9_.:-]{1,128}$').hasMatch(this.purpose)) {
      throw const AuthProtocolException('OIDC_STEP_UP_PURPOSE_INVALID');
    }
  }

  final String nonce;
  final String purpose;
  final List<String> acrValues;
}

final class StepUpAuthorizationResult {
  StepUpAuthorizationResult({
    required String accessToken,
    required DateTime accessTokenExpiresAt,
    this.idToken,
  }) : accessToken = _requiredStepUp(accessToken, 'accessToken'),
       accessTokenExpiresAt = accessTokenExpiresAt.toUtc();

  final String accessToken;
  final DateTime accessTokenExpiresAt;
  final String? idToken;

  @override
  String toString() =>
      'StepUpAuthorizationResult(accessToken: [REDACTED], idToken: '
      '${idToken == null ? 'absent' : '[REDACTED]'})';
}

abstract interface class StepUpAuthorizationGateway {
  Future<StepUpAuthorizationResult> authorizeStepUp(
    MobileOidcConfiguration configuration,
    StepUpAuthenticationRequest request,
  );
}

final class AppAuthStepUpAuthorizationGateway
    implements StepUpAuthorizationGateway {
  const AppAuthStepUpAuthorizationGateway({
    appauth.FlutterAppAuth appAuth = const appauth.FlutterAppAuth(),
  }) : _appAuth = appAuth;

  final appauth.FlutterAppAuth _appAuth;

  @override
  Future<StepUpAuthorizationResult> authorizeStepUp(
    MobileOidcConfiguration configuration,
    StepUpAuthenticationRequest request,
  ) async {
    try {
      final response = await _appAuth.authorizeAndExchangeCode(
        appauth.AuthorizationTokenRequest(
          configuration.clientId,
          configuration.redirectUri.toString(),
          additionalParameters: <String, String>{
            'max_age': '0',
            if (request.acrValues.isNotEmpty)
              'acr_values': request.acrValues.join(' '),
          },
          issuer: configuration.issuer.toString(),
          nonce: request.nonce,
          promptValues: const <String>['login'],
          scopes: configuration.scopes,
        ),
      );
      final accessToken = response.accessToken;
      final expiresAt = response.accessTokenExpirationDateTime;
      if (accessToken == null || accessToken.isEmpty || expiresAt == null) {
        throw const AuthProtocolException(
          'OIDC_STEP_UP_TOKEN_RESPONSE_INCOMPLETE',
        );
      }
      return StepUpAuthorizationResult(
        accessToken: accessToken,
        accessTokenExpiresAt: expiresAt,
        idToken: response.idToken,
      );
    } on appauth.FlutterAppAuthUserCancelledException {
      throw const AuthUserCancelledException();
    } on appauth.FlutterAppAuthPlatformException {
      throw const AuthPlatformException('OIDC_STEP_UP_AUTHORIZATION_FAILED');
    } on AuthException {
      rethrow;
    } on Object {
      throw const AuthPlatformException('OIDC_STEP_UP_UNAVAILABLE');
    }
  }
}

final class StepUpAuthenticationProof {
  StepUpAuthenticationProof._({
    required String accessToken,
    required this.authenticatedAt,
    required this.purpose,
    required this.validUntil,
  }) : accessToken = _requiredStepUp(accessToken, 'accessToken');

  final String accessToken;
  final DateTime authenticatedAt;
  final DateTime validUntil;
  final String purpose;

  bool isUsableAt(DateTime now) => validUntil.isAfter(now.toUtc());

  @override
  String toString() =>
      'StepUpAuthenticationProof(accessToken: [REDACTED], purpose: $purpose, '
      'validUntil: ${validUntil.toIso8601String()})';
}

final class StepUpAuthenticationService {
  StepUpAuthenticationService({
    required MobileOidcConfiguration configuration,
    required StepUpAuthorizationGateway gateway,
    StepUpClock? clock,
    Duration maximumProofAge = const Duration(minutes: 5),
    StepUpNonceFactory? nonceFactory,
  }) : _clock = clock ?? DateTime.now,
       _configuration = configuration,
       _gateway = gateway,
       _maximumProofAge = maximumProofAge,
       _nonceFactory = nonceFactory ?? _secureNonce {
    if (maximumProofAge <= Duration.zero ||
        maximumProofAge > const Duration(minutes: 10)) {
      throw const AuthConfigurationException('OIDC_STEP_UP_PROOF_AGE_INVALID');
    }
  }

  final StepUpClock _clock;
  final MobileOidcConfiguration _configuration;
  final StepUpAuthorizationGateway _gateway;
  final Duration _maximumProofAge;
  final StepUpNonceFactory _nonceFactory;

  Future<StepUpAuthenticationProof> authenticate({
    Iterable<String> acrValues = const <String>[],
    required String purpose,
  }) async {
    final request = StepUpAuthenticationRequest(
      acrValues: acrValues,
      nonce: _nonceFactory(),
      purpose: purpose,
    );
    final result = await _gateway.authorizeStepUp(_configuration, request);
    final authenticatedAt = _clock().toUtc();
    if (!result.accessTokenExpiresAt.isAfter(authenticatedAt)) {
      throw const AuthProtocolException('OIDC_STEP_UP_TOKEN_EXPIRED');
    }
    final maximumValidUntil = authenticatedAt.add(_maximumProofAge);
    final validUntil = result.accessTokenExpiresAt.isBefore(maximumValidUntil)
        ? result.accessTokenExpiresAt
        : maximumValidUntil;
    return StepUpAuthenticationProof._(
      accessToken: result.accessToken,
      authenticatedAt: authenticatedAt,
      purpose: request.purpose,
      validUntil: validUntil,
    );
  }

  static String _secureNonce() {
    final random = Random.secure();
    final bytes = List<int>.generate(32, (_) => random.nextInt(256));
    return base64UrlEncode(bytes).replaceAll('=', '');
  }
}

String _requiredStepUp(String value, String field) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw AuthProtocolException('OIDC_STEP_UP_FIELD_REQUIRED:$field');
  }
  return normalized;
}
