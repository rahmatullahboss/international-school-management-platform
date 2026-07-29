part of 'main.dart';

class FamilyProductionApp extends StatefulWidget {
  const FamilyProductionApp({
    this.coordinator,
    this.initializeCoordinator = true,
    super.key,
  });

  final MobileAppCoordinator? coordinator;
  final bool initializeCoordinator;

  @override
  State<FamilyProductionApp> createState() => _FamilyProductionAppState();
}

class _FamilyProductionAppState extends State<FamilyProductionApp> {
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
            allowedPersonas: const {
              SchoolPersona.guardian,
              SchoolPersona.student,
            },
            expectedRedirectScheme: 'ozzylschoolfamily',
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
          appName: 'School Family',
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
          return _AuthorizedFamilyApp(
            coordinator: coordinator,
            session: session,
          );
        }
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          home: MobileAccessGate(
            appName: 'School Family',
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

class _AuthorizedFamilyApp extends StatefulWidget {
  const _AuthorizedFamilyApp({
    required this.coordinator,
    required this.session,
  });

  final MobileAppCoordinator coordinator;
  final SchoolSession session;

  @override
  State<_AuthorizedFamilyApp> createState() => _AuthorizedFamilyAppState();
}

class _AuthorizedFamilyAppState extends State<_AuthorizedFamilyApp> {
  late GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = _createRouter();
  }

  @override
  void didUpdateWidget(covariant _AuthorizedFamilyApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.tenantId != widget.session.tenantId ||
        oldWidget.session.campusId != widget.session.campusId ||
        oldWidget.session.activePersona != widget.session.activePersona ||
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
    final routes = <RouteBase>[
      ShellRoute(
        builder: (context, state, child) => _AuthorizedFamilyShell(
          coordinator: widget.coordinator,
          location: state.uri.path,
          session: session,
          child: child,
        ),
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) =>
                _AuthorizedFamilyHomeScreen(session: session),
          ),
          if (session.can(SchoolCapability.attendanceRead))
            GoRoute(
              path: '/attendance',
              builder: (context, state) =>
                  _AuthorizedFamilyAttendanceScreen(session: session),
            ),
          if (session.can(SchoolCapability.gradesReadPublished))
            GoRoute(
              path: '/results',
              builder: (context, state) => const FamilyResultsScreen(),
            ),
          if (session.activePersona == SchoolPersona.guardian &&
              session.can(SchoolCapability.billingRead))
            GoRoute(
              path: '/fees',
              builder: (context, state) => const _AuthorizedFamilyFeesScreen(),
            ),
          if (session.can(SchoolCapability.messagesRead))
            GoRoute(
              path: '/messages',
              builder: (context, state) => const FamilyMessagesScreen(),
            ),
        ],
      ),
    ];
    return GoRouter(routes: routes);
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    debugShowCheckedModeBanner: false,
    routerConfig: _router,
    theme: SchoolTheme.light(),
    title: 'School Family',
  );

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }
}

class _AuthorizedFamilyShell extends StatelessWidget {
  const _AuthorizedFamilyShell({
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
  Widget build(BuildContext context) {
    final paths = <String>['/'];
    final destinations = <SchoolDestination>[
      const SchoolDestination(
        icon: Icons.home_outlined,
        label: 'Home',
        selectedIcon: Icons.home,
      ),
    ];
    if (session.can(SchoolCapability.attendanceRead)) {
      paths.add('/attendance');
      destinations.add(
        const SchoolDestination(
          icon: Icons.fact_check_outlined,
          label: 'Attendance',
          selectedIcon: Icons.fact_check,
        ),
      );
    }
    if (session.can(SchoolCapability.gradesReadPublished)) {
      paths.add('/results');
      destinations.add(
        const SchoolDestination(
          icon: Icons.school_outlined,
          label: 'Results',
          selectedIcon: Icons.school,
        ),
      );
    }
    if (session.activePersona == SchoolPersona.guardian &&
        session.can(SchoolCapability.billingRead)) {
      paths.add('/fees');
      destinations.add(
        const SchoolDestination(
          icon: Icons.receipt_long_outlined,
          label: 'Fees',
          selectedIcon: Icons.receipt_long,
        ),
      );
    }
    if (session.can(SchoolCapability.messagesRead)) {
      paths.add('/messages');
      destinations.add(
        const SchoolDestination(
          icon: Icons.forum_outlined,
          label: 'Messages',
          selectedIcon: Icons.forum,
        ),
      );
    }

    final availablePersonas = coordinator.state.accessOptions
        .where(
          (option) =>
              option.tenantId == session.tenantId &&
              option.campusId == session.campusId,
        )
        .map((option) => option.persona)
        .where(
          (persona) =>
              persona == SchoolPersona.guardian ||
              persona == SchoolPersona.student,
        )
        .toSet();

    return SchoolAdaptiveScaffold(
      actions: [
        if (availablePersonas.length > 1)
          PopupMenuButton<SchoolPersona>(
            icon: const Icon(Icons.switch_account_outlined),
            initialValue: session.activePersona,
            itemBuilder: (context) => availablePersonas
                .map(
                  (persona) => PopupMenuItem(
                    value: persona,
                    child: Text('${persona.label} profile'),
                  ),
                )
                .toList(growable: false),
            onSelected: coordinator.switchPersona,
            tooltip: 'Switch profile',
          ),
        IconButton(
          icon: const Icon(Icons.logout),
          onPressed: () => unawaited(coordinator.signOut()),
          tooltip: 'Sign out',
        ),
      ],
      body: child,
      destinations: destinations,
      onDestinationSelected: (index) => context.go(paths[index]),
      selectedIndex: paths.indexOf(location).clamp(0, paths.length - 1).toInt(),
      status: const SchoolStatusBanner(
        label: 'Authorized session',
        message: 'Published information follows the selected school access.',
        tone: SchoolStatusTone.success,
      ),
      title: 'School Family · ${session.activePersona.label}',
    );
  }
}

class _AuthorizedFamilyHomeScreen extends StatelessWidget {
  const _AuthorizedFamilyHomeScreen({required this.session});

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

    if (session.can(SchoolCapability.attendanceRead)) {
      addLink(
        icon: Icons.fact_check_outlined,
        label: 'Review attendance',
        path: '/attendance',
        supporting: 'Published and finalized sessions only',
      );
    }
    if (session.can(SchoolCapability.gradesReadPublished)) {
      addLink(
        icon: Icons.school_outlined,
        label: 'View published results',
        path: '/results',
        supporting: 'Academic calculations remain server-governed',
      );
    }
    if (session.activePersona == SchoolPersona.guardian &&
        session.can(SchoolCapability.billingRead)) {
      addLink(
        icon: Icons.receipt_long_outlined,
        label: 'Review fees and receipts',
        path: '/fees',
        supporting: 'Issued invoices and allocated payments',
      );
    }
    if (session.can(SchoolCapability.messagesRead)) {
      addLink(
        icon: Icons.forum_outlined,
        label: 'Open messages',
        path: '/messages',
        supporting: 'Authorized school conversations',
      );
    }

    return ListView(
      children: [
        SchoolPageSection(
          description:
              'School and role access is loaded from your verified account.',
          title: session.activePersona == SchoolPersona.guardian
              ? 'Family overview'
              : 'My school day',
          child: SchoolPanel(
            child: links.isEmpty
                ? const SchoolStatusBanner(
                    label: 'No mobile journeys assigned',
                    message:
                        'Your account is valid, but no supported Family app capability is currently available.',
                    tone: SchoolStatusTone.information,
                  )
                : Column(children: links),
          ),
        ),
      ],
    );
  }
}

class _AuthorizedFamilyAttendanceScreen extends StatelessWidget {
  const _AuthorizedFamilyAttendanceScreen({required this.session});

  final SchoolSession session;

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      SchoolPageSection(
        description:
            'Published sessions only. Approved corrections may change these totals.',
        title: session.activePersona == SchoolPersona.guardian
            ? 'Student attendance'
            : 'My attendance',
        child: const SchoolPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('96% present'),
              Divider(height: SchoolSpacing.lg),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.check_circle_outline),
                title: Text('Present · 48 sessions'),
                subtitle: Text('Source: finalized attendance sessions'),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.access_time_outlined),
                title: Text('Late · 1 session'),
                subtitle: Text('Corrected by the attendance office'),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.event_busy_outlined),
                title: Text('Absent · 1 session'),
                subtitle: Text('Notice acknowledged'),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

class _AuthorizedFamilyFeesScreen extends StatelessWidget {
  const _AuthorizedFamilyFeesScreen();

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      SchoolPageSection(
        description:
            'Balance is derived from issued invoices and allocated payments.',
        title: 'Fees and receipts',
        child: SchoolPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Outstanding · BDT 4,500',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: SchoolSpacing.xs),
              const Text('Invoice INV-2026-0719 · Tuition installment'),
              const Divider(height: SchoolSpacing.lg),
              const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.receipt_outlined),
                title: Text('Last receipt · BDT 4,500'),
                subtitle: Text('Allocated receipt RCPT-1042'),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
