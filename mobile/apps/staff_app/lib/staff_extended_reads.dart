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
  final Set<String> messagesSending = <String>{};
  final Map<String, _PendingConversationSend> _pendingSends = {};
  String? assessmentsError;
  String? conversationsError;
  final Map<String, String> messageErrors = {};
  int _commandSequence = 0;
  int _scopeRevision = 0;

  Future<void> initialize() async {
    await Future.wait([loadAssessments(), loadConversations()]);
  }

  Future<void> updateScope({
    required TeacherExtendedReadRepository repository,
    required SchoolSession session,
  }) async {
    _scopeRevision += 1;
    _repository = repository;
    _session = session;
    assessments = null;
    conversations = null;
    conversationMessages.clear();
    messagesLoading.clear();
    messagesSending.clear();
    _pendingSends.clear();
    assessmentsLoading = false;
    conversationsLoading = false;
    assessmentsError = null;
    conversationsError = null;
    messageErrors.clear();
    notifyListeners();
    await initialize();
  }

  Future<void> loadAssessments() async {
    final revision = _scopeRevision;
    final repository = _repository;
    final session = _session;
    if (!session.can(SchoolCapability.gradesWrite)) return;
    assessmentsLoading = true;
    assessmentsError = null;
    notifyListeners();
    try {
      final result = await repository.loadAssessments(session);
      if (revision == _scopeRevision) assessments = result;
    } on Object {
      if (revision == _scopeRevision) {
        assessmentsError = 'STAFF_ASSESSMENTS_UNAVAILABLE';
      }
    } finally {
      if (revision == _scopeRevision) {
        assessmentsLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadConversations() async {
    final revision = _scopeRevision;
    final repository = _repository;
    final session = _session;
    if (!session.can(SchoolCapability.messagesRead)) return;
    conversationsLoading = true;
    conversationsError = null;
    notifyListeners();
    try {
      final result = await repository.loadConversations(session);
      if (revision == _scopeRevision) conversations = result;
    } on Object {
      if (revision == _scopeRevision) {
        conversationsError = 'STAFF_CONVERSATIONS_UNAVAILABLE';
      }
    } finally {
      if (revision == _scopeRevision) {
        conversationsLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadConversationMessages(String conversationId) async {
    final revision = _scopeRevision;
    final repository = _repository;
    final session = _session;
    if (!session.can(SchoolCapability.messagesRead) ||
        messagesLoading.contains(conversationId)) {
      return;
    }
    messagesLoading.add(conversationId);
    messageErrors.remove(conversationId);
    notifyListeners();
    try {
      final page = await repository.loadConversationMessages(
        conversationId: conversationId,
        session: session,
      );
      if (revision != _scopeRevision) return;
      conversationMessages[conversationId] = page;
      if (page.messages.isNotEmpty) {
        try {
          await repository.markConversationRead(
            command: TeacherConversationReadCommand(
              conversationId: conversationId,
              idempotencyKey: _readCommandId(
                conversationId,
                page.messages.first.messageId,
              ),
              messageId: page.messages.first.messageId,
            ),
            session: session,
          );
        } on Object {
          if (revision == _scopeRevision) {
            messageErrors[conversationId] =
                'STAFF_CONVERSATION_READ_RECEIPT_UNAVAILABLE';
          }
        }
      }
    } on Object {
      if (revision == _scopeRevision) {
        messageErrors[conversationId] =
            'STAFF_CONVERSATION_MESSAGES_UNAVAILABLE';
      }
    } finally {
      if (revision == _scopeRevision) {
        messagesLoading.remove(conversationId);
        notifyListeners();
      }
    }
  }

  bool canSendMessage(TeacherConversationSummary conversation) =>
      conversation.canReply && _session.can(SchoolCapability.messagesSend);

  Future<bool> sendMessage(
    TeacherConversationSummary conversation,
    String body,
  ) async {
    final revision = _scopeRevision;
    final repository = _repository;
    final session = _session;
    if (!canSendMessage(conversation) ||
        messagesSending.contains(conversation.conversationId)) {
      return false;
    }
    messagesSending.add(conversation.conversationId);
    messageErrors.remove(conversation.conversationId);
    notifyListeners();
    try {
      final normalizedBody = body.trim();
      final pending = _pendingSends[conversation.conversationId];
      final idempotencyKey = pending != null && pending.body == normalizedBody
          ? pending.idempotencyKey
          : _nextCommandId('send');
      final command = TeacherConversationSendCommand(
        body: body,
        conversationId: conversation.conversationId,
        idempotencyKey: idempotencyKey,
      );
      _pendingSends[conversation.conversationId] = _PendingConversationSend(
        body: command.body,
        idempotencyKey: idempotencyKey,
      );
      final message = await repository.sendConversationMessage(
        command: command,
        session: session,
      );
      if (revision != _scopeRevision) return false;
      _pendingSends.remove(conversation.conversationId);
      final existing = conversationMessages[conversation.conversationId];
      conversationMessages[conversation.conversationId] =
          TeacherConversationMessagesReadModel(
            conversationId: conversation.conversationId,
            hasMore: existing?.hasMore ?? false,
            messages: <TeacherConversationMessage>[
              message,
              ...?existing?.messages.where(
                (item) => item.messageId != message.messageId,
              ),
            ],
            studentDisplayName:
                existing?.studentDisplayName ?? conversation.studentDisplayName,
            subject: existing?.subject ?? conversation.subject,
          );
      final current = conversations;
      if (current != null) {
        conversations = TeacherConversationListReadModel(
          conversations: current.conversations.map(
            (item) => item.conversationId == conversation.conversationId
                ? TeacherConversationSummary(
                    canReply: item.canReply,
                    conversationId: item.conversationId,
                    latestMessageAt: message.sentAt,
                    studentDisplayName: item.studentDisplayName,
                    studentId: item.studentId,
                    subject: item.subject,
                  )
                : item,
          ),
          generatedAt: current.generatedAt,
          hasMore: current.hasMore,
        );
      }
      return true;
    } on Object {
      if (revision == _scopeRevision) {
        messageErrors[conversation.conversationId] =
            'STAFF_CONVERSATION_SEND_UNAVAILABLE';
      }
      return false;
    } finally {
      if (revision == _scopeRevision) {
        messagesSending.remove(conversation.conversationId);
        notifyListeners();
      }
    }
  }

  String _nextCommandId(String operation) {
    _commandSequence += 1;
    return 'teacher-$operation-${DateTime.now().toUtc().microsecondsSinceEpoch}-$_commandSequence';
  }

  String _readCommandId(String conversationId, String messageId) =>
      'teacher-read-$conversationId-$messageId';
}

final class _PendingConversationSend {
  const _PendingConversationSend({
    required this.body,
    required this.idempotencyKey,
  });

  final String body;
  final String idempotencyKey;
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
      final error = controller.messageErrors[conversation.conversationId];
      final canSend = controller.canSendMessage(conversation);
      return SafeArea(
        child: Column(
          children: [
            ListTile(
              title: Text(
                SchoolBidirectionalText.isolate(conversation.subject),
              ),
              subtitle: Text(
                '${SchoolBidirectionalText.isolate(conversation.studentDisplayName)} · '
                '${canSend ? strings.replyAvailable : strings.readOnlyConversation}',
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
            if (error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  SchoolSpacing.md,
                  0,
                  SchoolSpacing.md,
                  SchoolSpacing.sm,
                ),
                child: SchoolStatusBanner(
                  label: strings.messageActionFailed,
                  message: SchoolBidirectionalText.isolate(error),
                  tone: SchoolStatusTone.error,
                ),
              ),
            if (canSend)
              _TeacherConversationComposer(
                controller: controller,
                conversation: conversation,
              ),
          ],
        ),
      );
    },
  );
}

class _TeacherConversationComposer extends StatefulWidget {
  const _TeacherConversationComposer({
    required this.controller,
    required this.conversation,
  });

  final StaffExtendedReadController controller;
  final TeacherConversationSummary conversation;

  @override
  State<_TeacherConversationComposer> createState() =>
      _TeacherConversationComposerState();
}

class _TeacherConversationComposerState
    extends State<_TeacherConversationComposer> {
  final TextEditingController _message = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final strings = StaffExtendedReadStrings.forLocale(
      Localizations.localeOf(context),
    );
    final sending = widget.controller.messagesSending.contains(
      widget.conversation.conversationId,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        SchoolSpacing.md,
        SchoolSpacing.sm,
        SchoolSpacing.md,
        SchoolSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _message,
            decoration: InputDecoration(labelText: strings.message),
            maxLength: 4000,
            maxLines: 4,
            minLines: 1,
          ),
          FilledButton.icon(
            icon: const Icon(Icons.send_outlined),
            label: Text(strings.sendMessage),
            onPressed: sending
                ? null
                : () async {
                    final body = _message.text;
                    final sent = await widget.controller.sendMessage(
                      widget.conversation,
                      body,
                    );
                    if (mounted && sent) _message.clear();
                  },
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }
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
