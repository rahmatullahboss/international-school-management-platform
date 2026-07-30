library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:school_authentication/school_authentication.dart';
import 'package:school_family_domain/family_interactions.dart';
import 'package:school_mobile_core/mobile_core.dart';

typedef SecureDocumentAccessTokenProvider = Future<String> Function();
typedef SecureDocumentClock = DateTime Function();

final class SecureDocumentException implements Exception {
  const SecureDocumentException(this.code, {this.statusCode});

  final String code;
  final int? statusCode;

  @override
  String toString() => 'SecureDocumentException($code, $statusCode)';
}

final class SecureDocumentStreamResponse {
  SecureDocumentStreamResponse({
    required this.bytes,
    required int contentLength,
    required String documentId,
    required String mediaType,
    required this.noStore,
    required String sha256Hex,
  }) : contentLength = _positive(contentLength, 'contentLength'),
       documentId = _identifier(documentId, 'documentId'),
       mediaType = _mediaType(mediaType),
       sha256Hex = _sha256(sha256Hex);

  final Stream<List<int>> bytes;
  final int contentLength;
  final String documentId;
  final String mediaType;
  final bool noStore;
  final String sha256Hex;
}

abstract interface class SecureDocumentTransport {
  Future<SecureDocumentStreamResponse> exchange({
    required String accessToken,
    required String correlationId,
    required FamilyDocumentDownloadGrant grant,
    required String idempotencyKey,
    required SchoolSession session,
  });
}

final class HttpSecureDocumentTransport implements SecureDocumentTransport {
  HttpSecureDocumentTransport({required Uri baseUri, http.Client? client})
    : _baseUri = _normalizeBaseUri(baseUri),
      _client = client ?? http.Client(),
      _ownsClient = client == null;

  final Uri _baseUri;
  final http.Client _client;
  final bool _ownsClient;

  @override
  Future<SecureDocumentStreamResponse> exchange({
    required String accessToken,
    required String correlationId,
    required FamilyDocumentDownloadGrant grant,
    required String idempotencyKey,
    required SchoolSession session,
  }) async {
    final token = _required(accessToken, 'accessToken');
    final correlation = _identifier(correlationId, 'correlationId');
    final idempotency = _identifier(idempotencyKey, 'idempotencyKey');
    final grantId = _identifier(grant.grantId, 'grantId');
    final path =
        'v1/mobile/family/document-download-grants/'
        '${Uri.encodeComponent(grantId)}/exchange';
    final request = http.Request('POST', _baseUri.resolve(path))
      ..followRedirects = false
      ..maxRedirects = 0
      ..headers.addAll(<String, String>{
        'Accept': 'application/octet-stream',
        'Authorization': 'Bearer $token',
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotency,
        'X-Campus-Id': session.campusId,
        'X-Correlation-Id': correlation,
        'X-Persona': session.activePersona.name,
        'X-Tenant-Id': session.tenantId,
      })
      ..body = '{}';
    final response = await _client.send(request);
    if (response.statusCode != HttpStatus.ok) {
      await response.stream.drain<void>();
      throw SecureDocumentException(
        'SECURE_DOCUMENT_EXCHANGE_FAILED',
        statusCode: response.statusCode,
      );
    }
    final headers = response.headers;
    final cacheControl = headers['cache-control']?.toLowerCase() ?? '';
    final contentLength =
        response.contentLength ?? int.tryParse(headers['content-length'] ?? '');
    if (contentLength == null || contentLength < 1) {
      await response.stream.drain<void>();
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_CONTENT_LENGTH_REQUIRED',
      );
    }
    final documentId = headers['x-document-id'];
    final digest = headers['x-content-sha256'];
    final mediaType = headers['content-type']?.split(';').first.trim();
    if (documentId == null || digest == null || mediaType == null) {
      await response.stream.drain<void>();
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_RESPONSE_HEADERS_REQUIRED',
      );
    }
    return SecureDocumentStreamResponse(
      bytes: response.stream,
      contentLength: contentLength,
      documentId: documentId,
      mediaType: mediaType,
      noStore: cacheControl
          .split(',')
          .any((directive) => directive.trim() == 'no-store'),
      sha256Hex: digest,
    );
  }

  void close() {
    if (_ownsClient) _client.close();
  }

  static Uri _normalizeBaseUri(Uri value) {
    if (value.scheme != 'https' || value.host.isEmpty) {
      throw const SecureDocumentException('SECURE_DOCUMENT_API_HTTPS_REQUIRED');
    }
    return value.path.endsWith('/')
        ? value
        : value.replace(path: '${value.path}/');
  }
}

abstract interface class SecureDocumentPresenter {
  Future<void> presentFile({required String mediaType, required String path});
}

abstract interface class SecureDocumentLease {
  Future<void> append(List<int> bytes);

  Future<void> present(SecureDocumentPresenter presenter, String mediaType);

  Future<void> seal();

  Future<void> dispose();
}

abstract interface class SecureDocumentLeaseFactory {
  Future<SecureDocumentLease> create();
}

abstract interface class SecureDocumentDirectoryProvider {
  Future<Directory> temporaryDirectory();
}

final class PathProviderSecureDocumentDirectoryProvider
    implements SecureDocumentDirectoryProvider {
  const PathProviderSecureDocumentDirectoryProvider();

  @override
  Future<Directory> temporaryDirectory() => getTemporaryDirectory();
}

final class FileNoStoreDocumentLeaseFactory
    implements SecureDocumentLeaseFactory {
  FileNoStoreDocumentLeaseFactory({
    SecureDocumentDirectoryProvider directoryProvider =
        const PathProviderSecureDocumentDirectoryProvider(),
    Random? random,
  }) : _directoryProvider = directoryProvider,
       _random = random ?? Random.secure();

  final SecureDocumentDirectoryProvider _directoryProvider;
  final Random _random;

  @override
  Future<SecureDocumentLease> create() async {
    final directory = await _directoryProvider.temporaryDirectory();
    await directory.create(recursive: true);
    final name = List<int>.generate(
      24,
      (_) => _random.nextInt(256),
    ).map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
    final file = File('${directory.path}/school-secure-$name.bin');
    return _FileNoStoreDocumentLease(file);
  }
}

final class _FileNoStoreDocumentLease implements SecureDocumentLease {
  _FileNoStoreDocumentLease(this._file);

  final File _file;
  IOSink? _sink;
  bool _disposed = false;
  bool _sealed = false;

  @override
  Future<void> append(List<int> bytes) async {
    _ensureWritable();
    final sink = _sink ??= _file.openWrite(mode: FileMode.writeOnly);
    sink.add(bytes);
  }

  @override
  Future<void> seal() async {
    if (_disposed) {
      throw const SecureDocumentException('SECURE_DOCUMENT_LEASE_DISPOSED');
    }
    if (_sealed) return;
    final sink = _sink ??= _file.openWrite(mode: FileMode.writeOnly);
    await sink.flush();
    await sink.close();
    _sealed = true;
  }

  @override
  Future<void> present(
    SecureDocumentPresenter presenter,
    String mediaType,
  ) async {
    if (!_sealed || _disposed) {
      throw const SecureDocumentException('SECURE_DOCUMENT_LEASE_NOT_READY');
    }
    await presenter.presentFile(mediaType: mediaType, path: _file.path);
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    if (!_sealed) {
      await _sink?.close();
    }
    if (await _file.exists()) {
      await _file.delete();
    }
  }

  void _ensureWritable() {
    if (_sealed || _disposed) {
      throw const SecureDocumentException('SECURE_DOCUMENT_LEASE_NOT_WRITABLE');
    }
  }

  @override
  String toString() => 'SecureDocumentLease(path: [REDACTED])';
}

final class SecureDocumentExchangeReceipt {
  const SecureDocumentExchangeReceipt({
    required this.byteLength,
    required this.completedAt,
    required this.documentId,
    required this.sha256Hex,
    required this.stepUpUsed,
  });

  final String documentId;
  final int byteLength;
  final String sha256Hex;
  final DateTime completedAt;
  final bool stepUpUsed;

  @override
  String toString() =>
      'SecureDocumentExchangeReceipt(documentId: $documentId, '
      'sha256: [REDACTED], bytes: $byteLength)';
}

abstract interface class FamilySecureDocumentExchange {
  Future<SecureDocumentExchangeReceipt> exchangeAndPresent({
    required FamilyDocumentSummary document,
    required FamilyDocumentDownloadGrant grant,
    required SchoolSession session,
  });
}

final class SecureDocumentExchangeCoordinator
    implements FamilySecureDocumentExchange {
  SecureDocumentExchangeCoordinator({
    required SecureDocumentAccessTokenProvider accessTokenProvider,
    required SecureDocumentLeaseFactory leaseFactory,
    required SecureDocumentPresenter presenter,
    required StepUpAuthenticationService stepUpAuthentication,
    required SecureDocumentTransport transport,
    SecureDocumentClock? clock,
    int maximumBytes = 25 * 1024 * 1024,
  }) : _accessTokenProvider = accessTokenProvider,
       _clock = clock ?? DateTime.now,
       _leaseFactory = leaseFactory,
       _maximumBytes = maximumBytes,
       _presenter = presenter,
       _stepUpAuthentication = stepUpAuthentication,
       _transport = transport {
    if (maximumBytes < 1 || maximumBytes > 100 * 1024 * 1024) {
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_MAXIMUM_BYTES_INVALID',
      );
    }
  }

  final SecureDocumentAccessTokenProvider _accessTokenProvider;
  final SecureDocumentClock _clock;
  final SecureDocumentLeaseFactory _leaseFactory;
  final int _maximumBytes;
  final SecureDocumentPresenter _presenter;
  final StepUpAuthenticationService _stepUpAuthentication;
  final SecureDocumentTransport _transport;
  final Set<String> _activeGrants = <String>{};
  final Set<String> _completedGrants = <String>{};

  @override
  Future<SecureDocumentExchangeReceipt> exchangeAndPresent({
    required FamilyDocumentSummary document,
    required FamilyDocumentDownloadGrant grant,
    required SchoolSession session,
  }) async {
    _validateScope(document: document, grant: grant, session: session);
    if (_completedGrants.contains(grant.grantId) ||
        !_activeGrants.add(grant.grantId)) {
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_GRANT_ALREADY_CLAIMED',
      );
    }
    SecureDocumentLease? lease;
    try {
      final stepUpUsed = grant.requiresStepUp;
      final accessToken = stepUpUsed
          ? (await _stepUpAuthentication.authenticate(
              acrValues: const <String>['urn:school:aal2'],
              purpose: 'family_document_download',
            )).accessToken
          : await _accessTokenProvider();
      final response = await _transport.exchange(
        accessToken: accessToken,
        correlationId: _identity('secure-document-exchange'),
        grant: grant,
        idempotencyKey: _identity('secure-document-operation'),
        session: session,
      );
      _validateResponse(document, response);
      lease = await _leaseFactory.create();
      final completer = Completer<Digest>();
      final digestSink = sha256.startChunkedConversion(
        _SingleDigestSink(completer),
      );
      var received = 0;
      await for (final chunk in response.bytes) {
        received += chunk.length;
        if (received > response.contentLength || received > _maximumBytes) {
          throw const SecureDocumentException(
            'SECURE_DOCUMENT_STREAM_TOO_LARGE',
          );
        }
        digestSink.add(chunk);
        await lease.append(chunk);
      }
      digestSink.close();
      final actualDigest = (await completer.future).toString();
      if (received != response.contentLength ||
          actualDigest != response.sha256Hex) {
        throw const SecureDocumentException(
          'SECURE_DOCUMENT_INTEGRITY_MISMATCH',
        );
      }
      await lease.seal();
      await lease.present(_presenter, response.mediaType);
      _completedGrants.add(grant.grantId);
      return SecureDocumentExchangeReceipt(
        byteLength: received,
        completedAt: _clock().toUtc(),
        documentId: document.documentId,
        sha256Hex: actualDigest,
        stepUpUsed: stepUpUsed,
      );
    } finally {
      _activeGrants.remove(grant.grantId);
      await lease?.dispose();
    }
  }

  void _validateScope({
    required FamilyDocumentSummary document,
    required FamilyDocumentDownloadGrant grant,
    required SchoolSession session,
  }) {
    _identifier(grant.grantId, 'grantId');
    if ((session.activePersona != SchoolPersona.guardian &&
            session.activePersona != SchoolPersona.student) ||
        !session.can(SchoolCapability.documentsRead)) {
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_CAPABILITY_REQUIRED',
      );
    }
    if (grant.documentId != document.documentId) {
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_GRANT_SCOPE_MISMATCH',
      );
    }
    final now = _clock().toUtc();
    if (!grant.expiresAt.isAfter(now.add(const Duration(seconds: 5)))) {
      throw const SecureDocumentException('SECURE_DOCUMENT_GRANT_EXPIRED');
    }
    if (document.classification == FamilyDocumentClassification.restricted &&
        (!grant.singleUse ||
            document.cachePolicy != FamilyDocumentCachePolicy.noStore)) {
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_RESTRICTED_POLICY_INVALID',
      );
    }
    if (document.sizeBytes < 1 || document.sizeBytes > _maximumBytes) {
      throw const SecureDocumentException('SECURE_DOCUMENT_SIZE_UNSUPPORTED');
    }
  }

  void _validateResponse(
    FamilyDocumentSummary document,
    SecureDocumentStreamResponse response,
  ) {
    if (!response.noStore) {
      throw const SecureDocumentException('SECURE_DOCUMENT_NO_STORE_REQUIRED');
    }
    if (response.documentId != document.documentId) {
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_RESPONSE_SCOPE_MISMATCH',
      );
    }
    if (response.contentLength != document.sizeBytes ||
        response.contentLength > _maximumBytes) {
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_CONTENT_LENGTH_MISMATCH',
      );
    }
  }

  String _identity(String prefix) =>
      '$prefix-${_clock().toUtc().microsecondsSinceEpoch}';
}

final class _SingleDigestSink implements Sink<Digest> {
  _SingleDigestSink(this._completer);

  final Completer<Digest> _completer;
  bool _closed = false;

  @override
  void add(Digest data) {
    if (_closed || _completer.isCompleted) {
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_DIGEST_SINK_INVALID',
      );
    }
    _completer.complete(data);
  }

  @override
  void close() {
    _closed = true;
    if (!_completer.isCompleted) {
      _completer.completeError(
        const SecureDocumentException('SECURE_DOCUMENT_DIGEST_MISSING'),
      );
    }
  }
}

String _identifier(String value, String field) {
  final normalized = _required(value, field);
  if (!RegExp(r'^[A-Za-z0-9_.:-]{1,256}$').hasMatch(normalized) ||
      normalized.contains('://')) {
    throw SecureDocumentException('SECURE_DOCUMENT_IDENTIFIER_INVALID:$field');
  }
  return normalized;
}

String _mediaType(String value) {
  final normalized = _required(value, 'mediaType').toLowerCase();
  const allowed = <String>{
    'application/pdf',
    'image/jpeg',
    'image/png',
    'text/plain',
  };
  if (!allowed.contains(normalized)) {
    throw const SecureDocumentException(
      'SECURE_DOCUMENT_MEDIA_TYPE_UNSUPPORTED',
    );
  }
  return normalized;
}

int _positive(int value, String field) {
  if (value < 1) {
    throw SecureDocumentException('SECURE_DOCUMENT_POSITIVE_REQUIRED:$field');
  }
  return value;
}

String _required(String value, String field) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw SecureDocumentException('SECURE_DOCUMENT_FIELD_REQUIRED:$field');
  }
  return normalized;
}

String _sha256(String value) {
  final normalized = value.trim().toLowerCase();
  if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(normalized)) {
    throw const SecureDocumentException('SECURE_DOCUMENT_SHA256_INVALID');
  }
  return normalized;
}
