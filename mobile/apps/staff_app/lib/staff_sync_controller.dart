part of 'main.dart';

typedef StaffSyncRuntimeLoader = Future<TeacherSyncRuntime> Function({
  required TeacherJourneyRepository repository,
  required SchoolSession session,
});

enum StaffSyncPhase { initializing, ready, saving, syncing, failed }

final class StaffAttendanceSyncState {
  const StaffAttendanceSyncState({
    required this.dirty,
    required this.marks,
    required this.operations,
    required this.phase,
    required this.reasonCode,
    required this.rosterMeetingId,
    required this.rosterVersion,
  });

  factory StaffAttendanceSyncState.initial() => const StaffAttendanceSyncState(
    dirty: false,
    marks: <String, TeacherAttendanceMark>{},
    operations: <SyncOperationEnvelope>[],
    phase: StaffSyncPhase.initializing,
    reasonCode: null,
    rosterMeetingId: null,
    rosterVersion: null,
  );

  final bool dirty;
  final Map<String, TeacherAttendanceMark> marks;
  final List<SyncOperationEnvelope> operations;
  final StaffSyncPhase phase;
  final String? reasonCode;
  final String? rosterMeetingId;
  final int? rosterVersion;

  int get pendingCount => operations
      .where(
        (operation) =>
            operation.state == SyncOperationState.savedOnDevice ||
            operation.state == SyncOperationState.waitingForNetwork ||
            operation.state == SyncOperationState.inFlight,
      )
      .length;

  int get attentionCount => operations
      .where(
        (operation) =>
            operation.state == SyncOperationState.conflict ||
            operation.state == SyncOperationState.rejected ||
            operation.state == SyncOperationState.requiresReconciliation,
      )
      .length;

  SyncOperationEnvelope? get latestOperation =>
      operations.isEmpty ? null : operations.first;

  StaffAttendanceSyncState copyWith({
    bool? dirty,
    Map<String, TeacherAttendanceMark>? marks,
    List<SyncOperationEnvelope>? operations,
    StaffSyncPhase? phase,
    String? reasonCode,
    bool clearReasonCode = false,
    String? rosterMeetingId,
    bool clearRoster = false,
    int? rosterVersion,
  }) => StaffAttendanceSyncState(
    dirty: dirty ?? this.dirty,
    marks: marks ?? this.marks,
    operations: operations ?? this.operations,
    phase: phase ?? this.phase,
    reasonCode: clearReasonCode ? null : reasonCode ?? this.reasonCode,
    rosterMeetingId: clearRoster
        ? null
        : rosterMeetingId ?? this.rosterMeetingId,
    rosterVersion: clearRoster ? null : rosterVersion ?? this.rosterVersion,
  );
}

final class StaffAttendanceSyncController extends ChangeNotifier {
  StaffAttendanceSyncController({
    DateTime Function()? clock,
    required TeacherJourneyRepository repository,
    StaffSyncRuntimeLoader? runtimeLoader,
    required SchoolSession session,
  }) : _clock = clock ?? DateTime.now,
       _repository = repository,
       _runtimeLoader = runtimeLoader ?? loadPlatformTeacherSyncRuntime,
       _session = session,
       _state = StaffAttendanceSyncState.initial();

  final DateTime Function() _clock;
  TeacherJourneyRepository _repository;
  final StaffSyncRuntimeLoader _runtimeLoader;
  SchoolSession _session;
  StaffAttendanceSyncState _state;
  TeacherSyncRuntime? _runtime;
  TeacherRosterReadModel? _roster;
  int _generation = 0;

  StaffAttendanceSyncState get state => _state;

  Future<void> initialize() => _loadRuntime(resetRoster: false);

  Future<void> updateScope({
    required TeacherJourneyRepository repository,
    required SchoolSession session,
  }) async {
    final changed =
        _repository != repository ||
        _session.accountId != session.accountId ||
        _session.tenantId != session.tenantId ||
        _session.campusId != session.campusId ||
        _session.activePersona != session.activePersona ||
        !setEquals(_session.capabilities, session.capabilities);
    if (!changed) {
      return;
    }
    _repository = repository;
    _session = session;
    await _loadRuntime(resetRoster: true);
  }

  void attachRoster(TeacherRosterReadModel roster) {
    if (_state.rosterMeetingId == roster.meetingId &&
        _state.rosterVersion == roster.version) {
      return;
    }
    final marks = <String, TeacherAttendanceMark>{
      for (final student in roster.students)
        student.studentId: TeacherAttendanceMark.present,
    };
    _roster = roster;
    _state = _state.copyWith(
      clearReasonCode: true,
      dirty: false,
      marks: Map<String, TeacherAttendanceMark>.unmodifiable(marks),
      phase: _runtime == null
          ? StaffSyncPhase.initializing
          : StaffSyncPhase.ready,
      rosterMeetingId: roster.meetingId,
      rosterVersion: roster.version,
    );
    notifyListeners();
  }

  void mark(String studentId, TeacherAttendanceMark mark) {
    final roster = _roster;
    if (roster == null ||
        !roster.students.any((student) => student.studentId == studentId)) {
      throw const TeacherSyncException('TEACHER_SYNC_ROSTER_STUDENT_REQUIRED');
    }
    final marks = Map<String, TeacherAttendanceMark>.of(_state.marks)
      ..[studentId] = mark;
    _state = _state.copyWith(
      clearReasonCode: true,
      dirty: true,
      marks: Map<String, TeacherAttendanceMark>.unmodifiable(marks),
    );
    notifyListeners();
  }

  Future<void> saveOnDevice() async {
    final runtime = _runtime;
    final roster = _roster;
    if (runtime == null) {
      _fail('TEACHER_SYNC_RUNTIME_UNAVAILABLE');
      return;
    }
    if (roster == null) {
      _fail('TEACHER_SYNC_ROSTER_REQUIRED');
      return;
    }
    if (!_state.dirty) {
      return;
    }
    _state = _state.copyWith(
      clearReasonCode: true,
      phase: StaffSyncPhase.saving,
    );
    notifyListeners();
    try {
      final now = _clock();
      final identity = '${roster.meetingId}-${now.toUtc().microsecondsSinceEpoch}';
      await runtime.queue.enqueueAttendance(
        command: TeacherAttendanceBatchCommand(
          baseVersion: roster.version,
          clientCreatedAt: now,
          idempotencyKey: 'teacher-attendance-$identity',
          lines: roster.students.map(
            (student) => TeacherAttendanceLine(
              mark:
                  _state.marks[student.studentId] ??
                  TeacherAttendanceMark.present,
              studentId: student.studentId,
            ),
          ),
          meetingId: roster.meetingId,
          operationId: 'attendance-$identity',
        ),
        session: _session,
      );
      await _refreshJournal(
        dirty: false,
        phase: StaffSyncPhase.ready,
      );
    } on TeacherSyncException catch (error) {
      _fail(error.code);
    } on TeacherDomainException catch (error) {
      _fail(error.code);
    } on SyncStorageException catch (error) {
      _fail(error.code);
    } on SyncContractException catch (error) {
      _fail(error.code);
    } on Object {
      _fail('TEACHER_SYNC_SAVE_FAILED');
    }
  }

  Future<void> syncNow() async {
    final runtime = _runtime;
    if (runtime == null) {
      _fail('TEACHER_SYNC_RUNTIME_UNAVAILABLE');
      return;
    }
    _state = _state.copyWith(
      clearReasonCode: true,
      phase: StaffSyncPhase.syncing,
    );
    notifyListeners();
    try {
      await runtime.coordinator.flush(now: _clock(), session: _session);
      await _refreshJournal(phase: StaffSyncPhase.ready);
    } on SyncStorageException catch (error) {
      _fail(error.code);
    } on SyncContractException catch (error) {
      _fail(error.code);
    } on Object {
      _fail('TEACHER_SYNC_FLUSH_FAILED');
    }
  }

  Future<void> refreshJournal() async {
    if (_runtime == null) {
      return;
    }
    try {
      await _refreshJournal(phase: StaffSyncPhase.ready);
    } on SyncStorageException catch (error) {
      _fail(error.code);
    } on SyncContractException catch (error) {
      _fail(error.code);
    } on Object {
      _fail('TEACHER_SYNC_JOURNAL_FAILED');
    }
  }

  Future<void> _loadRuntime({required bool resetRoster}) async {
    final generation = ++_generation;
    if (resetRoster) {
      _roster = null;
    }
    _runtime = null;
    _state = StaffAttendanceSyncState.initial().copyWith(
      clearRoster: resetRoster,
    );
    notifyListeners();
    try {
      final runtime = await _runtimeLoader(
        repository: _repository,
        session: _session,
      );
      if (generation != _generation) {
        return;
      }
      _runtime = runtime;
      await _refreshJournal(phase: StaffSyncPhase.ready);
    } on SyncStorageException catch (error) {
      if (generation == _generation) {
        _fail(error.code);
      }
    } on Object {
      if (generation == _generation) {
        _fail('TEACHER_SYNC_INITIALIZATION_FAILED');
      }
    }
  }

  Future<void> _refreshJournal({
    bool? dirty,
    required StaffSyncPhase phase,
  }) async {
    final operations = await _runtime!.queue.journal(session: _session);
    _state = _state.copyWith(
      clearReasonCode: true,
      dirty: dirty,
      operations: List<SyncOperationEnvelope>.unmodifiable(operations),
      phase: phase,
    );
    notifyListeners();
  }

  void _fail(String reasonCode) {
    _state = _state.copyWith(
      phase: StaffSyncPhase.failed,
      reasonCode: reasonCode,
    );
    notifyListeners();
  }
}

Future<TeacherSyncRuntime> loadPlatformTeacherSyncRuntime({
  required TeacherJourneyRepository repository,
  required SchoolSession session,
}) async {
  final keyVault = PlatformSyncKeyVault();
  final recordCipher = AesGcmSyncRecordCipher();
  final scope = SyncStorageScope.fromSession(session);
  final store = await PlatformEncryptedSyncStoreFactory(
    keyVault: keyVault,
    recordCipher: recordCipher,
  ).open(session);
  final payloadProtector = ScopedSyncPayloadProtector(
    keyVault: keyVault,
    recordCipher: recordCipher,
    scope: scope,
  );
  return TeacherSyncRuntime(
    coordinator: OfflineSyncCoordinator(
      retrySchedule: RetrySchedule(),
      store: store,
      transport: TeacherSyncTransport(
        payloadProtector: payloadProtector,
        repository: repository,
      ),
    ),
    queue: TeacherOfflineQueue(
      journal: store,
      payloadProtector: payloadProtector,
      store: store,
    ),
  );
}
