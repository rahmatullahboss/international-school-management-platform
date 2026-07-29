library;

import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:school_mobile_core/mobile_core.dart';

typedef AccessTokenProvider = Future<String?> Function();

final class ApiRequestContext {
  const ApiRequestContext({
    required this.correlationId,
    required this.session,
  });

  final String correlationId;
  final SchoolSession session;
}

final class SchoolApiException implements Exception {
  const SchoolApiException({
    required this.code,
    required this.message,
    this.statusCode,
  });

  final String code;
  final String message;
  final int? statusCode;

  @override
  String toString() => 'SchoolApiException($code, $statusCode): $message';
}

final class SchoolApiClient {
  SchoolApiClient({
    required Uri baseUri,
    required AccessTokenProvider accessTokenProvider,
    http.Client? client,
  }) : baseUri = _normalizeBaseUri(baseUri),
       _accessTokenProvider = accessTokenProvider,
       _client = client ?? http.Client();

  final Uri baseUri;
  final AccessTokenProvider _accessTokenProvider;
  final http.Client _client;

  Future<Map<String, Object?>> getJson(
    String path, {
    required ApiRequestContext context,
    Map<String, String> queryParameters = const <String, String>{},
  }) async {
    final response = await _client.get(
      _resolve(path, queryParameters),
      headers: await _headers(context),
    );
    return _decode(response);
  }

  Future<Map<String, Object?>> postJson(
    String path, {
    required ApiRequestContext context,
    required Map<String, Object?> body,
  }) async {
    final response = await _client.post(
      _resolve(path),
      body: jsonEncode(body),
      headers: await _headers(context),
    );
    return _decode(response);
  }

  void close() => _client.close();

  Future<Map<String, String>> _headers(ApiRequestContext context) async {
    final token = await _accessTokenProvider();
    if (token == null || token.isEmpty) {
      throw const SchoolApiException(
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sign in is required before this request can be sent.',
      );
    }

    return <String, String>{
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
      'X-Campus-Id': context.session.campusId,
      'X-Correlation-Id': context.correlationId,
      'X-Persona': context.session.activePersona.name,
      'X-Tenant-Id': context.session.tenantId,
    };
  }

  Map<String, Object?> _decode(http.Response response) {
    Object? decoded;
    if (response.body.isNotEmpty) {
      try {
        decoded = jsonDecode(response.body);
      } on FormatException {
        throw SchoolApiException(
          code: 'INVALID_SERVER_RESPONSE',
          message: 'The server returned an unreadable response.',
          statusCode: response.statusCode,
        );
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = decoded is Map<String, Object?> ? decoded : null;
      final rawCode = error?['code'];
      final rawMessage = error?['message'];
      throw SchoolApiException(
        code: rawCode is String ? rawCode : 'REQUEST_FAILED',
        message: rawMessage is String
            ? rawMessage
            : 'The request could not be completed.',
        statusCode: response.statusCode,
      );
    }

    if (decoded == null) {
      return const <String, Object?>{};
    }
    if (decoded is! Map<String, Object?>) {
      throw SchoolApiException(
        code: 'UNEXPECTED_RESPONSE_SHAPE',
        message: 'The server response did not match the expected object shape.',
        statusCode: response.statusCode,
      );
    }
    return decoded;
  }

  Uri _resolve(
    String path, [
    Map<String, String> queryParameters = const <String, String>{},
  ]) {
    final normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    return baseUri.resolve(normalizedPath).replace(
      queryParameters: queryParameters.isEmpty ? null : queryParameters,
    );
  }

  static Uri _normalizeBaseUri(Uri baseUri) {
    if (!baseUri.hasScheme || baseUri.host.isEmpty) {
      throw ArgumentError.value(
        baseUri,
        'baseUri',
        'An absolute API base URI is required.',
      );
    }
    if (baseUri.path.endsWith('/')) {
      return baseUri;
    }
    return baseUri.replace(path: '${baseUri.path}/');
  }
}
