part of 'main.dart';

class FamilyProductionApp extends StatefulWidget {
  const FamilyProductionApp({
    this.coordinator,
    this.initializeCoordinator = true,
    this.interactionRepository,
    this.notificationSource,
    this.onNotificationDecision,
    this.repository,
    this.secureDocumentExchange,
    super.key,
  });

  final MobileAppCoordinator? coordinator;
  final bool initializeCoordinator;
  final FamilyInteractionRepository? interactionRepository;
  final MobileNotificationSource? notificationSource;
  final ValueChanged<MobileNotificationRouteDecision>? onNotificationDecision;
  final FamilyReadRepository? repository;
  final FamilySecureDocumentExchange? secureDocumentExchange;

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
        localeListResolutionCallback:
            SchoolLocalizationConfiguration.localeListResolutionCallback,
        localizationsDelegates:
            SchoolLocalizationConfiguration.localizationsDelegates,
        onGenerateTitle: (context) =>
            SchoolShellStrings.of(context).familyAppName,
        supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
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
              localeListResolutionCallback:
                  SchoolLocalizationConfiguration.localeListResolutionCallback,
              localizationsDelegates:
                  SchoolLocalizationConfiguration.localizationsDelegates,
              onGenerateTitle: (context) =>
                  SchoolShellStrings.of(context).familyAppName,
              supportedLocales:
                  SchoolLocalizationConfiguration.supportedLocales,
              theme: SchoolTheme.light(),
            );
          }
          return _AuthorizedFamilyApp(
            coordinator: coordinator,
            interactionRepository: interactionRepository,
            notificationSource: widget.notificationSource,
            onNotificationDecision: widget.onNotificationDecision,
            repository: repository,
            secureDocumentExchange: widget.secureDocumentExchange,
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
          localeListResolutionCallback:
              SchoolLocalizationConfiguration.localeListResolutionCallback,
          localizationsDelegates:
              SchoolLocalizationConfiguration.localizationsDelegates,
          onGenerateTitle: (context) =>
              SchoolShellStrings.of(context).familyAppName,
          supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
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
    this.notificationSource,
    this.onNotificationDecision,
    required this.session,
    this.secureDocumentExchange,
  });

  final MobileAppCoordinator coordinator;
  final FamilyInteractionRepository? interactionRepository;
  final MobileNotificationSource? notificationSource;
  final ValueChanged<MobileNotificationRouteDecision>? onNotificationDecision;
  final FamilyReadRepository repository;
  final SchoolSession session;
  final FamilySecureDocumentExchange? secureDocumentExchange;

  @override
  State<_AuthorizedFamilyApp> createState() => _AuthorizedFamilyAppState();
}

class _AuthorizedFamilyAppState extends State<_AuthorizedFamilyApp> {
  FamilyInteractionController? _interactions;
  late FamilyJourneyController _journey;
  final MobileNotificationOpenTracker _notificationTracker =
      MobileNotificationOpenTracker();
  StreamSubscription<MobileNotificationEnvelope>? _notificationSubscription;
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
        secureDocumentExchange: widget.secureDocumentExchange,
        session: widget.session,
      );
    }
    _router = _createRouter();
    _bindNotifications();
    unawaited(_journey.initialize());
  }

  @override
  void didUpdateWidget(covariant _AuthorizedFamilyApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    final scopeChanged = !_sameSession(oldWidget.session, widget.session);
    final interactionChanged =
        oldWidget.interactionRepository != widget.interactionRepository;
    final notificationSourceChanged =
        oldWidget.notificationSource != widget.notificationSource;
    final secureDocumentExchangeChanged =
        oldWidget.secureDocumentExchange != widget.secureDocumentExchange;
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
    if (interactionChanged || secureDocumentExchangeChanged) {
      _interactions?.dispose();
      final interactionRepository = widget.interactionRepository;
      _interactions = interactionRepository == null
          ? null
          : FamilyInteractionController(
              repository: interactionRepository,
              secureDocumentExchange: widget.secureDocumentExchange,
              session: widget.session,
            );
    } else if (scopeChanged && widget.interactionRepository != null) {
      _interactions?.updateScope(
        repository: widget.interactionRepository!,
        session: widget.session,
      );
    }
    if (scopeChanged || interactionChanged || secureDocumentExchangeChanged) {
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
    var decision = const MobileNotificationRouteResolver().resolve(
      application: MobileNotificationApplication.family,
      envelope: envelope,
      session: widget.session,
    );
    if (decision.isAllowed &&
        _requiresFamilyInteractions(envelope.kind) &&
        widget.interactionRepository == null) {
      decision = const MobileNotificationRouteDecision.blocked(
        MobileNotificationRouteStatus.routeUnavailable,
        'MOBILE_NOTIFICATION_INTERACTION_ROUTE_UNAVAILABLE',
      );
    }
    widget.onNotificationDecision?.call(decision);
    final location = decision.location;
    if (mounted && location != null) _router.go(location);
  }

  bool _requiresFamilyInteractions(MobileNotificationKind kind) =>
      switch (kind) {
        MobileNotificationKind.familyDocuments ||
        MobileNotificationKind.familyForms ||
        MobileNotificationKind.familyConsent ||
        MobileNotificationKind.familyConversation => true,
        _ => false,
      };

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
    localeListResolutionCallback:
        SchoolLocalizationConfiguration.localeListResolutionCallback,
    localizationsDelegates:
        SchoolLocalizationConfiguration.localizationsDelegates,
    onGenerateTitle: (context) => SchoolShellStrings.of(context).familyAppName,
    routerConfig: _router,
    supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
    theme: SchoolTheme.light(),
  );

  @override
  void dispose() {
    final subscription = _notificationSubscription;
    if (subscription != null) unawaited(subscription.cancel());
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
    final strings = SchoolShellStrings.of(context);
    final paths = <String>['/'];
    final destinations = <SchoolDestination>[
      SchoolDestination(
        icon: Icons.home_outlined,
        label: strings.home,
        selectedIcon: Icons.home,
      ),
    ];
    if (session.can(SchoolCapability.attendanceRead)) {
      paths.add('/attendance');
      destinations.add(
        SchoolDestination(
          icon: Icons.fact_check_outlined,
          label: strings.attendance,
          selectedIcon: Icons.fact_check,
        ),
      );
    }
    if (session.can(SchoolCapability.gradesReadPublished)) {
      paths.add('/results');
      destinations.add(
        SchoolDestination(
          icon: Icons.school_outlined,
          label: strings.results,
          selectedIcon: Icons.school,
        ),
      );
    }
    if (session.activePersona == SchoolPersona.guardian &&
        session.can(SchoolCapability.billingRead)) {
      paths.add('/fees');
      destinations.add(
        SchoolDestination(
          icon: Icons.receipt_long_outlined,
          label: strings.fees,
          selectedIcon: Icons.receipt_long,
        ),
      );
    }
    if (interactionsAvailable &&
        (session.can(SchoolCapability.documentsRead) ||
            session.can(SchoolCapability.formsConsent))) {
      paths.add('/services');
      destinations.add(
        SchoolDestination(
          icon: Icons.dashboard_customize_outlined,
          label: strings.services,
          selectedIcon: Icons.dashboard_customize,
        ),
      );
    }
    if (session.can(SchoolCapability.messagesRead)) {
      paths.add(interactionsAvailable ? '/conversations' : '/messages');
      destinations.add(
        SchoolDestination(
          icon: Icons.forum_outlined,
          label: interactionsAvailable
              ? strings.conversations
              : strings.messages,
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
                          '${SchoolBidirectionalText.isolate(student.displayName)} · '
                          '${SchoolBidirectionalText.isolate(student.gradeLabel)}',
                        ),
                      ),
                    )
                    .toList(growable: false),
                onSelected: (studentId) =>
                    unawaited(journey.selectStudent(studentId)),
                tooltip: strings.switchStudent,
              ),
            if (availablePersonas.length > 1)
              PopupMenuButton<SchoolPersona>(
                icon: const Icon(Icons.switch_account_outlined),
                initialValue: session.activePersona,
                itemBuilder: (context) => availablePersonas
                    .map(
                      (persona) => PopupMenuItem(
                        value: persona,
                        child: Text(
                          persona == SchoolPersona.guardian
                              ? strings.guardianProfile
                              : strings.studentProfile,
                        ),
                      ),
                    )
                    .toList(growable: false),
                onSelected: coordinator.switchPersona,
                tooltip: strings.switchRole,
              ),
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () => unawaited(coordinator.signOut()),
              tooltip: strings.signOut,
            ),
          ],
          body: child,
          destinations: destinations,
          onDestinationSelected: (index) => context.go(paths[index]),
          selectedIndex: paths
              .indexOf(location)
              .clamp(0, paths.length - 1)
              .toInt(),
          status: _journeyStatus(context, journey.state),
          title:
              '${strings.familyAppName} · '
              '${session.activePersona == SchoolPersona.guardian ? strings.guardianProfile : strings.studentProfile}',
        );
      },
    );
  }

  Widget _journeyStatus(BuildContext context, FamilyJourneyState state) {
    final strings = FamilyProductionStrings.forLocale(
      Localizations.localeOf(context),
    );
    return switch (state.phase) {
      FamilyJourneyPhase.loading => SchoolStatusBanner(
        label: strings.loadingPublishedInformation,
        message: strings.selectedProfileRefreshing,
        tone: SchoolStatusTone.information,
      ),
      FamilyJourneyPhase.ready => SchoolStatusBanner(
        label: strings.publishedInformation,
        message:
            '${SchoolBidirectionalText.isolate(state.directory!.activeStudent.displayName)} · '
            '${SchoolBidirectionalText.isolate(state.directory!.activeStudent.gradeLabel)}',
        tone: SchoolStatusTone.success,
      ),
      FamilyJourneyPhase.failed => SchoolStatusBanner(
        label: strings.informationUnavailable,
        message: strings.substituteValuesHiddenUntilVerified,
        tone: SchoolStatusTone.error,
      ),
    };
  }
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
      final strings = FamilyProductionStrings.forLocale(
        Localizations.localeOf(context),
      );
      switch (state.phase) {
        case FamilyJourneyPhase.loading:
          return const Center(child: CircularProgressIndicator());
        case FamilyJourneyPhase.failed:
          return ListView(
            children: [
              SchoolPageSection(
                description: strings.informationUnavailable,
                title: strings.unableToLoadFamilyInformation,
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SchoolStatusBanner(
                        label: strings.noSubstituteValuesShown,
                        message: strings.substituteValuesHiddenUntilVerified,
                        tone: SchoolStatusTone.error,
                      ),
                      const SizedBox(height: SchoolSpacing.md),
                      FilledButton.icon(
                        icon: const Icon(Icons.refresh),
                        label: Text(strings.tryAgain),
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
      final strings = FamilyProductionStrings.forLocale(
        Localizations.localeOf(context),
      );
      final countStrings = SchoolCountStrings.of(context);
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
          strings.reviewAttendance,
          '/attendance',
          SchoolBidirectionalText.isolate(dashboard.attendance!.summaryLabel),
        );
      }
      if (dashboard.publishedResults.isNotEmpty) {
        addLink(
          Icons.school_outlined,
          strings.viewPublishedResults,
          '/results',
          countStrings.publishedResults(dashboard.publishedResults.length),
        );
      }
      if (dashboard.fees != null) {
        addLink(
          Icons.receipt_long_outlined,
          strings.reviewFeesAndReceipts,
          '/fees',
          '${strings.invoice} ${SchoolBidirectionalText.isolate(dashboard.fees!.invoiceReference)}',
        );
      }
      if (interactionsAvailable &&
          (session.can(SchoolCapability.documentsRead) ||
              session.can(SchoolCapability.formsConsent))) {
        addLink(
          Icons.dashboard_customize_outlined,
          strings.documentsAndForms,
          '/services',
          strings.capabilityScopedFamilyServices,
        );
      }
      if (dashboard.messages != null) {
        addLink(
          Icons.forum_outlined,
          interactionsAvailable
              ? strings.openConversations
              : strings.openMessages,
          interactionsAvailable ? '/conversations' : '/messages',
          countStrings.unreadMessages(dashboard.messages!.unreadCount),
        );
      }

      return ListView(
        children: [
          SchoolPageSection(
            description:
                '${SchoolBidirectionalText.isolate(dashboard.student.gradeLabel)} · '
                '${SchoolBidirectionalText.isolate(dashboard.student.relationshipLabel)}',
            title: SchoolBidirectionalText.isolate(
              dashboard.student.displayName,
            ),
            child: SchoolPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    strings.todaysTimetable,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: SchoolSpacing.sm),
                  if (dashboard.timetable.isEmpty)
                    Text(strings.noPublishedTimetableItems)
                  else
                    for (final item in dashboard.timetable)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.schedule_outlined),
                        title: Text(
                          SchoolBidirectionalText.isolate(item.subjectLabel),
                        ),
                        subtitle: Text(
                          SchoolBidirectionalText.isolate(item.locationLabel),
                        ),
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
      final strings = FamilyProductionStrings.forLocale(
        Localizations.localeOf(context),
      );
      final countStrings = SchoolCountStrings.of(context);
      final attendance = dashboard.attendance;
      return ListView(
        children: [
          SchoolPageSection(
            description: strings.publishedSessionsDescription,
            title: session.activePersona == SchoolPersona.guardian
                ? '${SchoolBidirectionalText.isolate(dashboard.student.displayName)} · ${SchoolShellStrings.of(context).attendance}'
                : strings.myAttendance,
            child: SchoolPanel(
              child: attendance == null
                  ? Text(strings.noPublishedAttendanceSummary)
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          SchoolBidirectionalText.isolate(
                            attendance.summaryLabel,
                          ),
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const Divider(height: SchoolSpacing.lg),
                        _countTile(
                          context,
                          Icons.check_circle_outline,
                          strings.present,
                          attendance.presentSessions,
                        ),
                        _countTile(
                          context,
                          Icons.access_time_outlined,
                          strings.late,
                          attendance.lateSessions,
                        ),
                        _countTile(
                          context,
                          Icons.event_busy_outlined,
                          strings.absent,
                          attendance.absentSessions,
                        ),
                        Text(
                          countStrings.finalizedSessions(
                            attendance.totalSessions,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ],
      );
    },
  );

  Widget _countTile(
    BuildContext context,
    IconData icon,
    String label,
    int count,
  ) {
    final sessions = SchoolCountStrings.of(context).finalizedSessions(count);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text('$label · $sessions'),
    );
  }
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
          description: FamilyProductionStrings.forLocale(
            Localizations.localeOf(context),
          ).publishedResultsDescription,
          title:
              '${SchoolBidirectionalText.isolate(dashboard.student.displayName)} · ${FamilyProductionStrings.forLocale(Localizations.localeOf(context)).publishedResults}',
          child: SchoolPanel(
            child: dashboard.publishedResults.isEmpty
                ? Text(
                    FamilyProductionStrings.forLocale(
                      Localizations.localeOf(context),
                    ).noPublishedResults,
                  )
                : Column(
                    children: [
                      for (final result in dashboard.publishedResults)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.verified_outlined),
                          title: Text(
                            '${SchoolBidirectionalText.isolate(result.subjectLabel)} · '
                            '${SchoolBidirectionalText.isolate(result.gradeLabel)}',
                          ),
                          subtitle: Text(
                            SchoolBidirectionalText.isolate(
                              result.assessmentLabel,
                            ),
                          ),
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
      final strings = FamilyProductionStrings.forLocale(
        Localizations.localeOf(context),
      );
      final fees = dashboard.fees;
      return ListView(
        children: [
          SchoolPageSection(
            description: strings.amountsFromIssuedInvoices,
            title: strings.feesAndReceipts,
            child: SchoolPanel(
              child: fees == null
                  ? Text(strings.noFeeSummary)
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          '${strings.outstanding} · ${_moneyLabel(context, fees.outstanding)}',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: SchoolSpacing.xs),
                        Text(
                          '${strings.invoice} ${SchoolBidirectionalText.isolate(fees.invoiceReference)}',
                        ),
                        if (fees.lastReceipt != null) ...[
                          const Divider(height: SchoolSpacing.lg),
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.receipt_outlined),
                            title: Text(
                              '${strings.lastReceipt} · ${_moneyLabel(context, fees.lastReceipt!)}',
                            ),
                            subtitle: Text(
                              SchoolBidirectionalText.isolate(
                                fees.lastReceiptReference!,
                              ),
                            ),
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

  String _moneyLabel(BuildContext context, FamilyMoneyAmount amount) =>
      SchoolExactMoneyFormatter.format(
        currencyCode: amount.currencyCode,
        fractionDigits: 2,
        locale: Localizations.localeOf(context),
        minorUnits: amount.minorUnits,
      );
}

class _FamilyMessagesReadScreen extends StatelessWidget {
  const _FamilyMessagesReadScreen({required this.journey});

  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyJourneyView(
    journey: journey,
    builder: (context, directory, dashboard) {
      final strings = FamilyProductionStrings.forLocale(
        Localizations.localeOf(context),
      );
      final countStrings = SchoolCountStrings.of(context);
      final messages = dashboard.messages;
      return ListView(
        children: [
          SchoolPageSection(
            description: strings.conversationAccessDescription,
            title: strings.messages,
            child: SchoolPanel(
              child: messages == null
                  ? Text(strings.noMessageSummary)
                  : ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.mark_email_unread_outlined),
                      title: Text(
                        countStrings.unreadMessages(messages.unreadCount),
                      ),
                      subtitle: Text(strings.openConversationDataPending),
                    ),
            ),
          ),
        ],
      );
    },
  );
}
