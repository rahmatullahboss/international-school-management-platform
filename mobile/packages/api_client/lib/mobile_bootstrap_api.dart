import 'package:school_api_client/school_api_client.dart';
import 'package:school_mobile_core/mobile_core.dart';

final class MobileBootstrapApi {
  const MobileBootstrapApi(this._client);

  static const path = '/v1/mobile/bootstrap';

  final SchoolApiClient _client;

  Future<MobileBootstrap> load({required String correlationId}) async {
    final response = await _client.getJson(
      path,
      context: ApiRequestContext.accountScoped(correlationId: correlationId),
    );

    try {
      return MobileBootstrapDecoder.decode(response);
    } on BootstrapContractException catch (error) {
      throw SchoolApiException(
        code: 'INVALID_BOOTSTRAP_RESPONSE',
        message: 'The account access response could not be validated.',
        statusCode: null,
      );
    } on FormatException catch (error) {
      throw SchoolApiException(
        code: 'INVALID_BOOTSTRAP_RESPONSE',
        message: 'The account access response could not be decoded.',
        statusCode: null,
      );
    }
  }
}

abstract final class MobileBootstrapDecoder {
  static MobileBootstrap decode(Map<String, Object?> json) => MobileBootstrap(
    accountId: _requiredString(json, 'accountId'),
    locale: _requiredString(json, 'locale'),
    schools: _objectList(json, 'schools').map(_decodeTenant),
    syncCursor: _optionalString(json, 'syncCursor'),
    timeZone: _requiredString(json, 'timeZone'),
  );

  static TenantAccess _decodeTenant(Map<String, Object?> json) => TenantAccess(
    campuses: _objectList(json, 'campuses').map(_decodeCampus),
    tenantId: _requiredString(json, 'tenantId'),
    tenantName: _requiredString(json, 'tenantName'),
  );

  static CampusAccess _decodeCampus(Map<String, Object?> json) => CampusAccess(
    campusId: _requiredString(json, 'campusId'),
    campusName: _requiredString(json, 'campusName'),
    personas: _objectList(json, 'personas').map(_decodePersona),
  );

  static PersonaAccess _decodePersona(Map<String, Object?> json) =>
      PersonaAccess(
        capabilities: _stringList(json, 'capabilities'),
        persona: _persona(_requiredString(json, 'persona')),
      );

  static SchoolPersona _persona(String value) => switch (value) {
    'guardian' => SchoolPersona.guardian,
    'student' => SchoolPersona.student,
    'teacher' => SchoolPersona.teacher,
    _ => throw const FormatException('BOOTSTRAP_PERSONA_UNKNOWN'),
  };

  static String _requiredString(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is! String || value.trim().isEmpty) {
      throw FormatException('BOOTSTRAP_FIELD_REQUIRED:$key');
    }
    return value.trim();
  }

  static String? _optionalString(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value == null) {
      return null;
    }
    if (value is! String) {
      throw FormatException('BOOTSTRAP_FIELD_INVALID:$key');
    }
    return value.trim();
  }

  static List<Map<String, Object?>> _objectList(
    Map<String, Object?> json,
    String key,
  ) {
    final value = json[key];
    if (value is! List<Object?>) {
      throw FormatException('BOOTSTRAP_LIST_REQUIRED:$key');
    }
    return value.map((item) {
      if (item is! Map<String, Object?>) {
        throw FormatException('BOOTSTRAP_OBJECT_REQUIRED:$key');
      }
      return item;
    }).toList(growable: false);
  }

  static List<String> _stringList(
    Map<String, Object?> json,
    String key,
  ) {
    final value = json[key];
    if (value is! List<Object?>) {
      throw FormatException('BOOTSTRAP_LIST_REQUIRED:$key');
    }
    return value.map((item) {
      if (item is! String || item.trim().isEmpty) {
        throw FormatException('BOOTSTRAP_STRING_REQUIRED:$key');
      }
      return item.trim();
    }).toList(growable: false);
  }
}
