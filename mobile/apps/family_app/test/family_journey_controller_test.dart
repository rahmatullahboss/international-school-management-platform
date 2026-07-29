import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:school_family_app/main.dart';
import 'package:school_family_domain/school_family_domain.dart';
import 'package:school_mobile_core/mobile_core.dart';

void main() {
  test('loads profiles and the active student dashboard', () async {
    final repository = FakeFamilyRepository();
    final controller = FamilyJourneyController(
      repository: repository,
      session: guardianSession(),
    );

    await controller.initialize();

    expect(controller.state.phase, FamilyJourneyPhase.ready);
    expect(controller.state.directory?.activeStudentId, 'student-1');
    expect(controller.state.dashboard?.student.studentId, 'student-1');
    expect(repository.dashboardRequests, ['student-1']);
    controller.dispose();
  });

  test('switches children and discards a slower stale dashboard response', () async {
    final repository = ControlledFamilyRepository();
    final controller = FamilyJourneyController(
      repository: repository,
      session: guardianSession(),
    );
    final initialization = controller.initialize();
    await repository.profileRequested.future;
    repository.profileResponse.complete(directory());
    await repository.firstDashboardRequested.future;

    final switchFuture = controller.selectStudent('student-2');
    await repository.secondDashboardRequested.future;
    repository.secondDashboardResponse.complete(dashboard('student-2'));
    await switchFuture;
    repository.firstDashboardResponse.complete(dashboard('student-1'));
    await initialization;

    expect(controller.state.phase, FamilyJourneyPhase.ready);
    expect(controller.state.directory?.activeStudentId, 'student-2');
    expect(controller.state.dashboard?.student.studentId, 'student-2');
    controller.dispose();
  });

  test('fails closed when dashboard identity differs from selected child', () async {
    final repository = FakeFamilyRepository(
      dashboardFactory: (studentId) => dashboard('different-student'),
    );
    final controller = FamilyJourneyController(
      repository: repository,
      session: guardianSession(),
    );

    await controller.initialize();

    expect(controller.state.phase, FamilyJourneyPhase.failed);
    expect(
      controller.state.reasonCode,
      'FAMILY_DASHBOARD_PROFILE_MISMATCH',
    );
    controller.dispose();
  });

  test('reloads when tenant, campus, persona or capabilities change', () async {
    final repository = FakeFamilyRepository();
    final controller = FamilyJourneyController(
      repository: repository,
      session: guardianSession(),
    );
    await controller.initialize();

    await controller.updateSession(
      guardianSession(
        capabilities: const {
          SchoolCapability.attendanceRead,
          SchoolCapability.gradesReadPublished,
        },
      ),
    );

    expect(repository.profileRequests, 2);
    controller.dispose();
  });
}

SchoolSession guardianSession({Set<String>? capabilities}) => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.guardian,
  availablePersonas: const {SchoolPersona.guardian},
  campusId: 'campus-1',
  capabilities:
      capabilities ??
      const {
        SchoolCapability.attendanceRead,
        SchoolCapability.billingRead,
        SchoolCapability.gradesReadPublished,
        SchoolCapability.messagesRead,
      },
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);

FamilyProfileDirectory directory() => FamilyProfileDirectory(
  accountId: 'account-1',
  activeStudentId: 'student-1',
  students: [student('student-1'), student('student-2')],
);

FamilyStudentProfile student(String studentId) => FamilyStudentProfile(
  campusId: 'campus-1',
  displayName: studentId == 'student-1' ? 'Student One' : 'Student Two',
  gradeLabel: studentId == 'student-1' ? 'Grade 7' : 'Grade 4',
  relationshipLabel: 'Child',
  studentId: studentId,
);

FamilyDashboardReadModel dashboard(String studentId) =>
    FamilyDashboardReadModel(
      attendance: FamilyAttendanceReadModel(
        absentSessions: 1,
        lateSessions: 1,
        presentSessions: 48,
        summaryLabel: 'Published attendance · 96%',
        totalSessions: 50,
      ),
      fees: null,
      generatedAt: DateTime.utc(2026, 7, 30),
      messages: FamilyMessageReadModel(unreadCount: 0),
      publishedResults: const [],
      student: student(studentId),
      timetable: const [],
    );

final class FakeFamilyRepository implements FamilyReadRepository {
  FakeFamilyRepository({
    FamilyDashboardReadModel Function(String studentId)? dashboardFactory,
  }) : dashboardFactory = dashboardFactory ?? dashboard;

  final FamilyDashboardReadModel Function(String studentId) dashboardFactory;
  int profileRequests = 0;
  final List<String> dashboardRequests = [];

  @override
  Future<FamilyDashboardReadModel> loadDashboard({
    required SchoolSession session,
    required String studentId,
  }) async {
    dashboardRequests.add(studentId);
    return dashboardFactory(studentId);
  }

  @override
  Future<FamilyProfileDirectory> loadProfiles(SchoolSession session) async {
    profileRequests++;
    return directory();
  }
}

final class ControlledFamilyRepository implements FamilyReadRepository {
  final profileRequested = Completer<void>();
  final profileResponse = Completer<FamilyProfileDirectory>();
  final firstDashboardRequested = Completer<void>();
  final secondDashboardRequested = Completer<void>();
  final firstDashboardResponse = Completer<FamilyDashboardReadModel>();
  final secondDashboardResponse = Completer<FamilyDashboardReadModel>();
  int dashboardCount = 0;

  @override
  Future<FamilyDashboardReadModel> loadDashboard({
    required SchoolSession session,
    required String studentId,
  }) {
    dashboardCount++;
    if (dashboardCount == 1) {
      firstDashboardRequested.complete();
      return firstDashboardResponse.future;
    }
    secondDashboardRequested.complete();
    return secondDashboardResponse.future;
  }

  @override
  Future<FamilyProfileDirectory> loadProfiles(SchoolSession session) {
    profileRequested.complete();
    return profileResponse.future;
  }
}
