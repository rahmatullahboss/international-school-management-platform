part of 'main.dart';

enum FamilyJourneyPhase { loading, ready, failed }

final class FamilyJourneyState {
  const FamilyJourneyState._({
    required this.phase,
    this.dashboard,
    this.directory,
    this.reasonCode,
  });

  const FamilyJourneyState.loading({
    FamilyDashboardReadModel? dashboard,
    FamilyProfileDirectory? directory,
  }) : this._(
         dashboard: dashboard,
         directory: directory,
         phase: FamilyJourneyPhase.loading,
       );

  const FamilyJourneyState.failed(String reasonCode)
    : this._(phase: FamilyJourneyPhase.failed, reasonCode: reasonCode);

  const FamilyJourneyState.ready({
    required FamilyDashboardReadModel dashboard,
    required FamilyProfileDirectory directory,
  }) : this._(
         dashboard: dashboard,
         directory: directory,
         phase: FamilyJourneyPhase.ready,
       );

  final FamilyJourneyPhase phase;
  final FamilyProfileDirectory? directory;
  final FamilyDashboardReadModel? dashboard;
  final String? reasonCode;
}

final class FamilyJourneyController extends ChangeNotifier {
  FamilyJourneyController({
    required FamilyReadRepository repository,
    required SchoolSession session,
  }) : _repository = repository,
       _session = session;

  final FamilyReadRepository _repository;
  SchoolSession _session;
  FamilyJourneyState _state = const FamilyJourneyState.loading();
  int _generation = 0;
  bool _disposed = false;

  FamilyJourneyState get state => _state;

  Future<void> initialize() async {
    final generation = ++_generation;
    _set(const FamilyJourneyState.loading());
    try {
      final directory = await _repository.loadProfiles(_session);
      if (!_isCurrent(generation)) return;
      _set(FamilyJourneyState.loading(directory: directory));
      await _loadDashboard(directory, generation);
    } on Object catch (error) {
      _failIfCurrent(generation, error);
    }
  }

  Future<void> selectStudent(String studentId) async {
    final current = _state.directory;
    if (current == null) return initialize();
    final generation = ++_generation;
    try {
      final selected = current.select(studentId);
      _set(
        FamilyJourneyState.loading(
          dashboard: _state.dashboard,
          directory: selected,
        ),
      );
      await _loadDashboard(selected, generation);
    } on Object catch (error) {
      _failIfCurrent(generation, error);
    }
  }

  Future<void> updateSession(SchoolSession session) async {
    if (_sameScope(_session, session)) return;
    _session = session;
    await initialize();
  }

  Future<void> _loadDashboard(
    FamilyProfileDirectory directory,
    int generation,
  ) async {
    final dashboard = await _repository.loadDashboard(
      session: _session,
      studentId: directory.activeStudentId,
    );
    if (!_isCurrent(generation)) return;
    if (dashboard.student.studentId != directory.activeStudentId) {
      throw const FamilyDomainException('FAMILY_DASHBOARD_PROFILE_MISMATCH');
    }
    _set(FamilyJourneyState.ready(dashboard: dashboard, directory: directory));
  }

  bool _sameScope(SchoolSession first, SchoolSession second) =>
      first.tenantId == second.tenantId &&
      first.campusId == second.campusId &&
      first.activePersona == second.activePersona &&
      setEquals(first.capabilities, second.capabilities);

  void _failIfCurrent(int generation, Object error) {
    if (_isCurrent(generation)) {
      _set(FamilyJourneyState.failed(_reasonCode(error)));
    }
  }

  String _reasonCode(Object error) {
    if (error is FamilyDomainException) return error.code;
    if (error is SchoolApiException) return error.code;
    return 'FAMILY_JOURNEY_UNAVAILABLE';
  }

  bool _isCurrent(int generation) => !_disposed && generation == _generation;

  void _set(FamilyJourneyState next) {
    if (_disposed) return;
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    super.dispose();
  }
}
