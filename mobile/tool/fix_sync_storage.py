#!/usr/bin/env python3
"""Apply strict analyzer compatibility fixes to sync_storage."""

from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'packages/sync_storage'

key_path = root / 'lib/src/sync_key_vault.dart'
source = key_path.read_text(encoding='utf-8')
old = """  SyncKeyMaterial({required SecretKey secretKey, required this.version})
    : secretKey = secretKey {
"""
new = """  SyncKeyMaterial({required this.secretKey, required this.version}) {
"""
if old in source:
    source = source.replace(old, new, 1)
elif new not in source:
    raise SystemExit('Unexpected SyncKeyMaterial constructor shape')
key_path.write_text(source, encoding='utf-8')

store_path = root / 'lib/src/file_encrypted_sync_store.dart'
source = store_path.read_text(encoding='utf-8')
old = """  _EncryptedSnapshot({
    required this.fingerprint,
    required Map<String, EncryptedSyncRecord> records,
    this.cursor,
  }) : records = records;
"""
new = """  _EncryptedSnapshot({
    required this.fingerprint,
    required this.records,
    this.cursor,
  });
"""
if old in source:
    source = source.replace(old, new, 1)
elif new not in source:
    raise SystemExit('Unexpected encrypted snapshot constructor shape')
store_path.write_text(source, encoding='utf-8')

cipher_path = root / 'lib/src/sync_record_cipher.dart'
source = cipher_path.read_text(encoding='utf-8')
factory_block = """  factory EncryptedSyncRecord.fromJson(Map<String, Object?> json) {
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

"""
anchor = """  EncryptedSyncRecord._({required Uint8List bytes, required this.keyVersion})
    : _bytes = bytes;

"""
if factory_block in source:
    source = source.replace(factory_block, '', 1)
    source = source.replace(anchor, anchor + factory_block, 1)
elif source.find('factory EncryptedSyncRecord.fromJson') > source.find('final Uint8List _bytes;'):
    raise SystemExit('Unexpected EncryptedSyncRecord factory shape')
cipher_path.write_text(source, encoding='utf-8')

scope_path = root / 'lib/src/sync_storage_scope.dart'
source = scope_path.read_text(encoding='utf-8')
factory_block = """  factory SyncStorageScope.fromJson(Map<String, Object?> json) =>
      SyncStorageScope(
        accountId: _string(json, 'accountId'),
        campusId: _string(json, 'campusId'),
        tenantId: _string(json, 'tenantId'),
      );

"""
anchor = """  const SyncStorageScope._({
    required this.accountId,
    required this.campusId,
    required this.tenantId,
  });

"""
if factory_block in source:
    source = source.replace(factory_block, '', 1)
    source = source.replace(anchor, anchor + factory_block, 1)
elif source.find('factory SyncStorageScope.fromJson') > source.find('final String accountId;'):
    raise SystemExit('Unexpected SyncStorageScope factory shape')
scope_path.write_text(source, encoding='utf-8')

test_path = root / 'test/sync_storage_test.dart'
source = test_path.read_text(encoding='utf-8')
old = """Future<File> activeFile(Directory directory) async => directory
    .list()
    .whereType<File>()
    .firstWhere((file) => file.path.endsWith('.json'));
"""
new = """Future<File> activeFile(Directory directory) async {
  await for (final entity in directory.list()) {
    if (entity is File && entity.path.endsWith('.json')) {
      return entity;
    }
  }
  throw StateError('Active sync store file not found.');
}
"""
if old in source:
    source = source.replace(old, new, 1)
elif new not in source:
    raise SystemExit('Unexpected activeFile helper shape')
test_path.write_text(source, encoding='utf-8')
print('Encrypted sync storage compatibility fixes applied.')
