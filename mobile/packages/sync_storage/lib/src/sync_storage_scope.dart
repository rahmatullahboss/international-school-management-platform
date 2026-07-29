import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:school_mobile_core/mobile_core.dart';

final class SyncStorageScope {
  factory SyncStorageScope({
    required String accountId,
    required String campusId,
    required String tenantId,
  }) => SyncStorageScope._(
    accountId: _required(accountId, 'accountId'),
    campusId: _required(campusId, 'campusId'),
    tenantId: _required(tenantId, 'tenantId'),
  );

  factory SyncStorageScope.fromSession(SchoolSession session) =>
      SyncStorageScope(
        accountId: session.accountId,
        campusId: session.campusId,
        tenantId: session.tenantId,
      );

  const SyncStorageScope._({
    required this.accountId,
    required this.campusId,
    required this.tenantId,
  });

  final String accountId;
  final String tenantId;
  final String campusId;

  bool matchesSession(SchoolSession session) =>
      accountId == session.accountId &&
      tenantId == session.tenantId &&
      campusId == session.campusId;

  Future<String> fingerprint() async {
    final hash = await Sha256().hash(
      utf8.encode(
        'school-sync-scope-v1\u0000$accountId\u0000$tenantId\u0000$campusId',
      ),
    );
    return base64UrlEncode(hash.bytes).replaceAll('=', '');
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'accountId': accountId,
    'tenantId': tenantId,
    'campusId': campusId,
  };

  factory SyncStorageScope.fromJson(Map<String, Object?> json) =>
      SyncStorageScope(
        accountId: _string(json, 'accountId'),
        campusId: _string(json, 'campusId'),
        tenantId: _string(json, 'tenantId'),
      );

  @override
  bool operator ==(Object other) =>
      other is SyncStorageScope &&
      other.accountId == accountId &&
      other.tenantId == tenantId &&
      other.campusId == campusId;

  @override
  int get hashCode => Object.hash(accountId, tenantId, campusId);

  @override
  String toString() => 'SyncStorageScope(redacted)';
}

final class SyncStorageException implements Exception {
  const SyncStorageException(this.code, [this.cause]);

  final String code;
  final Object? cause;

  @override
  String toString() => 'SyncStorageException($code)';
}

String _required(String value, String field) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw SyncStorageException('SYNC_STORAGE_FIELD_REQUIRED:$field');
  }
  return normalized;
}

String _string(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw SyncStorageException('SYNC_STORAGE_STRING_REQUIRED:$key');
  }
  return value.trim();
}
