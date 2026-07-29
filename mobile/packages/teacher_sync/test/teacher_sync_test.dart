import 'package:flutter_test/flutter_test.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_staff_domain/school_staff_domain.dart';
import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:school_sync_engine/sync_journal.dart';
import 'package:school_sync_storage/school_sync_storage.dart';
import 'package:school_teacher_sync/school_teacher_sync.dart';

void main() {
  late SchoolSession session;
  late _MemorySyncStore store;
  late ScopedSyncPayloadProtector protector;

  setUp(() {
    session = teacherSession();
    store = _MemorySyncStore();
    protector = ScopedSyncPayloadProtector(
      keyVault: MemorySyncKeyVault(),
      recordCipher: AesGcmSyncRecordCipher(),
      scope: SyncStorageScope.fromSession(session),
    );
  });

  test('attendance enqueue encrypts payload and is idempotent', () async {
    final queue = TeacherOfflineQueue(
      journal: store,
      payloadProtector: protector,
      store: store,
    );
    final command = attendanceCommand();

    final first = await queue.enqueueAttendance(command: command, session: session);
    final second = await queue.enqueueAttendance(command: command, session: session);

    expect(identical(first, second), isTrue);
    expect(first.kind, SyncOperationKind.attendanceBatch);
    expect(first.state, SyncOperationState.savedOnDevice);
    expect(first.payload.schemaVersion, teacherAttendancePayloadSchema);
    expect(first.payload.ciphertext, isNotEmpty);
    expect(first.payload.toString(), isNot(contains('student-1')));
    expect(store.operations, hasLength(1));
  });

  test('operation id collision cannot overwrite another teacher command', () async {
    final queue = TeacherOfflineQueue(
      journal: store,
      payloadProtector: protector,
      store: store,
    );
    await queue.enqueueAttendance(
      command: attendanceCommand(),
      session: session,
    );

    expect(
      () => queue.enqueueAttendance(
        command: attendanceCommand(meetingId: 'meeting-2'),
        session: session,
      ),
      throwsA(
        isA<TeacherSyncException>().having(
          (error) => error.code,
          'code',
          'TEACHER_SYNC_OPERATION_COLLISION',
        ),
      ),
    );
  });

  test('transport decrypts attendance and maps accepted receipt', () async {
    final repository = _TeacherRepository(
      attendanceReceipt: TeacherWriteReceipt(
        acceptedRevision: 8,
        operationId: 'operation-1',
        status: TeacherWriteStatus.accepted,
      ),
    );
    final queue = TeacherOfflineQueue(
      journal: store,
      payloadProtector: protector,
      store: store,
    );
    final operation = await queue.enqueueAttendance(
      command: attendanceCommand(),
      session: session,
    );
    final transport = TeacherSyncTransport(
      payloadProtector: protector,
      repository: repository,
    );

    final result = await transport.send(operation.markInFlight(), session);

    expect(result.outcome, SyncAttemptOutcome.accepted);
    expect(repository.lastAttendance?.meetingId, 'meeting-1');
    expect(repository.lastAttendance?.lines.single.studentId, 'student-1');
  });

  test('mismatched server receipt requires reconciliation', () async {
    final repository = _TeacherRepository(
      attendanceReceipt: TeacherWriteReceipt(
        acceptedRevision: 8,
        operationId: 'another-operation',
        status: TeacherWriteStatus.accepted,
      ),
    );
    final queue = TeacherOfflineQueue(
      journal: store,
      payloadProtector: protector,
      store: store,
    );
    final operation = await queue.enqueueAttendance(
      command: attendanceCommand(),
      session: session,
    );

    final result = await TeacherSyncTransport(
      payloadProtector: protector,
      repository: repository,
    ).send(operation.markInFlight(), session);

    expect(result.outcome, SyncAttemptOutcome.requiresReconciliation);
    expect(result.reasonCode, 'TEACHER_SYNC_RECEIPT_SCOPE_MISMATCH');
  });

  test('retryable API failure returns operation to durable retry state', () async {
    final repository = _TeacherRepository(
      attendanceError: const SchoolApiException(
        code: 'SERVER_UNAVAILABLE',
        message: 'Unavailable',
        statusCode: 503,
      ),
    );
    final queue = TeacherOfflineQueue(
      journal: store,
      payloadProtector: protector,
      store: store,
    );
    await queue.enqueueAttendance(command: attendanceCommand(), session: session);
    final now = DateTime.parse('2026-07-30T05:00:00+06:00');

    final receipt = await OfflineSyncCoordinator(
      retrySchedule: RetrySchedule(baseDelay: const Duration(seconds: 10)),
      store: store,
      transport: TeacherSyncTransport(
        payloadProtector: protector,
        repository: repository,
      ),
    ).flush(now: now, session: session);

    final operation = receipt.operations.single;
    expect(operation.state, SyncOperationState.waitingForNetwork);
    expect(operation.attemptCount, 1);
    expect(operation.nextAttemptAt, now.add(const Duration(seconds: 10)));
    expect(operation.lastReasonCode, 'SYNC_TRANSPORT_UNAVAILABLE');
  });

  test('grade draft is encrypted and duplicate receipt remains terminal', () async {
    final repository = _TeacherRepository(
      gradeReceipt: TeacherWriteReceipt(
        acceptedRevision: 4,
        operationId: 'grade-operation-1',
        status: TeacherWriteStatus.duplicate,
        reasonCode: 'ALREADY_APPLIED',
      ),
    );
    final queue = TeacherOfflineQueue(
      journal: store,
      payloadProtector: protector,
      store: store,
    );
    await queue.enqueueGradeDraft(
      clientCreatedAt: DateTime.parse('2026-07-30T05:00:00+06:00'),
      command: gradeCommand(),
      session: session,
    );

    final receipt = await OfflineSyncCoordinator(
      retrySchedule: RetrySchedule(),
      store: store,
      transport: TeacherSyncTransport(
        payloadProtector: protector,
        repository: repository,
      ),
    ).flush(
      now: DateTime.parse('2026-07-30T05:01:00+06:00'),
      session: session,
    );

    expect(receipt.operations.single.state, SyncOperationState.duplicate);
    expect(receipt.operations.single.lastReasonCode, 'ALREADY_APPLIED');
    expect(repository.lastGradeDraft?.entries.single.scoreUnits, 7500);
  });

  test('journal filters by teacher kinds, states and current scope', () async {
    final queue = TeacherOfflineQueue(
      journal: store,
      payloadProtector: protector,
      store: store,
    );
    await queue.enqueueAttendance(command: attendanceCommand(), session: session);
    await queue.enqueueGradeDraft(
      clientCreatedAt: DateTime.parse('2026-07-30T05:00:00+06:00'),
      command: gradeCommand(),
      session: session,
    );

    final operations = await queue.journal(
      session: session,
      states: const <SyncOperationState>{SyncOperationState.savedOnDevice},
    );

    expect(operations, hasLength(2));
    expect(
      operations.map((operation) => operation.kind),
      containsAll(<SyncOperationKind>[
        SyncOperationKind.attendanceBatch,
        SyncOperationKind.gradeDraft,
      ]),
    );
  });
}

SchoolSession teacherSession() => SchoolSession(
  accountId: 'account-1',
  campusId: 'campus-1',
  capabilities: const <String>{
    SchoolCapability.attendanceTake,
    SchoolCapability.gradesWrite,
  },
  activePersona: SchoolPersona.teacher,
  tenantId: 'tenant-1',
);

TeacherAttendanceBatchCommand attendanceCommand({
  String meetingId = 'meeting-1',
}) => TeacherAttendanceBatchCommand(
  baseVersion: 7,
  clientCreatedAt: DateTime.parse('2026-07-30T05:00:00+06:00'),
  idempotencyKey: 'attendance-idempotency-1',
  lines: <TeacherAttendanceLine>[
    TeacherAttendanceLine(
      mark: TeacherAttendanceMark.present,
      studentId: 'student-1',
    ),
  ],
  meetingId: meetingId,
  operationId: 'operation-1',
);

TeacherGradeDraftCommand gradeCommand() => TeacherGradeDraftCommand(
  assessmentId: 'assessment-1',
  baseVersion: 3,
  entries: <TeacherGradeDraftEntry>[
    TeacherGradeDraftEntry(
      scoreUnits: 7500,
      status: TeacherGradeEntryStatus.scored,
      studentId: 'student-1',
    ),
  ],
  idempotencyKey: 'grade-idempotency-1',
  maximumScoreUnits: 10000,
  operationId: 'grade-operation-1',
  scoreScale: 100,
);

final class _MemorySyncStore
    implements EncryptedSyncStore, SyncOperationJournal {
  final Map<String, SyncOperationEnvelope> operations =
      <String, SyncOperationEnvelope>{};
  SyncCursor? cursor;

  @override
  Future<SyncOperationEnvelope?> find(String operationId) async =>
      operations[operationId];

  @override
  Future<List<SyncOperationEnvelope>> listOperations({
    required SchoolSession session,
    Set<SyncOperationKind>? kinds,
    Set<SyncOperationState>? states,
    int limit = 100,
  }) async {
    final result = operations.values
        .where((operation) {
          operation.validateSession(session);
          return (kinds == null || kinds.contains(operation.kind)) &&
              (states == null || states.contains(operation.state));
        })
        .take(limit)
        .toList(growable: false);
    return List<SyncOperationEnvelope>.unmodifiable(result);
  }

  @override
  Future<void> purgeTerminalBefore(DateTime cutoff) async {
    operations.removeWhere(
      (key, operation) =>
          operation.isTerminal && operation.clientCreatedAt.isBefore(cutoff),
    );
  }

  @override
  Future<List<SyncOperationEnvelope>> ready({
    required DateTime now,
    required SchoolSession session,
    int limit = 25,
  }) async {
    final result = operations.values.where((operation) {
      operation.validateSession(session);
      return operation.state == SyncOperationState.savedOnDevice ||
          (operation.state == SyncOperationState.waitingForNetwork &&
              operation.nextAttemptAt != null &&
              !operation.nextAttemptAt!.isAfter(now));
    }).take(limit).toList(growable: false);
    return List<SyncOperationEnvelope>.unmodifiable(result);
  }

  @override
  Future<SyncCursor?> readCursor(SchoolSession session) async {
    cursor?.validateSession(session);
    return cursor;
  }

  @override
  Future<void> saveCursor(SyncCursor cursor) async {
    this.cursor = cursor;
  }

  @override
  Future<void> upsert(SyncOperationEnvelope operation) async {
    operations[operation.operationId] = operation;
  }
}

final class _TeacherRepository implements TeacherJourneyRepository {
  _TeacherRepository({
    this.attendanceError,
    this.attendanceReceipt,
    this.gradeReceipt,
  });

  final SchoolApiException? attendanceError;
  final TeacherWriteReceipt? attendanceReceipt;
  final TeacherWriteReceipt? gradeReceipt;
  TeacherAttendanceBatchCommand? lastAttendance;
  TeacherGradeDraftCommand? lastGradeDraft;

  @override
  Future<TeacherTodayReadModel> loadToday(
    SchoolSession session, {
    String correlationId = 'teacher-today',
  }) => throw UnimplementedError();

  @override
  Future<TeacherRosterReadModel> loadRoster({
    required String meetingId,
    required SchoolSession session,
    String correlationId = 'teacher-roster',
  }) => throw UnimplementedError();

  @override
  Future<TeacherWriteReceipt> saveGradeDraft({
    required TeacherGradeDraftCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-grade-draft',
  }) async {
    lastGradeDraft = command;
    return gradeReceipt ??
        TeacherWriteReceipt(
          acceptedRevision: command.baseVersion + 1,
          operationId: command.operationId,
          status: TeacherWriteStatus.accepted,
        );
  }

  @override
  Future<TeacherWriteReceipt> submitAttendance({
    required TeacherAttendanceBatchCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-attendance-batch',
  }) async {
    final error = attendanceError;
    if (error != null) {
      throw error;
    }
    lastAttendance = command;
    return attendanceReceipt ??
        TeacherWriteReceipt(
          acceptedRevision: command.baseVersion + 1,
          operationId: command.operationId,
          status: TeacherWriteStatus.accepted,
        );
  }
}
