import 'package:flutter/foundation.dart';
import 'package:school_api_client/mobile_bootstrap_api.dart';
import 'package:school_api_client/school_api_client.dart';
import 'package:school_app_bootstrap/src/runtime_configuration.dart';
import 'package:school_authentication/school_authentication.dart';
import 'package:school_mobile_core/mobile_core.dart';

typedef CorrelationIdFactory = String Function();

abstract interface class MobileBootstrapLoader {
  Future<MobileBootstrap> load({required String correlationId});
}

final class ApiMobileBootstrapLoader implements MobileBootstrapLoader {
  const ApiMobileBootstrapLoader(this._api);

  final MobileBootstrapApi _api;

  @override
  Future<MobileBootstrap> load({required String correlationId}) =>
      _api.load(correlationId: correlationId);
}

enum MobileApplicationPhase {
  restoring,
  signedOut,
  authenticating,
  loadingAccess,
  choosingAccess,
  ready,
  signingOut,
  failed,
}

final class MobileAccessOption {
  const MobileAccessOption({
    required this.campusId,
    required this.campusName,
    required this.persona,
    required this.tenantId,
    required this.tenantName,
  });

  final String tenantId;
  final String tenantName;
  final String campusId;
  final String campusName;
  final SchoolPersona persona;

  bool matches(MobileAccessOption other) =>
      tenantId == other.tenantId &&
      campusId == other.campusId &&
      persona == other.persona;
}

final class MobileApplicationState {
  const MobileApplicationState._({
    required this.phase,
    this.accessOptions = const <MobileAccessOption>[],
    this.bootstrap,
    this.reasonCode,
    this.session,
  });

  const MobileApplicationState.restoring()
    : this._(phase: MobileApplicationPhase.restoring);

  const MobileApplicationState.signedOut({String? reasonCode})
    : this._(phase: MobileApplicationPhase.signedOut, reasonCode: reasonCode);

  const MobileApplicationState.authenticating()
    : this._(phase: MobileApplicationPhase.authenticating);

  const MobileApplicationState.loadingAccess()
    : this._(phase: MobileApplicationPhase.loadingAccess);

  MobileApplicationState.choosingAccess({
    required MobileBootstrap bootstrap,
    required List<MobileAccessOption> accessOptions,
  }) : this._(
         accessOptions: List<MobileAccessOption>.unmodifiable(accessOptions),
         bootstrap: bootstrap,
         phase: MobileApplicationPhase.choosingAccess,
       );

  MobileApplicationState.ready({
    required MobileBootstrap bootstrap,
    required SchoolSession session,
    required List<MobileAccessOption> accessOptions,
  }) : this._(
         accessOptions: List<MobileAccessOption>.unmodifiable(accessOptions),
         bootstrap: bootstrap,
         phase: MobileApplicationPhase.ready,
         session: session,
       );

  const MobileApplicationState.signingOut()
    : this._(phase: MobileApplicationPhase.signingOut);

  const MobileApplicationState.failed(String reasonCode)
    : this._(phase: MobileApplicationPhase.failed, reasonCode: reasonCode);

  final MobileApplicationPhase phase;
  final MobileBootstrap? bootstrap;
  final SchoolSession? session;
  final List<MobileAccessOption> accessOptions;
  final String? reasonCode;

  bool get isReady => phase == MobileApplicationPhase.ready && session != null;
}

final class MobileAppCoordinator extends ChangeNotifier {
  MobileAppCoordinator({
    required Set<SchoolPersona> allowedPersonas,
    required AuthSessionManager authentication,
    required MobileBootstrapLoader bootstrapLoader,
    CorrelationIdFactory? correlationIdFactory,
    SchoolApiClient? ownedApiClient,
  }) : _allowedPersonas = Set<SchoolPersona>.unmodifiable(allowedPersonas),
       _authentication = authentication,
       _bootstrapLoader = bootstrapLoader,
       _correlationIdFactory =
           correlationIdFactory ?? _DefaultCorrelationIdFactory().next,
       _ownedApiClient = ownedApiClient {
    if (_allowedPersonas.isEmpty) {
      throw ArgumentError.value(
        allowedPersonas,
        'allowedPersonas',
        'At least one app persona is required.',
      );
    }
  }

  factory MobileAppCoordinator.fromEnvironment({
    required Set<SchoolPersona> allowedPersonas,
    required String expectedRedirectScheme,
  }) {
    final runtime = MobileRuntimeConfiguration.fromEnvironment(
      expectedRedirectScheme: expectedRedirectScheme,
    );
    final authentication = AuthSessionManager(
      configuration: runtime.oidc,
      gateway: const AppAuthAuthorizationGateway(),
      tokenStore: SecureAuthTokenStore(),
    );
    final apiClient = SchoolApiClient(
      accessTokenProvider: authentication.validAccessToken,
      baseUri: runtime.apiBaseUri,
    );
    return MobileAppCoordinator(
      allowedPersonas: allowedPersonas,
      authentication: authentication,
      bootstrapLoader: ApiMobileBootstrapLoader(MobileBootstrapApi(apiClient)),
      ownedApiClient: apiClient,
    );
  }

  final Set<SchoolPersona> _allowedPersonas;
  final AuthSessionManager _authentication;
  final MobileBootstrapLoader _bootstrapLoader;
  final CorrelationIdFactory _correlationIdFactory;
  final SchoolApiClient? _ownedApiClient;

  MobileApplicationState _state = const MobileApplicationState.restoring();
  int _operationGeneration = 0;
  bool _disposed = false;

  MobileApplicationState get state => _state;

  Future<void> initialize() async {
    final operation = ++_operationGeneration;
    _set(const MobileApplicationState.restoring());
    try {
      final snapshot = await _authentication.restore();
      await _applyAuthenticationSnapshot(snapshot, operation);
    } on Object catch (error) {
      _failIfCurrent(operation, error);
    }
  }

  Future<void> signIn() async {
    final operation = ++_operationGeneration;
    _set(const MobileApplicationState.authenticating());
    try {
      final snapshot = await _authentication.signIn();
      await _applyAuthenticationSnapshot(snapshot, operation);
    } on Object catch (error) {
      _failIfCurrent(operation, error);
    }
  }

  Future<void> signOut() async {
    final operation = ++_operationGeneration;
    _set(const MobileApplicationState.signingOut());
    try {
      final snapshot = await _authentication.signOut();
      if (!_isCurrent(operation)) {
        return;
      }
      _set(MobileApplicationState.signedOut(reasonCode: snapshot.reasonCode));
    } on Object catch (error) {
      if (!_isCurrent(operation)) {
        return;
      }
      _set(MobileApplicationState.signedOut(reasonCode: _reasonCode(error)));
    }
  }

  void selectAccess(MobileAccessOption selected) {
    final bootstrap = _state.bootstrap;
    if (bootstrap == null) {
      _set(
        const MobileApplicationState.failed(
          'BOOTSTRAP_SELECTION_CONTEXT_REQUIRED',
        ),
      );
      return;
    }
    final option = _state.accessOptions.where(selected.matches).firstOrNull;
    if (option == null) {
      _set(
        const MobileApplicationState.failed(
          'BOOTSTRAP_SELECTION_NOT_AVAILABLE',
        ),
      );
      return;
    }
    _activate(bootstrap, _state.accessOptions, option);
  }

  void switchPersona(SchoolPersona persona) {
    final session = _state.session;
    if (session == null || !_allowedPersonas.contains(persona)) {
      return;
    }
    final option = _state.accessOptions
        .where(
          (candidate) =>
              candidate.tenantId == session.tenantId &&
              candidate.campusId == session.campusId &&
              candidate.persona == persona,
        )
        .firstOrNull;
    if (option != null) {
      selectAccess(option);
    }
  }

  Future<void> _applyAuthenticationSnapshot(
    AuthSessionSnapshot snapshot,
    int operation,
  ) async {
    if (!_isCurrent(operation)) {
      return;
    }
    switch (snapshot.phase) {
      case AuthSessionPhase.signedOut:
        _set(MobileApplicationState.signedOut(reasonCode: snapshot.reasonCode));
      case AuthSessionPhase.failed:
        _set(
          MobileApplicationState.failed(
            snapshot.reasonCode ?? 'AUTHENTICATION_FAILED',
          ),
        );
      case AuthSessionPhase.authenticated:
        await _loadAccess(operation);
    }
  }

  Future<void> _loadAccess(int operation) async {
    _set(const MobileApplicationState.loadingAccess());
    try {
      final bootstrap = await _bootstrapLoader.load(
        correlationId: _correlationIdFactory(),
      );
      if (!_isCurrent(operation)) {
        return;
      }
      final options = _accessOptions(bootstrap);
      if (options.isEmpty) {
        _set(const MobileApplicationState.failed('BOOTSTRAP_NO_APP_ACCESS'));
        return;
      }
      if (options.length == 1) {
        _activate(bootstrap, options, options.single);
        return;
      }
      _set(
        MobileApplicationState.choosingAccess(
          accessOptions: options,
          bootstrap: bootstrap,
        ),
      );
    } on Object catch (error) {
      _failIfCurrent(operation, error);
    }
  }

  List<MobileAccessOption> _accessOptions(MobileBootstrap bootstrap) {
    final options = <MobileAccessOption>[];
    for (final school in bootstrap.schools) {
      for (final campus in school.campuses) {
        for (final persona in campus.personas) {
          if (_allowedPersonas.contains(persona)) {
            options.add(
              MobileAccessOption(
                campusId: campus.campusId,
                campusName: campus.campusName,
                persona: persona,
                tenantId: school.tenantId,
                tenantName: school.tenantName,
              ),
            );
          }
        }
      }
    }
    return List<MobileAccessOption>.unmodifiable(options);
  }

  void _activate(
    MobileBootstrap bootstrap,
    List<MobileAccessOption> options,
    MobileAccessOption option,
  ) {
    try {
      final session = bootstrap.activate(
        campusId: option.campusId,
        persona: option.persona,
        tenantId: option.tenantId,
      );
      _set(
        MobileApplicationState.ready(
          accessOptions: options,
          bootstrap: bootstrap,
          session: session,
        ),
      );
    } on Object catch (error) {
      _set(MobileApplicationState.failed(_reasonCode(error)));
    }
  }

  void _failIfCurrent(int operation, Object error) {
    if (_isCurrent(operation)) {
      _set(MobileApplicationState.failed(_reasonCode(error)));
    }
  }

  String _reasonCode(Object error) => switch (error) {
    AuthException(:final code) => code,
    BootstrapContractException(:final code) => code,
    SchoolApiException(:final code) => code,
    MobileRuntimeConfigurationException(:final code) => code,
    _ => 'MOBILE_BOOTSTRAP_UNAVAILABLE',
  };

  bool _isCurrent(int operation) =>
      !_disposed && operation == _operationGeneration;

  void _set(MobileApplicationState next) {
    if (_disposed) {
      return;
    }
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _operationGeneration++;
    _ownedApiClient?.close();
    super.dispose();
  }
}

final class _DefaultCorrelationIdFactory {
  int _sequence = 0;

  String next() {
    _sequence++;
    final timestamp = DateTime.now().toUtc().microsecondsSinceEpoch;
    return 'mobile-$timestamp-$_sequence';
  }
}
