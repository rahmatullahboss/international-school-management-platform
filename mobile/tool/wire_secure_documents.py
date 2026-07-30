from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"anchor not found in {relative}: {old[:100]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "apps/family_app/lib/main.dart",
    "import 'package:school_mobile_core/notification_routing.dart';\n",
    "import 'package:school_mobile_core/notification_routing.dart';\n"
    "import 'package:school_secure_documents/school_secure_documents.dart';\n",
)

replace_once(
    "apps/family_app/lib/family_interaction_controller.dart",
    """  FamilyInteractionController({
    required FamilyInteractionRepository repository,
    required SchoolSession session,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now,
       _repository = repository,
       _session = session;

  FamilyInteractionRepository _repository;
  SchoolSession _session;
  final DateTime Function() _clock;
""",
    """  FamilyInteractionController({
    required FamilyInteractionRepository repository,
    required SchoolSession session,
    DateTime Function()? clock,
    FamilySecureDocumentExchange? secureDocumentExchange,
  }) : _clock = clock ?? DateTime.now,
       _repository = repository,
       _secureDocumentExchange = secureDocumentExchange,
       _session = session;

  FamilyInteractionRepository _repository;
  SchoolSession _session;
  final DateTime Function() _clock;
  final FamilySecureDocumentExchange? _secureDocumentExchange;
""",
)
replace_once(
    "apps/family_app/lib/family_interaction_controller.dart",
    """  String? pendingDocumentId;
  FamilyDocumentDownloadGrant? downloadGrant;

  FamilyInteractionPhase formsPhase""",
    """  String? pendingDocumentId;
  FamilyDocumentDownloadGrant? downloadGrant;
  bool documentOpening = false;
  SecureDocumentExchangeReceipt? documentReceipt;

  FamilyInteractionPhase formsPhase""",
)
replace_once(
    "apps/family_app/lib/family_interaction_controller.dart",
    "  SchoolSession get session => _session;\n",
    """  SchoolSession get session => _session;

  bool get secureDocumentExchangeAvailable => _secureDocumentExchange != null;
""",
)
replace_once(
    "apps/family_app/lib/family_interaction_controller.dart",
    """    pendingDocumentId = document.documentId;
    downloadGrant = null;
    documentsReasonCode = null;
""",
    """    pendingDocumentId = document.documentId;
    downloadGrant = null;
    documentReceipt = null;
    documentsReasonCode = null;
""",
)
replace_once(
    "apps/family_app/lib/family_interaction_controller.dart",
    "  Future<void> loadForms(String value) async {",
    """  Future<void> openPreparedDocument() async {
    final exchange = _secureDocumentExchange;
    final grant = downloadGrant;
    final document = grant == null
        ? null
        : documents
              .where((item) => item.documentId == grant.documentId)
              .firstOrNull;
    if (exchange == null) {
      documentsReasonCode = 'FAMILY_SECURE_DOCUMENT_RUNTIME_REQUIRED';
      _safeNotify();
      return;
    }
    if (grant == null || document == null) {
      documentsReasonCode = 'FAMILY_DOCUMENT_GRANT_REQUIRED';
      _safeNotify();
      return;
    }
    final revision = _scopeRevision;
    documentOpening = true;
    documentReceipt = null;
    documentsReasonCode = null;
    _safeNotify();
    try {
      final receipt = await exchange.exchangeAndPresent(
        document: document,
        grant: grant,
        session: _session,
      );
      if (revision != _scopeRevision) return;
      documentReceipt = receipt;
      downloadGrant = null;
    } on Object catch (error) {
      if (revision != _scopeRevision) return;
      documentsReasonCode = _familyInteractionReason(error);
    }
    if (revision == _scopeRevision) {
      documentOpening = false;
      _safeNotify();
    }
  }

  Future<void> loadForms(String value) async {""",
)
replace_once(
    "apps/family_app/lib/family_interaction_controller.dart",
    """    pendingDocumentId = null;
    downloadGrant = null;
    formsPhase""",
    """    pendingDocumentId = null;
    downloadGrant = null;
    documentOpening = false;
    documentReceipt = null;
    formsPhase""",
)
replace_once(
    "apps/family_app/lib/family_interaction_controller.dart",
    """  FamilyInteractionException(:final code) => code,
  _ => 'FAMILY_INTERACTION_UNAVAILABLE',
""",
    """  FamilyInteractionException(:final code) => code,
  SecureDocumentException(:final code) => code,
  _ => 'FAMILY_INTERACTION_UNAVAILABLE',
""",
)

replace_once(
    "apps/family_app/lib/family_interaction_screens.dart",
    """                      if (interactions.downloadGrant != null) ...[
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
""",
    """                      if (interactions.downloadGrant != null) ...[
                        SchoolStatusBanner(
                          label: interactions.downloadGrant!.requiresStepUp
                              ? 'Additional verification required'
                              : 'Secure grant prepared',
                          message:
                              'The short-lived ${interactions.downloadGrant!.singleUse ? 'single-use ' : ''}grant expires ${_familyDateTimeLabel(context, interactions.downloadGrant!.expiresAt)}. No URL or credential is shown.',
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
                                ? 'Verify and open securely'
                                : 'Open securely',
                          ),
                          onPressed:
                              interactions.documentOpening ||
                                  !interactions.secureDocumentExchangeAvailable
                              ? null
                              : interactions.openPreparedDocument,
                        ),
                        if (!interactions.secureDocumentExchangeAvailable)
                          const Padding(
                            padding: EdgeInsets.only(top: SchoolSpacing.xs),
                            child: Text(
                              'Secure document presentation is not configured on this build.',
                            ),
                          ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
                      if (interactions.documentReceipt != null) ...[
                        SchoolStatusBanner(
                          label: 'Document closed securely',
                          message:
                              'The verified document was presented from a no-store lease and the temporary bytes were deleted.',
                          tone: SchoolStatusTone.success,
                        ),
                        const SizedBox(height: SchoolSpacing.md),
                      ],
""",
)

replace_once(
    "apps/family_app/lib/production_app.dart",
    """    this.repository,
    super.key,
  });""",
    """    this.repository,
    this.secureDocumentExchange,
    super.key,
  });""",
)
replace_once(
    "apps/family_app/lib/production_app.dart",
    """  final FamilyReadRepository? repository;

  @override""",
    """  final FamilyReadRepository? repository;
  final FamilySecureDocumentExchange? secureDocumentExchange;

  @override""",
)
replace_once(
    "apps/family_app/lib/production_app.dart",
    """            repository: repository,
            session: session,
          );""",
    """            repository: repository,
            secureDocumentExchange: widget.secureDocumentExchange,
            session: session,
          );""",
)
replace_once(
    "apps/family_app/lib/production_app.dart",
    """    this.onNotificationDecision,
    required this.session,
  });""",
    """    this.onNotificationDecision,
    required this.session,
    this.secureDocumentExchange,
  });""",
)
replace_once(
    "apps/family_app/lib/production_app.dart",
    """  final FamilyReadRepository repository;
  final SchoolSession session;""",
    """  final FamilyReadRepository repository;
  final SchoolSession session;
  final FamilySecureDocumentExchange? secureDocumentExchange;""",
)
replace_once(
    "apps/family_app/lib/production_app.dart",
    """      _interactions = FamilyInteractionController(
        repository: interactionRepository,
        session: widget.session,
      );""",
    """      _interactions = FamilyInteractionController(
        repository: interactionRepository,
        secureDocumentExchange: widget.secureDocumentExchange,
        session: widget.session,
      );""",
)
replace_once(
    "apps/family_app/lib/production_app.dart",
    """    final notificationSourceChanged =
        oldWidget.notificationSource != widget.notificationSource;""",
    """    final notificationSourceChanged =
        oldWidget.notificationSource != widget.notificationSource;
    final secureDocumentExchangeChanged =
        oldWidget.secureDocumentExchange != widget.secureDocumentExchange;""",
)
replace_once(
    "apps/family_app/lib/production_app.dart",
    """    if (interactionChanged) {
      _interactions?.dispose();
      final interactionRepository = widget.interactionRepository;
      _interactions = interactionRepository == null
          ? null
          : FamilyInteractionController(
              repository: interactionRepository,
              session: widget.session,
            );""",
    """    if (interactionChanged || secureDocumentExchangeChanged) {
      _interactions?.dispose();
      final interactionRepository = widget.interactionRepository;
      _interactions = interactionRepository == null
          ? null
          : FamilyInteractionController(
              repository: interactionRepository,
              secureDocumentExchange: widget.secureDocumentExchange,
              session: widget.session,
            );""",
)
replace_once(
    "apps/family_app/lib/production_app.dart",
    """    if (scopeChanged || interactionChanged) {
      _router.dispose();""",
    """    if (scopeChanged ||
        interactionChanged ||
        secureDocumentExchangeChanged) {
      _router.dispose();""",
)
