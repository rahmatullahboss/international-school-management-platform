import 'package:flutter_test/flutter_test.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_staff_app/main.dart';
import 'package:school_staff_domain/school_staff_domain.dart';
import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:school_sync_engine/sync_journal.dart';
import 'package:school_sync_storage/school_sync_storage.dart';
import 'package:school_teacher_sync/school_teacher_sync.dart';

void main() {
  test(
    'authorized roster saves encrypted draft and syncs accepted receipt',
    () async {
      final session = teacherSession();
      final store = _MemorySyncStore();
      final repository = _TeacherRepository(
        status: TeacherWriteStatus.accepted,
      );
      final runtime = teacherRuntime(
        repository: repository,
        session: session,
        store: store,
      );
      final controller = StaffAttendanceSyncController(
        clock: () => DateTime.parse('2026-07-30T05:30:00+06:00'),
        repository: repository,
        runtimeLoader: ({required repository, required session}) async =>
            runtime,
        session: session,
      );

      await controller.initialize();
      controller.attachRoster(roster());
      controller.mark('student-1', TeacherAttendanceMark.absent);
      await controller.saveOnDevice();

      expect(controller.state.dirty, isFalse);
      expect(controller.state.pendingCount, 1);
      expect(store.operations.single.payload.ciphertext, isNotEmpty);
      expect(
        store.operations.single.payload.toString(),
        isNot(contains('student-1')),
      );

      await controller.syncNow();

      expect(controller.state.pendingCount, 0);
      expect(
        controller.state.latestOperation?.state,
        SyncOperationState.synced,
      );
      expect(
        repository.lastAttendance?.lines.single.mark,
        TeacherAttendanceMark.absent,
      );
    },
  );

  test('conflict receipt remains visible for manual attention', () async {
    final session = teacherSession();
    final store = _MemorySyncStore();
    final repository = _TeacherRepository(status: TeacherWriteStatus.conflict);
    final runtime = teacherRuntime(
      repository: repository,
      session: session,
      store: store,
    );
    final controller = StaffAttendanceSyncController(
      clock: () => DateTime.parse('2026-07-30T05:31:00+06:00'),
      repository: repository,
      runtimeLoader: ({required repository, required session}) async => runtime,
      session: session,
    );

    await controller.initialize();
    controller.attachRoster(roster());
    controller.mark('student-1', TeacherAttendanceMark.late);
    await controller.saveOnDevice();
    await controller.syncNow();

    expect(controller.state.attentionCount, 1);
    expect(
      controller.state.latestOperation?.state,
      SyncOperationState.conflict,
    );
    expect(
      controller.state.latestOperation?.lastReasonCode,
      'VERSION_CONFLICT',
    );
  });

  test(
    'school scope update clears roster and reloads isolated runtime',
    () async {
      final first = teacherSession();
      final second = teacherSession(tenantId: 'tenant-2', campusId: 'campus-2');
      final repository = _TeacherRepository(
        status: TeacherWriteStatus.accepted,
      );
      var loads = 0;
      final controller = StaffAttendanceSyncController(
        repository: repository,
        runtimeLoader: ({required repository, required session}) async {
          loads++;
          return teacherRuntime(
            repository: repository,
            session: session,
            store: _MemorySyncStore(),
          );
        },
        session: first,
      );

      await controller.initialize();
      controller.attachRoster(roster());
      await controller.updateScope(repository: repository, session: second);

      expect(loads, 2);
      expect(controller.state.rosterMeetingId, isNull);
      expect(controller.state.marks, isEmpty);
      expect(controller.state.phase, StaffSyncPhase.ready);
    },
  );
}

TeacherSyncRuntime teacherRuntime({
  required TeacherJourneyRepository repository,
  required SchoolSession session,
  required _MemorySyncStore store,
}) {
  final protector = ScopedSyncPayloadProtector(
    keyVault: MemorySyncKeyVault(),
    recordCipher: AesGcmSyncRecordCipher(),
    scope: SyncStorageScope.fromSession(session),
  );
  return TeacherSyncRuntime(
    coordinator: OfflineSyncCoordinator(
      retrySchedule: RetrySchedule(),
      store: store,
      transport: TeacherSyncTransport(
        payloadProtector: protector,
        repository: repository,
      ),
    ),
    queue: TeacherOfflineQueue(
      journal: store,
      payloadProtector: protector,
      store: store,
    ),
  );
}

SchoolSession teacherSession({
  String campusId = 'campus-1',
  String tenantId = 'tenant-1',
}) => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.teacher,
  availablePersonas: const <SchoolPersona>{SchoolPersona.teacher},
  campusId: campusId,
  capabilities: const <String>{SchoolCapability.attendanceTake},
  locale: 'en-GB',
  tenantId: tenantId,
  timeZone: 'Asia/Dhaka',
);

TeacherRosterReadModel roster() => TeacherRosterReadModel(
  meetingId: 'meeting-1',
  sectionId: 'section-1',
  students: <TeacherRosterStudent>[
    TeacherRosterStudent(
      displayName: 'Student One',
      rollLabel: '01',
      studentId: 'student-1',
    ),
  ],
  version: 7,
);

final class _MemorySyncStore
    implements EncryptedSyncStore, SyncOperationJournal {
  final Map<String, SyncOperationEnvelope> _operations =
      <String, SyncOperationEnvelope>{};

  List<SyncOperationEnvelope> get operations =>
      List<SyncOperationEnvelope>.unmodifiable(_operations.values);

  @override
  Future<SyncOperationEnvelope?> find(String operationId) async =>
      _operations[operationId];

  @override
  Future<List<SyncOperationEnvelope>> listOperations({
    required SchoolSession session,
    Set<SyncOperationKind>? kinds,
    Set<SyncOperationState>? states,
    int limit = 100,
  }) async {
    final values =
        _operations.values
            .where((operation) {
              operation.validateSession(session);
              return (kinds == null || kinds.contains(operation.kind)) &&
                  (states == null || states.contains(operation.state));
            })
            .toList(growable: false)
          ..sort(
            (first, second) =>
                second.clientCreatedAt.compareTo(first.clientCreatedAt),
          );
    return List<SyncOperationEnvelope>.unmodifiable(values.take(limit));
  }

  @override
  Future<void> purgeTerminalBefore(DateTime cutoff) async {
    _operations.removeWhere(
      (key, operation) =>
          operation.isTerminal && operation.clientCreatedAt.isBefore(cutoff),
    );
  }

  @override
  Future<List<SyncOperationEnvelope>> ready({
    required DateTime now,
    required SchoolSession session,
    int limit = 25,
  }) async => List<SyncOperationEnvelope>.unmodifiable(
    _operations.values
        .where((operation) {
          operation.validateSession(session);
          return operation.state == SyncOperationState.savedOnDevice ||
              (operation.state == SyncOperationState.waitingForNetwork &&
                  operation.nextAttemptAt != null &&
                  !operation.nextAttemptAt!.isAfter(now));
        })
        .take(limit),
  );

  @override
  Future<SyncCursor?> readCursor(SchoolSession session) async => null;

  @override
  Future<void> saveCursor(SyncCursor cursor) async {}

  @override
  Future<void> upsert(SyncOperationEnvelope operation) async {
    _operations[operation.operationId] = operation;
  }
}

final class _TeacherRepository implements TeacherJourneyRepository {
  _TeacherRepository({required this.status});

  final TeacherWriteStatus status;
  TeacherAttendanceBatchCommand? lastAttendance;

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
  }) => throw UnimplementedError();

  @override
  Future<TeacherWriteReceipt> submitAttendance({
    required TeacherAttendanceBatchCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-attendance-batch',
  }) async {
    lastAttendance = command;
    return TeacherWriteReceipt(
      acceptedRevision: command.baseVersion + 1,
      operationId: command.operationId,
      reasonCode: status == TeacherWriteStatus.conflict
          ? 'VERSION_CONFLICT'
          : null,
      status: status,
    );
  }
}
