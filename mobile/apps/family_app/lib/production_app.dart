part of 'main.dart';

class FamilyProductionApp extends StatefulWidget {
  const FamilyProductionApp({
    this.coordinator,
    this.initializeCoordinator = true,
    this.interactionRepository,
    this.repository,
    super.key,
  });

  final MobileAppCoordinator? coordinator;
  final bool initializeCoordinator;
  final FamilyInteractionRepository? interactionRepository;
  final FamilyReadRepository? repository;

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
          final apiClient = coordinator.apiClient;
          final repository =
              widget.repository ??
              (apiClient == null ? null : FamilyReadApi(apiClient));
          final interactionRepository =
              widget.interactionRepository ??
              (apiClient == null
                  ? null
                  : FamilyInteractionApiRepository(
                      FamilyInteractionApi(apiClient),
                    ));
          if (repository == null) {
            return MaterialApp(
              debugShowCheckedModeBanner: false,
              home: const MobileConfigurationFailureScreen(
                appName: 'School Family',
                reasonCode: 'FAMILY_REPOSITORY_CONFIGURATION_REQUIRED',
              ),
              theme: SchoolTheme.light(),
            );
          }
          return _AuthorizedFamilyApp(
            coordinator: coordinator,
            interactionRepository: interactionRepository,
            repository: repository,
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
    required this.repository,
    this.interactionRepository,
    required this.session,
  });

  final MobileAppCoordinator coordinator;
  final FamilyInteractionRepository? interactionRepository;
  final FamilyReadRepository repository;
  final SchoolSession session;

  @override
  State<_AuthorizedFamilyApp> createState() => _AuthorizedFamilyAppState();
}

class _AuthorizedFamilyAppState extends State<_AuthorizedFamilyApp> {
  FamilyInteractionController? _interactions;
  late FamilyJourneyController _journey;
  late GoRouter _router;

  @override
  void initState() {
    super.initState();
    _journey = FamilyJourneyController(
      repository: widget.repository,
      session: widget.session,
    );
    final interactionRepository = widget.interactionRepository;
    if (interactionRepository != null) {
      _interactions = FamilyInteractionController(
        repository: interactionRepository,
        session: widget.session,
      );
    }
    _router = _createRouter();
    unawaited(_journey.initialize());
  }

  @override
  void didUpdateWidget(covariant _AuthorizedFamilyApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    final scopeChanged = !_sameSession(oldWidget.session, widget.session);
    final interactionChanged =
        oldWidget.interactionRepository != widget.interactionRepository;
    if (oldWidget.repository != widget.repository) {
      _journey.dispose();
      _journey = FamilyJourneyController(
        repository: widget.repository,
        session: widget.session,
      );
      unawaited(_journey.initialize());
    } else if (scopeChanged) {
      unawaited(_journey.updateSession(widget.session));
    }
    if (interactionChanged) {
      _interactions?.dispose();
      final interactionRepository = widget.interactionRepository;
      _interactions = interactionRepository == null
          ? null
          : FamilyInteractionController(
              repository: interactionRepository,
              session: widget.session,
            );
    } else if (scopeChanged && widget.interactionRepository != null) {
      _interactions?.updateScope(
        repository: widget.interactionRepository!,
        session: widget.session,
      );
    }
    if (scopeChanged || interactionChanged) {
      _router.dispose();
      _router = _createRouter();
    }
  }

  bool _sameSession(SchoolSession first, SchoolSession second) =>
      first.tenantId == second.tenantId &&
      first.campusId == second.campusId &&
      first.activePersona == second.activePersona &&
      setEquals(first.capabilities, second.capabilities);

  GoRouter _createRouter() {
    final interactions = _interactions;
    final session = widget.session;
    return GoRouter(
      routes: [
        ShellRoute(
          builder: (context, state, child) => _AuthorizedFamilyShell(
            coordinator: widget.coordinator,
            interactionsAvailable: interactions != null,
            journey: _journey,
            location: state.uri.path,
            session: session,
            child: child,
          ),
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => _FamilyHomeScreen(
                interactionsAvailable: interactions != null,
                journey: _journey,
                session: session,
              ),
            ),
            if (session.can(SchoolCapability.attendanceRead))
              GoRoute(
                path: '/attendance',
                builder: (context, state) => _FamilyAttendanceScreen(
                  journey: _journey,
                  session: session,
                ),
              ),
            if (session.can(SchoolCapability.gradesReadPublished))
              GoRoute(
                path: '/results',
                builder: (context, state) =>
                    _FamilyResultsReadScreen(journey: _journey),
              ),
            if (session.activePersona == SchoolPersona.guardian &&
                session.can(SchoolCapability.billingRead))
              GoRoute(
                path: '/fees',
                builder: (context, state) =>
                    _FamilyFeesReadScreen(journey: _journey),
              ),
            if (interactions != null &&
                (session.can(SchoolCapability.documentsRead) ||
                    session.can(SchoolCapability.formsConsent)))
              GoRoute(
                path: '/services',
                builder: (context, state) => _FamilyServicesScreen(
                  interactions: interactions,
                  journey: _journey,
                  session: session,
                ),
              ),
            if (interactions != null &&
                session.can(SchoolCapability.documentsRead))
              GoRoute(
                path: '/documents',
                builder: (context, state) => _FamilyDocumentsScreen(
                  interactions: interactions,
                  journey: _journey,
                ),
              ),
            if (interactions != null &&
                session.can(SchoolCapability.formsConsent)) ...[
              GoRoute(
                path: '/forms',
                builder: (context, state) => _FamilyFormsScreen(
                  interactions: interactions,
                  journey: _journey,
                ),
              ),
              GoRoute(
                path: '/forms/:formId',
                builder: (context, state) => _FamilyFormScreen(
                  formId: state.pathParameters['formId']!,
                  interactions: interactions,
                  journey: _journey,
                ),
              ),
              if (session.activePersona == SchoolPersona.guardian)
                GoRoute(
                  path: '/consents',
                  builder: (context, state) => _FamilyConsentsScreen(
                    interactions: interactions,
                    journey: _journey,
                  ),
                ),
            ],
            if (session.can(SchoolCapability.messagesRead))
              GoRoute(
                path: '/messages',
                builder: (context, state) =>
                    _FamilyMessagesReadScreen(journey: _journey),
              ),
            if (interactions != null &&
                session.can(SchoolCapability.messagesRead)) ...[
              GoRoute(
                path: '/conversations',
                builder: (context, state) => _FamilyConversationsScreen(
                  interactions: interactions,
                  journey: _journey,
                ),
              ),
              GoRoute(
                path: '/conversations/:conversationId',
                builder: (context, state) => _FamilyConversationScreen(
                  conversationId: state.pathParameters['conversationId']!,
                  interactions: interactions,
                  journey: _journey,
                  session: session,
                ),
              ),
            ],
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
    title: 'School Family',
  );

  @override
  void dispose() {
    _router.dispose();
    _journey.dispose();
    super.dispose();
  }
}

class _AuthorizedFamilyShell extends StatelessWidget {
  const _AuthorizedFamilyShell({
    required this.child,
    required this.coordinator,
    required this.interactionsAvailable,
    required this.journey,
    required this.location,
    required this.session,
  });

  final Widget child;
  final MobileAppCoordinator coordinator;
  final bool interactionsAvailable;
  final FamilyJourneyController journey;
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
    if (interactionsAvailable &&
        (session.can(SchoolCapability.documentsRead) ||
            session.can(SchoolCapability.formsConsent))) {
      paths.add('/services');
      destinations.add(
        const SchoolDestination(
          icon: Icons.dashboard_customize_outlined,
          label: 'Services',
          selectedIcon: Icons.dashboard_customize,
        ),
      );
    }
    if (session.can(SchoolCapability.messagesRead)) {
      paths.add(interactionsAvailable ? '/conversations' : '/messages');
      destinations.add(
        SchoolDestination(
          icon: Icons.forum_outlined,
          label: interactionsAvailable ? 'Conversations' : 'Messages',
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

    return AnimatedBuilder(
      animation: journey,
      builder: (context, _) {
        final directory = journey.state.directory;
        return SchoolAdaptiveScaffold(
          actions: [
            if (directory != null && directory.students.length > 1)
              PopupMenuButton<String>(
                icon: const Icon(Icons.people_outline),
                initialValue: directory.activeStudentId,
                itemBuilder: (context) => directory.students
                    .map(
                      (student) => PopupMenuItem(
                        value: student.studentId,
                        child: Text(
                          '${student.displayName} · ${student.gradeLabel}',
                        ),
                      ),
                    )
                    .toList(growable: false),
                onSelected: (studentId) =>
                    unawaited(journey.selectStudent(studentId)),
                tooltip: 'Switch student',
              ),
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
                tooltip: 'Switch role',
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
          selectedIndex: paths
              .indexOf(location)
              .clamp(0, paths.length - 1)
              .toInt(),
          status: _journeyStatus(journey.state),
          title: 'School Family · ${session.activePersona.label}',
        );
      },
    );
  }

  Widget _journeyStatus(FamilyJourneyState state) => switch (state.phase) {
    FamilyJourneyPhase.loading => const SchoolStatusBanner(
      label: 'Loading published information',
      message: 'The selected school profile is being refreshed.',
      tone: SchoolStatusTone.information,
    ),
    FamilyJourneyPhase.ready => SchoolStatusBanner(
      label: 'Published information',
      message:
          'Showing ${state.directory!.activeStudent.displayName} · ${state.directory!.activeStudent.gradeLabel}',
      tone: SchoolStatusTone.success,
    ),
    FamilyJourneyPhase.failed => const SchoolStatusBanner(
      label: 'Information unavailable',
      message: 'No cached academic or financial values are being substituted.',
      tone: SchoolStatusTone.error,
    ),
  };
}

class _FamilyJourneyView extends StatelessWidget {
  const _FamilyJourneyView({required this.builder, required this.journey});

  final Widget Function(
    BuildContext context,
    FamilyProfileDirectory directory,
    FamilyDashboardReadModel dashboard,
  )
  builder;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: journey,
    builder: (context, _) {
      final state = journey.state;
      switch (state.phase) {
        case FamilyJourneyPhase.loading:
          return const Center(child: CircularProgressIndicator());
        case FamilyJourneyPhase.failed:
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Published information could not be verified for this profile.',
                title: 'Unable to load Family information',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SchoolStatusBanner(
                        label: 'No substitute values shown',
                        message:
                            'Academic and financial values remain hidden until the authorized service responds.',
                        tone: SchoolStatusTone.error,
                      ),
                      const SizedBox(height: SchoolSpacing.md),
                      FilledButton.icon(
                        icon: const Icon(Icons.refresh),
                        label: const Text('Try again'),
                        onPressed: () => unawaited(journey.initialize()),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        case FamilyJourneyPhase.ready:
          return builder(context, state.directory!, state.dashboard!);
      }
    },
  );
}

class _FamilyHomeScreen extends StatelessWidget {
  const _FamilyHomeScreen({
    required this.interactionsAvailable,
    required this.journey,
    required this.session,
  });

  final bool interactionsAvailable;
  final FamilyJourneyController journey;
  final SchoolSession session;

  @override
  Widget build(BuildContext context) => _FamilyJourneyView(
    journey: journey,
    builder: (context, directory, dashboard) {
      final links = <Widget>[];
      void addLink(
        IconData icon,
        String label,
        String path,
        String supporting,
      ) {
        if (links.isNotEmpty) links.add(const Divider());
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

      if (dashboard.attendance != null) {
        addLink(
          Icons.fact_check_outlined,
          'Review attendance',
          '/attendance',
          dashboard.attendance!.summaryLabel,
        );
      }
      if (dashboard.publishedResults.isNotEmpty) {
        addLink(
          Icons.school_outlined,
          'View published results',
          '/results',
          '${dashboard.publishedResults.length} published result(s)',
        );
      }
      if (dashboard.fees != null) {
        addLink(
          Icons.receipt_long_outlined,
          'Review fees and receipts',
          '/fees',
          'Invoice ${dashboard.fees!.invoiceReference}',
        );
      }
      if (interactionsAvailable &&
          (session.can(SchoolCapability.documentsRead) ||
              session.can(SchoolCapability.formsConsent))) {
        addLink(
          Icons.dashboard_customize_outlined,
          'Documents and forms',
          '/services',
          'Capability-scoped Family services',
        );
      }
      if (dashboard.messages != null) {
        addLink(
          Icons.forum_outlined,
          interactionsAvailable ? 'Open conversations' : 'Open messages',
          interactionsAvailable ? '/conversations' : '/messages',
          '${dashboard.messages!.unreadCount} unread message(s)',
        );
      }

      return ListView(
        children: [
          SchoolPageSection(
            description:
                '${dashboard.student.gradeLabel} · ${dashboard.student.relationshipLabel}',
            title: dashboard.student.displayName,
            child: SchoolPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Today’s timetable',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: SchoolSpacing.sm),
                  if (dashboard.timetable.isEmpty)
                    const Text('No published timetable items.')
                  else
                    for (final item in dashboard.timetable)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.schedule_outlined),
                        title: Text(item.subjectLabel),
                        subtitle: Text(item.locationLabel),
                      ),
                  if (links.isNotEmpty) const Divider(),
                  ...links,
                ],
              ),
            ),
          ),
        ],
      );
    },
  );
}

class _FamilyAttendanceScreen extends StatelessWidget {
  const _FamilyAttendanceScreen({required this.journey, required this.session});

  final FamilyJourneyController journey;
  final SchoolSession session;

  @override
  Widget build(BuildContext context) => _FamilyJourneyView(
    journey: journey,
    builder: (context, directory, dashboard) {
      final attendance = dashboard.attendance;
      return ListView(
        children: [
          SchoolPageSection(
            description:
                'Published sessions only. Approved corrections may change these totals.',
            title: session.activePersona == SchoolPersona.guardian
                ? '${dashboard.student.displayName} attendance'
                : 'My attendance',
            child: SchoolPanel(
              child: attendance == null
                  ? const Text('No published attendance summary is available.')
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          attendance.summaryLabel,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const Divider(height: SchoolSpacing.lg),
                        _countTile(
                          Icons.check_circle_outline,
                          'Present',
                          attendance.presentSessions,
                        ),
                        _countTile(
                          Icons.access_time_outlined,
                          'Late',
                          attendance.lateSessions,
                        ),
                        _countTile(
                          Icons.event_busy_outlined,
                          'Absent',
                          attendance.absentSessions,
                        ),
                        Text(
                          'Total finalized sessions · ${attendance.totalSessions}',
                        ),
                      ],
                    ),
            ),
          ),
        ],
      );
    },
  );

  Widget _countTile(IconData icon, String label, int count) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(icon),
    title: Text('$label · $count session(s)'),
  );
}

class _FamilyResultsReadScreen extends StatelessWidget {
  const _FamilyResultsReadScreen({required this.journey});

  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyJourneyView(
    journey: journey,
    builder: (context, directory, dashboard) => ListView(
      children: [
        SchoolPageSection(
          description:
              'Only results released by the academic publication workflow are shown.',
          title: '${dashboard.student.displayName} · Published results',
          child: SchoolPanel(
            child: dashboard.publishedResults.isEmpty
                ? const Text('No published results are available.')
                : Column(
                    children: [
                      for (final result in dashboard.publishedResults)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.verified_outlined),
                          title: Text(
                            '${result.subjectLabel} · ${result.gradeLabel}',
                          ),
                          subtitle: Text(result.assessmentLabel),
                        ),
                    ],
                  ),
          ),
        ),
      ],
    ),
  );
}

class _FamilyFeesReadScreen extends StatelessWidget {
  const _FamilyFeesReadScreen({required this.journey});

  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyJourneyView(
    journey: journey,
    builder: (context, directory, dashboard) {
      final fees = dashboard.fees;
      return ListView(
        children: [
          SchoolPageSection(
            description:
                'Amounts come from issued invoices and allocated receipts.',
            title: 'Fees and receipts',
            child: SchoolPanel(
              child: fees == null
                  ? const Text('No fee summary is available for this profile.')
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Outstanding · ${_moneyLabel(fees.outstanding)}',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: SchoolSpacing.xs),
                        Text('Invoice ${fees.invoiceReference}'),
                        if (fees.lastReceipt != null) ...[
                          const Divider(height: SchoolSpacing.lg),
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.receipt_outlined),
                            title: Text(
                              'Last receipt · ${_moneyLabel(fees.lastReceipt!)}',
                            ),
                            subtitle: Text(fees.lastReceiptReference!),
                          ),
                        ],
                      ],
                    ),
            ),
          ),
        ],
      );
    },
  );

  String _moneyLabel(FamilyMoneyAmount amount) {
    final major = amount.minorUnits ~/ 100;
    final fraction = (amount.minorUnits % 100).toString().padLeft(2, '0');
    return '${amount.currencyCode} $major.$fraction';
  }
}

class _FamilyMessagesReadScreen extends StatelessWidget {
  const _FamilyMessagesReadScreen({required this.journey});

  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyJourneyView(
    journey: journey,
    builder: (context, directory, dashboard) {
      final messages = dashboard.messages;
      return ListView(
        children: [
          SchoolPageSection(
            description:
                'Conversation access follows school relationship permissions.',
            title: 'Messages',
            child: SchoolPanel(
              child: messages == null
                  ? const Text('No message summary is available.')
                  : ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.mark_email_unread_outlined),
                      title: Text('${messages.unreadCount} unread message(s)'),
                      subtitle: const Text(
                        'Open conversation data will be added through the server-owned messaging contract.',
                      ),
                    ),
            ),
          ),
        ],
      );
    },
  );
}
