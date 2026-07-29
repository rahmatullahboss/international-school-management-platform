import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:school_sync_storage/src/sync_key_vault.dart';
import 'package:school_sync_storage/src/sync_storage_scope.dart';

final class EncryptedSyncRecord {
  factory EncryptedSyncRecord({
    required Uint8List bytes,
    required int keyVersion,
  }) {
    if (bytes.isEmpty) {
      throw const SyncStorageException('SYNC_RECORD_BYTES_REQUIRED');
    }
    if (keyVersion < 1) {
      throw const SyncStorageException('SYNC_KEY_VERSION_INVALID');
    }
    return EncryptedSyncRecord._(
      bytes: Uint8List.fromList(bytes),
      keyVersion: keyVersion,
    );
  }

  EncryptedSyncRecord._({required Uint8List bytes, required this.keyVersion})
    : _bytes = bytes;

  factory EncryptedSyncRecord.fromJson(Map<String, Object?> json) {
    final keyVersion = json['keyVersion'];
    final box = json['box'];
    if (keyVersion is! int || box is! String) {
      throw const SyncStorageException('SYNC_RECORD_SHAPE_INVALID');
    }
    try {
      return EncryptedSyncRecord(
        bytes: base64Decode(box),
        keyVersion: keyVersion,
      );
    } on FormatException catch (error) {
      throw SyncStorageException('SYNC_RECORD_ENCODING_INVALID', error);
    }
  }

  final Uint8List _bytes;
  final int keyVersion;

  Uint8List get bytes => Uint8List.fromList(_bytes);

  Map<String, Object?> toJson() => <String, Object?>{
    'keyVersion': keyVersion,
    'box': base64Encode(_bytes),
  };

  @override
  String toString() =>
      'EncryptedSyncRecord(keyVersion: $keyVersion, bytes: ${_bytes.length})';
}

abstract interface class SyncRecordCipher {
  Future<EncryptedSyncRecord> encrypt({
    required List<int> associatedData,
    required SyncKeyMaterial key,
    required Map<String, Object?> value,
  });

  Future<Map<String, Object?>> decrypt({
    required List<int> associatedData,
    required SyncKeyMaterial key,
    required EncryptedSyncRecord record,
  });
}

final class AesGcmSyncRecordCipher implements SyncRecordCipher {
  AesGcmSyncRecordCipher({AesGcm? algorithm})
    : _algorithm = algorithm ?? AesGcm.with256bits();

  final AesGcm _algorithm;

  @override
  Future<EncryptedSyncRecord> encrypt({
    required List<int> associatedData,
    required SyncKeyMaterial key,
    required Map<String, Object?> value,
  }) async {
    final secretBox = await _algorithm.encrypt(
      utf8.encode(jsonEncode(value)),
      secretKey: key.secretKey,
      aad: associatedData,
    );
    return EncryptedSyncRecord(
      bytes: Uint8List.fromList(secretBox.concatenation()),
      keyVersion: key.version,
    );
  }

  @override
  Future<Map<String, Object?>> decrypt({
    required List<int> associatedData,
    required SyncKeyMaterial key,
    required EncryptedSyncRecord record,
  }) async {
    if (record.keyVersion != key.version) {
      throw const SyncStorageException('SYNC_RECORD_KEY_VERSION_MISMATCH');
    }
    try {
      final secretBox = SecretBox.fromConcatenation(
        record.bytes,
        nonceLength: _algorithm.nonceLength,
        macLength: _algorithm.macAlgorithm.macLength,
      );
      final clearText = await _algorithm.decrypt(
        secretBox,
        secretKey: key.secretKey,
        aad: associatedData,
      );
      final decoded = jsonDecode(utf8.decode(clearText));
      if (decoded is! Map<String, Object?>) {
        throw const SyncStorageException('SYNC_RECORD_PAYLOAD_INVALID');
      }
      return decoded;
    } on SyncStorageException {
      rethrow;
    } on Object catch (error) {
      throw SyncStorageException('SYNC_RECORD_DECRYPTION_FAILED', error);
    }
  }
}

List<int> syncRecordAssociatedData({
  required String recordKind,
  required String recordToken,
  required String scopeFingerprint,
}) => utf8.encode(
  'school-sync-record-v1\u0000$scopeFingerprint\u0000$recordKind\u0000$recordToken',
);
