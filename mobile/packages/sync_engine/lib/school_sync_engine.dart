/// Durable, privacy-bounded offline synchronization contracts.
library;

import 'dart:typed_data';

import 'package:school_mobile_core/mobile_core.dart';

enum SyncOperationKind {
  attendanceBatch,
  gradeDraft,
  formDraft,
  consentDecision,
  messageDraft,
  lowRiskRequest,
}

enum SyncOperationState {
  savedOnDevice,
  waitingForNetwork,
  inFlight,
  synced,
  duplicate,
  conflict,
  rejected,
  requiresReconciliation,
}

enum SyncAttemptOutcome {
  accepted,
  duplicate,
  retryableFailure,
  conflict,
  rejected,
  requiresReconciliation,
}

final class EncryptedSyncPayload {
  factory EncryptedSyncPayload({
    required Uint8List ciphertext,
    required String contentType,
    required String keyAlias,
    required String schemaVersion,
  }) {
    if (ciphertext.isEmpty) {
      throw const SyncContractException('SYNC_CIPHERTEXT_REQUIRED');
    }
    return EncryptedSyncPayload._(
      ciphertext: Uint8List.fromList(ciphertext),
      contentType: _required(contentType, 'contentType'),
      keyAlias: _required(keyAlias, 'keyAlias'),
      schemaVersion: _required(schemaVersion, 'schemaVersion'),
    );
  }

  EncryptedSyncPayload._({
    required Uint8List ciphertext,
    required this.contentType,
    required this.keyAlias,
    required this.schemaVersion,
  }) : _ciphertext = ciphertext;

  final Uint8List _ciphertext;
  final String contentType;
  final String keyAlias;
  final String schemaVersion;

  Uint8List get ciphertext => Uint8List.fromList(_ciphertext);

  @override
  String toString() =>
      'EncryptedSyncPayload(contentType: $contentType, schemaVersion: $schemaVersion, bytes: ${_ciphertext.length})';
}

final class SyncOperationEnvelope {
  factory SyncOperationEnvelope({
    required String accountId,
    required String aggregateId,
    required String aggregateType,
    required int attemptCount,
    required int baseVersion,
    required String campusId,
    required DateTime clientCreatedAt,
    required String idempotencyKey,
    required SyncOperationKind kind,
    required DateTime? nextAttemptAt,
    required String operationId,
    required EncryptedSyncPayload payload,
    required SchoolPersona persona,
    required SyncOperationState state,
    required String tenantId,
    String? lastReasonCode,
  }) {
    if (attemptCount < 0) {
      throw const SyncContractException('SYNC_ATTEMPT_COUNT_INVALID');
    }
    if (baseVersion < 0) {
      throw const SyncContractException('SYNC_BASE_VERSION_INVALID');
    }
    if (_terminalStates.contains(state) && nextAttemptAt != null) {
      throw const SyncContractException('SYNC_TERMINAL_RETRY_NOT_ALLOWED');
    }
    if (state == SyncOperationState.waitingForNetwork &&
        nextAttemptAt == null) {
      throw const SyncContractException('SYNC_NEXT_ATTEMPT_REQUIRED');
    }
    return SyncOperationEnvelope._(
      accountId: _required(accountId, 'accountId'),
      aggregateId: _required(aggregateId, 'aggregateId'),
      aggregateType: _required(aggregateType, 'aggregateType'),
      attemptCount: attemptCount,
      baseVersion: baseVersion,
      campusId: _required(campusId, 'campusId'),
      clientCreatedAt: clientCreatedAt,
      idempotencyKey: _required(idempotencyKey, 'idempotencyKey'),
      kind: kind,
      lastReasonCode: _optional(lastReasonCode),
      nextAttemptAt: nextAttemptAt,
      operationId: _required(operationId, 'operationId'),
      payload: payload,
      persona: persona,
      state: state,
      tenantId: _required(tenantId, 'tenantId'),
    );
  }

  const SyncOperationEnvelope._({
    required this.accountId,
    required this.aggregateId,
    required this.aggregateType,
    required this.attemptCount,
    required this.baseVersion,
    required this.campusId,
    required this.clientCreatedAt,
    required this.idempotencyKey,
    required this.kind,
    required this.lastReasonCode,
    required this.nextAttemptAt,
    required this.operationId,
    required this.payload,
    required this.persona,
    required this.state,
    required this.tenantId,
  });

  final String operationId;
  final String idempotencyKey;
  final String accountId;
  final String tenantId;
  final String campusId;
  final SchoolPersona persona;
  final SyncOperationKind kind;
  final String aggregateType;
  final String aggregateId;
  final int baseVersion;
  final DateTime clientCreatedAt;
  final EncryptedSyncPayload payload;
  final SyncOperationState state;
  final int attemptCount;
  final DateTime? nextAttemptAt;
  final String? lastReasonCode;

  bool get isTerminal => _terminalStates.contains(state);

  void validateSession(SchoolSession session) {
    if (accountId != session.accountId ||
        tenantId != session.tenantId ||
        campusId != session.campusId ||
        persona != session.activePersona) {
      throw const SyncContractException('SYNC_SESSION_SCOPE_MISMATCH');
    }
  }

  SyncOperationEnvelope transition({
    required DateTime now,
    required SyncAttemptOutcome outcome,
    required RetrySchedule retrySchedule,
    String? reasonCode,
  }) {
    if (isTerminal) {
      throw const SyncContractException('SYNC_TERMINAL_OPERATION_IMMUTABLE');
    }
    final normalizedReason = _optional(reasonCode);
    final nextAttemptCount = attemptCount + 1;
    return switch (outcome) {
      SyncAttemptOutcome.accepted => _copy(
        attemptCount: nextAttemptCount,
        lastReasonCode: normalizedReason,
        nextAttemptAt: null,
        state: SyncOperationState.synced,
      ),
      SyncAttemptOutcome.duplicate => _copy(
        attemptCount: nextAttemptCount,
        lastReasonCode: normalizedReason,
        nextAttemptAt: null,
        state: SyncOperationState.duplicate,
      ),
      SyncAttemptOutcome.retryableFailure => _copy(
        attemptCount: nextAttemptCount,
        lastReasonCode: normalizedReason ?? 'SYNC_RETRYABLE_FAILURE',
        nextAttemptAt: now.add(retrySchedule.delayFor(nextAttemptCount)),
        state: SyncOperationState.waitingForNetwork,
      ),
      SyncAttemptOutcome.conflict => _copy(
        attemptCount: nextAttemptCount,
        lastReasonCode: normalizedReason ?? 'SYNC_CONFLICT',
        nextAttemptAt: null,
        state: SyncOperationState.conflict,
      ),
      SyncAttemptOutcome.rejected => _copy(
        attemptCount: nextAttemptCount,
        lastReasonCode: normalizedReason ?? 'SYNC_REJECTED',
        nextAttemptAt: null,
        state: SyncOperationState.rejected,
      ),
      SyncAttemptOutcome.requiresReconciliation => _copy(
        attemptCount: nextAttemptCount,
        lastReasonCode: normalizedReason ?? 'SYNC_RECONCILIATION_REQUIRED',
        nextAttemptAt: null,
        state: SyncOperationState.requiresReconciliation,
      ),
    };
  }

  SyncOperationEnvelope markInFlight() {
    if (isTerminal) {
      throw const SyncContractException('SYNC_TERMINAL_OPERATION_IMMUTABLE');
    }
    return _copy(
      attemptCount: attemptCount,
      lastReasonCode: lastReasonCode,
      nextAttemptAt: null,
      state: SyncOperationState.inFlight,
    );
  }

  SyncOperationEnvelope _copy({
    required int attemptCount,
    required String? lastReasonCode,
    required DateTime? nextAttemptAt,
    required SyncOperationState state,
  }) => SyncOperationEnvelope(
    accountId: accountId,
    aggregateId: aggregateId,
    aggregateType: aggregateType,
    attemptCount: attemptCount,
    baseVersion: baseVersion,
    campusId: campusId,
    clientCreatedAt: clientCreatedAt,
    idempotencyKey: idempotencyKey,
    kind: kind,
    lastReasonCode: lastReasonCode,
    nextAttemptAt: nextAttemptAt,
    operationId: operationId,
    payload: payload,
    persona: persona,
    state: state,
    tenantId: tenantId,
  );
}

final class RetrySchedule {
  factory RetrySchedule({
    Duration baseDelay = const Duration(seconds: 5),
    Duration maximumDelay = const Duration(minutes: 15),
  }) {
    if (baseDelay.isNegative ||
        maximumDelay.isNegative ||
        maximumDelay < baseDelay) {
      throw const SyncContractException('SYNC_RETRY_SCHEDULE_INVALID');
    }
    return RetrySchedule._(baseDelay: baseDelay, maximumDelay: maximumDelay);
  }

  const RetrySchedule._({required this.baseDelay, required this.maximumDelay});

  final Duration baseDelay;
  final Duration maximumDelay;

  Duration delayFor(int attemptCount) {
    if (attemptCount < 1) {
      throw const SyncContractException('SYNC_RETRY_ATTEMPT_INVALID');
    }
    var multiplier = 1;
    for (var index = 1; index < attemptCount && multiplier < 1024; index++) {
      multiplier *= 2;
    }
    final milliseconds = baseDelay.inMilliseconds * multiplier;
    return Duration(
      milliseconds: milliseconds > maximumDelay.inMilliseconds
          ? maximumDelay.inMilliseconds
          : milliseconds,
    );
  }
}

final class SyncCursor {
  factory SyncCursor({
    required String accountId,
    required String campusId,
    required String cursor,
    required DateTime receivedAt,
    required String tenantId,
  }) => SyncCursor._(
    accountId: _required(accountId, 'accountId'),
    campusId: _required(campusId, 'campusId'),
    cursor: _required(cursor, 'cursor'),
    receivedAt: receivedAt,
    tenantId: _required(tenantId, 'tenantId'),
  );

  const SyncCursor._({
    required this.accountId,
    required this.campusId,
    required this.cursor,
    required this.receivedAt,
    required this.tenantId,
  });

  final String accountId;
  final String tenantId;
  final String campusId;
  final String cursor;
  final DateTime receivedAt;

  void validateSession(SchoolSession session) {
    if (accountId != session.accountId ||
        tenantId != session.tenantId ||
        campusId != session.campusId) {
      throw const SyncContractException('SYNC_CURSOR_SCOPE_MISMATCH');
    }
  }
}

final class SyncBatchReceipt {
  factory SyncBatchReceipt({
    required String? nextCursor,
    required Iterable<SyncOperationEnvelope> operations,
  }) {
    final normalized = List<SyncOperationEnvelope>.unmodifiable(operations);
    final identities = <String>{};
    for (final operation in normalized) {
      if (!identities.add(operation.operationId)) {
        throw const SyncContractException('SYNC_RECEIPT_OPERATION_DUPLICATE');
      }
    }
    return SyncBatchReceipt._(
      nextCursor: _optional(nextCursor),
      operations: normalized,
    );
  }

  const SyncBatchReceipt._({
    required this.nextCursor,
    required this.operations,
  });

  final String? nextCursor;
  final List<SyncOperationEnvelope> operations;
}

abstract interface class EncryptedSyncStore {
  Future<void> upsert(SyncOperationEnvelope operation);

  Future<SyncOperationEnvelope?> find(String operationId);

  Future<List<SyncOperationEnvelope>> ready({
    required DateTime now,
    required SchoolSession session,
    int limit = 25,
  });

  Future<void> saveCursor(SyncCursor cursor);

  Future<SyncCursor?> readCursor(SchoolSession session);

  Future<void> purgeTerminalBefore(DateTime cutoff);
}

abstract interface class SyncTransport {
  Future<SyncAttemptResult> send(
    SyncOperationEnvelope operation,
    SchoolSession session,
  );
}

final class SyncAttemptResult {
  factory SyncAttemptResult({
    required SyncAttemptOutcome outcome,
    String? reasonCode,
  }) =>
      SyncAttemptResult._(outcome: outcome, reasonCode: _optional(reasonCode));

  const SyncAttemptResult._({required this.outcome, required this.reasonCode});

  final SyncAttemptOutcome outcome;
  final String? reasonCode;
}

final class OfflineSyncCoordinator {
  OfflineSyncCoordinator({
    required RetrySchedule retrySchedule,
    required EncryptedSyncStore store,
    required SyncTransport transport,
  }) : _retrySchedule = retrySchedule,
       _store = store,
       _transport = transport;

  final RetrySchedule _retrySchedule;
  final EncryptedSyncStore _store;
  final SyncTransport _transport;

  Future<SyncBatchReceipt> flush({
    required DateTime now,
    required SchoolSession session,
    int limit = 25,
  }) async {
    if (limit < 1 || limit > 100) {
      throw const SyncContractException('SYNC_BATCH_LIMIT_INVALID');
    }
    final ready = await _store.ready(now: now, session: session, limit: limit);
    final processed = <SyncOperationEnvelope>[];
    for (final pending in ready) {
      pending.validateSession(session);
      final inFlight = pending.markInFlight();
      await _store.upsert(inFlight);
      SyncAttemptResult result;
      try {
        result = await _transport.send(inFlight, session);
      } on Object {
        result = SyncAttemptResult(
          outcome: SyncAttemptOutcome.retryableFailure,
          reasonCode: 'SYNC_TRANSPORT_UNAVAILABLE',
        );
      }
      final transitioned = inFlight.transition(
        now: now,
        outcome: result.outcome,
        reasonCode: result.reasonCode,
        retrySchedule: _retrySchedule,
      );
      await _store.upsert(transitioned);
      processed.add(transitioned);
    }
    final cursor = await _store.readCursor(session);
    return SyncBatchReceipt(nextCursor: cursor?.cursor, operations: processed);
  }
}

final class SyncContractException implements Exception {
  const SyncContractException(this.code);

  final String code;

  @override
  String toString() => 'SyncContractException($code)';
}

const _terminalStates = <SyncOperationState>{
  SyncOperationState.synced,
  SyncOperationState.duplicate,
  SyncOperationState.conflict,
  SyncOperationState.rejected,
  SyncOperationState.requiresReconciliation,
};

String _required(String value, String field) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw SyncContractException('SYNC_FIELD_REQUIRED:$field');
  }
  return normalized;
}

String? _optional(String? value) {
  final normalized = value?.trim();
  return normalized == null || normalized.isEmpty ? null : normalized;
}
