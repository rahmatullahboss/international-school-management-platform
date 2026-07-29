part of 'main.dart';

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
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: const Icon(Icons.class_outlined),
    onTap: onOpenRoster,
    subtitle: Text(
      '${meeting.sectionLabel} · ${meeting.roomLabel} · ${meeting.rosterCount} student(s)'
      '${meeting.isSubstitution ? ' · Substitution' : ''}',
    ),
    title: Text(meeting.subjectLabel),
    trailing: onOpenRoster == null ? null : const Icon(Icons.chevron_right),
  );
}

class _TeacherRosterScreen extends StatelessWidget {
  const _TeacherRosterScreen({required this.journey});

  final StaffJourneyController journey;

  @override
  Widget build(BuildContext context) => _StaffJourneyView(
    journey: journey,
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
      return ListView(
        children: [
          SchoolPageSection(
            description:
                'Version ${roster.version} · changes are drafts until server acceptance.',
            title: 'Attendance roster',
            child: SchoolPanel(
              child: roster.students.isEmpty
                  ? const Text('No students are present in the authorized roster.')
                  : Column(
                      children: [
                        for (
                          var index = 0;
                          index < roster.students.length;
                          index++
                        ) ...[
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.person_outline),
                            subtitle: Text(roster.students[index].rollLabel),
                            title: Text(roster.students[index].displayName),
                          ),
                          if (index != roster.students.length - 1)
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
