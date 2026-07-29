import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'auth_models.dart';

abstract interface class AuthTokenStore {
  Future<AuthTokenSet?> read();

  Future<void> write(AuthTokenSet tokens);

  Future<void> clear();
}

final class SecureAuthTokenStore implements AuthTokenStore {
  SecureAuthTokenStore({
    FlutterSecureStorage? storage,
    String storageKey = 'school.mobile.auth.tokens.v1',
  }) : _storage = storage ?? const FlutterSecureStorage(),
       _storageKey = storageKey {
    if (storageKey.trim().isEmpty) {
      throw ArgumentError.value(storageKey, 'storageKey', 'A key is required.');
    }
  }

  final FlutterSecureStorage _storage;
  final String _storageKey;

  @override
  Future<AuthTokenSet?> read() async {
    final serialized = await _storage.read(key: _storageKey);
    if (serialized == null) {
      return null;
    }

    try {
      final decoded = jsonDecode(serialized);
      if (decoded is! Map<String, Object?>) {
        throw const AuthProtocolException('OIDC_STORED_TOKEN_INVALID');
      }
      return AuthTokenSet.fromJson(decoded);
    } on AuthException {
      await clear();
      rethrow;
    } on FormatException {
      await clear();
      throw const AuthProtocolException('OIDC_STORED_TOKEN_INVALID');
    }
  }

  @override
  Future<void> write(AuthTokenSet tokens) => _storage.write(
    key: _storageKey,
    value: jsonEncode(tokens.toJson()),
  );

  @override
  Future<void> clear() => _storage.delete(key: _storageKey);
}

final class MemoryAuthTokenStore implements AuthTokenStore {
  AuthTokenSet? _tokens;

  @override
  Future<void> clear() async {
    _tokens = null;
  }

  @override
  Future<AuthTokenSet?> read() async => _tokens;

  @override
  Future<void> write(AuthTokenSet tokens) async {
    _tokens = tokens;
  }
}
