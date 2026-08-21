import 'package:school_api_client/school_api_client.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_sync_engine/school_sync_engine.dart';

typedef SyncCorrelationIdFactory = String Function();

final class MobileSyncDeltaApi implements SyncDeltaTransport {
  MobileSyncDeltaApi(
    this._client, {
    required SyncCorrelationIdFactory correlationIdFactory,
  }) : _correlationIdFactory = correlationIdFactory;

  final SchoolApiClient _client;
  final SyncCorrelationIdFactory _correlationIdFactory;

  static final RegExp _canonicalCursor = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  );
  static final RegExp _canonicalServerTime = RegExp(
    r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$',
  );
  static const Set<String> _expectedKeys = <String>{
    'cursor',
    'changed',
    'serverTime',
  };

  @override
  Future<SyncDelta> pull({
    required SchoolSession session,
    required String? cursor,
  }) async {
    if (cursor != null && !_canonicalCursor.hasMatch(cursor)) {
      throw const SchoolApiException(
        code: 'MOBILE_SYNC_CURSOR_INVALID',
        message: 'The local synchronization cursor is invalid.',
      );
    }
    final correlationId = _correlationIdFactory().trim();
    if (correlationId.isEmpty) {
      throw const SchoolApiException(
        code: 'CORRELATION_ID_REQUIRED',
        message: 'A request correlation identifier is required.',
      );
    }
    Map<String, Object?> response;
    try {
      response = await _client.getJson(
        '/v1/mobile/sync/delta',
        context: ApiRequestContext(
          correlationId: correlationId,
          session: session,
        ),
        queryParameters: cursor == null
            ? const <String, String>{}
            : <String, String>{'cursor': cursor},
      );
    } on SchoolApiException catch (error) {
      if (error.statusCode == 409 &&
          error.code == 'mobile_sync_cursor_invalid') {
        throw const SyncDeltaCursorInvalidException();
      }
      rethrow;
    }
    if (response.length != _expectedKeys.length ||
        response.keys.any((key) => !_expectedKeys.contains(key))) {
      throw _invalidResponse();
    }
    final nextCursor = response['cursor'];
    final changed = response['changed'];
    final rawServerTime = response['serverTime'];
    if (nextCursor is! String ||
        !_canonicalCursor.hasMatch(nextCursor) ||
        changed is! bool ||
        rawServerTime is! String ||
        !_canonicalServerTime.hasMatch(rawServerTime)) {
      throw _invalidResponse();
    }
    final serverTime = DateTime.tryParse(rawServerTime);
    if (serverTime == null ||
        !serverTime.isUtc ||
        serverTime.toIso8601String() != rawServerTime) {
      throw _invalidResponse();
    }
    return SyncDelta(
      changed: changed,
      cursor: nextCursor,
      serverTime: serverTime,
    );
  }

  SchoolApiException _invalidResponse() => const SchoolApiException(
    code: 'INVALID_MOBILE_SYNC_RESPONSE',
    message: 'The mobile synchronization response was invalid.',
  );
}
