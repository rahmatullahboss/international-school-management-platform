import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_api_client/teacher_mobile_api.dart';
import 'package:school_app_bootstrap/school_app_bootstrap.dart';
import 'package:school_authentication/school_authentication.dart';
import 'package:school_design_system/school_application.dart';
import 'package:school_design_system/school_count_strings.dart';
import 'package:school_design_system/school_design_system.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_mobile_core/notification_routing.dart';
import 'package:school_staff_app/staff_production_dynamic_strings.dart';
import 'package:school_staff_app/staff_production_strings.dart';
import 'package:school_staff_domain/school_staff_domain.dart';
import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:school_sync_storage/school_sync_storage.dart';
import 'package:school_teacher_sync/school_teacher_sync.dart';

part 'production_app.dart';
part 'staff_journey_controller.dart';
part 'staff_sync_controller.dart';
part 'teacher_production_journeys.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final localeController = SchoolLocaleController.secure(
    storageKey: 'school.mobile.staff.locale.v1',
  );
  await localeController.initialize();

  runApp(
    SchoolLocalePreferenceHost(
      controller: localeController,
      appBuilder: (context, controller) =>
          ProviderScope(child: StaffProductionApp()),
    ),
  );
}

enum AttendanceMark { present, absent, late }

extension AttendanceMarkLabel on AttendanceMark {
  String get label => switch (this) {
    AttendanceMark.present => 'Present',
    AttendanceMark.absent => 'Absent',
    AttendanceMark.late => 'Late',
  };
}

final class AttendanceDraftState {
  const AttendanceDraftState({
    required this.marks,
    required this.pendingStudentIds,
  });

  final Map<String, AttendanceMark> marks;
  final Set<String> pendingStudentIds;

  int get pendingCount => pendingStudentIds.length;
}

final attendanceDraftProvider =
    NotifierProvider<AttendanceDraftController, AttendanceDraftState>(
      AttendanceDraftController.new,
    );

final class AttendanceDraftController extends Notifier<AttendanceDraftState> {
  @override
  AttendanceDraftState build() => AttendanceDraftState(
    marks: Map<String, AttendanceMark>.unmodifiable({
      for (final student in rosterStudents) student.id: AttendanceMark.present,
    }),
    pendingStudentIds: const <String>{},
  );

  void mark(String studentId, AttendanceMark mark) {
    final marks = Map<String, AttendanceMark>.of(state.marks)
      ..[studentId] = mark;
    final pending = Set<String>.of(state.pendingStudentIds)..add(studentId);
    state = AttendanceDraftState(
      marks: Map<String, AttendanceMark>.unmodifiable(marks),
      pendingStudentIds: Set<String>.unmodifiable(pending),
    );
  }

  void completeDemoSync() {
    state = AttendanceDraftState(
      marks: state.marks,
      pendingStudentIds: const <String>{},
    );
  }
}

final _staffRouter = GoRouter(
  routes: [
    ShellRoute(
      builder: (context, state, child) =>
          StaffShell(location: state.uri.path, child: child),
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const StaffHomeScreen(),
        ),
        GoRoute(
          path: '/attendance',
          builder: (context, state) => const StaffAttendanceScreen(),
        ),
        GoRoute(
          path: '/gradebook',
          builder: (context, state) => const StaffGradebookScreen(),
        ),
        GoRoute(
          path: '/messages',
          builder: (context, state) => const StaffMessagesScreen(),
        ),
      ],
    ),
  ],
);

class StaffApp extends StatelessWidget {
  const StaffApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    debugShowCheckedModeBanner: false,
    routerConfig: _staffRouter,
    theme: SchoolTheme.light(),
    title: 'School Staff',
  );
}

class StaffShell extends ConsumerWidget {
  const StaffShell({required this.child, required this.location, super.key});

  final Widget child;
  final String location;

  static const _paths = ['/', '/attendance', '/gradebook', '/messages'];
  static const _destinations = [
    SchoolDestination(
      icon: Icons.home_outlined,
      label: 'Today',
      selectedIcon: Icons.home,
    ),
    SchoolDestination(
      icon: Icons.fact_check_outlined,
      label: 'Attendance',
      selectedIcon: Icons.fact_check,
    ),
    SchoolDestination(
      icon: Icons.edit_note_outlined,
      label: 'Gradebook',
      selectedIcon: Icons.edit_note,
    ),
    SchoolDestination(
      icon: Icons.forum_outlined,
      label: 'Messages',
      selectedIcon: Icons.forum,
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pendingCount = ref.watch(
      attendanceDraftProvider.select((state) => state.pendingCount),
    );
    final countStrings = SchoolCountStrings.of(context);
    final routeIndex = _paths.indexOf(location);

    return SchoolAdaptiveScaffold(
      actions: const [
        IconButton(
          icon: Icon(Icons.notifications_none),
          onPressed: null,
          tooltip: 'Notifications will be connected in a later checkpoint',
        ),
      ],
      body: child,
      destinations: _destinations,
      onDestinationSelected: (index) => context.go(_paths[index]),
      selectedIndex: routeIndex < 0 ? 0 : routeIndex,
      status: pendingCount == 0
          ? const SchoolStatusBanner(
              label: 'All changes synced',
              message: 'No attendance changes are waiting on this device.',
              tone: SchoolStatusTone.success,
            )
          : SchoolStatusBanner(
              label: 'Saved on device',
              message: countStrings.attendanceChangesWaiting(pendingCount),
              tone: SchoolStatusTone.warning,
            ),
      title: 'School Staff · Teacher',
    );
  }
}

class StaffHomeScreen extends StatelessWidget {
  const StaffHomeScreen({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      SchoolPageSection(
        description:
            'Assigned classes, substitutions and operational tasks for 29 July 2026.',
        title: 'Teacher day',
        child: Column(
          children: [
            SchoolPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Next class · Grade 5A',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: SchoolSpacing.sm),
                  const ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.calculate_outlined),
                    title: Text('Mathematics · 9:00 AM'),
                    subtitle: Text('Room 204 · 24 students'),
                  ),
                  const Divider(),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.fact_check_outlined),
                    onTap: () => context.go('/attendance'),
                    subtitle: const Text(
                      'Morning session · offline capture supported',
                    ),
                    title: const Text('Take attendance'),
                    trailing: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SchoolSpacing.md),
            SchoolPanel(
              child: Column(
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.edit_note_outlined),
                    onTap: () => context.go('/gradebook'),
                    subtitle: const Text('Draft scores · not published'),
                    title: const Text('Gradebook'),
                    trailing: const Icon(Icons.chevron_right),
                  ),
                  const Divider(),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.forum_outlined),
                    onTap: () => context.go('/messages'),
                    subtitle: const Text('Authorized school conversations'),
                    title: const Text('Messages'),
                    trailing: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class StaffAttendanceScreen extends ConsumerWidget {
  const StaffAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(attendanceDraftProvider);
    return ListView(
      children: [
        SchoolPageSection(
          description:
              'Grade 5A · Morning session. Changes remain recoverable until server acceptance.',
          title: 'Attendance draft',
          child: Column(
            children: [
              const SchoolStatusBanner(
                label: 'Development transport',
                message:
                    'The durable API sync adapter is the next checkpoint; this screen currently exercises the local draft state.',
                tone: SchoolStatusTone.information,
              ),
              const SizedBox(height: SchoolSpacing.md),
              SchoolPanel(
                child: Column(
                  children: [
                    for (
                      var index = 0;
                      index < rosterStudents.length;
                      index++
                    ) ...[
                      _AttendanceRow(
                        mark:
                            draft.marks[rosterStudents[index].id] ??
                            AttendanceMark.present,
                        onChanged: (mark) => ref
                            .read(attendanceDraftProvider.notifier)
                            .mark(rosterStudents[index].id, mark),
                        student: rosterStudents[index],
                      ),
                      if (index != rosterStudents.length - 1) const Divider(),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: SchoolSpacing.md),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.cloud_done_outlined),
                  label: Text(
                    draft.pendingCount == 0
                        ? 'No pending changes'
                        : 'Complete demo sync (${draft.pendingCount})',
                  ),
                  onPressed: draft.pendingCount == 0
                      ? null
                      : () => ref
                            .read(attendanceDraftProvider.notifier)
                            .completeDemoSync(),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class StaffGradebookScreen extends StatelessWidget {
  const StaffGradebookScreen({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      SchoolPageSection(
        description:
            'Draft assessment results only. Publishing and calculation remain server-governed.',
        title: 'Gradebook drafts',
        child: SchoolPanel(
          child: Column(
            children: const [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.assignment_outlined),
                title: Text('Mathematics quiz 3'),
                subtitle: Text('18 of 24 results entered · Draft'),
                trailing: Icon(Icons.chevron_right),
              ),
              Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.assignment_turned_in_outlined),
                title: Text('Term project'),
                subtitle: Text('24 of 24 results entered · Ready for review'),
                trailing: Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

class StaffMessagesScreen extends StatelessWidget {
  const StaffMessagesScreen({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    children: const [
      SchoolPageSection(
        description:
            'Conversation visibility follows relationship, class and communication permissions.',
        title: 'Messages',
        child: SchoolPanel(
          child: Column(
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(child: Icon(Icons.groups_outlined)),
                title: Text('Grade 5A guardians'),
                subtitle: Text('Class update · 11:40 AM'),
                trailing: Icon(Icons.chevron_right),
              ),
              Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(child: Icon(Icons.apartment_outlined)),
                title: Text('Academic office'),
                subtitle: Text('Assessment moderation · Yesterday'),
                trailing: Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

class _AttendanceRow extends StatelessWidget {
  const _AttendanceRow({
    required this.mark,
    required this.onChanged,
    required this.student,
  });

  final AttendanceMark mark;
  final ValueChanged<AttendanceMark> onChanged;
  final RosterStudent student;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: SchoolSpacing.xs),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(student.name, style: Theme.of(context).textTheme.titleMedium),
        Text(
          'Roll ${student.roll}',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: SchoolColors.operationalMuted,
          ),
        ),
        const SizedBox(height: SchoolSpacing.sm),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SegmentedButton<AttendanceMark>(
            onSelectionChanged: (selection) => onChanged(selection.first),
            segments: AttendanceMark.values
                .map(
                  (value) => ButtonSegment<AttendanceMark>(
                    icon: Icon(switch (value) {
                      AttendanceMark.present => Icons.check_circle_outline,
                      AttendanceMark.absent => Icons.cancel_outlined,
                      AttendanceMark.late => Icons.access_time_outlined,
                    }),
                    label: Text(value.label),
                    value: value,
                  ),
                )
                .toList(growable: false),
            selected: <AttendanceMark>{mark},
          ),
        ),
      ],
    ),
  );
}

final class RosterStudent {
  const RosterStudent({
    required this.id,
    required this.name,
    required this.roll,
  });

  final String id;
  final String name;
  final int roll;
}

const rosterStudents = <RosterStudent>[
  RosterStudent(id: 'student-001', name: 'Amina Rahman', roll: 1),
  RosterStudent(id: 'student-002', name: 'Farhan Ahmed', roll: 2),
  RosterStudent(id: 'student-003', name: 'Nusrat Jahan', roll: 3),
  RosterStudent(id: 'student-004', name: 'Rafi Islam', roll: 4),
  RosterStudent(id: 'student-005', name: 'Sara Khan', roll: 5),
];
