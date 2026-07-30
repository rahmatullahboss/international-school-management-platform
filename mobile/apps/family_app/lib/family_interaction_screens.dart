part of 'main.dart';

class _FamilyServicesScreen extends StatelessWidget {
  const _FamilyServicesScreen({
    required this.interactions,
    required this.journey,
    required this.session,
  });

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;
  final SchoolSession session;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final services = <Widget>[];
      void addService(
        IconData icon,
        String title,
        String subtitle,
        String path,
      ) {
        if (services.isNotEmpty) services.add(const Divider());
        services.add(
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(icon),
            onTap: () => context.go(path),
            subtitle: Text(subtitle),
            title: Text(title),
            trailing: const Icon(Icons.chevron_right),
          ),
        );
      }

      if (session.can(SchoolCapability.documentsRead)) {
        addService(
          Icons.description_outlined,
          'Documents',
          'Review metadata and prepare short-lived secure download grants.',
          '/documents',
        );
      }
      if (session.can(SchoolCapability.formsConsent)) {
        addService(
          Icons.assignment_outlined,
          'Forms',
          'Complete server-versioned forms without client-side authority.',
          '/forms',
        );
        if (session.activePersona == SchoolPersona.guardian) {
          addService(
            Icons.verified_user_outlined,
            'Guardian consent',
            'Review policy versions and submit explicit decisions.',
            '/consents',
          );
        }
      }

      return ListView(
        children: [
          SchoolPageSection(
            description:
                '${directory.activeStudent.displayName} · capability-scoped services',
            title: 'Documents and forms',
            child: SchoolPanel(
              child: services.isEmpty
                  ? const Text('No interaction services are authorized.')
                  : Column(children: services),
            ),
          ),
        ],
      );
    },
  );
}

class _FamilyDocumentsScreen extends StatelessWidget {
  const _FamilyDocumentsScreen({
    required this.interactions,
    required this.journey,
  });

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final studentId = directory.activeStudentId;
      if (interactions.documentsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(() => interactions.loadDocuments(studentId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.documentsPhase == FamilyInteractionPhase.loading &&
              interactions.documents.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.documentsPhase == FamilyInteractionPhase.failed &&
              interactions.documents.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadDocuments(studentId),
              reasonCode: interactions.documentsReasonCode,
              title: 'Documents unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Only metadata is shown. Restricted files remain no-store and raw download credentials are never exposed.',
                title: '${directory.activeStudent.displayName} documents',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.documentsReasonCode != null)
                        SchoolStatusBanner(
                          label: 'Document action failed',
                          message: interactions.documentsReasonCode!,
                          tone: SchoolStatusTone.error,
                        ),
                      if (interactions.downloadGrant != null) ...[
                        SchoolStatusBanner(
                          label: interactions.downloadGrant!.requiresStepUp
                              ? 'Additional verification required'
                              : 'Secure grant prepared',
                          message:
                              'The short-lived ${interactions.downloadGrant!.singleUse ? 'single-use ' : ''}grant expires ${_familyDateTimeLabel(context, interactions.downloadGrant!.expiresAt)}. No URL or credential is shown.',
                          tone: SchoolStatusTone.success,
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      if (interactions.documents.isEmpty)
                        const Text(
                          'No authorized document metadata is available.',
                        )
                      else
                        for (
                          var index = 0;
                          index < interactions.documents.length;
                          index++
                        ) ...[
                          _FamilyDocumentTile(
                            document: interactions.documents[index],
                            loading:
                                interactions.pendingDocumentId ==
                                interactions.documents[index].documentId,
                            onPrepare: () =>
                                interactions.prepareDocumentDownload(
                                  interactions.documents[index],
                                ),
                          ),
                          if (index != interactions.documents.length - 1)
                            const Divider(),
                        ],
                      if (interactions.documentsNextCursor != null) ...[
                        const SizedBox(height: SchoolSpacing.md),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.expand_more),
                          label: const Text('Load more documents'),
                          onPressed:
                              interactions.documentsPhase ==
                                  FamilyInteractionPhase.loading
                              ? null
                              : () => interactions.loadDocuments(
                                  studentId,
                                  append: true,
                                ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _FamilyDocumentTile extends StatelessWidget {
  const _FamilyDocumentTile({
    required this.document,
    required this.loading,
    required this.onPrepare,
  });

  final FamilyDocumentSummary document;
  final bool loading;
  final VoidCallback onPrepare;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(
      document.classification == FamilyDocumentClassification.restricted
          ? Icons.lock_outline
          : Icons.description_outlined,
    ),
    title: Text(document.title),
    subtitle: Text(
      '${document.fileName} · ${_fileSizeLabel(document.sizeBytes)} · issued ${_familyDateLabel(context, document.issuedAt)}\n${document.classification.name} · ${document.cachePolicy.name}',
    ),
    isThreeLine: true,
    trailing: loading
        ? const SizedBox.square(
            dimension: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : IconButton(
            icon: const Icon(Icons.download_for_offline_outlined),
            onPressed: onPrepare,
            tooltip: 'Prepare secure download',
          ),
  );
}

class _FamilyFormsScreen extends StatelessWidget {
  const _FamilyFormsScreen({required this.interactions, required this.journey});

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final studentId = directory.activeStudentId;
      if (interactions.formsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(() => interactions.loadForms(studentId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.formsPhase == FamilyInteractionPhase.loading &&
              interactions.forms.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.formsPhase == FamilyInteractionPhase.failed &&
              interactions.forms.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadForms(studentId),
              reasonCode: interactions.formsReasonCode,
              title: 'Forms unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Submission uses the server-issued base and schema versions. The client does not infer a newer revision.',
                title: '${directory.activeStudent.displayName} forms',
                child: SchoolPanel(
                  child: interactions.forms.isEmpty
                      ? const Text('No forms are available for this profile.')
                      : Column(
                          children: [
                            for (
                              var index = 0;
                              index < interactions.forms.length;
                              index++
                            ) ...[
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(
                                  interactions.forms[index].status ==
                                          FamilyFormStatus.open
                                      ? Icons.assignment_outlined
                                      : Icons.assignment_turned_in_outlined,
                                ),
                                onTap:
                                    interactions.forms[index].status ==
                                        FamilyFormStatus.open
                                    ? () => context.go(
                                        '/forms/${Uri.encodeComponent(interactions.forms[index].formId)}',
                                      )
                                    : null,
                                subtitle: Text(
                                  '${interactions.forms[index].status.name}${interactions.forms[index].dueAt == null ? '' : ' · due ${_familyDateLabel(context, interactions.forms[index].dueAt!)}'}',
                                ),
                                title: Text(interactions.forms[index].title),
                                trailing:
                                    interactions.forms[index].status ==
                                        FamilyFormStatus.open
                                    ? const Icon(Icons.chevron_right)
                                    : null,
                              ),
                              if (index != interactions.forms.length - 1)
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
    },
  );
}

class _FamilyFormScreen extends StatefulWidget {
  const _FamilyFormScreen({
    required this.formId,
    required this.interactions,
    required this.journey,
  });

  final String formId;
  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  State<_FamilyFormScreen> createState() => _FamilyFormScreenState();
}

class _FamilyFormScreenState extends State<_FamilyFormScreen> {
  String? _preparedDefinition;
  Map<String, Object?> _answers = <String, Object?>{};

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: widget.interactions,
    journey: widget.journey,
    builder: (context, directory) {
      final interactions = widget.interactions;
      final definition = interactions.activeForm;
      if ((definition == null || definition.formId != widget.formId) &&
          interactions.formPhase != FamilyInteractionPhase.loading) {
        _afterFrame(() => interactions.loadForm(widget.formId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          final active = interactions.activeForm;
          if (interactions.formPhase == FamilyInteractionPhase.loading ||
              active == null &&
                  interactions.formPhase == FamilyInteractionPhase.idle) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.formPhase == FamilyInteractionPhase.failed ||
              active == null ||
              active.formId != widget.formId) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadForm(widget.formId),
              reasonCode: interactions.formReasonCode,
              title: 'Form unavailable',
            );
          }
          final definitionKey =
              '${active.formId}:${active.baseVersion}:${active.schemaVersion}';
          if (_preparedDefinition != definitionKey) {
            _preparedDefinition = definitionKey;
            _answers = <String, Object?>{};
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Base version ${active.baseVersion} · schema ${active.schemaVersion} · ${directory.activeStudent.displayName}',
                title: active.title,
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.formReasonCode != null) ...[
                        SchoolStatusBanner(
                          label: 'Form not submitted',
                          message: interactions.formReasonCode!,
                          tone: SchoolStatusTone.error,
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      if (interactions.formAcceptedRevision != null) ...[
                        SchoolStatusBanner(
                          label: 'Submission accepted',
                          message:
                              'The server accepted revision ${interactions.formAcceptedRevision}.',
                          tone: SchoolStatusTone.success,
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      for (final field in active.fields) ...[
                        _FamilyFormField(
                          field: field,
                          value: _answers[field.fieldId],
                          onChanged: (value) {
                            setState(() {
                              if (value == null) {
                                _answers.remove(field.fieldId);
                              } else {
                                _answers[field.fieldId] = value;
                              }
                            });
                          },
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      FilledButton.icon(
                        icon: const Icon(Icons.send_outlined),
                        label: const Text('Submit form'),
                        onPressed:
                            interactions.formSubmitting ||
                                active.status != FamilyFormStatus.open
                            ? null
                            : () => interactions.submitActiveForm(_answers),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _FamilyFormField extends StatelessWidget {
  const _FamilyFormField({
    required this.field,
    required this.onChanged,
    required this.value,
  });

  final FamilyFormFieldDefinition field;
  final ValueChanged<Object?> onChanged;
  final Object? value;

  @override
  Widget build(BuildContext context) => switch (field.type) {
    FamilyFormFieldType.text => TextFormField(
      initialValue: value as String?,
      decoration: InputDecoration(
        labelText: '${field.label}${field.required ? ' *' : ''}',
      ),
      maxLength: 4000,
      onChanged: onChanged,
    ),
    FamilyFormFieldType.boolean => CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      title: Text('${field.label}${field.required ? ' *' : ''}'),
      value: value as bool? ?? false,
      onChanged: onChanged,
    ),
    FamilyFormFieldType.singleChoice => DropdownButtonFormField<String>(
      initialValue: value as String?,
      decoration: InputDecoration(
        labelText: '${field.label}${field.required ? ' *' : ''}',
      ),
      items: field.options
          .map((option) => DropdownMenuItem(value: option, child: Text(option)))
          .toList(growable: false),
      onChanged: onChanged,
    ),
    FamilyFormFieldType.date => _FamilyDateField(
      label: '${field.label}${field.required ? ' *' : ''}',
      onChanged: onChanged,
      value: value as String?,
    ),
  };
}

class _FamilyDateField extends StatelessWidget {
  const _FamilyDateField({
    required this.label,
    required this.onChanged,
    required this.value,
  });

  final String label;
  final ValueChanged<Object?> onChanged;
  final String? value;

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    icon: const Icon(Icons.calendar_today_outlined),
    label: Text(value == null ? label : '$label · $value'),
    onPressed: () async {
      final now = DateTime.now();
      final selected = await showDatePicker(
        context: context,
        firstDate: DateTime(now.year - 1),
        initialDate: DateTime.tryParse(value ?? '') ?? now,
        lastDate: DateTime(now.year + 5),
      );
      if (selected != null) {
        onChanged(
          '${selected.year.toString().padLeft(4, '0')}-${selected.month.toString().padLeft(2, '0')}-${selected.day.toString().padLeft(2, '0')}',
        );
      }
    },
  );
}

class _FamilyConsentsScreen extends StatelessWidget {
  const _FamilyConsentsScreen({
    required this.interactions,
    required this.journey,
  });

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final studentId = directory.activeStudentId;
      if (interactions.consentsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(() => interactions.loadConsents(studentId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.consentsPhase == FamilyInteractionPhase.loading &&
              interactions.consents.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.consentsPhase == FamilyInteractionPhase.failed &&
              interactions.consents.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadConsents(studentId),
              reasonCode: interactions.consentsReasonCode,
              title: 'Consent requests unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Only a guardian persona with the consent capability can submit a decision.',
                title:
                    '${directory.activeStudent.displayName} consent requests',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.consentsReasonCode != null)
                        SchoolStatusBanner(
                          label: 'Consent decision not accepted',
                          message: interactions.consentsReasonCode!,
                          tone: SchoolStatusTone.error,
                        ),
                      if (interactions.consentAcceptedRevision != null)
                        SchoolStatusBanner(
                          label: 'Decision accepted',
                          message:
                              'The server accepted revision ${interactions.consentAcceptedRevision}. Refresh to verify the published status.',
                          tone: SchoolStatusTone.success,
                        ),
                      if (interactions.consents.isEmpty)
                        const Text('No consent requests are available.')
                      else
                        for (
                          var index = 0;
                          index < interactions.consents.length;
                          index++
                        ) ...[
                          _FamilyConsentTile(
                            consent: interactions.consents[index],
                            loading:
                                interactions.pendingConsentId ==
                                interactions.consents[index].consentId,
                            onDecision: (decision) =>
                                interactions.decideConsent(
                                  interactions.consents[index],
                                  decision,
                                ),
                          ),
                          if (index != interactions.consents.length - 1)
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
    },
  );
}

class _FamilyConsentTile extends StatelessWidget {
  const _FamilyConsentTile({
    required this.consent,
    required this.loading,
    required this.onDecision,
  });

  final FamilyConsentRequest consent;
  final bool loading;
  final ValueChanged<FamilyConsentDecision> onDecision;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(Icons.verified_user_outlined),
        subtitle: Text(
          'Policy ${consent.policyVersion} · ${consent.status.name}${consent.dueAt == null ? '' : ' · due ${_familyDateLabel(context, consent.dueAt!)}'}',
        ),
        title: Text(consent.title),
      ),
      if (consent.status == FamilyConsentStatus.pending)
        Wrap(
          spacing: SchoolSpacing.sm,
          runSpacing: SchoolSpacing.sm,
          children: [
            FilledButton.icon(
              icon: const Icon(Icons.check),
              label: const Text('Grant consent'),
              onPressed: loading
                  ? null
                  : () => onDecision(FamilyConsentDecision.grant),
            ),
            OutlinedButton.icon(
              icon: const Icon(Icons.close),
              label: const Text('Decline'),
              onPressed: loading
                  ? null
                  : () => onDecision(FamilyConsentDecision.decline),
            ),
          ],
        ),
    ],
  );
}

class _FamilyConversationsScreen extends StatelessWidget {
  const _FamilyConversationsScreen({
    required this.interactions,
    required this.journey,
  });

  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: interactions,
    journey: journey,
    builder: (context, directory) {
      final studentId = directory.activeStudentId;
      if (interactions.conversationsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(() => interactions.loadConversations(studentId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.loading &&
              interactions.conversations.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.failed &&
              interactions.conversations.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadConversations(studentId),
              reasonCode: interactions.conversationsReasonCode,
              title: 'Conversations unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    'Conversation access follows the active school relationship and capability scope.',
                title: '${directory.activeStudent.displayName} conversations',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.conversations.isEmpty)
                        const Text('No conversations are available.')
                      else
                        for (
                          var index = 0;
                          index < interactions.conversations.length;
                          index++
                        ) ...[
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.forum_outlined),
                            onTap: () => context.go(
                              '/conversations/${Uri.encodeComponent(interactions.conversations[index].conversationId)}',
                            ),
                            subtitle: Text(
                              '${interactions.conversations[index].unreadCount} unread · ${_familyDateTimeLabel(context, interactions.conversations[index].latestMessageAt)}',
                            ),
                            title: Text(
                              interactions.conversations[index].subject,
                            ),
                            trailing: const Icon(Icons.chevron_right),
                          ),
                          if (index != interactions.conversations.length - 1)
                            const Divider(),
                        ],
                      if (interactions.conversationsNextCursor != null) ...[
                        const SizedBox(height: SchoolSpacing.md),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.expand_more),
                          label: const Text('Load more conversations'),
                          onPressed:
                              interactions.conversationsPhase ==
                                  FamilyInteractionPhase.loading
                              ? null
                              : () => interactions.loadConversations(
                                  studentId,
                                  append: true,
                                ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _FamilyConversationScreen extends StatefulWidget {
  const _FamilyConversationScreen({
    required this.conversationId,
    required this.interactions,
    required this.journey,
    required this.session,
  });

  final String conversationId;
  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;
  final SchoolSession session;

  @override
  State<_FamilyConversationScreen> createState() =>
      _FamilyConversationScreenState();
}

class _FamilyConversationScreenState extends State<_FamilyConversationScreen> {
  final TextEditingController _message = TextEditingController();

  @override
  Widget build(BuildContext context) => _FamilyInteractionJourneyGate(
    interactions: widget.interactions,
    journey: widget.journey,
    builder: (context, directory) {
      final interactions = widget.interactions;
      if (interactions.conversationsPhase == FamilyInteractionPhase.idle) {
        _afterFrame(
          () => interactions.loadConversations(directory.activeStudentId),
        );
      }
      if (interactions.conversationsPhase == FamilyInteractionPhase.ready &&
          interactions.activeConversation?.conversationId !=
              widget.conversationId) {
        _afterFrame(() => interactions.openConversation(widget.conversationId));
      }
      return AnimatedBuilder(
        animation: interactions,
        builder: (context, _) {
          if (interactions.conversationsPhase ==
                  FamilyInteractionPhase.loading ||
              interactions.messagesPhase == FamilyInteractionPhase.loading &&
                  interactions.messages.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          final conversation = interactions.activeConversation;
          if (conversation == null ||
              conversation.conversationId != widget.conversationId ||
              interactions.messagesPhase == FamilyInteractionPhase.failed &&
                  interactions.messages.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () async {
                if (interactions.conversationsPhase !=
                    FamilyInteractionPhase.ready) {
                  await interactions.loadConversations(
                    directory.activeStudentId,
                  );
                }
                await interactions.openConversation(widget.conversationId);
              },
              reasonCode: interactions.messagesReasonCode,
              title: 'Conversation unavailable',
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    '${directory.activeStudent.displayName} · authorized conversation',
                title: conversation.subject,
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.messagesReasonCode != null)
                        SchoolStatusBanner(
                          label: 'Message action failed',
                          message: interactions.messagesReasonCode!,
                          tone: SchoolStatusTone.error,
                        ),
                      if (interactions.messages.isEmpty)
                        const Text('No messages are available.')
                      else
                        for (final message in interactions.messages)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.account_circle_outlined),
                            subtitle: Text(
                              '${_familyDateTimeLabel(context, message.sentAt)}\n${message.body}',
                            ),
                            title: Text(message.authorLabel),
                            isThreeLine: true,
                            titleAlignment: ListTileTitleAlignment.top,
                          ),
                      if (interactions.messagesNextCursor != null)
                        OutlinedButton.icon(
                          icon: const Icon(Icons.expand_more),
                          label: const Text('Load earlier messages'),
                          onPressed:
                              interactions.messagesPhase ==
                                  FamilyInteractionPhase.loading
                              ? null
                              : () => interactions.loadMessages(append: true),
                        ),
                      if (widget.session.can(
                        SchoolCapability.messagesSend,
                      )) ...[
                        const Divider(height: SchoolSpacing.lg),
                        TextField(
                          controller: _message,
                          decoration: const InputDecoration(
                            labelText: 'Message',
                          ),
                          maxLength: 4000,
                          maxLines: 5,
                          minLines: 2,
                        ),
                        FilledButton.icon(
                          icon: const Icon(Icons.send_outlined),
                          label: const Text('Send message'),
                          onPressed: interactions.messageSending
                              ? null
                              : () async {
                                  final body = _message.text;
                                  await interactions.sendMessage(body);
                                  if (mounted &&
                                      interactions.messagesReasonCode == null) {
                                    _message.clear();
                                  }
                                },
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }
}

class _FamilyInteractionJourneyGate extends StatelessWidget {
  const _FamilyInteractionJourneyGate({
    required this.builder,
    required this.interactions,
    required this.journey,
  });

  final Widget Function(BuildContext context, FamilyProfileDirectory directory)
  builder;
  final FamilyInteractionController interactions;
  final FamilyJourneyController journey;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge(<Listenable>[journey, interactions]),
    builder: (context, _) {
      final state = journey.state;
      if (state.phase == FamilyJourneyPhase.loading) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.phase == FamilyJourneyPhase.failed || state.directory == null) {
        return const _FamilyInteractionFailure(
          reasonCode: 'FAMILY_PROFILE_DIRECTORY_UNAVAILABLE',
          title: 'Family profile unavailable',
        );
      }
      final directory = state.directory!;
      if (interactions.studentId != directory.activeStudentId) {
        _afterFrame(() => interactions.bindStudent(directory.activeStudentId));
        return const Center(child: CircularProgressIndicator());
      }
      return builder(context, directory);
    },
  );
}

class _FamilyInteractionFailure extends StatelessWidget {
  const _FamilyInteractionFailure({
    this.onRetry,
    this.reasonCode,
    required this.title,
  });

  final FutureOr<void> Function()? onRetry;
  final String? reasonCode;
  final String title;

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      SchoolPageSection(
        description:
            'No fixture or cached value is substituted when the authorized service cannot verify this interaction.',
        title: title,
        child: SchoolPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SchoolStatusBanner(
                label: 'Service unavailable',
                message: reasonCode ?? 'FAMILY_INTERACTION_UNAVAILABLE',
                tone: SchoolStatusTone.error,
              ),
              if (onRetry != null) ...[
                const SizedBox(height: SchoolSpacing.md),
                FilledButton.icon(
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try again'),
                  onPressed: () => onRetry!(),
                ),
              ],
            ],
          ),
        ),
      ),
    ],
  );
}

void _afterFrame(FutureOr<void> Function() callback) {
  WidgetsBinding.instance.addPostFrameCallback((_) => callback());
}

String _familyDateLabel(BuildContext context, DateTime value) =>
    MaterialLocalizations.of(context).formatMediumDate(value.toLocal());

String _familyDateTimeLabel(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final localizations = MaterialLocalizations.of(context);
  return '${localizations.formatMediumDate(local)} · ${localizations.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
}

String _fileSizeLabel(int bytes) {
  if (bytes < 1024) return '$bytes B';
  final kib = bytes / 1024;
  if (kib < 1024) return '${kib.toStringAsFixed(1)} KiB';
  return '${(kib / 1024).toStringAsFixed(1)} MiB';
}
