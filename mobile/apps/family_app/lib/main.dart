import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:school_api_client/family_interaction_api.dart';
import 'package:school_api_client/family_read_api.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_app_bootstrap/school_app_bootstrap.dart';
import 'package:school_authentication/school_authentication.dart';
import 'package:school_design_system/school_application.dart';
import 'package:school_design_system/school_count_strings.dart';
import 'package:school_design_system/school_design_system.dart';
import 'package:school_family_app/family_date_only_presentation.dart';
import 'package:school_family_app/family_interaction_strings.dart';
import 'package:school_family_app/family_production_strings.dart';
import 'package:school_family_app/family_utc_presentation.dart';
import 'package:school_family_domain/family_interactions.dart';
import 'package:school_family_domain/school_family_domain.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_mobile_core/notification_routing.dart';
import 'package:school_secure_documents/school_secure_documents.dart';

part 'family_interaction_controller.dart';
part 'family_interaction_screens.dart';
part 'family_journey_controller.dart';
part 'production_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final localeController = SchoolLocaleController.secure(
    storageKey: 'school.mobile.family.locale.v1',
  );
  await localeController.initialize();

  runApp(
    SchoolLocalePreferenceHost(
      controller: localeController,
      appBuilder: (context, controller) =>
          ProviderScope(child: FamilyProductionApp()),
    ),
  );
}

final familyPersonaProvider =
    NotifierProvider<FamilyPersonaController, SchoolPersona>(
      FamilyPersonaController.new,
    );

final class FamilyPersonaController extends Notifier<SchoolPersona> {
  @override
  SchoolPersona build() => SchoolPersona.guardian;

  void select(SchoolPersona persona) {
    if (persona == SchoolPersona.guardian || persona == SchoolPersona.student) {
      state = persona;
    }
  }
}

final _familyRouter = GoRouter(
  routes: [
    ShellRoute(
      builder: (context, state, child) =>
          FamilyShell(location: state.uri.path, child: child),
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const FamilyHomeScreen(),
        ),
        GoRoute(
          path: '/attendance',
          builder: (context, state) => const FamilyAttendanceScreen(),
        ),
        GoRoute(
          path: '/results',
          builder: (context, state) => const FamilyResultsScreen(),
        ),
        GoRoute(
          path: '/fees',
          builder: (context, state) => const FamilyFeesScreen(),
        ),
        GoRoute(
          path: '/messages',
          builder: (context, state) => const FamilyMessagesScreen(),
        ),
      ],
    ),
  ],
);

class FamilyApp extends StatelessWidget {
  const FamilyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    debugShowCheckedModeBanner: false,
    routerConfig: _familyRouter,
    theme: SchoolTheme.light(),
    title: 'School Family',
  );
}

class FamilyShell extends ConsumerWidget {
  const FamilyShell({required this.child, required this.location, super.key});

  final Widget child;
  final String location;

  static const _guardianPaths = [
    '/',
    '/attendance',
    '/results',
    '/fees',
    '/messages',
  ];
  static const _studentPaths = ['/', '/attendance', '/results', '/messages'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final persona = ref.watch(familyPersonaProvider);
    final paths = persona == SchoolPersona.guardian
        ? _guardianPaths
        : _studentPaths;
    final destinations = <SchoolDestination>[
      const SchoolDestination(
        icon: Icons.home_outlined,
        label: 'Home',
        selectedIcon: Icons.home,
      ),
      const SchoolDestination(
        icon: Icons.fact_check_outlined,
        label: 'Attendance',
        selectedIcon: Icons.fact_check,
      ),
      const SchoolDestination(
        icon: Icons.school_outlined,
        label: 'Results',
        selectedIcon: Icons.school,
      ),
      if (persona == SchoolPersona.guardian)
        const SchoolDestination(
          icon: Icons.receipt_long_outlined,
          label: 'Fees',
          selectedIcon: Icons.receipt_long,
        ),
      const SchoolDestination(
        icon: Icons.forum_outlined,
        label: 'Messages',
        selectedIcon: Icons.forum,
      ),
    ];
    final routeIndex = paths.indexOf(location);

    return SchoolAdaptiveScaffold(
      actions: [
        PopupMenuButton<SchoolPersona>(
          icon: const Icon(Icons.switch_account_outlined),
          initialValue: persona,
          itemBuilder: (context) => const [
            PopupMenuItem(
              value: SchoolPersona.guardian,
              child: Text('Guardian profile'),
            ),
            PopupMenuItem(
              value: SchoolPersona.student,
              child: Text('Student profile'),
            ),
          ],
          onSelected: (selected) {
            ref.read(familyPersonaProvider.notifier).select(selected);
            if (selected == SchoolPersona.student && location == '/fees') {
              context.go('/');
            }
          },
          tooltip: 'Switch profile',
        ),
      ],
      body: child,
      destinations: destinations,
      onDestinationSelected: (index) => context.go(paths[index]),
      selectedIndex: routeIndex < 0 ? 0 : routeIndex,
      status: const SchoolStatusBanner(
        label: 'Up to date',
        message: 'Published school information is available on this device.',
        tone: SchoolStatusTone.success,
      ),
      title: 'School Family · ${persona.label}',
    );
  }
}

class FamilyHomeScreen extends ConsumerWidget {
  const FamilyHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final persona = ref.watch(familyPersonaProvider);
    return ListView(
      children: [
        SchoolPageSection(
          description: persona == SchoolPersona.guardian
              ? 'Household view for authorized children and school tasks.'
              : 'Your published timetable, attendance, results and messages.',
          title: persona == SchoolPersona.guardian
              ? 'Family overview'
              : 'My school day',
          child: Column(
            children: [
              SchoolPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      persona == SchoolPersona.guardian
                          ? 'Amina Rahman · Grade 5'
                          : 'Today · Wednesday',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: SchoolSpacing.sm),
                    const ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.schedule_outlined),
                      title: Text('Mathematics · 9:00 AM'),
                      subtitle: Text(
                        'Room 204 · Published timetable · Asia/Dhaka',
                      ),
                    ),
                    const Divider(),
                    const ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.menu_book_outlined),
                      title: Text('English · 10:15 AM'),
                      subtitle: Text('Room 107 · Ms. Karim'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SchoolSpacing.md),
              SchoolPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Needs attention',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: SchoolSpacing.sm),
                    _TaskLink(
                      icon: Icons.fact_check_outlined,
                      label: 'Review this month’s attendance',
                      onTap: () => context.go('/attendance'),
                      supporting: 'Updated after the latest published session',
                    ),
                    const Divider(),
                    _TaskLink(
                      icon: Icons.school_outlined,
                      label: 'Term results are available',
                      onTap: () => context.go('/results'),
                      supporting: 'Published by the academic office',
                    ),
                    if (persona == SchoolPersona.guardian) ...[
                      const Divider(),
                      _TaskLink(
                        icon: Icons.receipt_long_outlined,
                        label: 'One invoice is due',
                        onTap: () => context.go('/fees'),
                        supporting: 'Balance is traced to the issued invoice',
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class FamilyAttendanceScreen extends ConsumerWidget {
  const FamilyAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final persona = ref.watch(familyPersonaProvider);
    return ListView(
      children: [
        SchoolPageSection(
          description:
              'Published sessions through 29 July 2026. Corrections may change the total.',
          title: persona == SchoolPersona.guardian
              ? 'Amina’s attendance'
              : 'My attendance',
          child: SchoolPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '96% present',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: SchoolSpacing.xs),
                const Text(
                  'Definition: present sessions divided by finalized instructional sessions.',
                ),
                const Divider(height: SchoolSpacing.lg),
                const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.check_circle_outline),
                  title: Text('Present · 48 sessions'),
                  subtitle: Text('Source: finalized attendance sessions'),
                ),
                const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.access_time_outlined),
                  title: Text('Late · 1 session'),
                  subtitle: Text('12 July · corrected by attendance office'),
                ),
                const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.event_busy_outlined),
                  title: Text('Absent · 1 session'),
                  subtitle: Text('18 July · notice acknowledged'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class FamilyResultsScreen extends StatelessWidget {
  const FamilyResultsScreen({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      SchoolPageSection(
        description:
            'Only published results are shown. Calculations remain governed by the academic module.',
        title: 'Published results',
        child: SchoolPanel(
          child: Column(
            children: const [
              _ResultRow(
                subject: 'Mathematics',
                result: 'A',
                score: '88 / 100',
              ),
              Divider(),
              _ResultRow(subject: 'English', result: 'A-', score: '84 / 100'),
              Divider(),
              _ResultRow(subject: 'Science', result: 'B+', score: '79 / 100'),
            ],
          ),
        ),
      ),
    ],
  );
}

class FamilyFeesScreen extends ConsumerWidget {
  const FamilyFeesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final persona = ref.watch(familyPersonaProvider);
    if (persona != SchoolPersona.guardian) {
      return const SchoolPageSection(
        title: 'Page unavailable',
        child: SchoolStatusBanner(
          label: 'Guardian access required',
          message: 'This page is not available for the selected profile.',
          tone: SchoolStatusTone.information,
        ),
      );
    }

    return ListView(
      children: [
        SchoolPageSection(
          description:
              'Balance shown from issued invoices and allocated payments as of 29 July 2026.',
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
                  subtitle: Text('Allocated 5 July 2026 · Receipt RCPT-1042'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class FamilyMessagesScreen extends StatelessWidget {
  const FamilyMessagesScreen({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    children: const [
      SchoolPageSection(
        description:
            'Only conversations authorized for the selected school profile are listed.',
        title: 'Messages',
        child: SchoolPanel(
          child: Column(
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(child: Icon(Icons.campaign_outlined)),
                title: Text('School office'),
                subtitle: Text('Term calendar update · 2 hours ago'),
                trailing: Icon(Icons.chevron_right),
              ),
              Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(child: Icon(Icons.person_outline)),
                title: Text('Ms. Karim'),
                subtitle: Text('English class note · Yesterday'),
                trailing: Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

class _TaskLink extends StatelessWidget {
  const _TaskLink({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.supporting,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String supporting;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(icon),
    onTap: onTap,
    subtitle: Text(supporting),
    title: Text(label),
    trailing: const Icon(Icons.chevron_right),
  );
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({
    required this.result,
    required this.score,
    required this.subject,
  });

  final String subject;
  final String result;
  final String score;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(subject),
    subtitle: Text('Published score · $score'),
    trailing: Text(result, style: Theme.of(context).textTheme.titleMedium),
  );
}
