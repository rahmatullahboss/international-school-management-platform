part of 'main.dart';

class StaffProductionApp extends StatefulWidget {
  const StaffProductionApp({
    this.coordinator,
    this.initializeCoordinator = true,
    this.notificationSource,
    this.onNotificationDecision,
    this.repository,
    this.syncRuntimeLoader,
    super.key,
  });

  final MobileAppCoordinator? coordinator;
  final bool initializeCoordinator;
  final MobileNotificationSource? notificationSource;
  final ValueChanged<MobileNotificationRouteDecision>? onNotificationDecision;
  final TeacherJourneyRepository? repository;
  final StaffSyncRuntimeLoader? syncRuntimeLoader;

  @override
  State<StaffProductionApp> createState() => _StaffProductionAppState();
}

class _StaffProductionAppState extends State<StaffProductionApp> {
  MobileAppCoordinator? _coordinator;
  String? _configurationReason;
  late final bool _ownsCoordinator;

  @override
  void initState() {
    super.initState();
    _ownsCoordinator = widget.coordinator == null;
    try {
      _coordinator =
          widget.coordinator ??
          MobileAppCoordinator.fromEnvironment(
            allowedPersonas: const {SchoolPersona.teacher},
            expectedRedirectScheme: 'ozzylschoolstaff',
          );
      if (widget.initializeCoordinator) {
        unawaited(_coordinator!.initialize());
      }
    } on MobileRuntimeConfigurationException catch (error) {
      _configurationReason = error.code;
    } on AuthException catch (error) {
      _configurationReason = error.code;
    } on Object {
      _configurationReason = 'MOBILE_CONFIGURATION_UNAVAILABLE';
    }
  }

  @override
  Widget build(BuildContext context) {
    final configurationReason = _configurationReason;
    if (configurationReason != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: MobileConfigurationFailureScreen(
          appName: 'School Staff',
          reasonCode: configurationReason,
        ),
        theme: SchoolTheme.light(),
      );
    }

    final coordinator = _coordinator!;
    return AnimatedBuilder(
      animation: coordinator,
      builder: (context, child) {
        final state = coordinator.state;
        final session = state.session;
        if (state.isReady && session != null) {
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
            notificationSource: widget.notificationSource,
            onNotificationDecision: widget.onNotificationDecision,
            repository: repository,
            session: session,
            syncRuntimeLoader: widget.syncRuntimeLoader,
          );
        }
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          home: MobileAccessGate(
            appName: 'School Staff',
            onRetry: coordinator.initialize,
            onSelectAccess: coordinator.selectAccess,
            onSignIn: coordinator.signIn,
            onSignOut: coordinator.signOut,
            state: state,
          ),
          theme: SchoolTheme.light(),
        );
      },
    );
  }

  @override
  void dispose() {
    if (_ownsCoordinator) {
      _coordinator?.dispose();
    }
    super.dispose();
  }
}

class _AuthorizedStaffApp extends StatefulWidget {
  const _AuthorizedStaffApp({
    required this.coordinator,
    this.notificationSource,
    this.onNotificationDecision,
    required this.repository,
    required this.session,
    this.syncRuntimeLoader,
  });

  final MobileAppCoordinator coordinator;
  final MobileNotificationSource? notificationSource;
  final ValueChanged<MobileNotificationRouteDecision>? onNotificationDecision;
  final TeacherJourneyRepository repository;
  final SchoolSession session;
  final StaffSyncRuntimeLoader? syncRuntimeLoader;

  @override
  State<_AuthorizedStaffApp> createState() => _AuthorizedStaffAppState();
}

class _AuthorizedStaffAppState extends State<_AuthorizedStaffApp> {
  late StaffJourneyController _journey;
  final MobileNotificationOpenTracker _notificationTracker =
      MobileNotificationOpenTracker();
  StreamSubscription<MobileNotificationEnvelope>? _notificationSubscription;
  late GoRouter _router;
  late StaffAttendanceSyncController _sync;

  @override
  void initState() {
    super.initState();
    _journey = StaffJourneyController(
      repository: widget.repository,
      session: widget.session,
    );
    _sync = StaffAttendanceSyncController(
      repository: widget.repository,
      runtimeLoader: widget.syncRuntimeLoader,
      session: widget.session,
    );
    _router = _createRouter();
    _bindNotifications();
    unawaited(_journey.initialize());
    unawaited(_sync.initialize());
  }

  @override
  void didUpdateWidget(covariant _AuthorizedStaffApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    final scopeChanged =
        oldWidget.session.tenantId != widget.session.tenantId ||
        oldWidget.session.campusId != widget.session.campusId ||
        oldWidget.session.activePersona != widget.session.activePersona ||
        !setEquals(oldWidget.session.capabilities, widget.session.capabilities);
    final repositoryChanged = oldWidget.repository != widget.repository;
    final notificationSourceChanged =
        oldWidget.notificationSource != widget.notificationSource;
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
      unawaited(
        _sync.updateScope(
          repository: widget.repository,
          session: widget.session,
        ),
      );
      _router.dispose();
      _router = _createRouter();
    }
    if (scopeChanged) {
      _notificationTracker.clear();
    }
    if (notificationSourceChanged) {
      final subscription = _notificationSubscription;
      if (subscription != null) unawaited(subscription.cancel());
      _notificationSubscription = null;
      _notificationTracker.clear();
      _bindNotifications();
    }
  }

  void _bindNotifications() {
    final source = widget.notificationSource;
    if (source == null) return;
    _notificationSubscription = source.openedNotifications.listen(
      _handleNotification,
    );
    final initial = source.takeInitial();
    if (initial != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _handleNotification(initial);
      });
    }
  }

  void _handleNotification(MobileNotificationEnvelope envelope) {
    if (!_notificationTracker.claim(envelope.notificationId)) return;
    final decision = const MobileNotificationRouteResolver().resolve(
      application: MobileNotificationApplication.staff,
      envelope: envelope,
      session: widget.session,
    );
    widget.onNotificationDecision?.call(decision);
    final location = decision.location;
    if (mounted && location != null) _router.go(location);
  }

  GoRouter _createRouter() {
    final session = widget.session;
    return GoRouter(
      routes: [
        ShellRoute(
          builder: (context, state, child) => _AuthorizedStaffShell(
            coordinator: widget.coordinator,
            location: state.uri.path,
            session: session,
            sync: _sync,
            child: child,
          ),
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) =>
                  _TeacherTodayScreen(journey: _journey, session: session),
            ),
            if (session.can(SchoolCapability.attendanceTake))
              GoRoute(
                path: '/attendance',
                builder: (context, state) => _TeacherRosterScreen(
                  journey: _journey,
                  session: session,
                  sync: _sync,
                ),
              ),
            if (session.can(SchoolCapability.gradesWrite))
              GoRoute(
                path: '/gradebook',
                builder: (context, state) => const StaffGradebookScreen(),
              ),
            if (session.can(SchoolCapability.messagesRead) ||
                session.can(SchoolCapability.messagesSend))
              GoRoute(
                path: '/messages',
                builder: (context, state) => const StaffMessagesScreen(),
              ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    debugShowCheckedModeBanner: false,
    routerConfig: _router,
    theme: SchoolTheme.light(),
    title: 'School Staff',
  );

  @override
  void dispose() {
    final subscription = _notificationSubscription;
    if (subscription != null) unawaited(subscription.cancel());
    _router.dispose();
    _journey.dispose();
    _sync.dispose();
    super.dispose();
  }
}

class _AuthorizedStaffShell extends StatelessWidget {
  const _AuthorizedStaffShell({
    required this.child,
    required this.coordinator,
    required this.location,
    required this.session,
    required this.sync,
  });

  final Widget child;
  final MobileAppCoordinator coordinator;
  final String location;
  final SchoolSession session;
  final StaffAttendanceSyncController sync;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: sync,
    builder: (context, _) {
      final paths = <String>['/'];
      final destinations = <SchoolDestination>[
        const SchoolDestination(
          icon: Icons.home_outlined,
          label: 'Today',
          selectedIcon: Icons.home,
        ),
      ];
      if (session.can(SchoolCapability.attendanceTake)) {
        paths.add('/attendance');
        destinations.add(
          const SchoolDestination(
            icon: Icons.fact_check_outlined,
            label: 'Attendance',
            selectedIcon: Icons.fact_check,
          ),
        );
      }
      if (session.can(SchoolCapability.gradesWrite)) {
        paths.add('/gradebook');
        destinations.add(
          const SchoolDestination(
            icon: Icons.edit_note_outlined,
            label: 'Gradebook',
            selectedIcon: Icons.edit_note,
          ),
        );
      }
      if (session.can(SchoolCapability.messagesRead) ||
          session.can(SchoolCapability.messagesSend)) {
        paths.add('/messages');
        destinations.add(
          const SchoolDestination(
            icon: Icons.forum_outlined,
            label: 'Messages',
            selectedIcon: Icons.forum,
          ),
        );
      }

      final syncState = sync.state;
      final status = switch ((
        syncState.phase,
        syncState.attentionCount,
        syncState.pendingCount,
      )) {
        (StaffSyncPhase.failed, _, _) => SchoolStatusBanner(
          label: 'Sync unavailable',
          message:
              syncState.reasonCode ?? 'Attendance sync could not be verified.',
          tone: SchoolStatusTone.error,
        ),
        (_, final attention, _) when attention > 0 => SchoolStatusBanner(
          label: 'Review required',
          message: '$attention attendance operation(s) need reconciliation.',
          tone: SchoolStatusTone.error,
        ),
        (_, _, final pending) when pending > 0 => SchoolStatusBanner(
          label: 'Saved on device',
          message:
              '$pending encrypted attendance operation(s) are waiting to sync.',
          tone: SchoolStatusTone.warning,
        ),
        _ => const SchoolStatusBanner(
          label: 'Authorized session',
          message: 'No attendance operations are waiting on this device.',
          tone: SchoolStatusTone.success,
        ),
      };

      return SchoolAdaptiveScaffold(
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => unawaited(coordinator.signOut()),
            tooltip: 'Sign out',
          ),
        ],
        body: child,
        destinations: destinations,
        onDestinationSelected: (index) => context.go(paths[index]),
        selectedIndex: paths
            .indexOf(location)
            .clamp(0, paths.length - 1)
            .toInt(),
        status: status,
        title: 'School Staff · Teacher',
      );
    },
  );
}
