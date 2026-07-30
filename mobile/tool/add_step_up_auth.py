from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write(relative: str, content: str) -> None:
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"anchor not found in {relative}: {old!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


write(
    "packages/authentication/lib/src/step_up_authentication.dart",
    r'''
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
''',
)

replace_once(
    "packages/authentication/lib/school_authentication.dart",
    "export 'src/session_manager.dart';",
    "export 'src/session_manager.dart';\nexport 'src/step_up_authentication.dart';",
)

write(
    "packages/authentication/test/step_up_authentication_test.dart",
    r'''
import 'package:school_authentication/school_authentication.dart';
import 'package:test/test.dart';

void main() {
  test('creates a short-lived transient proof from fresh authorization', () async {
    final gateway = _FakeStepUpGateway(
      result: StepUpAuthorizationResult(
        accessToken: 'step-up-token',
        accessTokenExpiresAt: DateTime.utc(2026, 7, 30, 10),
      ),
    );
    final service = StepUpAuthenticationService(
      clock: () => DateTime.utc(2026, 7, 30, 9),
      configuration: configuration(),
      gateway: gateway,
      nonceFactory: () => 'nonce_12345678901234567890',
    );

    final proof = await service.authenticate(
      acrValues: const <String>['urn:school:aal2'],
      purpose: 'family_document_download',
    );

    expect(proof.isUsableAt(DateTime.utc(2026, 7, 30, 9, 4)), isTrue);
    expect(proof.isUsableAt(DateTime.utc(2026, 7, 30, 9, 5)), isFalse);
    expect(proof.toString(), isNot(contains('step-up-token')));
    expect(gateway.request?.purpose, 'family_document_download');
    expect(gateway.request?.acrValues, ['urn:school:aal2']);
  });

  test('rejects an already expired authorization result', () async {
    final service = StepUpAuthenticationService(
      clock: () => DateTime.utc(2026, 7, 30, 9),
      configuration: configuration(),
      gateway: _FakeStepUpGateway(
        result: StepUpAuthorizationResult(
          accessToken: 'expired-token',
          accessTokenExpiresAt: DateTime.utc(2026, 7, 30, 8, 59),
        ),
      ),
      nonceFactory: () => 'nonce_12345678901234567890',
    );

    expect(
      () => service.authenticate(purpose: 'family_document_download'),
      throwsA(
        isA<AuthProtocolException>().having(
          (error) => error.code,
          'code',
          'OIDC_STEP_UP_TOKEN_EXPIRED',
        ),
      ),
    );
  });
}

MobileOidcConfiguration configuration() => MobileOidcConfiguration(
  clientId: 'school-family',
  issuer: Uri.parse('https://identity.example.test'),
  redirectUri: Uri.parse('ozzylschoolfamily:/oauth/callback'),
);

final class _FakeStepUpGateway implements StepUpAuthorizationGateway {
  _FakeStepUpGateway({required this.result});

  final StepUpAuthorizationResult result;
  StepUpAuthenticationRequest? request;

  @override
  Future<StepUpAuthorizationResult> authorizeStepUp(
    MobileOidcConfiguration configuration,
    StepUpAuthenticationRequest request,
  ) async {
    this.request = request;
    return result;
  }
}
''',
)
