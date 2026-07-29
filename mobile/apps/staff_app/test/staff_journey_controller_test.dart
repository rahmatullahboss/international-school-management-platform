import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_staff_app/main.dart';
import 'package:school_staff_domain/school_staff_domain.dart';

void main() {
  test('loads the authorized teacher day', () async {
    final repository = FakeTeacherRepository(today: teacherToday());
    final controller = StaffJourneyController(
      repository: repository,
      session: teacherSession(),
    );

    await controller.initialize();

    expect(controller.state.phase, StaffJourneyPhase.ready);
    expect(controller.state.today?.teacherDisplayName, 'Teacher One');
    expect(controller.state.today?.meetings.single.meetingId, 'meeting-1');
    controller.dispose();
  });

  test('loads only the roster for an assigned meeting', () async {
    final repository = FakeTeacherRepository(
      roster: teacherRoster(),
      today: teacherToday(),
    );
    final controller = StaffJourneyController(
      repository: repository,
      session: teacherSession(),
    );

    await controller.initialize();
    await controller.loadRoster('meeting-1');

    expect(controller.state.activeRoster?.meetingId, 'meeting-1');
    expect(
      controller.state.activeRoster?.students.single.studentId,
      'student-1',
    );
    expect(repository.loadedMeetingIds, ['meeting-1']);
    controller.dispose();
  });

  test(
    'rejects unassigned meeting roster requests before repository transport',
    () async {
      final repository = FakeTeacherRepository(today: teacherToday());
      final controller = StaffJourneyController(
        repository: repository,
        session: teacherSession(),
      );

      await controller.initialize();
      await controller.loadRoster('meeting-other');

      expect(controller.state.rosterReasonCode, 'TEACHER_MEETING_NOT_ASSIGNED');
      expect(repository.loadedMeetingIds, isEmpty);
      controller.dispose();
    },
  );

  test('discards a slower stale roster response', () async {
    final first = Completer<TeacherRosterReadModel>();
    final repository = SequencedTeacherRepository(
      rosters: <String, Future<TeacherRosterReadModel>>{
        'meeting-1': first.future,
        'meeting-2': Future<TeacherRosterReadModel>.value(
          teacherRoster(meetingId: 'meeting-2', sectionId: 'section-2'),
        ),
      },
      today: teacherToday(includeSecondMeeting: true),
    );
    final controller = StaffJourneyController(
      repository: repository,
      session: teacherSession(),
    );

    await controller.initialize();
    final firstLoad = controller.loadRoster('meeting-1');
    await controller.loadRoster('meeting-2');
    first.complete(teacherRoster());
    await firstLoad;

    expect(controller.state.activeRoster?.meetingId, 'meeting-2');
    controller.dispose();
  });

  test('session scope change reloads and clears the previous roster', () async {
    final repository = FakeTeacherRepository(
      roster: teacherRoster(),
      today: teacherToday(),
    );
    final controller = StaffJourneyController(
      repository: repository,
      session: teacherSession(),
    );

    await controller.initialize();
    await controller.loadRoster('meeting-1');
    await controller.updateSession(
      teacherSession(campusId: 'campus-2', tenantId: 'tenant-2'),
    );

    expect(repository.todayLoadCount, 2);
    expect(controller.state.activeRoster, isNull);
    controller.dispose();
  });

  test('fails closed when teacher day cannot be verified', () async {
    final repository = FakeTeacherRepository(
      error: const TeacherDomainException('TEACHER_TODAY_UNAVAILABLE'),
      today: teacherToday(),
    );
    final controller = StaffJourneyController(
      repository: repository,
      session: teacherSession(),
    );

    await controller.initialize();

    expect(controller.state.phase, StaffJourneyPhase.failed);
    expect(controller.state.reasonCode, 'TEACHER_TODAY_UNAVAILABLE');
    expect(controller.state.today, isNull);
    controller.dispose();
  });
}

final class FakeTeacherRepository implements TeacherJourneyRepository {
  FakeTeacherRepository({this.error, this.roster, required this.today});

  final Object? error;
  final TeacherRosterReadModel? roster;
  final TeacherTodayReadModel today;
  int todayLoadCount = 0;
  final List<String> loadedMeetingIds = <String>[];

  @override
  Future<TeacherTodayReadModel> loadToday(
    SchoolSession session, {
    String correlationId = 'teacher-today',
  }) async {
    todayLoadCount++;
    final failure = error;
    if (failure != null) throw failure;
    return today;
  }

  @override
  Future<TeacherRosterReadModel> loadRoster({
    required String meetingId,
    required SchoolSession session,
    String correlationId = 'teacher-roster',
  }) async {
    loadedMeetingIds.add(meetingId);
    return roster ?? teacherRoster(meetingId: meetingId);
  }

  @override
  Future<TeacherWriteReceipt> saveGradeDraft({
    required TeacherGradeDraftCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-grade-draft',
  }) => throw UnimplementedError();

  @override
  Future<TeacherWriteReceipt> submitAttendance({
    required TeacherAttendanceBatchCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-attendance-batch',
  }) => throw UnimplementedError();
}

final class SequencedTeacherRepository implements TeacherJourneyRepository {
  SequencedTeacherRepository({required this.rosters, required this.today});

  final Map<String, Future<TeacherRosterReadModel>> rosters;
  final TeacherTodayReadModel today;

  @override
  Future<TeacherTodayReadModel> loadToday(
    SchoolSession session, {
    String correlationId = 'teacher-today',
  }) async => today;

  @override
  Future<TeacherRosterReadModel> loadRoster({
    required String meetingId,
    required SchoolSession session,
    String correlationId = 'teacher-roster',
  }) =>
      rosters[meetingId] ??
      Future<TeacherRosterReadModel>.error(
        const TeacherDomainException('TEACHER_ROSTER_UNAVAILABLE'),
      );

  @override
  Future<TeacherWriteReceipt> saveGradeDraft({
    required TeacherGradeDraftCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-grade-draft',
  }) => throw UnimplementedError();

  @override
  Future<TeacherWriteReceipt> submitAttendance({
    required TeacherAttendanceBatchCommand command,
    required SchoolSession session,
    String correlationId = 'teacher-attendance-batch',
  }) => throw UnimplementedError();
}

TeacherTodayReadModel teacherToday({bool includeSecondMeeting = false}) =>
    TeacherTodayReadModel(
      campusId: 'campus-1',
      generatedAt: DateTime.parse('2026-07-30T08:00:00+06:00'),
      meetings: <TeacherMeetingSummary>[
        teacherMeeting(),
        if (includeSecondMeeting)
          teacherMeeting(meetingId: 'meeting-2', sectionId: 'section-2'),
      ],
      teacherDisplayName: 'Teacher One',
    );

TeacherMeetingSummary teacherMeeting({
  String meetingId = 'meeting-1',
  String sectionId = 'section-1',
}) => TeacherMeetingSummary(
  attendanceStatus: TeacherAttendanceStatus.notStarted,
  endsAt: DateTime.parse('2026-07-30T10:00:00+06:00'),
  meetingId: meetingId,
  roomLabel: 'Room 204',
  rosterCount: 24,
  sectionId: sectionId,
  sectionLabel: sectionId == 'section-1' ? 'Grade 5A' : 'Grade 6B',
  startsAt: DateTime.parse('2026-07-30T09:00:00+06:00'),
  subjectLabel: 'Mathematics',
);

TeacherRosterReadModel teacherRoster({
  String meetingId = 'meeting-1',
  String sectionId = 'section-1',
}) => TeacherRosterReadModel(
  meetingId: meetingId,
  sectionId: sectionId,
  students: <TeacherRosterStudent>[
    TeacherRosterStudent(
      displayName: 'Student One',
      rollLabel: 'Roll 01',
      studentId: 'student-1',
    ),
  ],
  version: 3,
);

SchoolSession teacherSession({
  String campusId = 'campus-1',
  String tenantId = 'tenant-1',
}) => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.teacher,
  availablePersonas: const {SchoolPersona.teacher},
  campusId: campusId,
  capabilities: const {
    SchoolCapability.attendanceTake,
    SchoolCapability.gradesWrite,
    SchoolCapability.timetableRead,
  },
  locale: 'en-BD',
  tenantId: tenantId,
  timeZone: 'Asia/Dhaka',
);
