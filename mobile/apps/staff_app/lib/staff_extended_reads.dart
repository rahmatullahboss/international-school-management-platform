part of 'main.dart';

final class StaffExtendedReadController extends ChangeNotifier {
  StaffExtendedReadController({
    required TeacherExtendedReadRepository repository,
    required SchoolSession session,
  }) : _repository = repository,
       _session = session;

  TeacherExtendedReadRepository _repository;
  SchoolSession _session;
  TeacherAssessmentListReadModel? assessments;
  TeacherConversationListReadModel? conversations;
  final Map<String, TeacherConversationMessagesReadModel> conversationMessages =
      {};
  bool assessmentsLoading = false;
  bool conversationsLoading = false;
  final Set<String> messagesLoading = <String>{};
  String? assessmentsError;
  String? conversationsError;
  final Map<String, String> messageErrors = {};

  Future<void> initialize() async {
    await Future.wait([loadAssessments(), loadConversations()]);
  }

  Future<void> updateScope({
    required TeacherExtendedReadRepository repository,
    required SchoolSession session,
  }) async {
    _repository = repository;
    _session = session;
    assessments = null;
    conversations = null;
    conversationMessages.clear();
    assessmentsError = null;
    conversationsError = null;
    messageErrors.clear();
    notifyListeners();
    await initialize();
  }

  Future<void> loadAssessments() async {
    if (!_session.can(SchoolCapability.gradesWrite)) return;
    assessmentsLoading = true;
    assessmentsError = null;
    notifyListeners();
    try {
      assessments = await _repository.loadAssessments(_session);
    } on Object {
      assessmentsError = 'STAFF_ASSESSMENTS_UNAVAILABLE';
    } finally {
      assessmentsLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadConversations() async {
    if (!_session.can(SchoolCapability.messagesRead)) return;
    conversationsLoading = true;
    conversationsError = null;
    notifyListeners();
    try {
      conversations = await _repository.loadConversations(_session);
    } on Object {
      conversationsError = 'STAFF_CONVERSATIONS_UNAVAILABLE';
    } finally {
      conversationsLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadConversationMessages(String conversationId) async {
    if (!_session.can(SchoolCapability.messagesRead) ||
        messagesLoading.contains(conversationId)) {
      return;
    }
    messagesLoading.add(conversationId);
    messageErrors.remove(conversationId);
    notifyListeners();
    try {
      conversationMessages[conversationId] = await _repository
          .loadConversationMessages(
            conversationId: conversationId,
            session: _session,
          );
    } on Object {
      messageErrors[conversationId] = 'STAFF_CONVERSATION_MESSAGES_UNAVAILABLE';
    } finally {
      messagesLoading.remove(conversationId);
      notifyListeners();
    }
  }
}

class StaffAuthoritativeGradebookScreen extends StatelessWidget {
  const StaffAuthoritativeGradebookScreen({
    required this.controller,
    super.key,
  });

  final StaffExtendedReadController controller;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final strings = StaffExtendedReadStrings.forLocale(
        Localizations.localeOf(context),
      );
      final data = controller.assessments;
      if (data == null && controller.assessmentsLoading) {
        return const Center(child: CircularProgressIndicator());
      }
      if (data == null) {
        return _StaffExtendedReadFailure(
          description: strings.assessmentsDescription,
          onRetry: controller.loadAssessments,
          title: strings.assessmentsTitle,
        );
      }
      return RefreshIndicator(
        onRefresh: controller.loadAssessments,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SchoolPageSection(
              description: strings.assessmentsDescription,
              title: strings.assessmentsTitle,
              child: SchoolPanel(
                child: data.assessments.isEmpty
                    ? SchoolStatusBanner(
                        label: strings.assessmentsTitle,
                        message: strings.assessmentsEmpty,
                        tone: SchoolStatusTone.information,
                      )
                    : Column(
                        children: [
                          for (
                            var index = 0;
                            index < data.assessments.length;
                            index++
                          ) ...[
                            _TeacherAssessmentTile(
                              assessment: data.assessments[index],
                            ),
                            if (index != data.assessments.length - 1)
                              const Divider(),
                          ],
                        ],
                      ),
              ),
            ),
            if (data.hasMore)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  SchoolSpacing.md,
                  0,
                  SchoolSpacing.md,
                  SchoolSpacing.md,
                ),
                child: SchoolStatusBanner(
                  label: strings.assessmentsTitle,
                  message: strings.latestWindowNotice,
                  tone: SchoolStatusTone.information,
                ),
              ),
          ],
        ),
      );
    },
  );
}

class _TeacherAssessmentTile extends StatelessWidget {
  const _TeacherAssessmentTile({required this.assessment});

  final TeacherAssessmentSummary assessment;

  @override
  Widget build(BuildContext context) {
    final strings = StaffExtendedReadStrings.forLocale(
      Localizations.localeOf(context),
    );
    final stateLabel = assessment.isReadOnly ? strings.locked : strings.open;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        assessment.isReadOnly ? Icons.lock_outline : Icons.assignment_outlined,
      ),
      title: Text(SchoolBidirectionalText.isolate(assessment.assessmentTitle)),
      subtitle: Text(
        '${SchoolBidirectionalText.isolate(assessment.subjectLabel)} · '
        '${SchoolBidirectionalText.isolate(assessment.sectionLabel)}\n'
        '${strings.enteredCount(assessment.enteredCount, assessment.rosterCount)} · $stateLabel',
      ),
      isThreeLine: true,
    );
  }
}

class StaffAuthoritativeMessagesScreen extends StatelessWidget {
  const StaffAuthoritativeMessagesScreen({required this.controller, super.key});

  final StaffExtendedReadController controller;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final strings = StaffExtendedReadStrings.forLocale(
        Localizations.localeOf(context),
      );
      final data = controller.conversations;
      if (data == null && controller.conversationsLoading) {
        return const Center(child: CircularProgressIndicator());
      }
      if (data == null) {
        return _StaffExtendedReadFailure(
          description: strings.conversationsDescription,
          onRetry: controller.loadConversations,
          title: strings.conversationsTitle,
        );
      }
      return RefreshIndicator(
        onRefresh: controller.loadConversations,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SchoolPageSection(
              description: strings.conversationsDescription,
              title: strings.conversationsTitle,
              child: SchoolPanel(
                child: data.conversations.isEmpty
                    ? SchoolStatusBanner(
                        label: strings.conversationsTitle,
                        message: strings.conversationsEmpty,
                        tone: SchoolStatusTone.information,
                      )
                    : Column(
                        children: [
                          for (
                            var index = 0;
                            index < data.conversations.length;
                            index++
                          ) ...[
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.forum_outlined),
                              title: Text(
                                SchoolBidirectionalText.isolate(
                                  data.conversations[index].subject,
                                ),
                              ),
                              subtitle: Text(
                                SchoolBidirectionalText.isolate(
                                  data.conversations[index].studentDisplayName,
                                ),
                              ),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => _openConversation(
                                context,
                                data.conversations[index],
                              ),
                            ),
                            if (index != data.conversations.length - 1)
                              const Divider(),
                          ],
                        ],
                      ),
              ),
            ),
            if (data.hasMore)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  SchoolSpacing.md,
                  0,
                  SchoolSpacing.md,
                  SchoolSpacing.md,
                ),
                child: SchoolStatusBanner(
                  label: strings.conversationsTitle,
                  message: strings.latestWindowNotice,
                  tone: SchoolStatusTone.information,
                ),
              ),
          ],
        ),
      );
    },
  );

  void _openConversation(
    BuildContext context,
    TeacherConversationSummary conversation,
  ) {
    unawaited(controller.loadConversationMessages(conversation.conversationId));
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => FractionallySizedBox(
        heightFactor: 0.8,
        child: _TeacherConversationSheet(
          controller: controller,
          conversation: conversation,
        ),
      ),
    );
  }
}

class _TeacherConversationSheet extends StatelessWidget {
  const _TeacherConversationSheet({
    required this.controller,
    required this.conversation,
  });

  final StaffExtendedReadController controller;
  final TeacherConversationSummary conversation;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final strings = StaffExtendedReadStrings.forLocale(
        Localizations.localeOf(context),
      );
      final data = controller.conversationMessages[conversation.conversationId];
      final loading = controller.messagesLoading.contains(
        conversation.conversationId,
      );
      return SafeArea(
        child: Column(
          children: [
            ListTile(
              title: Text(
                SchoolBidirectionalText.isolate(conversation.subject),
              ),
              subtitle: Text(
                '${SchoolBidirectionalText.isolate(conversation.studentDisplayName)} · '
                '${strings.readOnlyConversation}',
              ),
              trailing: IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: data == null
                  ? Center(
                      child: loading
                          ? const CircularProgressIndicator()
                          : FilledButton.icon(
                              icon: const Icon(Icons.refresh),
                              label: Text(strings.refresh),
                              onPressed: () => unawaited(
                                controller.loadConversationMessages(
                                  conversation.conversationId,
                                ),
                              ),
                            ),
                    )
                  : data.messages.isEmpty
                  ? Center(child: Text(strings.messagesEmpty))
                  : ListView.separated(
                      padding: const EdgeInsets.all(SchoolSpacing.md),
                      itemCount: data.messages.length,
                      separatorBuilder: (context, index) => const Divider(),
                      itemBuilder: (context, index) {
                        final message = data.messages[index];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            message.authoredByViewer
                                ? Icons.person_outline
                                : Icons.account_circle_outlined,
                          ),
                          title: Text(
                            SchoolBidirectionalText.isolate(
                              message.authorLabel,
                            ),
                          ),
                          subtitle: Text(
                            SchoolBidirectionalText.isolate(message.body),
                          ),
                        );
                      },
                    ),
            ),
            if (data?.hasMore ?? false)
              Padding(
                padding: const EdgeInsets.all(SchoolSpacing.md),
                child: SchoolStatusBanner(
                  label: strings.conversationsTitle,
                  message: strings.latestWindowNotice,
                  tone: SchoolStatusTone.information,
                ),
              ),
          ],
        ),
      );
    },
  );
}

class _StaffExtendedReadFailure extends StatelessWidget {
  const _StaffExtendedReadFailure({
    required this.description,
    required this.onRetry,
    required this.title,
  });

  final String description;
  final Future<void> Function() onRetry;
  final String title;

  @override
  Widget build(BuildContext context) {
    final strings = StaffExtendedReadStrings.forLocale(
      Localizations.localeOf(context),
    );
    return ListView(
      children: [
        SchoolPageSection(
          description: description,
          title: title,
          child: SchoolPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SchoolStatusBanner(
                  label: title,
                  message: strings.unavailable,
                  tone: SchoolStatusTone.error,
                ),
                const SizedBox(height: SchoolSpacing.md),
                FilledButton.icon(
                  icon: const Icon(Icons.refresh),
                  label: Text(strings.refresh),
                  onPressed: () => unawaited(onRetry()),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
