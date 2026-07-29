import 'dart:async';
import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:school_sync_storage/src/sync_storage_scope.dart';

final class SyncKeyMaterial {
  SyncKeyMaterial({required SecretKey secretKey, required this.version})
    : secretKey = secretKey {
    if (version < 1) {
      throw const SyncStorageException('SYNC_KEY_VERSION_INVALID');
    }
  }

  final int version;
  final SecretKey secretKey;

  @override
  String toString() => 'SyncKeyMaterial(version: $version, key: redacted)';
}

abstract interface class SyncKeyVault {
  Future<SyncKeyMaterial> current(SyncStorageScope scope);

  Future<SyncKeyMaterial> read(SyncStorageScope scope, int version);

  Future<SyncKeyMaterial> rotate(SyncStorageScope scope);

  Future<void> deleteScope(SyncStorageScope scope);
}

final class PlatformSyncKeyVault implements SyncKeyVault {
  PlatformSyncKeyVault({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  final _SerialExecutor _serial = _SerialExecutor();
  final AesGcm _algorithm = AesGcm.with256bits();

  @override
  Future<SyncKeyMaterial> current(SyncStorageScope scope) =>
      _serial.run(() async {
        final fingerprint = await scope.fingerprint();
        final versionValue = await _storage.read(
          key: _versionKey(fingerprint),
        );
        if (versionValue == null) {
          return _create(fingerprint, 1, makeCurrent: true);
        }
        final version = int.tryParse(versionValue);
        if (version == null || version < 1) {
          throw const SyncStorageException('SYNC_KEY_VERSION_CORRUPT');
        }
        return _readFingerprint(fingerprint, version);
      });

  @override
  Future<SyncKeyMaterial> read(SyncStorageScope scope, int version) =>
      _serial.run(() async {
        if (version < 1) {
          throw const SyncStorageException('SYNC_KEY_VERSION_INVALID');
        }
        return _readFingerprint(await scope.fingerprint(), version);
      });

  @override
  Future<SyncKeyMaterial> rotate(SyncStorageScope scope) =>
      _serial.run(() async {
        final fingerprint = await scope.fingerprint();
        final versionValue = await _storage.read(
          key: _versionKey(fingerprint),
        );
        final currentVersion = versionValue == null
            ? 0
            : int.tryParse(versionValue);
        if (currentVersion == null || currentVersion < 0) {
          throw const SyncStorageException('SYNC_KEY_VERSION_CORRUPT');
        }
        return _create(fingerprint, currentVersion + 1, makeCurrent: true);
      });

  @override
  Future<void> deleteScope(SyncStorageScope scope) =>
      _serial.run(() async {
        final fingerprint = await scope.fingerprint();
        final versionValue = await _storage.read(
          key: _versionKey(fingerprint),
        );
        final currentVersion = versionValue == null
            ? 0
            : int.tryParse(versionValue);
        if (currentVersion == null || currentVersion < 0) {
          throw const SyncStorageException('SYNC_KEY_VERSION_CORRUPT');
        }
        for (var version = 1; version <= currentVersion; version++) {
          await _storage.delete(key: _materialKey(fingerprint, version));
        }
        await _storage.delete(key: _versionKey(fingerprint));
      });

  Future<SyncKeyMaterial> _create(
    String fingerprint,
    int version, {
    required bool makeCurrent,
  }) async {
    final key = await _algorithm.newSecretKey();
    final bytes = await key.extractBytes();
    await _storage.write(
      key: _materialKey(fingerprint, version),
      value: base64Encode(bytes),
    );
    if (makeCurrent) {
      await _storage.write(
        key: _versionKey(fingerprint),
        value: version.toString(),
      );
    }
    return SyncKeyMaterial(secretKey: key, version: version);
  }

  Future<SyncKeyMaterial> _readFingerprint(
    String fingerprint,
    int version,
  ) async {
    final encoded = await _storage.read(
      key: _materialKey(fingerprint, version),
    );
    if (encoded == null) {
      throw const SyncStorageException('SYNC_KEY_MATERIAL_MISSING');
    }
    try {
      final bytes = base64Decode(encoded);
      if (bytes.length != _algorithm.secretKeyLength) {
        throw const SyncStorageException('SYNC_KEY_LENGTH_INVALID');
      }
      return SyncKeyMaterial(
        secretKey: SecretKey(bytes),
        version: version,
      );
    } on FormatException catch (error) {
      throw SyncStorageException('SYNC_KEY_MATERIAL_CORRUPT', error);
    }
  }

  String _versionKey(String fingerprint) =>
      'school.mobile.sync.key.$fingerprint.current';

  String _materialKey(String fingerprint, int version) =>
      'school.mobile.sync.key.$fingerprint.v$version';
}

final class MemorySyncKeyVault implements SyncKeyVault {
  final Map<SyncStorageScope, List<SecretKey>> _keys =
      <SyncStorageScope, List<SecretKey>>{};
  final AesGcm _algorithm = AesGcm.with256bits();

  @override
  Future<SyncKeyMaterial> current(SyncStorageScope scope) async {
    final keys = _keys[scope];
    if (keys == null || keys.isEmpty) {
      return rotate(scope);
    }
    return SyncKeyMaterial(secretKey: keys.last, version: keys.length);
  }

  @override
  Future<void> deleteScope(SyncStorageScope scope) async {
    final keys = _keys.remove(scope);
    if (keys != null) {
      for (final key in keys) {
        key.destroy();
      }
    }
  }

  @override
  Future<SyncKeyMaterial> read(SyncStorageScope scope, int version) async {
    final keys = _keys[scope];
    if (version < 1 || keys == null || version > keys.length) {
      throw const SyncStorageException('SYNC_KEY_MATERIAL_MISSING');
    }
    return SyncKeyMaterial(secretKey: keys[version - 1], version: version);
  }

  @override
  Future<SyncKeyMaterial> rotate(SyncStorageScope scope) async {
    final key = await _algorithm.newSecretKey();
    final keys = _keys.putIfAbsent(scope, () => <SecretKey>[]);
    keys.add(key);
    return SyncKeyMaterial(secretKey: key, version: keys.length);
  }
}

abstract interface class SyncScopeCatalog {
  Future<void> register(SyncStorageScope scope);

  Future<List<SyncStorageScope>> scopesForAccount(String accountId);

  Future<void> remove(SyncStorageScope scope);

  Future<void> clearAccount(String accountId);
}

final class PlatformSyncScopeCatalog implements SyncScopeCatalog {
  PlatformSyncScopeCatalog({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  final _SerialExecutor _serial = _SerialExecutor();

  @override
  Future<void> register(SyncStorageScope scope) => _serial.run(() async {
    final scopes = await _read(scope.accountId);
    if (!scopes.contains(scope)) {
      await _write(scope.accountId, <SyncStorageScope>[...scopes, scope]);
    }
  });

  @override
  Future<List<SyncStorageScope>> scopesForAccount(String accountId) =>
      _serial.run(() => _read(accountId));

  @override
  Future<void> remove(SyncStorageScope scope) => _serial.run(() async {
    final scopes = await _read(scope.accountId);
    await _write(
      scope.accountId,
      scopes.where((candidate) => candidate != scope).toList(growable: false),
    );
  });

  @override
  Future<void> clearAccount(String accountId) =>
      _serial.run(() async => _storage.delete(key: await _catalogKey(accountId)));

  Future<List<SyncStorageScope>> _read(String accountId) async {
    final encoded = await _storage.read(key: await _catalogKey(accountId));
    if (encoded == null) {
      return const <SyncStorageScope>[];
    }
    try {
      final decoded = jsonDecode(encoded);
      if (decoded is! List<Object?>) {
        throw const SyncStorageException('SYNC_SCOPE_CATALOG_INVALID');
      }
      return List<SyncStorageScope>.unmodifiable(
        decoded.map((item) {
          if (item is! Map<String, Object?>) {
            throw const SyncStorageException('SYNC_SCOPE_CATALOG_INVALID');
          }
          return SyncStorageScope.fromJson(item);
        }),
      );
    } on FormatException catch (error) {
      throw SyncStorageException('SYNC_SCOPE_CATALOG_INVALID', error);
    }
  }

  Future<void> _write(
    String accountId,
    List<SyncStorageScope> scopes,
  ) async {
    final key = await _catalogKey(accountId);
    if (scopes.isEmpty) {
      await _storage.delete(key: key);
      return;
    }
    await _storage.write(
      key: key,
      value: jsonEncode(
        scopes.map((scope) => scope.toJson()).toList(growable: false),
      ),
    );
  }

  Future<String> _catalogKey(String accountId) async {
    final normalized = accountId.trim();
    if (normalized.isEmpty) {
      throw const SyncStorageException('SYNC_ACCOUNT_ID_REQUIRED');
    }
    final hash = await Sha256().hash(utf8.encode('sync-account-v1\u0000$normalized'));
    final fingerprint = base64UrlEncode(hash.bytes).replaceAll('=', '');
    return 'school.mobile.sync.scopes.$fingerprint';
  }
}

final class MemorySyncScopeCatalog implements SyncScopeCatalog {
  final Map<String, Set<SyncStorageScope>> _scopes =
      <String, Set<SyncStorageScope>>{};

  @override
  Future<void> clearAccount(String accountId) async {
    _scopes.remove(accountId);
  }

  @override
  Future<void> register(SyncStorageScope scope) async {
    _scopes.putIfAbsent(scope.accountId, () => <SyncStorageScope>{}).add(scope);
  }

  @override
  Future<void> remove(SyncStorageScope scope) async {
    final scopes = _scopes[scope.accountId];
    scopes?.remove(scope);
    if (scopes != null && scopes.isEmpty) {
      _scopes.remove(scope.accountId);
    }
  }

  @override
  Future<List<SyncStorageScope>> scopesForAccount(String accountId) async =>
      List<SyncStorageScope>.unmodifiable(
        _scopes[accountId] ?? const <SyncStorageScope>{},
      );
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
