import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_authentication/school_authentication.dart';
import 'package:school_family_domain/family_interactions.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_secure_documents/school_secure_documents.dart';

void main() {
  test(
    'uses step-up, verifies integrity and disposes no-store lease',
    () async {
      final bytes = utf8.encode('secure-document');
      final gateway = _FakeStepUpGateway(
        StepUpAuthorizationResult(
          accessToken: 'step-up-access',
          accessTokenExpiresAt: DateTime.utc(2026, 7, 30, 10),
        ),
      );
      final lease = _MemoryLease();
      final presenter = _FakePresenter();
      final transport = _FakeTransport(response: responseFor(bytes: bytes));
      var ordinaryTokenCalls = 0;
      final coordinator = SecureDocumentExchangeCoordinator(
        accessTokenProvider: () async {
          ordinaryTokenCalls++;
          return 'ordinary-access';
        },
        clock: () => DateTime.utc(2026, 7, 30, 9),
        leaseFactory: _FakeLeaseFactory(lease),
        presenter: presenter,
        stepUpAuthentication: StepUpAuthenticationService(
          clock: () => DateTime.utc(2026, 7, 30, 9),
          configuration: configuration(),
          gateway: gateway,
          nonceFactory: () => 'nonce_12345678901234567890',
        ),
        transport: transport,
      );

      final receipt = await coordinator.exchangeAndPresent(
        document: document(sizeBytes: bytes.length),
        grant: grant(requiresStepUp: true),
        session: session(),
      );

      expect(receipt.stepUpUsed, isTrue);
      expect(ordinaryTokenCalls, 0);
      expect(transport.lastAccessToken, 'step-up-access');
      expect(presenter.presented, isTrue);
      expect(lease.disposed, isTrue);
      expect(lease.bytes, bytes);
      expect(
        receipt.toString(),
        isNot(contains(sha256.convert(bytes).toString())),
      );

      await expectLater(
        coordinator.exchangeAndPresent(
          document: document(sizeBytes: bytes.length),
          grant: grant(requiresStepUp: true),
          session: session(),
        ),
        throwsA(
          isA<SecureDocumentException>().having(
            (error) => error.code,
            'code',
            'SECURE_DOCUMENT_GRANT_ALREADY_CLAIMED',
          ),
        ),
      );
    },
  );

  test('deletes the lease when integrity validation fails', () async {
    final bytes = utf8.encode('secure-document');
    final lease = _MemoryLease();
    final coordinator = SecureDocumentExchangeCoordinator(
      accessTokenProvider: () async => 'ordinary-access',
      clock: () => DateTime.utc(2026, 7, 30, 9),
      leaseFactory: _FakeLeaseFactory(lease),
      presenter: _FakePresenter(),
      stepUpAuthentication: StepUpAuthenticationService(
        clock: () => DateTime.utc(2026, 7, 30, 9),
        configuration: configuration(),
        gateway: _FakeStepUpGateway(
          StepUpAuthorizationResult(
            accessToken: 'step-up-access',
            accessTokenExpiresAt: DateTime.utc(2026, 7, 30, 10),
          ),
        ),
        nonceFactory: () => 'nonce_12345678901234567890',
      ),
      transport: _FakeTransport(
        response: SecureDocumentStreamResponse(
          bytes: Stream<List<int>>.value(bytes),
          contentLength: bytes.length,
          documentId: 'document-1',
          mediaType: 'application/pdf',
          noStore: true,
          sha256Hex: List<String>.filled(64, '0').join(),
        ),
      ),
    );

    await expectLater(
      coordinator.exchangeAndPresent(
        document: document(sizeBytes: bytes.length),
        grant: grant(requiresStepUp: false),
        session: session(),
      ),
      throwsA(
        isA<SecureDocumentException>().having(
          (error) => error.code,
          'code',
          'SECURE_DOCUMENT_INTEGRITY_MISMATCH',
        ),
      ),
    );
    expect(lease.disposed, isTrue);
    expect(lease.presented, isFalse);
  });

  test('rejects restricted grants that are not single use', () async {
    final coordinator = SecureDocumentExchangeCoordinator(
      accessTokenProvider: () async => 'ordinary-access',
      clock: () => DateTime.utc(2026, 7, 30, 9),
      leaseFactory: _FakeLeaseFactory(_MemoryLease()),
      presenter: _FakePresenter(),
      stepUpAuthentication: StepUpAuthenticationService(
        clock: () => DateTime.utc(2026, 7, 30, 9),
        configuration: configuration(),
        gateway: _FakeStepUpGateway(
          StepUpAuthorizationResult(
            accessToken: 'step-up-access',
            accessTokenExpiresAt: DateTime.utc(2026, 7, 30, 10),
          ),
        ),
        nonceFactory: () => 'nonce_12345678901234567890',
      ),
      transport: _FakeTransport(
        response: responseFor(bytes: utf8.encode('secure-document')),
      ),
    );

    await expectLater(
      coordinator.exchangeAndPresent(
        document: document(sizeBytes: utf8.encode('secure-document').length),
        grant: FamilyDocumentDownloadGrant(
          documentId: 'document-1',
          expiresAt: DateTime.utc(2026, 7, 30, 9, 10),
          grantId: 'grant-unsafe',
          requiresStepUp: true,
          singleUse: false,
        ),
        session: session(),
      ),
      throwsA(
        isA<SecureDocumentException>().having(
          (error) => error.code,
          'code',
          'SECURE_DOCUMENT_RESTRICTED_POLICY_INVALID',
        ),
      ),
    );
  });
}

SecureDocumentStreamResponse responseFor({required List<int> bytes}) =>
    SecureDocumentStreamResponse(
      bytes: Stream<List<int>>.value(bytes),
      contentLength: bytes.length,
      documentId: 'document-1',
      mediaType: 'application/pdf',
      noStore: true,
      sha256Hex: sha256.convert(bytes).toString(),
    );

FamilyDocumentSummary document({required int sizeBytes}) =>
    FamilyDocumentSummary(
      cachePolicy: FamilyDocumentCachePolicy.noStore,
      classification: FamilyDocumentClassification.restricted,
      documentId: 'document-1',
      fileName: 'report.pdf',
      issuedAt: DateTime.utc(2026, 7, 1),
      sizeBytes: sizeBytes,
      title: 'Student report',
    );

FamilyDocumentDownloadGrant grant({required bool requiresStepUp}) =>
    FamilyDocumentDownloadGrant(
      documentId: 'document-1',
      expiresAt: DateTime.utc(2026, 7, 30, 9, 10),
      grantId: 'grant-1',
      requiresStepUp: requiresStepUp,
      singleUse: true,
    );

SchoolSession session() => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.guardian,
  availablePersonas: const <SchoolPersona>{SchoolPersona.guardian},
  campusId: 'campus-1',
  capabilities: const <String>{SchoolCapability.documentsRead},
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);

MobileOidcConfiguration configuration() => MobileOidcConfiguration(
  clientId: 'school-family',
  issuer: Uri.parse('https://identity.example.test'),
  redirectUri: Uri.parse('ozzylschoolfamily:/oauth/callback'),
);

final class _FakeStepUpGateway implements StepUpAuthorizationGateway {
  _FakeStepUpGateway(this.result);

  final StepUpAuthorizationResult result;

  @override
  Future<StepUpAuthorizationResult> authorizeStepUp(
    MobileOidcConfiguration configuration,
    StepUpAuthenticationRequest request,
  ) async => result;
}

final class _FakeTransport implements SecureDocumentTransport {
  _FakeTransport({required this.response});

  final SecureDocumentStreamResponse response;
  String? lastAccessToken;

  @override
  Future<SecureDocumentStreamResponse> exchange({
    required String accessToken,
    required String correlationId,
    required FamilyDocumentDownloadGrant grant,
    required String idempotencyKey,
    required SchoolSession session,
  }) async {
    lastAccessToken = accessToken;
    return response;
  }
}

final class _FakeLeaseFactory implements SecureDocumentLeaseFactory {
  _FakeLeaseFactory(this.lease);

  final _MemoryLease lease;

  @override
  Future<SecureDocumentLease> create() async => lease;
}

final class _MemoryLease implements SecureDocumentLease {
  final bytes = <int>[];
  bool disposed = false;
  bool presented = false;
  bool sealed = false;

  @override
  Future<void> append(List<int> bytes) async {
    this.bytes.addAll(bytes);
  }

  @override
  Future<void> dispose() async {
    disposed = true;
  }

  @override
  Future<void> present(
    SecureDocumentPresenter presenter,
    String mediaType,
  ) async {
    presented = true;
    await presenter.presentFile(
      mediaType: mediaType,
      path: '[opaque-test-path]',
    );
  }

  @override
  Future<void> seal() async {
    sealed = true;
  }
}

final class _FakePresenter implements SecureDocumentPresenter {
  bool presented = false;

  @override
  Future<void> presentFile({
    required String mediaType,
    required String path,
  }) async {
    presented = true;
  }
}
