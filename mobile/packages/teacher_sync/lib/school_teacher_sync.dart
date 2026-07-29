library;

import 'package:school_api_client/school_api_client.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_staff_domain/school_staff_domain.dart';
import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:school_sync_engine/sync_journal.dart';
import 'package:school_sync_storage/school_sync_storage.dart';

const teacherAttendancePayloadSchema = 'teacher.attendance-batch.v1';
const teacherGradeDraftPayloadSchema = 'teacher.grade-draft.v1';

final class TeacherOfflineQueue {
  const TeacherOfflineQueue({
    required SyncOperationJournal journal,
    required SyncPayloadProtector payloadProtector,
    required EncryptedSyncStore store,
  }) : _journal = journal,
       _payloadProtector = payloadProtector,
       _store = store;

  final SyncOperationJournal _journal;
  final SyncPayloadProtector _payloadProtector;
  final EncryptedSyncStore _store;

  Future<SyncOperationEnvelope> enqueueAttendance({
    required TeacherAttendanceBatchCommand command,
    required SchoolSession session,
  }) async {
    command.validateSession(session);
    final existing = await _existingOrCollision(
      aggregateId: command.meetingId,
      baseVersion: command.baseVersion,
      idempotencyKey: command.idempotencyKey,
      kind: SyncOperationKind.attendanceBatch,
      operationId: command.operationId,
      session: session,
    );
    if (existing != null) {
      return existing;
    }
    final payload = await _payloadProtector.protect(
      operationId: command.operationId,
      schemaVersion: teacherAttendancePayloadSchema,
      value: _attendanceToJson(command),
    );
    final operation = SyncOperationEnvelope(
      accountId: session.accountId,
      aggregateId: command.meetingId,
      aggregateType: 'attendanceMeeting',
      attemptCount: 0,
      baseVersion: command.baseVersion,
      campusId: session.campusId,
      clientCreatedAt: command.clientCreatedAt,
      idempotencyKey: command.idempotencyKey,
      kind: SyncOperationKind.attendanceBatch,
      nextAttemptAt: null,
      operationId: command.operationId,
      payload: payload,
      persona: session.activePersona,
      state: SyncOperationState.savedOnDevice,
      tenantId: session.tenantId,
    );
    await _store.upsert(operation);
    return operation;
  }

  Future<SyncOperationEnvelope> enqueueGradeDraft({
    required DateTime clientCreatedAt,
    required TeacherGradeDraftCommand command,
    required SchoolSession session,
  }) async {
    command.validateSession(session);
    final existing = await _existingOrCollision(
      aggregateId: command.assessmentId,
      baseVersion: command.baseVersion,
      idempotencyKey: command.idempotencyKey,
      kind: SyncOperationKind.gradeDraft,
      operationId: command.operationId,
      session: session,
    );
    if (existing != null) {
      return existing;
    }
    final payload = await _payloadProtector.protect(
      operationId: command.operationId,
      schemaVersion: teacherGradeDraftPayloadSchema,
      value: _gradeDraftToJson(command),
    );
    final operation = SyncOperationEnvelope(
      accountId: session.accountId,
      aggregateId: command.assessmentId,
      aggregateType: 'assessment',
      attemptCount: 0,
      baseVersion: command.baseVersion,
      campusId: session.campusId,
      clientCreatedAt: clientCreatedAt,
      idempotencyKey: command.idempotencyKey,
      kind: SyncOperationKind.gradeDraft,
      nextAttemptAt: null,
      operationId: command.operationId,
      payload: payload,
      persona: session.activePersona,
      state: SyncOperationState.savedOnDevice,
      tenantId: session.tenantId,
    );
    await _store.upsert(operation);
    return operation;
  }

  Future<SyncOperationEnvelope?> find({
    required String operationId,
    required SchoolSession session,
  }) async {
    final operation = await _store.find(operationId);
    operation?.validateSession(session);
    return operation;
  }

  Future<List<SyncOperationEnvelope>> journal({
    required SchoolSession session,
    Set<SyncOperationState>? states,
    int limit = 100,
  }) => _journal.listOperations(
    kinds: const <SyncOperationKind>{
      SyncOperationKind.attendanceBatch,
      SyncOperationKind.gradeDraft,
    },
    limit: limit,
    session: session,
    states: states,
  );

  Future<SyncOperationEnvelope?> _existingOrCollision({
    required String aggregateId,
    required int baseVersion,
    required String idempotencyKey,
    required SyncOperationKind kind,
    required String operationId,
    required SchoolSession session,
  }) async {
    final existing = await _store.find(operationId);
    if (existing == null) {
      return null;
    }
    existing.validateSession(session);
    if (existing.kind != kind ||
        existing.aggregateId != aggregateId ||
        existing.baseVersion != baseVersion ||
        existing.idempotencyKey != idempotencyKey) {
      throw const TeacherSyncException('TEACHER_SYNC_OPERATION_COLLISION');
    }
    return existing;
  }
}

final class TeacherSyncTransport implements SyncTransport {
  const TeacherSyncTransport({
    required SyncPayloadProtector payloadProtector,
    required TeacherJourneyRepository repository,
  }) : _payloadProtector = payloadProtector,
       _repository = repository;

  final SyncPayloadProtector _payloadProtector;
  final TeacherJourneyRepository _repository;

  @override
  Future<SyncAttemptResult> send(
    SyncOperationEnvelope operation,
    SchoolSession session,
  ) async {
    operation.validateSession(session);
    try {
      final payload = await _payloadProtector.unprotect(operation: operation);
      final receipt = switch (operation.kind) {
        SyncOperationKind.attendanceBatch => await _repository.submitAttendance(
          command: _attendanceFromJson(payload, operation),
          correlationId: 'sync-${operation.operationId}',
          session: session,
        ),
        SyncOperationKind.gradeDraft => await _repository.saveGradeDraft(
          command: _gradeDraftFromJson(payload, operation),
          correlationId: 'sync-${operation.operationId}',
          session: session,
        ),
        _ => null,
      };
      if (receipt == null) {
        return SyncAttemptResult(
          outcome: SyncAttemptOutcome.rejected,
          reasonCode: 'TEACHER_SYNC_KIND_UNSUPPORTED',
        );
      }
      if (receipt.operationId != operation.operationId) {
        return SyncAttemptResult(
          outcome: SyncAttemptOutcome.requiresReconciliation,
          reasonCode: 'TEACHER_SYNC_RECEIPT_SCOPE_MISMATCH',
        );
      }
      return SyncAttemptResult(
        outcome: _outcome(receipt.status),
        reasonCode: receipt.reasonCode,
      );
    } on SchoolApiException catch (error) {
      return _apiFailure(error);
    } on SyncStorageException catch (error) {
      return SyncAttemptResult(
        outcome: SyncAttemptOutcome.requiresReconciliation,
        reasonCode: error.code,
      );
    } on SyncContractException catch (error) {
      return SyncAttemptResult(
        outcome: SyncAttemptOutcome.requiresReconciliation,
        reasonCode: error.code,
      );
    } on TeacherDomainException catch (error) {
      return SyncAttemptResult(
        outcome: SyncAttemptOutcome.requiresReconciliation,
        reasonCode: error.code,
      );
    } on FormatException catch (error) {
      return SyncAttemptResult(
        outcome: SyncAttemptOutcome.requiresReconciliation,
        reasonCode: 'TEACHER_SYNC_PAYLOAD_INVALID:${error.message}',
      );
    }
  }

  SyncAttemptResult _apiFailure(SchoolApiException error) {
    final status = error.statusCode;
    if (status == 408 || status == 429 || (status != null && status >= 500)) {
      throw error;
    }
    if (status == 409) {
      return SyncAttemptResult(
        outcome: SyncAttemptOutcome.conflict,
        reasonCode: error.code,
      );
    }
    if (status == 401 || status == 403 || status == null) {
      return SyncAttemptResult(
        outcome: SyncAttemptOutcome.requiresReconciliation,
        reasonCode: error.code,
      );
    }
    return SyncAttemptResult(
      outcome: SyncAttemptOutcome.rejected,
      reasonCode: error.code,
    );
  }

  SyncAttemptOutcome _outcome(TeacherWriteStatus status) => switch (status) {
    TeacherWriteStatus.accepted => SyncAttemptOutcome.accepted,
    TeacherWriteStatus.duplicate => SyncAttemptOutcome.duplicate,
    TeacherWriteStatus.conflict => SyncAttemptOutcome.conflict,
    TeacherWriteStatus.rejected => SyncAttemptOutcome.rejected,
    TeacherWriteStatus.requiresReconciliation =>
      SyncAttemptOutcome.requiresReconciliation,
  };
}

final class TeacherSyncRuntime {
  const TeacherSyncRuntime({
    required this.coordinator,
    required this.queue,
  });

  final OfflineSyncCoordinator coordinator;
  final TeacherOfflineQueue queue;
}

final class TeacherSyncException implements Exception {
  const TeacherSyncException(this.code);

  final String code;

  @override
  String toString() => 'TeacherSyncException($code)';
}

Map<String, Object?> _attendanceToJson(
  TeacherAttendanceBatchCommand command,
) => <String, Object?>{
  'operationId': command.operationId,
  'idempotencyKey': command.idempotencyKey,
  'meetingId': command.meetingId,
  'baseVersion': command.baseVersion,
  'clientCreatedAt': command.clientCreatedAt.toIso8601String(),
  'lines': command.lines
      .map(
        (line) => <String, Object?>{
          'studentId': line.studentId,
          'mark': line.mark.name,
        },
      )
      .toList(growable: false),
};

TeacherAttendanceBatchCommand _attendanceFromJson(
  Map<String, Object?> json,
  SyncOperationEnvelope operation,
) {
  _requireEnvelopeIdentity(
    aggregateId: _string(json, 'meetingId'),
    baseVersion: _integer(json, 'baseVersion'),
    idempotencyKey: _string(json, 'idempotencyKey'),
    operation: operation,
    operationId: _string(json, 'operationId'),
  );
  return TeacherAttendanceBatchCommand(
    baseVersion: operation.baseVersion,
    clientCreatedAt: _dateTime(json, 'clientCreatedAt'),
    idempotencyKey: operation.idempotencyKey,
    lines: _objectList(json, 'lines').map(
      (line) => TeacherAttendanceLine(
        mark: TeacherAttendanceMark.values.byName(_string(line, 'mark')),
        studentId: _string(line, 'studentId'),
      ),
    ),
    meetingId: operation.aggregateId,
    operationId: operation.operationId,
  );
}

Map<String, Object?> _gradeDraftToJson(TeacherGradeDraftCommand command) =>
    <String, Object?>{
      'operationId': command.operationId,
      'idempotencyKey': command.idempotencyKey,
      'assessmentId': command.assessmentId,
      'baseVersion': command.baseVersion,
      'scoreScale': command.scoreScale,
      'maximumScoreUnits': command.maximumScoreUnits,
      'entries': command.entries
          .map(
            (entry) => <String, Object?>{
              'studentId': entry.studentId,
              'status': entry.status.name,
              if (entry.scoreUnits != null) 'scoreUnits': entry.scoreUnits,
            },
          )
          .toList(growable: false),
    };

TeacherGradeDraftCommand _gradeDraftFromJson(
  Map<String, Object?> json,
  SyncOperationEnvelope operation,
) {
  _requireEnvelopeIdentity(
    aggregateId: _string(json, 'assessmentId'),
    baseVersion: _integer(json, 'baseVersion'),
    idempotencyKey: _string(json, 'idempotencyKey'),
    operation: operation,
    operationId: _string(json, 'operationId'),
  );
  return TeacherGradeDraftCommand(
    assessmentId: operation.aggregateId,
    baseVersion: operation.baseVersion,
    entries: _objectList(json, 'entries').map(
      (entry) => TeacherGradeDraftEntry(
        scoreUnits: _optionalInteger(entry, 'scoreUnits'),
        status: TeacherGradeEntryStatus.values.byName(
          _string(entry, 'status'),
        ),
        studentId: _string(entry, 'studentId'),
      ),
    ),
    idempotencyKey: operation.idempotencyKey,
    maximumScoreUnits: _integer(json, 'maximumScoreUnits'),
    operationId: operation.operationId,
    scoreScale: _integer(json, 'scoreScale'),
  );
}

void _requireEnvelopeIdentity({
  required String aggregateId,
  required int baseVersion,
  required String idempotencyKey,
  required SyncOperationEnvelope operation,
  required String operationId,
}) {
  if (operation.operationId != operationId ||
      operation.idempotencyKey != idempotencyKey ||
      operation.aggregateId != aggregateId ||
      operation.baseVersion != baseVersion) {
    throw const TeacherSyncException('TEACHER_SYNC_PAYLOAD_SCOPE_MISMATCH');
  }
}

List<Map<String, Object?>> _objectList(
  Map<String, Object?> json,
  String key,
) {
  final value = json[key];
  if (value is! List<Object?>) {
    throw FormatException('TEACHER_SYNC_LIST_REQUIRED:$key');
  }
  return value.map((item) {
    if (item is! Map<String, Object?>) {
      throw FormatException('TEACHER_SYNC_OBJECT_REQUIRED:$key');
    }
    return item;
  }).toList(growable: false);
}

String _string(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('TEACHER_SYNC_STRING_REQUIRED:$key');
  }
  return value.trim();
}

int _integer(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! int) {
    throw FormatException('TEACHER_SYNC_INTEGER_REQUIRED:$key');
  }
  return value;
}

int? _optionalInteger(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  if (value is! int) {
    throw FormatException('TEACHER_SYNC_INTEGER_INVALID:$key');
  }
  return value;
}

DateTime _dateTime(Map<String, Object?> json, String key) {
  final value = DateTime.tryParse(_string(json, key));
  if (value == null) {
    throw FormatException('TEACHER_SYNC_DATETIME_INVALID:$key');
  }
  return value;
}
