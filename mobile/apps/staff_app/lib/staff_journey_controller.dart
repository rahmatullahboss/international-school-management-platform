part of 'main.dart';

enum StaffJourneyPhase { loading, ready, failed }

final class StaffJourneyState {
  const StaffJourneyState._({
    required this.phase,
    this.activeRoster,
    this.reasonCode,
    this.rosterLoading = false,
    this.rosterReasonCode,
    this.today,
  });

  const StaffJourneyState.loading()
    : this._(phase: StaffJourneyPhase.loading);

  const StaffJourneyState.failed(String reasonCode)
    : this._(phase: StaffJourneyPhase.failed, reasonCode: reasonCode);

  const StaffJourneyState.ready({
    required TeacherTodayReadModel today,
    TeacherRosterReadModel? activeRoster,
    bool rosterLoading = false,
    String? rosterReasonCode,
  }) : this._(
         activeRoster: activeRoster,
         phase: StaffJourneyPhase.ready,
         rosterLoading: rosterLoading,
         rosterReasonCode: rosterReasonCode,
         today: today,
       );

  final StaffJourneyPhase phase;
  final TeacherTodayReadModel? today;
  final TeacherRosterReadModel? activeRoster;
  final bool rosterLoading;
  final String? reasonCode;
  final String? rosterReasonCode;
}

final class StaffJourneyController extends ChangeNotifier {
  StaffJourneyController({
    required TeacherJourneyRepository repository,
    required SchoolSession session,
  }) : _repository = repository,
       _session = session;

  final TeacherJourneyRepository _repository;
  SchoolSession _session;
  StaffJourneyState _state = const StaffJourneyState.loading();
  int _todayGeneration = 0;
  int _rosterGeneration = 0;
  bool _disposed = false;

  StaffJourneyState get state => _state;

  Future<void> initialize() async {
    final generation = ++_todayGeneration;
    _rosterGeneration++;
    _set(const StaffJourneyState.loading());
    try {
      final today = await _repository.loadToday(_session);
      if (!_isCurrentToday(generation)) return;
      _set(StaffJourneyState.ready(today: today));
    } on Object catch (error) {
      if (_isCurrentToday(generation)) {
        _set(StaffJourneyState.failed(_reasonCode(error)));
      }
    }
  }

  Future<void> loadRoster(String meetingId) async {
    final today = _state.today;
    if (today == null) return;
    final meeting = today.meetings.where(
      (candidate) => candidate.meetingId == meetingId,
    );
    if (meeting.isEmpty) {
      _set(
        StaffJourneyState.ready(
          rosterReasonCode: 'TEACHER_MEETING_NOT_ASSIGNED',
          today: today,
        ),
      );
      return;
    }

    final generation = ++_rosterGeneration;
    _set(
      StaffJourneyState.ready(
        activeRoster: _state.activeRoster,
        rosterLoading: true,
        today: today,
      ),
    );
    try {
      final roster = await _repository.loadRoster(
        meetingId: meetingId,
        session: _session,
      );
      if (!_isCurrentRoster(generation)) return;
      if (roster.meetingId != meetingId ||
          roster.sectionId != meeting.single.sectionId) {
        throw const TeacherDomainException('TEACHER_ROSTER_SCOPE_MISMATCH');
      }
      _set(StaffJourneyState.ready(activeRoster: roster, today: today));
    } on Object catch (error) {
      if (_isCurrentRoster(generation)) {
        _set(
          StaffJourneyState.ready(
            rosterReasonCode: _reasonCode(error),
            today: today,
          ),
        );
      }
    }
  }

  Future<void> updateSession(SchoolSession session) async {
    if (_sameScope(_session, session)) return;
    _session = session;
    await initialize();
  }

  bool _sameScope(SchoolSession first, SchoolSession second) =>
      first.tenantId == second.tenantId &&
      first.campusId == second.campusId &&
      first.activePersona == second.activePersona &&
      setEquals(first.capabilities, second.capabilities);

  String _reasonCode(Object error) {
    if (error is TeacherDomainException) return error.code;
    if (error is SchoolApiException) return error.code;
    return 'TEACHER_JOURNEY_UNAVAILABLE';
  }

  bool _isCurrentToday(int generation) =>
      !_disposed && generation == _todayGeneration;

  bool _isCurrentRoster(int generation) =>
      !_disposed && generation == _rosterGeneration;

  void _set(StaffJourneyState next) {
    if (_disposed) return;
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _todayGeneration++;
    _rosterGeneration++;
    super.dispose();
  }
}
