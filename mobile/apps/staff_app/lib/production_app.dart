part of 'main.dart';

class StaffProductionApp extends StatefulWidget {
  const StaffProductionApp({
    this.coordinator,
    this.initializeCoordinator = true,
    super.key,
  });

  final MobileAppCoordinator? coordinator;
  final bool initializeCoordinator;

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
          return _AuthorizedStaffApp(
            coordinator: coordinator,
            session: session,
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
    required this.session,
  });

  final MobileAppCoordinator coordinator;
  final SchoolSession session;

  @override
  State<_AuthorizedStaffApp> createState() => _AuthorizedStaffAppState();
}

class _AuthorizedStaffAppState extends State<_AuthorizedStaffApp> {
  late GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = _createRouter();
  }

  @override
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

  GoRouter _createRouter() {
    final session = widget.session;
    return GoRouter(
      routes: [
        ShellRoute(
          builder: (context, state, child) => _AuthorizedStaffShell(
            child: child,
            coordinator: widget.coordinator,
            location: state.uri.path,
            session: session,
          ),
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) =>
                  _AuthorizedStaffHomeScreen(session: session),
            ),
            if (session.can(SchoolCapability.attendanceTake))
              GoRoute(
                path: '/attendance',
                builder: (context, state) => const StaffAttendanceScreen(),
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
    _router.dispose();
    super.dispose();
  }
}

class _AuthorizedStaffShell extends ConsumerWidget {
  const _AuthorizedStaffShell({
    required this.child,
    required this.coordinator,
    required this.location,
    required this.session,
  });

  final Widget child;
  final MobileAppCoordinator coordinator;
  final String location;
  final SchoolSession session;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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

    final pendingCount = ref.watch(
      attendanceDraftProvider.select((state) => state.pendingCount),
    );
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
      selectedIndex: paths.indexOf(location).clamp(0, paths.length - 1),
      status: pendingCount == 0
          ? const SchoolStatusBanner(
              label: 'Authorized session',
              message: 'No attendance changes are waiting on this device.',
              tone: SchoolStatusTone.success,
            )
          : SchoolStatusBanner(
              label: 'Saved on device',
              message:
                  '$pendingCount attendance change(s) are waiting to sync.',
              tone: SchoolStatusTone.warning,
            ),
      title: 'School Staff · Teacher',
    );
  }
}

class _AuthorizedStaffHomeScreen extends StatelessWidget {
  const _AuthorizedStaffHomeScreen({required this.session});

  final SchoolSession session;

  @override
  Widget build(BuildContext context) {
    final links = <Widget>[];
    void addLink({
      required IconData icon,
      required String label,
      required String path,
      required String supporting,
    }) {
      if (links.isNotEmpty) {
        links.add(const Divider());
      }
      links.add(
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon),
          onTap: () => context.go(path),
          subtitle: Text(supporting),
          title: Text(label),
          trailing: const Icon(Icons.chevron_right),
        ),
      );
    }

    if (session.can(SchoolCapability.attendanceTake)) {
      addLink(
        icon: Icons.fact_check_outlined,
        label: 'Take attendance',
        path: '/attendance',
        supporting: 'Local draft capture is available',
      );
    }
    if (session.can(SchoolCapability.gradesWrite)) {
      addLink(
        icon: Icons.edit_note_outlined,
        label: 'Open gradebook drafts',
        path: '/gradebook',
        supporting: 'Publishing remains server-governed',
      );
    }
    if (session.can(SchoolCapability.messagesRead) ||
        session.can(SchoolCapability.messagesSend)) {
      addLink(
        icon: Icons.forum_outlined,
        label: 'Open messages',
        path: '/messages',
        supporting: 'Class and relationship permissions apply',
      );
    }

    return ListView(
      children: [
        SchoolPageSection(
          description:
              'Operational tasks are limited to capabilities granted by the selected school campus.',
          title: 'Teacher day',
          child: SchoolPanel(
            child: links.isEmpty
                ? const SchoolStatusBanner(
                    label: 'No mobile tasks assigned',
                    message:
                        'Your account is valid, but no supported Staff app capability is currently available.',
                    tone: SchoolStatusTone.information,
                  )
                : Column(children: links),
          ),
        ),
      ],
    );
  }
}
