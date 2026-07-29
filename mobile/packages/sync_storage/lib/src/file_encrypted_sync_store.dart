import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:path_provider/path_provider.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:school_sync_engine/sync_journal.dart';
import 'package:school_sync_storage/src/sync_key_vault.dart';
import 'package:school_sync_storage/src/sync_record_cipher.dart';
import 'package:school_sync_storage/src/sync_storage_scope.dart';

abstract interface class SyncDirectoryProvider {
  Future<Directory> directory();
}

final class ApplicationSupportSyncDirectoryProvider
    implements SyncDirectoryProvider {
  const ApplicationSupportSyncDirectoryProvider();

  @override
  Future<Directory> directory() async {
    final root = await getApplicationSupportDirectory();
    final directory = Directory(
      '${root.path}${Platform.pathSeparator}school-mobile-sync',
    );
    await directory.create(recursive: true);
    return directory;
  }
}

final class FixedSyncDirectoryProvider implements SyncDirectoryProvider {
  const FixedSyncDirectoryProvider(this.value);

  final Directory value;

  @override
  Future<Directory> directory() async {
    await value.create(recursive: true);
    return value;
  }
}

final class PlatformEncryptedSyncStoreFactory {
  PlatformEncryptedSyncStoreFactory({
    SyncDirectoryProvider directoryProvider =
        const ApplicationSupportSyncDirectoryProvider(),
    SyncKeyVault? keyVault,
    SyncRecordCipher? recordCipher,
    SyncScopeCatalog? scopeCatalog,
  }) : _directoryProvider = directoryProvider,
       _keyVault = keyVault ?? PlatformSyncKeyVault(),
       _recordCipher = recordCipher ?? AesGcmSyncRecordCipher(),
       _scopeCatalog = scopeCatalog ?? PlatformSyncScopeCatalog();

  final SyncDirectoryProvider _directoryProvider;
  final SyncKeyVault _keyVault;
  final SyncRecordCipher _recordCipher;
  final SyncScopeCatalog _scopeCatalog;

  Future<FileEncryptedSyncStore> open(SchoolSession session) async {
    final scope = SyncStorageScope.fromSession(session);
    await _scopeCatalog.register(scope);
    return FileEncryptedSyncStore(
      directoryProvider: _directoryProvider,
      keyVault: _keyVault,
      recordCipher: _recordCipher,
      scope: scope,
    );
  }

  Future<void> purgeSchool(SchoolSession session) async {
    final scope = SyncStorageScope.fromSession(session);
    await _store(scope).purgeScope();
    await _scopeCatalog.remove(scope);
  }

  Future<void> purgeAccount(String accountId) async {
    final normalized = accountId.trim();
    if (normalized.isEmpty) {
      throw const SyncStorageException('SYNC_ACCOUNT_ID_REQUIRED');
    }
    final scopes = await _scopeCatalog.scopesForAccount(normalized);
    for (final scope in scopes) {
      await _store(scope).purgeScope();
    }
    await _scopeCatalog.clearAccount(normalized);
  }

  FileEncryptedSyncStore _store(SyncStorageScope scope) =>
      FileEncryptedSyncStore(
        directoryProvider: _directoryProvider,
        keyVault: _keyVault,
        recordCipher: _recordCipher,
        scope: scope,
      );
}

final class FileEncryptedSyncStore
    implements EncryptedSyncStore, SyncOperationJournal {
  FileEncryptedSyncStore({
    required SyncDirectoryProvider directoryProvider,
    required SyncKeyVault keyVault,
    required SyncRecordCipher recordCipher,
    required SyncStorageScope scope,
  }) : _directoryProvider = directoryProvider,
       _keyVault = keyVault,
       _recordCipher = recordCipher,
       _scope = scope;

  final SyncDirectoryProvider _directoryProvider;
  final SyncKeyVault _keyVault;
  final SyncRecordCipher _recordCipher;
  final SyncStorageScope _scope;
  final _SerialExecutor _serial = _SerialExecutor();

  @override
  Future<void> upsert(SyncOperationEnvelope operation) => _serial.run(() async {
    _validateOperationScope(operation);
    await _guardDecryption(() async {
      final files = await _files();
      final snapshot = await _load(files);
      final token = await _recordToken('operation', operation.operationId);
      final key = await _keyVault.current(_scope);
      final record = await _recordCipher.encrypt(
        associatedData: syncRecordAssociatedData(
          recordKind: 'operation',
          recordToken: token,
          scopeFingerprint: files.fingerprint,
        ),
        key: key,
        value: _operationToJson(operation),
      );
      snapshot.records[token] = record;
      await _write(files, snapshot);
    });
  });

  @override
  Future<SyncOperationEnvelope?> find(String operationId) => _serial.run(
    () async => _guardDecryption(() async {
      final normalized = operationId.trim();
      if (normalized.isEmpty) {
        throw const SyncStorageException('SYNC_OPERATION_ID_REQUIRED');
      }
      final files = await _files();
      final snapshot = await _load(files);
      final token = await _recordToken('operation', normalized);
      final record = snapshot.records[token];
      if (record == null) {
        return null;
      }
      final operation = await _decryptOperation(files, token, record);
      if (operation.operationId != normalized) {
        throw const SyncStorageException('SYNC_OPERATION_TOKEN_MISMATCH');
      }
      return operation;
    }),
  );

  @override
  Future<List<SyncOperationEnvelope>> listOperations({
    required SchoolSession session,
    Set<SyncOperationKind>? kinds,
    Set<SyncOperationState>? states,
    int limit = 100,
  }) => _serial.run(
    () async => _guardDecryption(() async {
      _validateSession(session);
      if (limit < 1 || limit > 500) {
        throw const SyncStorageException('SYNC_JOURNAL_LIMIT_INVALID');
      }
      final files = await _files();
      final snapshot = await _load(files);
      final operations = <SyncOperationEnvelope>[];
      for (final entry in snapshot.records.entries) {
        final operation = await _decryptOperation(
          files,
          entry.key,
          entry.value,
        );
        if (operation.accountId != session.accountId ||
            operation.tenantId != session.tenantId ||
            operation.campusId != session.campusId ||
            operation.persona != session.activePersona) {
          continue;
        }
        if (kinds != null && !kinds.contains(operation.kind)) {
          continue;
        }
        if (states != null && !states.contains(operation.state)) {
          continue;
        }
        operations.add(operation);
      }
      operations.sort((first, second) {
        final byTime = second.clientCreatedAt.compareTo(first.clientCreatedAt);
        return byTime != 0
            ? byTime
            : first.operationId.compareTo(second.operationId);
      });
      return List<SyncOperationEnvelope>.unmodifiable(operations.take(limit));
    }),
  );

  @override
  Future<List<SyncOperationEnvelope>> ready({
    required DateTime now,
    required SchoolSession session,
    int limit = 25,
  }) => _serial.run(
    () async => _guardDecryption(() async {
      _validateSession(session);
      if (limit < 1 || limit > 100) {
        throw const SyncStorageException('SYNC_READY_LIMIT_INVALID');
      }
      final files = await _files();
      final snapshot = await _load(files);
      final operations = <SyncOperationEnvelope>[];
      for (final entry in snapshot.records.entries) {
        final operation = await _decryptOperation(
          files,
          entry.key,
          entry.value,
        );
        if (operation.accountId != session.accountId ||
            operation.tenantId != session.tenantId ||
            operation.campusId != session.campusId ||
            operation.persona != session.activePersona) {
          continue;
        }
        final isReady = switch (operation.state) {
          SyncOperationState.savedOnDevice => true,
          SyncOperationState.waitingForNetwork =>
            operation.nextAttemptAt != null &&
                !operation.nextAttemptAt!.isAfter(now),
          _ => false,
        };
        if (isReady) {
          operations.add(operation);
        }
      }
      operations.sort((first, second) {
        final byTime = first.clientCreatedAt.compareTo(second.clientCreatedAt);
        return byTime != 0
            ? byTime
            : first.operationId.compareTo(second.operationId);
      });
      return List<SyncOperationEnvelope>.unmodifiable(operations.take(limit));
    }),
  );

  @override
  Future<void> saveCursor(SyncCursor cursor) => _serial.run(() async {
    _validateCursorScope(cursor);
    await _guardDecryption(() async {
      final files = await _files();
      final snapshot = await _load(files);
      final key = await _keyVault.current(_scope);
      snapshot.cursor = await _recordCipher.encrypt(
        associatedData: syncRecordAssociatedData(
          recordKind: 'cursor',
          recordToken: 'current',
          scopeFingerprint: files.fingerprint,
        ),
        key: key,
        value: _cursorToJson(cursor),
      );
      await _write(files, snapshot);
    });
  });

  @override
  Future<SyncCursor?> readCursor(SchoolSession session) => _serial.run(
    () async => _guardDecryption(() async {
      _validateSession(session);
      final files = await _files();
      final snapshot = await _load(files);
      final record = snapshot.cursor;
      if (record == null) {
        return null;
      }
      final key = await _keyVault.read(_scope, record.keyVersion);
      final value = await _recordCipher.decrypt(
        associatedData: syncRecordAssociatedData(
          recordKind: 'cursor',
          recordToken: 'current',
          scopeFingerprint: files.fingerprint,
        ),
        key: key,
        record: record,
      );
      final cursor = _cursorFromJson(value);
      cursor.validateSession(session);
      return cursor;
    }),
  );

  @override
  Future<void> purgeTerminalBefore(DateTime cutoff) => _serial.run(
    () async => _guardDecryption(() async {
      final files = await _files();
      final snapshot = await _load(files);
      final removals = <String>[];
      for (final entry in snapshot.records.entries) {
        final operation = await _decryptOperation(
          files,
          entry.key,
          entry.value,
        );
        if (operation.isTerminal &&
            operation.clientCreatedAt.isBefore(cutoff)) {
          removals.add(entry.key);
        }
      }
      for (final token in removals) {
        snapshot.records.remove(token);
      }
      if (removals.isNotEmpty) {
        await _write(files, snapshot);
      }
    }),
  );

  Future<void> rotateKey() => _serial.run(() async {
    await _guardDecryption(() async {
      final files = await _files();
      final snapshot = await _load(files);
      final operations = <String, SyncOperationEnvelope>{};
      for (final entry in snapshot.records.entries) {
        operations[entry.key] = await _decryptOperation(
          files,
          entry.key,
          entry.value,
        );
      }
      SyncCursor? cursor;
      final cursorRecord = snapshot.cursor;
      if (cursorRecord != null) {
        final oldKey = await _keyVault.read(_scope, cursorRecord.keyVersion);
        final value = await _recordCipher.decrypt(
          associatedData: syncRecordAssociatedData(
            recordKind: 'cursor',
            recordToken: 'current',
            scopeFingerprint: files.fingerprint,
          ),
          key: oldKey,
          record: cursorRecord,
        );
        cursor = _cursorFromJson(value);
      }

      final newKey = await _keyVault.rotate(_scope);
      final rotated = _EncryptedSnapshot.empty(files.fingerprint);
      for (final entry in operations.entries) {
        rotated.records[entry.key] = await _recordCipher.encrypt(
          associatedData: syncRecordAssociatedData(
            recordKind: 'operation',
            recordToken: entry.key,
            scopeFingerprint: files.fingerprint,
          ),
          key: newKey,
          value: _operationToJson(entry.value),
        );
      }
      if (cursor != null) {
        rotated.cursor = await _recordCipher.encrypt(
          associatedData: syncRecordAssociatedData(
            recordKind: 'cursor',
            recordToken: 'current',
            scopeFingerprint: files.fingerprint,
          ),
          key: newKey,
          value: _cursorToJson(cursor),
        );
      }
      await _write(files, rotated);
    });
  });

  Future<void> purgeScope() => _serial.run(() async {
    final files = await _files(createDirectory: false);
    final directory = files.directory;
    if (await directory.exists()) {
      await for (final entity in directory.list()) {
        if (entity is File && entity.path.contains(files.prefix)) {
          await entity.delete();
        }
      }
    }
    await _keyVault.deleteScope(_scope);
  });

  Future<T> _guardDecryption<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on SyncStorageException catch (error) {
      if (_requiresQuarantine(error.code)) {
        await _quarantine(error.code);
        throw SyncStorageException('SYNC_STORE_QUARANTINED', error);
      }
      rethrow;
    }
  }

  bool _requiresQuarantine(String code) =>
      code == 'SYNC_KEY_MATERIAL_MISSING' ||
      code == 'SYNC_KEY_MATERIAL_CORRUPT' ||
      code == 'SYNC_RECORD_DECRYPTION_FAILED' ||
      code == 'SYNC_RECORD_KEY_VERSION_MISMATCH' ||
      code == 'SYNC_STORE_DOCUMENT_INVALID' ||
      code == 'SYNC_STORE_SCOPE_MISMATCH' ||
      code == 'SYNC_OPERATION_TOKEN_MISMATCH';

  Future<void> _quarantine(String reasonCode) async {
    final files = await _files();
    if (await files.active.exists()) {
      final timestamp = DateTime.now().toUtc().microsecondsSinceEpoch;
      await files.active.rename('${files.active.path}.quarantine.$timestamp');
    }
    await files.blocked.writeAsString(
      jsonEncode(<String, Object?>{
        'reasonCode': reasonCode,
        'blockedAt': DateTime.now().toUtc().toIso8601String(),
      }),
      flush: true,
    );
  }

  Future<SyncOperationEnvelope> _decryptOperation(
    _StoreFiles files,
    String token,
    EncryptedSyncRecord record,
  ) async {
    final key = await _keyVault.read(_scope, record.keyVersion);
    final value = await _recordCipher.decrypt(
      associatedData: syncRecordAssociatedData(
        recordKind: 'operation',
        recordToken: token,
        scopeFingerprint: files.fingerprint,
      ),
      key: key,
      record: record,
    );
    return _operationFromJson(value);
  }

  Future<_EncryptedSnapshot> _load(_StoreFiles files) async {
    if (await files.blocked.exists()) {
      throw const SyncStorageException('SYNC_STORE_QUARANTINED');
    }
    if (!await files.active.exists()) {
      return _EncryptedSnapshot.empty(files.fingerprint);
    }
    try {
      final decoded = jsonDecode(await files.active.readAsString());
      if (decoded is! Map<String, Object?>) {
        throw const SyncStorageException('SYNC_STORE_DOCUMENT_INVALID');
      }
      return _EncryptedSnapshot.fromJson(
        decoded,
        expectedFingerprint: files.fingerprint,
      );
    } on SyncStorageException {
      rethrow;
    } on Object catch (error) {
      throw SyncStorageException('SYNC_STORE_DOCUMENT_INVALID', error);
    }
  }

  Future<void> _write(_StoreFiles files, _EncryptedSnapshot snapshot) async {
    final temporary = File(
      '${files.active.path}.tmp.${DateTime.now().toUtc().microsecondsSinceEpoch}',
    );
    final backup = File('${files.active.path}.backup');
    await temporary.writeAsString(jsonEncode(snapshot.toJson()), flush: true);
    var movedExisting = false;
    try {
      if (await backup.exists()) {
        await backup.delete();
      }
      if (await files.active.exists()) {
        await files.active.rename(backup.path);
        movedExisting = true;
      }
      await temporary.rename(files.active.path);
      if (movedExisting && await backup.exists()) {
        await backup.delete();
      }
    } on Object catch (error) {
      if (await temporary.exists()) {
        await temporary.delete();
      }
      if (movedExisting &&
          await backup.exists() &&
          !await files.active.exists()) {
        await backup.rename(files.active.path);
      }
      throw SyncStorageException('SYNC_STORE_WRITE_FAILED', error);
    }
  }

  Future<_StoreFiles> _files({bool createDirectory = true}) async {
    final directory = await _directoryProvider.directory();
    if (createDirectory) {
      await directory.create(recursive: true);
    }
    final fingerprint = await _scope.fingerprint();
    final prefix = 'school-sync-$fingerprint.v1';
    final root = '${directory.path}${Platform.pathSeparator}$prefix';
    return _StoreFiles(
      active: File('$root.json'),
      blocked: File('$root.blocked'),
      directory: directory,
      fingerprint: fingerprint,
      prefix: prefix,
    );
  }

  Future<String> _recordToken(String kind, String identifier) async {
    final normalized = identifier.trim();
    if (normalized.isEmpty) {
      throw const SyncStorageException('SYNC_RECORD_IDENTIFIER_REQUIRED');
    }
    final hash = await Sha256().hash(
      utf8.encode('school-sync-token-v1\u0000$kind\u0000$normalized'),
    );
    return base64UrlEncode(hash.bytes).replaceAll('=', '');
  }

  void _validateOperationScope(SyncOperationEnvelope operation) {
    if (operation.accountId != _scope.accountId ||
        operation.tenantId != _scope.tenantId ||
        operation.campusId != _scope.campusId) {
      throw const SyncStorageException('SYNC_STORAGE_OPERATION_SCOPE_MISMATCH');
    }
  }

  void _validateCursorScope(SyncCursor cursor) {
    if (cursor.accountId != _scope.accountId ||
        cursor.tenantId != _scope.tenantId ||
        cursor.campusId != _scope.campusId) {
      throw const SyncStorageException('SYNC_STORAGE_CURSOR_SCOPE_MISMATCH');
    }
  }

  void _validateSession(SchoolSession session) {
    if (!_scope.matchesSession(session)) {
      throw const SyncStorageException('SYNC_STORAGE_SESSION_SCOPE_MISMATCH');
    }
  }
}

final class _StoreFiles {
  const _StoreFiles({
    required this.active,
    required this.blocked,
    required this.directory,
    required this.fingerprint,
    required this.prefix,
  });

  final Directory directory;
  final File active;
  final File blocked;
  final String fingerprint;
  final String prefix;
}

final class _EncryptedSnapshot {
  _EncryptedSnapshot({
    required this.fingerprint,
    required this.records,
    this.cursor,
  });

  factory _EncryptedSnapshot.empty(String fingerprint) => _EncryptedSnapshot(
    fingerprint: fingerprint,
    records: <String, EncryptedSyncRecord>{},
  );

  factory _EncryptedSnapshot.fromJson(
    Map<String, Object?> json, {
    required String expectedFingerprint,
  }) {
    if (json['schemaVersion'] != 1) {
      throw const SyncStorageException('SYNC_STORE_SCHEMA_UNSUPPORTED');
    }
    final fingerprint = json['scopeFingerprint'];
    if (fingerprint != expectedFingerprint) {
      throw const SyncStorageException('SYNC_STORE_SCOPE_MISMATCH');
    }
    final recordsValue = json['records'];
    if (recordsValue is! Map<String, Object?>) {
      throw const SyncStorageException('SYNC_STORE_DOCUMENT_INVALID');
    }
    final records = <String, EncryptedSyncRecord>{};
    for (final entry in recordsValue.entries) {
      final value = entry.value;
      if (value is! Map<String, Object?>) {
        throw const SyncStorageException('SYNC_STORE_DOCUMENT_INVALID');
      }
      records[entry.key] = EncryptedSyncRecord.fromJson(value);
    }
    EncryptedSyncRecord? cursor;
    final cursorValue = json['cursor'];
    if (cursorValue != null) {
      if (cursorValue is! Map<String, Object?>) {
        throw const SyncStorageException('SYNC_STORE_DOCUMENT_INVALID');
      }
      cursor = EncryptedSyncRecord.fromJson(cursorValue);
    }
    return _EncryptedSnapshot(
      cursor: cursor,
      fingerprint: expectedFingerprint,
      records: records,
    );
  }

  final String fingerprint;
  final Map<String, EncryptedSyncRecord> records;
  EncryptedSyncRecord? cursor;

  Map<String, Object?> toJson() => <String, Object?>{
    'schemaVersion': 1,
    'scopeFingerprint': fingerprint,
    'records': <String, Object?>{
      for (final entry in records.entries) entry.key: entry.value.toJson(),
    },
    if (cursor != null) 'cursor': cursor!.toJson(),
  };
}

Map<String, Object?> _operationToJson(SyncOperationEnvelope operation) =>
    <String, Object?>{
      'operationId': operation.operationId,
      'idempotencyKey': operation.idempotencyKey,
      'accountId': operation.accountId,
      'tenantId': operation.tenantId,
      'campusId': operation.campusId,
      'persona': operation.persona.name,
      'kind': operation.kind.name,
      'aggregateType': operation.aggregateType,
      'aggregateId': operation.aggregateId,
      'baseVersion': operation.baseVersion,
      'clientCreatedAt': operation.clientCreatedAt.toIso8601String(),
      'payload': <String, Object?>{
        'ciphertext': base64Encode(operation.payload.ciphertext),
        'contentType': operation.payload.contentType,
        'keyAlias': operation.payload.keyAlias,
        'schemaVersion': operation.payload.schemaVersion,
      },
      'state': operation.state.name,
      'attemptCount': operation.attemptCount,
      if (operation.nextAttemptAt != null)
        'nextAttemptAt': operation.nextAttemptAt!.toIso8601String(),
      if (operation.lastReasonCode != null)
        'lastReasonCode': operation.lastReasonCode,
    };

SyncOperationEnvelope _operationFromJson(Map<String, Object?> json) {
  final payload = _map(json, 'payload');
  try {
    return SyncOperationEnvelope(
      accountId: _string(json, 'accountId'),
      aggregateId: _string(json, 'aggregateId'),
      aggregateType: _string(json, 'aggregateType'),
      attemptCount: _integer(json, 'attemptCount'),
      baseVersion: _integer(json, 'baseVersion'),
      campusId: _string(json, 'campusId'),
      clientCreatedAt: _dateTime(json, 'clientCreatedAt'),
      idempotencyKey: _string(json, 'idempotencyKey'),
      kind: SyncOperationKind.values.byName(_string(json, 'kind')),
      lastReasonCode: _optionalString(json, 'lastReasonCode'),
      nextAttemptAt: _optionalDateTime(json, 'nextAttemptAt'),
      operationId: _string(json, 'operationId'),
      payload: EncryptedSyncPayload(
        ciphertext: Uint8List.fromList(
          base64Decode(_string(payload, 'ciphertext')),
        ),
        contentType: _string(payload, 'contentType'),
        keyAlias: _string(payload, 'keyAlias'),
        schemaVersion: _string(payload, 'schemaVersion'),
      ),
      persona: SchoolPersona.values.byName(_string(json, 'persona')),
      state: SyncOperationState.values.byName(_string(json, 'state')),
      tenantId: _string(json, 'tenantId'),
    );
  } on SyncContractException catch (error) {
    throw SyncStorageException('SYNC_OPERATION_DOCUMENT_INVALID', error);
  } on FormatException catch (error) {
    throw SyncStorageException('SYNC_OPERATION_DOCUMENT_INVALID', error);
  } on ArgumentError catch (error) {
    throw SyncStorageException('SYNC_OPERATION_DOCUMENT_INVALID', error);
  }
}

Map<String, Object?> _cursorToJson(SyncCursor cursor) => <String, Object?>{
  'accountId': cursor.accountId,
  'tenantId': cursor.tenantId,
  'campusId': cursor.campusId,
  'cursor': cursor.cursor,
  'receivedAt': cursor.receivedAt.toIso8601String(),
};

SyncCursor _cursorFromJson(Map<String, Object?> json) => SyncCursor(
  accountId: _string(json, 'accountId'),
  campusId: _string(json, 'campusId'),
  cursor: _string(json, 'cursor'),
  receivedAt: _dateTime(json, 'receivedAt'),
  tenantId: _string(json, 'tenantId'),
);

Map<String, Object?> _map(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! Map<String, Object?>) {
    throw SyncStorageException('SYNC_STORAGE_MAP_REQUIRED:$key');
  }
  return value;
}

String _string(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw SyncStorageException('SYNC_STORAGE_STRING_REQUIRED:$key');
  }
  return value.trim();
}

String? _optionalString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  if (value is! String) {
    throw SyncStorageException('SYNC_STORAGE_STRING_INVALID:$key');
  }
  final normalized = value.trim();
  return normalized.isEmpty ? null : normalized;
}

int _integer(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! int) {
    throw SyncStorageException('SYNC_STORAGE_INTEGER_REQUIRED:$key');
  }
  return value;
}

DateTime _dateTime(Map<String, Object?> json, String key) {
  final value = DateTime.tryParse(_string(json, key));
  if (value == null) {
    throw SyncStorageException('SYNC_STORAGE_DATETIME_INVALID:$key');
  }
  return value;
}

DateTime? _optionalDateTime(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  if (value is! String) {
    throw SyncStorageException('SYNC_STORAGE_DATETIME_INVALID:$key');
  }
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    throw SyncStorageException('SYNC_STORAGE_DATETIME_INVALID:$key');
  }
  return parsed;
}

final class _SerialExecutor {
  Future<void> _tail = Future<void>.value();

  Future<T> run<T>(Future<T> Function() action) {
    final completer = Completer<T>();
    _tail = _tail.then((_) async {
      try {
        completer.complete(await action());
      } on Object catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }
}
