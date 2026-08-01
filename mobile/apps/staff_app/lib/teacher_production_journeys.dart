part of 'main.dart';

final class StaffProductionCountCopy {
  StaffProductionCountCopy.forLocale(Locale locale)
    : _strings = SchoolCountStrings.forLocale(locale);

  factory StaffProductionCountCopy.of(BuildContext context) =>
      StaffProductionCountCopy.forLocale(Localizations.localeOf(context));

  final SchoolCountStrings _strings;

  String rosterStudents(int count) => _strings.rosterStudents(count);

  String encryptedOperationsWaiting(int count) =>
      _strings.encryptedOperationsWaiting(count);

  String operationsRequireReview(int count) =>
      _strings.operationsRequireReview(count);
}

class _StaffJourneyView extends StatelessWidget {
  const _StaffJourneyView({required this.builder, required this.journey});

  final Widget Function(BuildContext context, StaffJourneyState state) builder;
  final StaffJourneyController journey;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: journey,
    builder: (context, _) {
      final state = journey.state;
      switch (state.phase) {
        case StaffJourneyPhase.loading:
          return const Center(child: CircularProgressIndicator());
        case StaffJourneyPhase.failed:
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Assigned teacher information could not be verified for this school scope.',
                title: 'Teacher information unavailable',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SchoolStatusBanner(
                        label: 'No substitute class data shown',
                        message:
                            'Schedules, rosters and operational records remain hidden until the authorized service responds.',
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
        case StaffJourneyPhase.ready:
          return builder(context, state);
      }
    },
  );
}

class _TeacherTodayScreen extends StatelessWidget {
  const _TeacherTodayScreen({required this.journey, required this.session});

  final StaffJourneyController journey;
  final SchoolSession session;

  @override
  Widget build(BuildContext context) => _StaffJourneyView(
    journey: journey,
    builder: (context, state) {
      final today = state.today!;
      return ListView(
        children: [
          SchoolPageSection(
            description:
                'Assigned meetings and substitutions for the selected school campus.',
            title: today.teacherDisplayName,
            child: SchoolPanel(
              child: today.meetings.isEmpty
                  ? const SchoolStatusBanner(
                      label: 'No assigned meetings',
                      message: 'No teacher meetings are assigned for this day.',
                      tone: SchoolStatusTone.information,
                    )
                  : Column(
                      children: [
                        for (
                          var index = 0;
                          index < today.meetings.length;
                          index++
                        ) ...[
                          _TeacherMeetingTile(
                            meeting: today.meetings[index],
                            onOpenRoster:
                                session.can(SchoolCapability.attendanceTake)
                                ? () {
                                    unawaited(
                                      journey.loadRoster(
                                        today.meetings[index].meetingId,
                                      ),
                                    );
                                    context.go('/attendance');
                                  }
                                : null,
                          ),
                          if (index != today.meetings.length - 1)
                            const Divider(),
                        ],
                      ],
                    ),
            ),
          ),
        ],
      );
    },
  );
}

class _TeacherMeetingTile extends StatelessWidget {
  const _TeacherMeetingTile({
    required this.meeting,
    required this.onOpenRoster,
  });

  final TeacherMeetingSummary meeting;
  final VoidCallback? onOpenRoster;

  @override
  Widget build(BuildContext context) {
    final countCopy = StaffProductionCountCopy.of(context);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.class_outlined),
      onTap: onOpenRoster,
      subtitle: Text(
        '${meeting.sectionLabel} · ${meeting.roomLabel} · '
        '${countCopy.rosterStudents(meeting.rosterCount)}'
        '${meeting.isSubstitution ? ' · Substitution' : ''}',
      ),
      title: Text(meeting.subjectLabel),
      trailing: onOpenRoster == null ? null : const Icon(Icons.chevron_right),
    );
  }
}

class _TeacherRosterScreen extends StatefulWidget {
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
              description:
                  'The assigned roster could not be verified for this meeting.',
              title: 'Roster unavailable',
              child: SchoolStatusBanner(
                label: 'No roster substituted',
                message:
                    'Attendance capture is unavailable until the authorized roster service responds.',
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
                message:
                    'Only rosters for assigned meetings can be opened on this device.',
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
    final attached =
        state.rosterMeetingId == roster.meetingId &&
        state.rosterVersion == roster.version;
    if (!attached || state.phase == StaffSyncPhase.initializing) {
      return const Center(child: CircularProgressIndicator());
    }
    final busy =
        state.phase == StaffSyncPhase.saving ||
        state.phase == StaffSyncPhase.syncing;
    return ListView(
      children: [
        SchoolPageSection(
          description:
              'Version ${roster.version} · encrypted drafts remain non-authoritative until server acceptance.',
          title: 'Attendance roster',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _AttendanceSyncStatus(state: state),
              const SizedBox(height: SchoolSpacing.md),
              SchoolPanel(
                child: roster.students.isEmpty
                    ? const Text(
                        'No students are present in the authorized roster.',
                      )
                    : Column(
                        children: [
                          for (
                            var index = 0;
                            index < roster.students.length;
                            index++
                          ) ...[
                            _TeacherAttendanceRow(
                              mark:
                                  state.marks[roster
                                      .students[index]
                                      .studentId] ??
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
                    onPressed: busy
                        ? null
                        : () => unawaited(sync.refreshJournal()),
                  ),
                ],
              ),
              if (state.operations.isNotEmpty) ...[
                const SizedBox(height: SchoolSpacing.md),
                SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Device operation journal',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
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
    final countCopy = StaffProductionCountCopy.of(context);
    if (state.phase == StaffSyncPhase.failed) {
      return SchoolStatusBanner(
        label: 'Sync unavailable',
        message:
            state.reasonCode ??
            'The encrypted attendance queue could not be opened.',
        tone: SchoolStatusTone.error,
      );
    }
    if (state.attentionCount > 0) {
      return SchoolStatusBanner(
        label: 'Manual review required',
        message: countCopy.operationsRequireReview(state.attentionCount),
        tone: SchoolStatusTone.error,
      );
    }
    if (state.dirty) {
      return const SchoolStatusBanner(
        label: 'Unsaved changes',
        message:
            'Save this roster to encrypted device storage before leaving the screen.',
        tone: SchoolStatusTone.warning,
      );
    }
    if (state.pendingCount > 0) {
      return SchoolStatusBanner(
        label: 'Saved on device',
        message: countCopy.encryptedOperationsWaiting(state.pendingCount),
        tone: SchoolStatusTone.warning,
      );
    }
    return const SchoolStatusBanner(
      label: 'No pending draft',
      message:
          'The server remains authoritative for attendance acceptance and locking.',
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
        Text(
          student.displayName,
          style: Theme.of(context).textTheme.titleMedium,
        ),
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
