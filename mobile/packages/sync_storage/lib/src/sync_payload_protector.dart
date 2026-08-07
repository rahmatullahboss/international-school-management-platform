import 'dart:convert';
import 'dart:typed_data';

import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:school_sync_storage/src/sync_key_vault.dart';
import 'package:school_sync_storage/src/sync_record_cipher.dart';
import 'package:school_sync_storage/src/sync_storage_scope.dart';

abstract interface class SyncPayloadProtector {
  Future<EncryptedSyncPayload> protect({
    required String operationId,
    required String schemaVersion,
    required Map<String, Object?> value,
  });

  Future<Map<String, Object?>> unprotect({
    required SyncOperationEnvelope operation,
  });
}

final class ScopedSyncPayloadProtector implements SyncPayloadProtector {
  ScopedSyncPayloadProtector({
    required SyncKeyVault keyVault,
    required SyncRecordCipher recordCipher,
    required SyncStorageScope scope,
  }) : _keyVault = keyVault,
       _recordCipher = recordCipher,
       _scope = scope;

  final SyncKeyVault _keyVault;
  final SyncRecordCipher _recordCipher;
  final SyncStorageScope _scope;

  @override
  Future<EncryptedSyncPayload> protect({
    required String operationId,
    required String schemaVersion,
    required Map<String, Object?> value,
  }) async {
    final normalizedOperationId = _required(operationId, 'operationId');
    final normalizedSchema = _required(schemaVersion, 'schemaVersion');
    final fingerprint = await _scope.fingerprint();
    final key = await _keyVault.current(_scope);
    final record = await _recordCipher.encrypt(
      associatedData: syncRecordAssociatedData(
        recordKind: 'payload:$normalizedSchema',
        recordToken: normalizedOperationId,
        scopeFingerprint: fingerprint,
      ),
      key: key,
      value: value,
    );
    return EncryptedSyncPayload(
      ciphertext: record.bytes,
      contentType: 'application/json',
      keyAlias: 'sync-scope-v${record.keyVersion}',
      schemaVersion: normalizedSchema,
    );
  }

  @override
  Future<Map<String, Object?>> unprotect({
    required SyncOperationEnvelope operation,
  }) async {
    _validateScope(operation);
    if (operation.payload.contentType != 'application/json') {
      throw const SyncStorageException('SYNC_PAYLOAD_CONTENT_TYPE_UNSUPPORTED');
    }
    final keyVersion = _keyVersion(operation.payload.keyAlias);
    final key = await _keyVault.read(_scope, keyVersion);
    final fingerprint = await _scope.fingerprint();
    return _recordCipher.decrypt(
      associatedData: syncRecordAssociatedData(
        recordKind: 'payload:${operation.payload.schemaVersion}',
        recordToken: operation.operationId,
        scopeFingerprint: fingerprint,
      ),
      key: key,
      record: EncryptedSyncRecord(
        bytes: Uint8List.fromList(operation.payload.ciphertext),
        keyVersion: keyVersion,
      ),
    );
  }

  void _validateScope(SyncOperationEnvelope operation) {
    if (operation.accountId != _scope.accountId ||
        operation.tenantId != _scope.tenantId ||
        operation.campusId != _scope.campusId) {
      throw const SyncStorageException('SYNC_PAYLOAD_SCOPE_MISMATCH');
    }
  }

  int _keyVersion(String alias) {
    const prefix = 'sync-scope-v';
    if (!alias.startsWith(prefix)) {
      throw const SyncStorageException('SYNC_PAYLOAD_KEY_ALIAS_INVALID');
    }
    final version = int.tryParse(alias.substring(prefix.length));
    if (version == null || version < 1) {
      throw const SyncStorageException('SYNC_PAYLOAD_KEY_ALIAS_INVALID');
    }
    return version;
  }
}

final class JsonSyncPayloadCodec {
  const JsonSyncPayloadCodec();

  Uint8List encode(Map<String, Object?> value) =>
      Uint8List.fromList(utf8.encode(jsonEncode(value)));

  Map<String, Object?> decode(Uint8List value) {
    final decoded = jsonDecode(utf8.decode(value));
    if (decoded is! Map<String, Object?>) {
      throw const SyncStorageException('SYNC_PAYLOAD_JSON_OBJECT_REQUIRED');
    }
    return decoded;
  }
}

String _required(String value, String field) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw SyncStorageException('SYNC_PAYLOAD_FIELD_REQUIRED:$field');
  }
  return normalized;
}
