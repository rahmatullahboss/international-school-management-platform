part of 'main.dart';

final class FamilyProductionCountCopy {
  FamilyProductionCountCopy.forLocale(Locale locale)
    : _strings = SchoolCountStrings.forLocale(locale);

  factory FamilyProductionCountCopy.of(BuildContext context) =>
      FamilyProductionCountCopy.forLocale(Localizations.localeOf(context));

  final SchoolCountStrings _strings;

  String documentsAvailable(int count) => _strings.documentsAvailable(count);

  String formsAwaitingResponse(int count) =>
      _strings.formsAwaitingResponse(count);

  String openConversations(int count) => _strings.openConversations(count);

  String unreadMessages(int count) => _strings.unreadMessages(count);
}

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
      final strings = FamilyInteractionStrings.forLocale(
        Localizations.localeOf(context),
      );
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
          strings.documents,
          strings.documentsServiceDescription,
          '/documents',
        );
      }
      if (session.can(SchoolCapability.formsConsent)) {
        addService(
          Icons.assignment_outlined,
          strings.forms,
          strings.formsServiceDescription,
          '/forms',
        );
        if (session.activePersona == SchoolPersona.guardian) {
          addService(
            Icons.verified_user_outlined,
            strings.guardianConsent,
            strings.guardianConsentDescription,
            '/consents',
          );
        }
      }

      return ListView(
        children: [
          SchoolPageSection(
            description:
                '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · '
                '${strings.capabilityScopedServices}',
            title: strings.documentsAndForms,
            child: SchoolPanel(
              child: services.isEmpty
                  ? Text(strings.noInteractionServicesAuthorized)
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
          final locale = Localizations.localeOf(context);
          final strings = FamilyInteractionStrings.forLocale(locale);
          if (interactions.documentsPhase == FamilyInteractionPhase.loading &&
              interactions.documents.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.documentsPhase == FamilyInteractionPhase.failed &&
              interactions.documents.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadDocuments(studentId),
              reasonCode: interactions.documentsReasonCode,
              title: strings.documentsUnavailable,
            );
          }
          final countCopy = FamilyProductionCountCopy.of(context);
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    '${countCopy.documentsAvailable(interactions.documents.length)} · '
                    '${strings.documentsMetadataOnlyDescription}',
                title:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.documents}',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.documentsReasonCode != null)
                        SchoolStatusBanner(
                          label: strings.documentActionFailed,
                          message: SchoolBidirectionalText.isolate(
                            interactions.documentsReasonCode!,
                          ),
                          tone: SchoolStatusTone.error,
                        ),
                      if (interactions.downloadGrant != null) ...[
                        SchoolStatusBanner(
                          label: interactions.downloadGrant!.requiresStepUp
                              ? strings.additionalVerificationRequired
                              : strings.secureGrantPrepared,
                          message: FamilyInteractionStrings.grantExpiryFor(
                            locale,
                            _familyDateTimeLabel(
                              context,
                              interactions.downloadGrant!.expiresAt,
                            ),
                            singleUse: interactions.downloadGrant!.singleUse,
                          ),
                          tone: SchoolStatusTone.success,
                        ),
                        const SizedBox(height: SchoolSpacing.sm),
                        FilledButton.icon(
                          icon: interactions.documentOpening
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.verified_user_outlined),
                          label: Text(
                            interactions.downloadGrant!.requiresStepUp
                                ? strings.verifyAndOpenSecurely
                                : strings.openSecurely,
                          ),
                          onPressed:
                              interactions.documentOpening ||
                                  !interactions.secureDocumentExchangeAvailable
                              ? null
                              : interactions.openPreparedDocument,
                        ),
                        if (!interactions.secureDocumentExchangeAvailable)
                          Padding(
                            padding: EdgeInsets.only(top: SchoolSpacing.xs),
                            child: Text(
                              strings.securePresentationNotConfigured,
                            ),
                          ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      if (interactions.documentReceipt != null) ...[
                        SchoolStatusBanner(
                          label: strings.documentClosedSecurely,
                          message: strings.documentClosedSecurelyMessage,
                          tone: SchoolStatusTone.success,
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      if (interactions.documents.isEmpty)
                        Text(strings.noAuthorizedDocumentMetadata)
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
                          label: Text(strings.loadMoreDocuments),
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
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final strings = FamilyInteractionStrings.forLocale(locale);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        document.classification == FamilyDocumentClassification.restricted
            ? Icons.lock_outline
            : Icons.description_outlined,
      ),
      title: Text(SchoolBidirectionalText.isolate(document.title)),
      subtitle: Text(
        '${SchoolBidirectionalText.isolate(document.fileName)} · '
        '${_fileSizeLabel(document.sizeBytes)} · '
        '${FamilyInteractionStrings.issuedFor(locale, _familyDateLabel(context, document.issuedAt))}\n'
        '${FamilyInteractionStrings.documentClassificationFor(locale, document.classification)} · '
        '${FamilyInteractionStrings.cachePolicyFor(locale, document.cachePolicy)}',
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
              tooltip: strings.prepareSecureDownload,
            ),
    );
  }
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
          final locale = Localizations.localeOf(context);
          final strings = FamilyInteractionStrings.forLocale(locale);
          if (interactions.formsPhase == FamilyInteractionPhase.loading &&
              interactions.forms.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.formsPhase == FamilyInteractionPhase.failed &&
              interactions.forms.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadForms(studentId),
              reasonCode: interactions.formsReasonCode,
              title: strings.formsUnavailable,
            );
          }
          final countCopy = FamilyProductionCountCopy.of(context);
          final openFormCount = interactions.forms
              .where((form) => form.status == FamilyFormStatus.open)
              .length;
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    '${countCopy.formsAwaitingResponse(openFormCount)} · '
                    '${strings.formsVersionDescription}',
                title:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.forms}',
                child: SchoolPanel(
                  child: interactions.forms.isEmpty
                      ? Text(strings.noForms)
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
                                  '${FamilyInteractionStrings.formStatusFor(locale, interactions.forms[index].status)}'
                                  '${interactions.forms[index].dueAt == null ? '' : ' · ${FamilyInteractionStrings.dueFor(locale, _familyDateLabel(context, interactions.forms[index].dueAt!))}'}',
                                ),
                                title: Text(
                                  SchoolBidirectionalText.isolate(
                                    interactions.forms[index].title,
                                  ),
                                ),
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
          final locale = Localizations.localeOf(context);
          final strings = FamilyInteractionStrings.forLocale(locale);
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
              title: strings.formUnavailable,
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
                description: FamilyInteractionStrings.formDefinitionFor(
                  locale,
                  baseVersion: active.baseVersion,
                  schemaVersion: active.schemaVersion,
                  isolatedStudentName: SchoolBidirectionalText.isolate(
                    directory.activeStudent.displayName,
                  ),
                ),
                title: SchoolBidirectionalText.isolate(active.title),
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.formReasonCode != null) ...[
                        SchoolStatusBanner(
                          label: strings.formNotSubmitted,
                          message: SchoolBidirectionalText.isolate(
                            interactions.formReasonCode!,
                          ),
                          tone: SchoolStatusTone.error,
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      if (interactions.formAcceptedRevision != null) ...[
                        SchoolStatusBanner(
                          label: strings.submissionAccepted,
                          message: FamilyInteractionStrings.acceptedRevisionFor(
                            locale,
                            interactions.formAcceptedRevision!,
                          ),
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
                        label: Text(strings.submitForm),
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
  Widget build(BuildContext context) {
    final displayLabel = SchoolBidirectionalText.isolate(field.label);
    return switch (field.type) {
      FamilyFormFieldType.text => TextFormField(
        initialValue: value as String?,
        decoration: InputDecoration(
          labelText: '$displayLabel${field.required ? ' *' : ''}',
        ),
        maxLength: 4000,
        onChanged: onChanged,
      ),
      FamilyFormFieldType.boolean => CheckboxListTile(
        contentPadding: EdgeInsets.zero,
        title: Text('$displayLabel${field.required ? ' *' : ''}'),
        value: value as bool? ?? false,
        onChanged: onChanged,
      ),
      FamilyFormFieldType.singleChoice => DropdownButtonFormField<String>(
        initialValue: value as String?,
        decoration: InputDecoration(
          labelText: '$displayLabel${field.required ? ' *' : ''}',
        ),
        items: field.options
            .map(
              (option) => DropdownMenuItem(
                value: option,
                child: Text(SchoolBidirectionalText.isolate(option)),
              ),
            )
            .toList(growable: false),
        onChanged: onChanged,
      ),
      FamilyFormFieldType.date => _FamilyDateField(
        label: '$displayLabel${field.required ? ' *' : ''}',
        onChanged: onChanged,
        value: value as String?,
      ),
    };
  }
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
          final locale = Localizations.localeOf(context);
          final strings = FamilyInteractionStrings.forLocale(locale);
          if (interactions.consentsPhase == FamilyInteractionPhase.loading &&
              interactions.consents.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (interactions.consentsPhase == FamilyInteractionPhase.failed &&
              interactions.consents.isEmpty) {
            return _FamilyInteractionFailure(
              onRetry: () => interactions.loadConsents(studentId),
              reasonCode: interactions.consentsReasonCode,
              title: strings.consentRequestsUnavailable,
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description: strings.guardianOnlyConsentDescription,
                title:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.consentRequests}',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.consentsReasonCode != null)
                        SchoolStatusBanner(
                          label: strings.consentDecisionNotAccepted,
                          message: SchoolBidirectionalText.isolate(
                            interactions.consentsReasonCode!,
                          ),
                          tone: SchoolStatusTone.error,
                        ),
                      if (interactions.consentAcceptedRevision != null)
                        SchoolStatusBanner(
                          label: strings.decisionAccepted,
                          message:
                              FamilyInteractionStrings.acceptedConsentRevisionFor(
                                locale,
                                interactions.consentAcceptedRevision!,
                              ),
                          tone: SchoolStatusTone.success,
                        ),
                      if (interactions.consents.isEmpty)
                        Text(strings.noConsentRequests)
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
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final strings = FamilyInteractionStrings.forLocale(locale);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.verified_user_outlined),
          subtitle: Text(
            FamilyInteractionStrings.policyStatusFor(
              locale,
              isolatedPolicyVersion: SchoolBidirectionalText.isolate(
                consent.policyVersion,
              ),
              status: consent.status,
              dueLabel: consent.dueAt == null
                  ? null
                  : _familyDateLabel(context, consent.dueAt!),
            ),
          ),
          title: Text(SchoolBidirectionalText.isolate(consent.title)),
        ),
        if (consent.status == FamilyConsentStatus.pending)
          Wrap(
            spacing: SchoolSpacing.sm,
            runSpacing: SchoolSpacing.sm,
            children: [
              FilledButton.icon(
                icon: const Icon(Icons.check),
                label: Text(strings.grantConsent),
                onPressed: loading
                    ? null
                    : () => onDecision(FamilyConsentDecision.grant),
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.close),
                label: Text(strings.decline),
                onPressed: loading
                    ? null
                    : () => onDecision(FamilyConsentDecision.decline),
              ),
            ],
          ),
      ],
    );
  }
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
          final strings = FamilyInteractionStrings.forLocale(
            Localizations.localeOf(context),
          );
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
              title: strings.conversationsUnavailable,
            );
          }
          final countCopy = FamilyProductionCountCopy.of(context);
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    '${countCopy.openConversations(interactions.conversations.length)} · '
                    '${strings.conversationAccessDescription}',
                title:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.conversations}',
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.conversations.isEmpty)
                        Text(strings.noConversations)
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
                              '${countCopy.unreadMessages(interactions.conversations[index].unreadCount)} · ${_familyDateTimeLabel(context, interactions.conversations[index].latestMessageAt)}',
                            ),
                            title: Text(
                              SchoolBidirectionalText.isolate(
                                interactions.conversations[index].subject,
                              ),
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
                          label: Text(strings.loadMoreConversations),
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
          final strings = FamilyInteractionStrings.forLocale(
            Localizations.localeOf(context),
          );
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
              title: strings.conversationUnavailable,
            );
          }
          return ListView(
            children: [
              SchoolPageSection(
                description:
                    '${SchoolBidirectionalText.isolate(directory.activeStudent.displayName)} · ${strings.authorizedConversation}',
                title: SchoolBidirectionalText.isolate(conversation.subject),
                child: SchoolPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (interactions.messagesReasonCode != null)
                        SchoolStatusBanner(
                          label: strings.messageActionFailed,
                          message: SchoolBidirectionalText.isolate(
                            interactions.messagesReasonCode!,
                          ),
                          tone: SchoolStatusTone.error,
                        ),
                      if (interactions.messages.isEmpty)
                        Text(strings.noMessages)
                      else
                        for (final message in interactions.messages)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.account_circle_outlined),
                            subtitle: Text(
                              '${_familyDateTimeLabel(context, message.sentAt)}\n'
                              '${SchoolBidirectionalText.isolate(message.body)}',
                            ),
                            title: Text(
                              SchoolBidirectionalText.isolate(
                                message.authorLabel,
                              ),
                            ),
                            isThreeLine: true,
                            titleAlignment: ListTileTitleAlignment.top,
                          ),
                      if (interactions.messagesNextCursor != null)
                        OutlinedButton.icon(
                          icon: const Icon(Icons.expand_more),
                          label: Text(strings.loadEarlierMessages),
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
                          decoration: InputDecoration(
                            labelText: strings.message,
                          ),
                          maxLength: 4000,
                          maxLines: 5,
                          minLines: 2,
                        ),
                        FilledButton.icon(
                          icon: const Icon(Icons.send_outlined),
                          label: Text(strings.sendMessage),
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
        return _FamilyInteractionFailure(
          reasonCode: 'FAMILY_PROFILE_DIRECTORY_UNAVAILABLE',
          title: FamilyInteractionStrings.forLocale(
            Localizations.localeOf(context),
          ).familyProfileUnavailable,
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
  Widget build(BuildContext context) {
    final strings = FamilyInteractionStrings.forLocale(
      Localizations.localeOf(context),
    );
    return ListView(
      children: [
        SchoolPageSection(
          description: strings.noSubstituteInteractionValues,
          title: title,
          child: SchoolPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SchoolStatusBanner(
                  label: strings.serviceUnavailable,
                  message: SchoolBidirectionalText.isolate(
                    reasonCode ?? 'FAMILY_INTERACTION_UNAVAILABLE',
                  ),
                  tone: SchoolStatusTone.error,
                ),
                if (onRetry != null) ...[
                  const SizedBox(height: SchoolSpacing.md),
                  FilledButton.icon(
                    icon: const Icon(Icons.refresh),
                    label: Text(strings.tryAgain),
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
}

void _afterFrame(FutureOr<void> Function() callback) {
  WidgetsBinding.instance.addPostFrameCallback((_) => callback());
}

String _familyDateLabel(BuildContext context, DateTime value) =>
    FamilyUtcPresentation.date(context, value);

String _familyDateTimeLabel(BuildContext context, DateTime value) =>
    FamilyUtcPresentation.dateTime(context, value);

String _fileSizeLabel(int bytes) {
  if (bytes < 1024) return '$bytes B';
  final kib = bytes / 1024;
  if (kib < 1024) return '${kib.toStringAsFixed(1)} KiB';
  return '${(kib / 1024).toStringAsFixed(1)} MiB';
}
