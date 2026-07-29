#!/usr/bin/env python3
"""Wire encrypted teacher attendance sync into the production Staff app."""

from pathlib import Path

root = Path(__file__).resolve().parents[1]

main_path = root / 'apps/staff_app/lib/main.dart'
main = main_path.read_text(encoding='utf-8')
imports = """import 'package:school_staff_domain/school_staff_domain.dart';
import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:school_sync_storage/school_sync_storage.dart';
import 'package:school_teacher_sync/school_teacher_sync.dart';
"""
if "import 'package:school_teacher_sync/school_teacher_sync.dart';" not in main:
    anchor = "import 'package:school_staff_domain/school_staff_domain.dart';\n"
    if anchor not in main:
        raise SystemExit('Unexpected Staff main import shape')
    main = main.replace(anchor, imports, 1)
part_line = "part 'staff_sync_controller.dart';\n"
if part_line not in main:
    anchor = "part 'staff_journey_controller.dart';\n"
    if anchor not in main:
        raise SystemExit('Unexpected Staff main part shape')
    main = main.replace(anchor, anchor + part_line, 1)
main_path.write_text(main, encoding='utf-8')

production_path = root / 'apps/staff_app/lib/production_app.dart'
production = production_path.read_text(encoding='utf-8')
production = production.replace(
    """    this.repository,
    super.key,
""",
    """    this.repository,
    this.syncRuntimeLoader,
    super.key,
""",
    1,
)
production = production.replace(
    """  final TeacherJourneyRepository? repository;

  @override
""",
    """  final TeacherJourneyRepository? repository;
  final StaffSyncRuntimeLoader? syncRuntimeLoader;

  @override
""",
    1,
)
production = production.replace(
    """            repository: repository,
            session: session,
""",
    """            repository: repository,
            session: session,
            syncRuntimeLoader: widget.syncRuntimeLoader,
""",
    1,
)
production = production.replace(
    """    required this.repository,
    required this.session,
  });

  final MobileAppCoordinator coordinator;
  final TeacherJourneyRepository repository;
  final SchoolSession session;
""",
    """    required this.repository,
    required this.session,
    this.syncRuntimeLoader,
  });

  final MobileAppCoordinator coordinator;
  final TeacherJourneyRepository repository;
  final SchoolSession session;
  final StaffSyncRuntimeLoader? syncRuntimeLoader;
""",
    1,
)
production = production.replace(
    """  late StaffJourneyController _journey;
  late GoRouter _router;
""",
    """  late StaffJourneyController _journey;
  late GoRouter _router;
  late StaffAttendanceSyncController _sync;
""",
    1,
)
production = production.replace(
    """    _router = _createRouter();
    unawaited(_journey.initialize());
""",
    """    _sync = StaffAttendanceSyncController(
      repository: widget.repository,
      runtimeLoader: widget.syncRuntimeLoader,
      session: widget.session,
    );
    _router = _createRouter();
    unawaited(_journey.initialize());
    unawaited(_sync.initialize());
""",
    1,
)
update_anchor = """    if (repositoryChanged || scopeChanged) {
      _router.dispose();
      _router = _createRouter();
    }
"""
update_new = """    if (repositoryChanged || scopeChanged) {
      unawaited(
        _sync.updateScope(
          repository: widget.repository,
          session: widget.session,
        ),
      );
      _router.dispose();
      _router = _createRouter();
    }
"""
if update_anchor in production:
    production = production.replace(update_anchor, update_new, 1)
elif update_new not in production:
    raise SystemExit('Unexpected Staff scope-update shape')
production = production.replace(
    """            session: session,
            child: child,
""",
    """            session: session,
            sync: _sync,
            child: child,
""",
    1,
)
production = production.replace(
    """                builder: (context, state) =>
                    _TeacherRosterScreen(journey: _journey),
""",
    """                builder: (context, state) => _TeacherRosterScreen(
                  journey: _journey,
                  session: session,
                  sync: _sync,
                ),
""",
    1,
)
production = production.replace(
    """    _router.dispose();
    _journey.dispose();
    super.dispose();
""",
    """    _router.dispose();
    _journey.dispose();
    _sync.dispose();
    super.dispose();
""",
    1,
)

shell_marker = 'class _AuthorizedStaffShell extends ConsumerWidget {'
if shell_marker in production:
    production = production.split(shell_marker, 1)[0] + """class _AuthorizedStaffShell extends StatelessWidget {
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
      final status = switch ((syncState.phase, syncState.attentionCount, syncState.pendingCount)) {
        (StaffSyncPhase.failed, _, _) => SchoolStatusBanner(
          label: 'Sync unavailable',
          message: syncState.reasonCode ?? 'Attendance sync could not be verified.',
          tone: SchoolStatusTone.error,
        ),
        (_, final attention, _) when attention > 0 => SchoolStatusBanner(
          label: 'Review required',
          message: '$attention attendance operation(s) need reconciliation.',
          tone: SchoolStatusTone.error,
        ),
        (_, _, final pending) when pending > 0 => SchoolStatusBanner(
          label: 'Saved on device',
          message: '$pending encrypted attendance operation(s) are waiting to sync.',
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
        selectedIndex: paths.indexOf(location).clamp(0, paths.length - 1).toInt(),
        status: status,
        title: 'School Staff · Teacher',
      );
    },
  );
}
"""
elif 'class _AuthorizedStaffShell extends StatelessWidget {' not in production:
    raise SystemExit('Unexpected authorized Staff shell shape')
production_path.write_text(production, encoding='utf-8')

journeys_path = root / 'apps/staff_app/lib/teacher_production_journeys.dart'
journeys = journeys_path.read_text(encoding='utf-8')
roster_marker = 'class _TeacherRosterScreen extends StatelessWidget {'
if roster_marker in journeys:
    journeys = journeys.split(roster_marker, 1)[0] + """class _TeacherRosterScreen extends StatefulWidget {
  const _TeacherRosterScreen({
    required this.journey,
    required this.session,
    required this.sync,
  });

  final StaffJourneyController journey;
  final SchoolSession session;
  final StaffAttendanceSyncController sync;

  @override
  State<_TeacherRosterScreen> createState() => _TeacherRosterScreenState();
}

class _TeacherRosterScreenState extends State<_TeacherRosterScreen> {
  @override
  Widget build(BuildContext context) => _StaffJourneyView(
    journey: widget.journey,
    builder: (context, state) {
      final roster = state.activeRoster;
      if (state.rosterLoading) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.rosterReasonCode != null) {
        return ListView(
          children: const [
            SchoolPageSection(
              description: 'The assigned roster could not be verified for this meeting.',
              title: 'Roster unavailable',
              child: SchoolStatusBanner(
                label: 'No roster substituted',
                message: 'Attendance capture is unavailable until the authorized roster service responds.',
                tone: SchoolStatusTone.error,
              ),
            ),
          ],
        );
      }
      if (roster == null) {
        return ListView(
          children: const [
            SchoolPageSection(
              description: 'Open an assigned meeting from Today first.',
              title: 'Select a meeting',
              child: SchoolStatusBanner(
                label: 'Roster not selected',
                message: 'Only rosters for assigned meetings can be opened on this device.',
                tone: SchoolStatusTone.information,
              ),
            ),
          ],
        );
      }
      final syncState = widget.sync.state;
      if (syncState.rosterMeetingId != roster.meetingId ||
          syncState.rosterVersion != roster.version) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            widget.sync.attachRoster(roster);
          }
        });
      }
      return AnimatedBuilder(
        animation: widget.sync,
        builder: (context, _) => _AttendanceSyncContent(
          roster: roster,
          session: widget.session,
          sync: widget.sync,
        ),
      );
    },
  );
}

class _AttendanceSyncContent extends StatelessWidget {
  const _AttendanceSyncContent({
    required this.roster,
    required this.session,
    required this.sync,
  });

  final TeacherRosterReadModel roster;
  final SchoolSession session;
  final StaffAttendanceSyncController sync;

  @override
  Widget build(BuildContext context) {
    final state = sync.state;
    final attached = state.rosterMeetingId == roster.meetingId &&
        state.rosterVersion == roster.version;
    if (!attached || state.phase == StaffSyncPhase.initializing) {
      return const Center(child: CircularProgressIndicator());
    }
    final busy = state.phase == StaffSyncPhase.saving ||
        state.phase == StaffSyncPhase.syncing;
    return ListView(
      children: [
        SchoolPageSection(
          description: 'Version ${roster.version} · encrypted drafts remain non-authoritative until server acceptance.',
          title: 'Attendance roster',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _AttendanceSyncStatus(state: state),
              const SizedBox(height: SchoolSpacing.md),
              SchoolPanel(
                child: roster.students.isEmpty
                    ? const Text('No students are present in the authorized roster.')
                    : Column(
                        children: [
                          for (var index = 0; index < roster.students.length; index++) ...[
                            _TeacherAttendanceRow(
                              mark: state.marks[roster.students[index].studentId] ??
                                  TeacherAttendanceMark.present,
                              onChanged: busy
                                  ? null
                                  : (mark) => sync.mark(
                                        roster.students[index].studentId,
                                        mark,
                                      ),
                              student: roster.students[index],
                            ),
                            if (index != roster.students.length - 1)
                              const Divider(),
                          ],
                        ],
                      ),
              ),
              const SizedBox(height: SchoolSpacing.md),
              Wrap(
                spacing: SchoolSpacing.sm,
                runSpacing: SchoolSpacing.sm,
                children: [
                  FilledButton.icon(
                    icon: const Icon(Icons.lock_outline),
                    label: const Text('Save encrypted draft'),
                    onPressed: busy || !state.dirty || roster.students.isEmpty
                        ? null
                        : () => unawaited(sync.saveOnDevice()),
                  ),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.sync),
                    label: const Text('Sync now'),
                    onPressed: busy || state.pendingCount == 0
                        ? null
                        : () => unawaited(sync.syncNow()),
                  ),
                  TextButton.icon(
                    icon: const Icon(Icons.refresh),
                    label: const Text('Refresh status'),
                    onPressed: busy ? null : () => unawaited(sync.refreshJournal()),
                  ),
                ],
              ),
              if (state.operations.isNotEmpty) ...[
                const SizedBox(height: SchoolSpacing.md),
                SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Device operation journal', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: SchoolSpacing.sm),
                      for (final operation in state.operations.take(5))
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(_syncStateIcon(operation.state)),
                          title: Text(_syncStateLabel(operation.state)),
                          subtitle: Text(
                            operation.lastReasonCode ??
                                'Operation ${operation.operationId} · encrypted payload',
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _AttendanceSyncStatus extends StatelessWidget {
  const _AttendanceSyncStatus({required this.state});

  final StaffAttendanceSyncState state;

  @override
  Widget build(BuildContext context) {
    if (state.phase == StaffSyncPhase.failed) {
      return SchoolStatusBanner(
        label: 'Sync unavailable',
        message: state.reasonCode ?? 'The encrypted attendance queue could not be opened.',
        tone: SchoolStatusTone.error,
      );
    }
    if (state.attentionCount > 0) {
      return SchoolStatusBanner(
        label: 'Manual review required',
        message: '${state.attentionCount} operation(s) are conflicted, rejected or require reconciliation.',
        tone: SchoolStatusTone.error,
      );
    }
    if (state.dirty) {
      return const SchoolStatusBanner(
        label: 'Unsaved changes',
        message: 'Save this roster to encrypted device storage before leaving the screen.',
        tone: SchoolStatusTone.warning,
      );
    }
    if (state.pendingCount > 0) {
      return SchoolStatusBanner(
        label: 'Saved on device',
        message: '${state.pendingCount} encrypted operation(s) are waiting for server acceptance.',
        tone: SchoolStatusTone.warning,
      );
    }
    return const SchoolStatusBanner(
      label: 'No pending draft',
      message: 'The server remains authoritative for attendance acceptance and locking.',
      tone: SchoolStatusTone.success,
    );
  }
}

class _TeacherAttendanceRow extends StatelessWidget {
  const _TeacherAttendanceRow({
    required this.mark,
    required this.onChanged,
    required this.student,
  });

  final TeacherAttendanceMark mark;
  final ValueChanged<TeacherAttendanceMark>? onChanged;
  final TeacherRosterStudent student;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: SchoolSpacing.xs),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(student.displayName, style: Theme.of(context).textTheme.titleMedium),
        Text(student.rollLabel),
        const SizedBox(height: SchoolSpacing.sm),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SegmentedButton<TeacherAttendanceMark>(
            onSelectionChanged: onChanged == null
                ? null
                : (selection) => onChanged!(selection.first),
            segments: TeacherAttendanceMark.values
                .map(
                  (value) => ButtonSegment<TeacherAttendanceMark>(
                    icon: Icon(_attendanceMarkIcon(value)),
                    label: Text(_attendanceMarkLabel(value)),
                    value: value,
                  ),
                )
                .toList(growable: false),
            selected: <TeacherAttendanceMark>{mark},
          ),
        ),
      ],
    ),
  );
}

String _attendanceMarkLabel(TeacherAttendanceMark mark) => switch (mark) {
  TeacherAttendanceMark.present => 'Present',
  TeacherAttendanceMark.absent => 'Absent',
  TeacherAttendanceMark.late => 'Late',
  TeacherAttendanceMark.excused => 'Excused',
};

IconData _attendanceMarkIcon(TeacherAttendanceMark mark) => switch (mark) {
  TeacherAttendanceMark.present => Icons.check_circle_outline,
  TeacherAttendanceMark.absent => Icons.cancel_outlined,
  TeacherAttendanceMark.late => Icons.access_time_outlined,
  TeacherAttendanceMark.excused => Icons.medical_information_outlined,
};

String _syncStateLabel(SyncOperationState state) => switch (state) {
  SyncOperationState.savedOnDevice => 'Saved on device',
  SyncOperationState.waitingForNetwork => 'Waiting for network',
  SyncOperationState.inFlight => 'Sending',
  SyncOperationState.synced => 'Accepted by server',
  SyncOperationState.duplicate => 'Already accepted',
  SyncOperationState.conflict => 'Version conflict',
  SyncOperationState.rejected => 'Rejected',
  SyncOperationState.requiresReconciliation => 'Reconciliation required',
};

IconData _syncStateIcon(SyncOperationState state) => switch (state) {
  SyncOperationState.savedOnDevice => Icons.lock_outline,
  SyncOperationState.waitingForNetwork => Icons.cloud_off_outlined,
  SyncOperationState.inFlight => Icons.sync,
  SyncOperationState.synced => Icons.cloud_done_outlined,
  SyncOperationState.duplicate => Icons.done_all,
  SyncOperationState.conflict => Icons.warning_amber_outlined,
  SyncOperationState.rejected => Icons.block_outlined,
  SyncOperationState.requiresReconciliation => Icons.rule_folder_outlined,
};
"""
elif 'class _TeacherRosterScreen extends StatefulWidget {' not in journeys:
    raise SystemExit('Unexpected teacher roster screen shape')
journeys_path.write_text(journeys, encoding='utf-8')

test_path = root / 'packages/teacher_sync/test/teacher_sync_test.dart'
test_source = test_path.read_text(encoding='utf-8')
if 'availablePersonas:' not in test_source:
    test_source = test_source.replace(
        """  activePersona: SchoolPersona.teacher,
  tenantId: 'tenant-1',
""",
        """  activePersona: SchoolPersona.teacher,
  availablePersonas: const <SchoolPersona>{SchoolPersona.teacher},
  locale: 'en-GB',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
""",
        1,
    )
test_path.write_text(test_source, encoding='utf-8')

print('Production Staff encrypted attendance sync wiring applied.')
