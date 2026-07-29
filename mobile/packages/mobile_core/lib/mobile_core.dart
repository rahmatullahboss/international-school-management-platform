/// Shared, platform-neutral contracts used by both Flutter applications.
library;

enum SchoolPersona {
  guardian,
  student,
  teacher;

  String get label => switch (this) {
    SchoolPersona.guardian => 'Guardian',
    SchoolPersona.student => 'Student',
    SchoolPersona.teacher => 'Teacher',
  };
}

abstract final class SchoolCapability {
  static const attendanceRead = 'attendance.read';
  static const attendanceTake = 'attendance.take';
  static const billingRead = 'billing.read';
  static const documentsRead = 'documents.read';
  static const formsConsent = 'forms.consent';
  static const gradesReadPublished = 'grades.read.published';
  static const gradesWrite = 'grades.write';
  static const messagesRead = 'messages.read';
  static const messagesSend = 'messages.send';
  static const timetableRead = 'timetable.read';
}

final class SchoolSession {
  SchoolSession({
    required this.accountId,
    required this.activePersona,
    required Set<SchoolPersona> availablePersonas,
    required this.campusId,
    required Set<String> capabilities,
    required this.locale,
    required this.tenantId,
    required this.timeZone,
  }) : availablePersonas = Set<SchoolPersona>.unmodifiable(
         availablePersonas,
       ),
       capabilities = Set<String>.unmodifiable(capabilities) {
    if (!this.availablePersonas.contains(activePersona)) {
      throw ArgumentError.value(
        activePersona,
        'activePersona',
        'The persona is not available for this account.',
      );
    }
  }

  final String accountId;
  final String tenantId;
  final String campusId;
  final SchoolPersona activePersona;
  final Set<SchoolPersona> availablePersonas;
  final Set<String> capabilities;
  final String locale;
  final String timeZone;

  bool can(String capability) => capabilities.contains(capability);

  SchoolSession copyWith({
    SchoolPersona? activePersona,
    Set<String>? capabilities,
  }) {
    final nextPersona = activePersona ?? this.activePersona;
    if (!availablePersonas.contains(nextPersona)) {
      throw ArgumentError.value(
        nextPersona,
        'activePersona',
        'The persona is not available for this account.',
      );
    }

    return SchoolSession(
      accountId: accountId,
      activePersona: nextPersona,
      availablePersonas: availablePersonas,
      campusId: campusId,
      capabilities: capabilities ?? this.capabilities,
      locale: locale,
      tenantId: tenantId,
      timeZone: timeZone,
    );
  }
}

final class PersonaAccess {
  factory PersonaAccess({
    required Iterable<String> capabilities,
    required SchoolPersona persona,
  }) {
    final normalized = capabilities.map((capability) => capability.trim()).toSet();
    if (normalized.any((capability) => capability.isEmpty)) {
      throw const BootstrapContractException('BOOTSTRAP_CAPABILITY_EMPTY');
    }
    return PersonaAccess._(
      capabilities: Set<String>.unmodifiable(normalized),
      persona: persona,
    );
  }

  const PersonaAccess._({required this.capabilities, required this.persona});

  final SchoolPersona persona;
  final Set<String> capabilities;
}

final class CampusAccess {
  factory CampusAccess({
    required String campusId,
    required String campusName,
    required Iterable<PersonaAccess> personas,
  }) {
    final normalizedId = campusId.trim();
    final normalizedName = campusName.trim();
    if (normalizedId.isEmpty || normalizedName.isEmpty) {
      throw const BootstrapContractException('BOOTSTRAP_CAMPUS_IDENTITY_REQUIRED');
    }

    final byPersona = <SchoolPersona, PersonaAccess>{};
    for (final access in personas) {
      if (byPersona.containsKey(access.persona)) {
        throw const BootstrapContractException('BOOTSTRAP_PERSONA_DUPLICATE');
      }
      byPersona[access.persona] = access;
    }
    if (byPersona.isEmpty) {
      throw const BootstrapContractException('BOOTSTRAP_PERSONA_REQUIRED');
    }

    return CampusAccess._(
      campusId: normalizedId,
      campusName: normalizedName,
      personas: Map<SchoolPersona, PersonaAccess>.unmodifiable(byPersona),
    );
  }

  const CampusAccess._({
    required this.campusId,
    required this.campusName,
    required Map<SchoolPersona, PersonaAccess> personas,
  }) : _personas = personas;

  final String campusId;
  final String campusName;
  final Map<SchoolPersona, PersonaAccess> _personas;

  Set<SchoolPersona> get personas => Set<SchoolPersona>.unmodifiable(
    _personas.keys,
  );

  PersonaAccess? accessFor(SchoolPersona persona) => _personas[persona];
}

final class TenantAccess {
  factory TenantAccess({
    required Iterable<CampusAccess> campuses,
    required String tenantId,
    required String tenantName,
  }) {
    final normalizedId = tenantId.trim();
    final normalizedName = tenantName.trim();
    if (normalizedId.isEmpty || normalizedName.isEmpty) {
      throw const BootstrapContractException('BOOTSTRAP_TENANT_IDENTITY_REQUIRED');
    }

    final byId = <String, CampusAccess>{};
    for (final campus in campuses) {
      if (byId.containsKey(campus.campusId)) {
        throw const BootstrapContractException('BOOTSTRAP_CAMPUS_DUPLICATE');
      }
      byId[campus.campusId] = campus;
    }
    if (byId.isEmpty) {
      throw const BootstrapContractException('BOOTSTRAP_CAMPUS_REQUIRED');
    }

    return TenantAccess._(
      campuses: Map<String, CampusAccess>.unmodifiable(byId),
      tenantId: normalizedId,
      tenantName: normalizedName,
    );
  }

  const TenantAccess._({
    required Map<String, CampusAccess> campuses,
    required this.tenantId,
    required this.tenantName,
  }) : _campuses = campuses;

  final String tenantId;
  final String tenantName;
  final Map<String, CampusAccess> _campuses;

  List<CampusAccess> get campuses => List<CampusAccess>.unmodifiable(
    _campuses.values,
  );

  CampusAccess? campus(String campusId) => _campuses[campusId];
}

final class MobileBootstrap {
  factory MobileBootstrap({
    required String accountId,
    required String locale,
    required Iterable<TenantAccess> schools,
    required String timeZone,
    String? syncCursor,
  }) {
    final normalizedAccountId = accountId.trim();
    final normalizedLocale = locale.trim();
    final normalizedTimeZone = timeZone.trim();
    if (normalizedAccountId.isEmpty ||
        normalizedLocale.isEmpty ||
        normalizedTimeZone.isEmpty) {
      throw const BootstrapContractException('BOOTSTRAP_ACCOUNT_CONTEXT_REQUIRED');
    }

    final byId = <String, TenantAccess>{};
    for (final school in schools) {
      if (byId.containsKey(school.tenantId)) {
        throw const BootstrapContractException('BOOTSTRAP_TENANT_DUPLICATE');
      }
      byId[school.tenantId] = school;
    }
    if (byId.isEmpty) {
      throw const BootstrapContractException('BOOTSTRAP_TENANT_REQUIRED');
    }

    return MobileBootstrap._(
      accountId: normalizedAccountId,
      locale: normalizedLocale,
      schools: Map<String, TenantAccess>.unmodifiable(byId),
      syncCursor: syncCursor?.trim(),
      timeZone: normalizedTimeZone,
    );
  }

  const MobileBootstrap._({
    required this.accountId,
    required this.locale,
    required Map<String, TenantAccess> schools,
    required this.syncCursor,
    required this.timeZone,
  }) : _schools = schools;

  final String accountId;
  final String locale;
  final String timeZone;
  final String? syncCursor;
  final Map<String, TenantAccess> _schools;

  List<TenantAccess> get schools => List<TenantAccess>.unmodifiable(
    _schools.values,
  );

  SchoolSession activate({
    required String campusId,
    required SchoolPersona persona,
    required String tenantId,
  }) {
    final school = _schools[tenantId];
    if (school == null) {
      throw const BootstrapContractException('BOOTSTRAP_TENANT_NOT_AVAILABLE');
    }
    final campus = school.campus(campusId);
    if (campus == null) {
      throw const BootstrapContractException('BOOTSTRAP_CAMPUS_NOT_AVAILABLE');
    }
    final access = campus.accessFor(persona);
    if (access == null) {
      throw const BootstrapContractException('BOOTSTRAP_PERSONA_NOT_AVAILABLE');
    }

    return SchoolSession(
      accountId: accountId,
      activePersona: persona,
      availablePersonas: campus.personas,
      campusId: campus.campusId,
      capabilities: access.capabilities,
      locale: locale,
      tenantId: school.tenantId,
      timeZone: timeZone,
    );
  }
}

final class BootstrapContractException implements Exception {
  const BootstrapContractException(this.code);

  final String code;

  @override
  String toString() => 'BootstrapContractException($code)';
}

enum MobileSyncStatus {
  savedOnDevice,
  waitingForNetwork,
  syncing,
  synced,
  conflict,
  rejected,
  requiresReview;

  String get label => switch (this) {
    MobileSyncStatus.savedOnDevice => 'Saved on device',
    MobileSyncStatus.waitingForNetwork => 'Waiting for network',
    MobileSyncStatus.syncing => 'Syncing',
    MobileSyncStatus.synced => 'Synced',
    MobileSyncStatus.conflict => 'Conflict',
    MobileSyncStatus.rejected => 'Rejected',
    MobileSyncStatus.requiresReview => 'Needs review',
  };
}

final class PendingOperation<T extends Object> {
  const PendingOperation({
    required this.baseVersion,
    required this.campusId,
    required this.clientCreatedAt,
    required this.idempotencyKey,
    required this.operationId,
    required this.payload,
    required this.persona,
    required this.status,
    required this.tenantId,
  });

  final String operationId;
  final String idempotencyKey;
  final String tenantId;
  final String campusId;
  final SchoolPersona persona;
  final DateTime clientCreatedAt;
  final int baseVersion;
  final T payload;
  final MobileSyncStatus status;

  PendingOperation<T> copyWith({MobileSyncStatus? status}) =>
      PendingOperation<T>(
        baseVersion: baseVersion,
        campusId: campusId,
        clientCreatedAt: clientCreatedAt,
        idempotencyKey: idempotencyKey,
        operationId: operationId,
        payload: payload,
        persona: persona,
        status: status ?? this.status,
        tenantId: tenantId,
      );
}
