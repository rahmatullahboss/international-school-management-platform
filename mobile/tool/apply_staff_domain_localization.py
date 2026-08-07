from pathlib import Path


main_path = Path('mobile/apps/staff_app/lib/main.dart')
main = main_path.read_text()
imports = (
    "import 'package:school_staff_app/staff_production_dynamic_strings.dart';\n"
    "import 'package:school_staff_app/staff_production_strings.dart';\n"
)
if "package:school_staff_app/staff_production_strings.dart" not in main:
    anchor = "import 'package:school_mobile_core/notification_routing.dart';\n"
    if main.count(anchor) != 1:
        raise SystemExit('staff main import anchor drifted')
    main = main.replace(anchor, anchor + imports)
    main_path.write_text(main)


def transform(path_name: str, replacements: list[tuple[str, str]]) -> None:
    path = Path(path_name)
    text = path.read_text()
    for old, new in replacements:
        if new in text:
            continue
        count = text.count(old)
        if count != 1:
            raise SystemExit(
                f'expected one Staff localization anchor, found {count} in {path_name}: {old[:100]!r}'
            )
        text = text.replace(old, new)
    path.write_text(text)


transform(
    'mobile/apps/staff_app/lib/production_app.dart',
    [
        (
            """      final strings = SchoolShellStrings.of(context);
      final paths = <String>['/'];""",
            """      final strings = SchoolShellStrings.of(context);
      final staffStrings = StaffProductionStrings.forLocale(
        Localizations.localeOf(context),
      );
      final countCopy = StaffProductionCountCopy.of(context);
      final paths = <String>['/'];""",
        ),
        (
            """        (StaffSyncPhase.failed, _, _) => SchoolStatusBanner(
          label: 'Sync unavailable',
          message: SchoolBidirectionalText.isolate(
            syncState.reasonCode ?? 'Attendance sync could not be verified.',
          ),
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
        ),""",
            """        (StaffSyncPhase.failed, _, _) => SchoolStatusBanner(
          label: staffStrings.syncUnavailable,
          message: syncState.reasonCode == null
              ? staffStrings.encryptedQueueUnavailable
              : SchoolBidirectionalText.isolate(syncState.reasonCode!),
          tone: SchoolStatusTone.error,
        ),
        (_, final attention, _) when attention > 0 => SchoolStatusBanner(
          label: staffStrings.reviewRequired,
          message: countCopy.operationsRequireReview(attention),
          tone: SchoolStatusTone.error,
        ),
        (_, _, final pending) when pending > 0 => SchoolStatusBanner(
          label: staffStrings.savedOnDevice,
          message: countCopy.encryptedOperationsWaiting(pending),
          tone: SchoolStatusTone.warning,
        ),
        _ => SchoolStatusBanner(
          label: staffStrings.authorizedSession,
          message: staffStrings.noAttendanceOperationsWaiting,
          tone: SchoolStatusTone.success,
        ),""",
        ),
    ],
)

transform(
    'mobile/apps/staff_app/lib/teacher_production_journeys.dart',
    [
        (
            """      final state = journey.state;
      switch (state.phase) {""",
            """      final state = journey.state;
      final strings = StaffProductionStrings.forLocale(
        Localizations.localeOf(context),
      );
      switch (state.phase) {""",
        ),
        (
            """              SchoolPageSection(
                description:
                    'Assigned teacher information could not be verified for this school scope.',
                title: 'Teacher information unavailable',""",
            """              SchoolPageSection(
                description: strings.teacherInformationUnverified,
                title: strings.teacherInformationUnavailable,""",
        ),
        (
            """                      const SchoolStatusBanner(
                        label: 'No substitute class data shown',
                        message:
                            'Schedules, rosters and operational records remain hidden until the authorized service responds.',
                        tone: SchoolStatusTone.error,
                      ),""",
            """                      SchoolStatusBanner(
                        label: strings.noSubstituteClassDataShown,
                        message: strings.schedulesRemainHidden,
                        tone: SchoolStatusTone.error,
                      ),""",
        ),
        (
            "label: const Text('Try again'),",
            'label: Text(strings.tryAgain),',
        ),
        (
            """      final today = state.today!;
      final countCopy = StaffProductionCountCopy.of(context);""",
            """      final today = state.today!;
      final countCopy = StaffProductionCountCopy.of(context);
      final strings = StaffProductionStrings.forLocale(
        Localizations.localeOf(context),
      );""",
        ),
        (
            """            description:
                '${countCopy.assignedMeetings(today.meetings.length)} · '
                'Assigned meetings and substitutions for the selected school campus.',
            title: today.teacherDisplayName,""",
            """            description:
                '${countCopy.assignedMeetings(today.meetings.length)} · '
                '${strings.assignedMeetingsDescription}',
            title: SchoolBidirectionalText.isolate(today.teacherDisplayName),""",
        ),
        (
            """                  ? const SchoolStatusBanner(
                      label: 'No assigned meetings',
                      message: 'No teacher meetings are assigned for this day.',
                      tone: SchoolStatusTone.information,
                    )""",
            """                  ? SchoolStatusBanner(
                      label: strings.noAssignedMeetings,
                      message: strings.noTeacherMeetingsAssigned,
                      tone: SchoolStatusTone.information,
                    )""",
        ),
        (
            """    final countCopy = StaffProductionCountCopy.of(context);
    return ListTile(""",
            """    final countCopy = StaffProductionCountCopy.of(context);
    final strings = StaffProductionStrings.forLocale(
      Localizations.localeOf(context),
    );
    return ListTile(""",
        ),
        (
            """        '${meeting.sectionLabel} · ${meeting.roomLabel} · '
        '${countCopy.rosterStudents(meeting.rosterCount)}'
        '${meeting.isSubstitution ? ' · Substitution' : ''}',
      ),
      title: Text(meeting.subjectLabel),""",
            """        '${SchoolBidirectionalText.isolate(meeting.sectionLabel)} · '
        '${SchoolBidirectionalText.isolate(meeting.roomLabel)} · '
        '${countCopy.rosterStudents(meeting.rosterCount)}'
        '${meeting.isSubstitution ? ' · ${strings.substitution}' : ''}',
      ),
      title: Text(SchoolBidirectionalText.isolate(meeting.subjectLabel)),""",
        ),
        (
            """    builder: (context, state) {
      final roster = state.activeRoster;""",
            """    builder: (context, state) {
      final strings = StaffProductionStrings.forLocale(
        Localizations.localeOf(context),
      );
      final roster = state.activeRoster;""",
        ),
        (
            """        return ListView(
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
        );""",
            """        return ListView(
          children: [
            SchoolPageSection(
              description: strings.assignedRosterUnverified,
              title: strings.rosterUnavailable,
              child: SchoolStatusBanner(
                label: strings.noRosterSubstituted,
                message: strings.attendanceCaptureUnavailable,
                tone: SchoolStatusTone.error,
              ),
            ),
          ],
        );""",
        ),
        (
            """        return ListView(
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
        );""",
            """        return ListView(
          children: [
            SchoolPageSection(
              description: strings.openAssignedMeetingFirst,
              title: strings.selectMeeting,
              child: SchoolStatusBanner(
                label: strings.rosterNotSelected,
                message: strings.onlyAssignedRosters,
                tone: SchoolStatusTone.information,
              ),
            ),
          ],
        );""",
        ),
        (
            """    final busy =
        state.phase == StaffSyncPhase.saving ||
        state.phase == StaffSyncPhase.syncing;
    return ListView(""",
            """    final busy =
        state.phase == StaffSyncPhase.saving ||
        state.phase == StaffSyncPhase.syncing;
    final locale = Localizations.localeOf(context);
    final strings = StaffProductionStrings.forLocale(locale);
    return ListView(""",
        ),
        (
            """          description:
              'Version ${roster.version} · encrypted drafts remain non-authoritative until server acceptance.',
          title: 'Attendance roster',""",
            """          description: StaffProductionDynamicStrings.rosterVersionDescription(
            locale,
            roster.version,
          ),
          title: strings.attendanceRoster,""",
        ),
        (
            """                    ? const Text(
                        'No students are present in the authorized roster.',
                      )""",
            """                    ? Text(strings.noStudentsInAuthorizedRoster)""",
        ),
        (
            "label: const Text('Save encrypted draft'),",
            'label: Text(strings.saveEncryptedDraft),',
        ),
        (
            "label: const Text('Sync now'),",
            'label: Text(strings.syncNow),',
        ),
        (
            "label: const Text('Refresh status'),",
            'label: Text(strings.refreshStatus),',
        ),
        (
            """                        'Device operation journal',
                        style: Theme.of(context).textTheme.titleMedium,""",
            """                        strings.deviceOperationJournal,
                        style: Theme.of(context).textTheme.titleMedium,""",
        ),
        (
            "title: Text(_syncStateLabel(operation.state)),",
            'title: Text(_syncStateLabel(context, operation.state)),',
        ),
        (
            """                            operation.lastReasonCode ??
                                'Operation ${operation.operationId} · encrypted payload',""",
            """                            operation.lastReasonCode == null
                                ? StaffProductionDynamicStrings.encryptedOperation(
                                    locale,
                                    SchoolBidirectionalText.isolate(
                                      operation.operationId,
                                    ),
                                  )
                                : SchoolBidirectionalText.isolate(
                                    operation.lastReasonCode!,
                                  ),""",
        ),
        (
            """    final countCopy = StaffProductionCountCopy.of(context);
    if (state.phase == StaffSyncPhase.failed) {""",
            """    final countCopy = StaffProductionCountCopy.of(context);
    final strings = StaffProductionStrings.forLocale(
      Localizations.localeOf(context),
    );
    if (state.phase == StaffSyncPhase.failed) {""",
        ),
        (
            """        label: 'Sync unavailable',
        message:
            state.reasonCode ??
            'The encrypted attendance queue could not be opened.',""",
            """        label: strings.syncUnavailable,
        message: state.reasonCode == null
            ? strings.encryptedQueueUnavailable
            : SchoolBidirectionalText.isolate(state.reasonCode!),""",
        ),
        (
            "label: 'Manual review required',",
            'label: strings.manualReviewRequired,',
        ),
        (
            """      return const SchoolStatusBanner(
        label: 'Unsaved changes',
        message:
            'Save this roster to encrypted device storage before leaving the screen.',
        tone: SchoolStatusTone.warning,
      );""",
            """      return SchoolStatusBanner(
        label: strings.unsavedChanges,
        message: strings.saveBeforeLeaving,
        tone: SchoolStatusTone.warning,
      );""",
        ),
        (
            "label: 'Saved on device',",
            'label: strings.savedOnDevice,',
        ),
        (
            """    return const SchoolStatusBanner(
      label: 'No pending draft',
      message:
          'The server remains authoritative for attendance acceptance and locking.',
      tone: SchoolStatusTone.success,
    );""",
            """    return SchoolStatusBanner(
      label: strings.noPendingDraft,
      message: strings.serverAttendanceAuthoritative,
      tone: SchoolStatusTone.success,
    );""",
        ),
        (
            "label: Text(_attendanceMarkLabel(value)),",
            'label: Text(_attendanceMarkLabel(context, value)),',
        ),
        (
            """          student.displayName,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        Text(student.rollLabel),""",
            """          SchoolBidirectionalText.isolate(student.displayName),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        Text(SchoolBidirectionalText.isolate(student.rollLabel)),""",
        ),
        (
            """String _attendanceMarkLabel(TeacherAttendanceMark mark) => switch (mark) {
  TeacherAttendanceMark.present => 'Present',
  TeacherAttendanceMark.absent => 'Absent',
  TeacherAttendanceMark.late => 'Late',
  TeacherAttendanceMark.excused => 'Excused',
};""",
            """String _attendanceMarkLabel(
  BuildContext context,
  TeacherAttendanceMark mark,
) {
  final strings = StaffProductionStrings.forLocale(
    Localizations.localeOf(context),
  );
  return switch (mark) {
    TeacherAttendanceMark.present => strings.present,
    TeacherAttendanceMark.absent => strings.absent,
    TeacherAttendanceMark.late => strings.late,
    TeacherAttendanceMark.excused => strings.excused,
  };
}""",
        ),
        (
            """String _syncStateLabel(SyncOperationState state) => switch (state) {
  SyncOperationState.savedOnDevice => 'Saved on device',
  SyncOperationState.waitingForNetwork => 'Waiting for network',
  SyncOperationState.inFlight => 'Sending',
  SyncOperationState.synced => 'Accepted by server',
  SyncOperationState.duplicate => 'Already accepted',
  SyncOperationState.conflict => 'Version conflict',
  SyncOperationState.rejected => 'Rejected',
  SyncOperationState.requiresReconciliation => 'Reconciliation required',
};""",
            """String _syncStateLabel(BuildContext context, SyncOperationState state) {
  final strings = StaffProductionStrings.forLocale(
    Localizations.localeOf(context),
  );
  return switch (state) {
    SyncOperationState.savedOnDevice => strings.savedOnDevice,
    SyncOperationState.waitingForNetwork => strings.waitingForNetwork,
    SyncOperationState.inFlight => strings.sending,
    SyncOperationState.synced => strings.acceptedByServer,
    SyncOperationState.duplicate => strings.alreadyAccepted,
    SyncOperationState.conflict => strings.versionConflict,
    SyncOperationState.rejected => strings.rejected,
    SyncOperationState.requiresReconciliation => strings.reconciliationRequired,
  };
}""",
        ),
    ],
)
