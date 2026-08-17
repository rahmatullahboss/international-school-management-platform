import 'package:flutter_test/flutter_test.dart';
import 'package:school_authentication/school_authentication.dart';

void main() {
  test(
    'creates a short-lived transient proof from fresh authorization',
    () async {
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
    },
  );

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
