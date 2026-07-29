#!/usr/bin/env python3
"""Wire repository-driven Staff production journeys deterministically."""

from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old in source:
        return source.replace(old, new, 1)
    if new in source:
        return source
    raise SystemExit(f'Unexpected Staff production declaration shape: {label}')


main_path = Path(__file__).resolve().parents[1] / 'apps/staff_app/lib/main.dart'
main = main_path.read_text(encoding='utf-8')
managed_imports = [
    "import 'package:school_api_client/school_api_client.dart';",
    "import 'package:school_api_client/teacher_mobile_api.dart';",
    "import 'package:school_app_bootstrap/school_app_bootstrap.dart';",
    "import 'package:school_authentication/school_authentication.dart';",
    "import 'package:school_design_system/school_design_system.dart';",
    "import 'package:school_mobile_core/mobile_core.dart';",
    "import 'package:school_staff_domain/school_staff_domain.dart';",
]
lines = [line for line in main.splitlines() if line not in set(managed_imports)]
anchor = "import 'package:go_router/go_router.dart';"
if anchor not in lines:
    raise SystemExit('STAFF_IMPORT_ANCHOR_REQUIRED')
index = lines.index(anchor) + 1
lines[index:index] = managed_imports
main = '\n'.join(lines) + '\n'

managed_parts = [
    "part 'production_app.dart';",
    "part 'staff_journey_controller.dart';",
    "part 'teacher_production_journeys.dart';",
]
lines = [line for line in main.splitlines() if line not in set(managed_parts)]
main_anchor = 'void main() {'
if main_anchor not in lines:
    raise SystemExit('STAFF_MAIN_ANCHOR_REQUIRED')
index = lines.index(main_anchor)
lines[index:index] = managed_parts + ['']
main_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')

path = Path(__file__).resolve().parents[1] / 'apps/staff_app/lib/production_app.dart'
source = path.read_text(encoding='utf-8')

source = replace_once(
    source,
    """  const StaffProductionApp({
    this.coordinator,
    this.initializeCoordinator = true,
    super.key,
  });

  final MobileAppCoordinator? coordinator;
  final bool initializeCoordinator;
""",
    """  const StaffProductionApp({
    this.coordinator,
    this.initializeCoordinator = true,
    this.repository,
    super.key,
  });

  final MobileAppCoordinator? coordinator;
  final bool initializeCoordinator;
  final TeacherJourneyRepository? repository;
""",
    'StaffProductionApp constructor',
)
source = replace_once(
    source,
    """        if (state.isReady && session != null) {
          return _AuthorizedStaffApp(
            coordinator: coordinator,
            session: session,
          );
        }
""",
    """        if (state.isReady && session != null) {
          final repository =
              widget.repository ??
              (coordinator.apiClient == null
                  ? null
                  : TeacherMobileApi(coordinator.apiClient!));
          if (repository == null) {
            return MaterialApp(
              debugShowCheckedModeBanner: false,
              home: const MobileConfigurationFailureScreen(
                appName: 'School Staff',
                reasonCode: 'TEACHER_REPOSITORY_CONFIGURATION_REQUIRED',
              ),
              theme: SchoolTheme.light(),
            );
          }
          return _AuthorizedStaffApp(
            coordinator: coordinator,
            repository: repository,
            session: session,
          );
        }
""",
    'ready repository composition',
)
source = replace_once(
    source,
    """class _AuthorizedStaffApp extends StatefulWidget {
  const _AuthorizedStaffApp({required this.coordinator, required this.session});

  final MobileAppCoordinator coordinator;
  final SchoolSession session;
""",
    """class _AuthorizedStaffApp extends StatefulWidget {
  const _AuthorizedStaffApp({
    required this.coordinator,
    required this.repository,
    required this.session,
  });

  final MobileAppCoordinator coordinator;
  final TeacherJourneyRepository repository;
  final SchoolSession session;
""",
    'authorized Staff widget',
)
source = replace_once(
    source,
    """class _AuthorizedStaffAppState extends State<_AuthorizedStaffApp> {
  late GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = _createRouter();
  }
""",
    """class _AuthorizedStaffAppState extends State<_AuthorizedStaffApp> {
  late StaffJourneyController _journey;
  late GoRouter _router;

  @override
  void initState() {
    super.initState();
    _journey = StaffJourneyController(
      repository: widget.repository,
      session: widget.session,
    );
    _router = _createRouter();
    unawaited(_journey.initialize());
  }
""",
    'authorized Staff state initialization',
)
source = replace_once(
    source,
    """  @override
  void didUpdateWidget(covariant _AuthorizedStaffApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.tenantId != widget.session.tenantId ||
        oldWidget.session.campusId != widget.session.campusId ||
        !setEquals(
          oldWidget.session.capabilities,
          widget.session.capabilities,
        )) {
      _router.dispose();
      _router = _createRouter();
    }
  }
""",
    """  @override
  void didUpdateWidget(covariant _AuthorizedStaffApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    final scopeChanged =
        oldWidget.session.tenantId != widget.session.tenantId ||
        oldWidget.session.campusId != widget.session.campusId ||
        oldWidget.session.activePersona != widget.session.activePersona ||
        !setEquals(
          oldWidget.session.capabilities,
          widget.session.capabilities,
        );
    final repositoryChanged = oldWidget.repository != widget.repository;
    if (repositoryChanged) {
      _journey.dispose();
      _journey = StaffJourneyController(
        repository: widget.repository,
        session: widget.session,
      );
      unawaited(_journey.initialize());
    } else if (scopeChanged) {
      unawaited(_journey.updateSession(widget.session));
    }
    if (repositoryChanged || scopeChanged) {
      _router.dispose();
      _router = _createRouter();
    }
  }
""",
    'authorized Staff update lifecycle',
)
source = replace_once(
    source,
    """            GoRoute(
              path: '/',
              builder: (context, state) =>
                  _AuthorizedStaffHomeScreen(session: session),
            ),
""",
    """            GoRoute(
              path: '/',
              builder: (context, state) => _TeacherTodayScreen(
                journey: _journey,
                session: session,
              ),
            ),
""",
    'teacher Today route',
)
source = replace_once(
    source,
    """            if (session.can(SchoolCapability.attendanceTake))
              GoRoute(
                path: '/attendance',
                builder: (context, state) => const StaffAttendanceScreen(),
              ),
""",
    """            if (session.can(SchoolCapability.attendanceTake))
              GoRoute(
                path: '/attendance',
                builder: (context, state) =>
                    _TeacherRosterScreen(journey: _journey),
              ),
""",
    'teacher roster route',
)
source = replace_once(
    source,
    """  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }
""",
    """  @override
  void dispose() {
    _router.dispose();
    _journey.dispose();
    super.dispose();
  }
""",
    'authorized Staff disposal',
)
path.write_text(source, encoding='utf-8')
print('Staff production journey wiring complete.')
