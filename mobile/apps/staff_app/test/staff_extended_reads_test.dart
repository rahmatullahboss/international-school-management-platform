import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_design_system/school_design_system.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_staff_app/main.dart';
import 'package:school_staff_domain/school_staff_domain.dart';

void main() {
  testWidgets('renders authoritative assessment state without substitute grades', (tester) async {
    final controller = StaffExtendedReadController(
      repository: _ExtendedRepository(),
      session: _teacherSession(),
    );
    await controller.initialize();

    await tester.pumpWidget(
      MaterialApp(
        theme: SchoolTheme.light(),
        home: Scaffold(body: StaffAuthoritativeGradebookScreen(controller: controller)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Fractions quiz'), findsOneWidget);
    expect(find.textContaining('Entered 12 / 24'), findsOneWidget);
    expect(find.textContaining('Locked'), findsOneWidget);
    expect(find.textContaining('87.5'), findsNothing);
    controller.dispose();
  });

  testWidgets('opens only the authoritative post-join conversation messages', (tester) async {
    final controller = StaffExtendedReadController(
      repository: _ExtendedRepository(),
      session: _teacherSession(),
    );
    await controller.initialize();

    await tester.pumpWidget(
      MaterialApp(
        theme: SchoolTheme.light(),
        home: Scaffold(body: StaffAuthoritativeMessagesScreen(controller: controller)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Homework support'), findsOneWidget);
    expect(find.textContaining('Student One'), findsOneWidget);
    await tester.tap(find.textContaining('Homework support'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Please review question 4.'), findsOneWidget);
    expect(find.textContaining('read-only'), findsOneWidget);
    controller.dispose();
  });

  test('scope update clears old conversation messages before reloading', () async {
    final repository = _ExtendedRepository();
    final controller = StaffExtendedReadController(
      repository: repository,
      session: _teacherSession(),
    );
    await controller.initialize();
    await controller.loadConversationMessages('conversation-1');
    expect(controller.conversationMessages, isNotEmpty);

    await controller.updateScope(
      repository: repository,
      session: _teacherSession(campusId: 'campus-2'),
    );

    expect(controller.conversationMessages, isEmpty);
    expect(controller.assessments, isNotNull);
    controller.dispose();
  });
}

final class _ExtendedRepository implements TeacherExtendedReadRepository {
  @override
  Future<TeacherAssessmentListReadModel> loadAssessments(
    SchoolSession session, {
    String correlationId = 'teacher-assessments',
  }) async => TeacherAssessmentListReadModel(
    assessments: [
      TeacherAssessmentSummary(
        assessmentId: 'assessment-1',
        assessmentTitle: 'Fractions quiz',
        categoryLabel: 'Quiz',
        dueAt: DateTime.parse('2026-08-23T03:00:00Z'),
        enteredCount: 12,
        lockState: TeacherGradebookLockState.locked,
        maximumScoreUnits: 1000000,
        rosterCount: 24,
        scoreScale: 10000,
        sectionId: 'section-1',
        sectionLabel: 'Grade 5A',
        state: TeacherAssessmentState.draft,
        subjectLabel: 'Mathematics',
        version: 2,
      ),
    ],
    generatedAt: DateTime.parse('2026-08-22T03:00:00Z'),
    hasMore: false,
  );

  @override
  Future<TeacherConversationListReadModel> loadConversations(
    SchoolSession session, {
    String correlationId = 'teacher-conversations',
  }) async => TeacherConversationListReadModel(
    conversations: [
      TeacherConversationSummary(
        canReply: true,
        conversationId: 'conversation-1',
        latestMessageAt: DateTime.parse('2026-08-22T03:00:00Z'),
        studentDisplayName: 'Student One',
        studentId: 'student-1',
        subject: 'Homework support',
      ),
    ],
    generatedAt: DateTime.parse('2026-08-22T03:00:00Z'),
    hasMore: false,
  );

  @override
  Future<TeacherConversationMessagesReadModel> loadConversationMessages({
    required String conversationId,
    required SchoolSession session,
    String correlationId = 'teacher-conversation-messages',
  }) async => TeacherConversationMessagesReadModel(
    conversationId: conversationId,
    hasMore: false,
    messages: [
      TeacherConversationMessage(
        authorLabel: 'Teacher One',
        authoredByViewer: true,
        body: 'Please review question 4.',
        messageId: 'message-1',
        sentAt: DateTime.parse('2026-08-22T03:00:00Z'),
      ),
    ],
    studentDisplayName: 'Student One',
    subject: 'Homework support',
  );
}

SchoolSession _teacherSession({String campusId = 'campus-1'}) => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.teacher,
  availablePersonas: const {SchoolPersona.teacher},
  campusId: campusId,
  capabilities: const {
    SchoolCapability.gradesWrite,
    SchoolCapability.messagesRead,
  },
  locale: 'en-BD',
  tenantId: 'tenant-1',
  timeZone: 'Asia/Dhaka',
);
