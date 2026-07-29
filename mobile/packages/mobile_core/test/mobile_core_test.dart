import 'package:school_mobile_core/mobile_core.dart';
import 'package:test/test.dart';

void main() {
  group('SchoolSession', () {
    final session = SchoolSession(
      accountId: 'account-1',
      activePersona: SchoolPersona.guardian,
      availablePersonas: const {SchoolPersona.guardian, SchoolPersona.student},
      campusId: 'campus-1',
      capabilities: const {
        SchoolCapability.attendanceRead,
        SchoolCapability.billingRead,
      },
      locale: 'en-BD',
      tenantId: 'tenant-1',
      timeZone: 'Asia/Dhaka',
    );

    test('checks declared capabilities', () {
      expect(session.can(SchoolCapability.billingRead), isTrue);
      expect(session.can(SchoolCapability.gradesWrite), isFalse);
    });

    test('switches only to an available persona', () {
      expect(
        session.copyWith(activePersona: SchoolPersona.student).activePersona,
        SchoolPersona.student,
      );
      expect(
        () => session.copyWith(activePersona: SchoolPersona.teacher),
        throwsArgumentError,
      );
    });
  });

  group('MobileBootstrap', () {
    final bootstrap = MobileBootstrap(
      accountId: 'account-1',
      locale: 'en-BD',
      schools: [
        TenantAccess(
          campuses: [
            CampusAccess(
              campusId: 'campus-1',
              campusName: 'Primary Campus',
              personas: [
                PersonaAccess(
                  capabilities: const {
                    SchoolCapability.attendanceRead,
                    SchoolCapability.billingRead,
                  },
                  persona: SchoolPersona.guardian,
                ),
                PersonaAccess(
                  capabilities: const {
                    SchoolCapability.attendanceRead,
                    SchoolCapability.gradesReadPublished,
                  },
                  persona: SchoolPersona.student,
                ),
              ],
            ),
          ],
          tenantId: 'tenant-1',
          tenantName: 'Example School',
        ),
      ],
      syncCursor: 'cursor-1',
      timeZone: 'Asia/Dhaka',
    );

    test('activates only the selected persona capabilities', () {
      final session = bootstrap.activate(
        campusId: 'campus-1',
        persona: SchoolPersona.student,
        tenantId: 'tenant-1',
      );

      expect(session.availablePersonas, {
        SchoolPersona.guardian,
        SchoolPersona.student,
      });
      expect(session.can(SchoolCapability.gradesReadPublished), isTrue);
      expect(session.can(SchoolCapability.billingRead), isFalse);
    });

    test('rejects unavailable tenant, campus and persona scopes', () {
      expect(
        () => bootstrap.activate(
          campusId: 'campus-1',
          persona: SchoolPersona.student,
          tenantId: 'other-tenant',
        ),
        throwsA(
          isA<BootstrapContractException>().having(
            (error) => error.code,
            'code',
            'BOOTSTRAP_TENANT_NOT_AVAILABLE',
          ),
        ),
      );
      expect(
        () => bootstrap.activate(
          campusId: 'other-campus',
          persona: SchoolPersona.student,
          tenantId: 'tenant-1',
        ),
        throwsA(
          isA<BootstrapContractException>().having(
            (error) => error.code,
            'code',
            'BOOTSTRAP_CAMPUS_NOT_AVAILABLE',
          ),
        ),
      );
      expect(
        () => bootstrap.activate(
          campusId: 'campus-1',
          persona: SchoolPersona.teacher,
          tenantId: 'tenant-1',
        ),
        throwsA(
          isA<BootstrapContractException>().having(
            (error) => error.code,
            'code',
            'BOOTSTRAP_PERSONA_NOT_AVAILABLE',
          ),
        ),
      );
    });

    test('rejects duplicate persona declarations', () {
      expect(
        () => CampusAccess(
          campusId: 'campus-1',
          campusName: 'Primary Campus',
          personas: [
            PersonaAccess(
              capabilities: const {SchoolCapability.attendanceRead},
              persona: SchoolPersona.guardian,
            ),
            PersonaAccess(
              capabilities: const {SchoolCapability.billingRead},
              persona: SchoolPersona.guardian,
            ),
          ],
        ),
        throwsA(
          isA<BootstrapContractException>().having(
            (error) => error.code,
            'code',
            'BOOTSTRAP_PERSONA_DUPLICATE',
          ),
        ),
      );
    });
  });

  test(
    'pending operation preserves idempotency identity across status changes',
    () {
      final operation = PendingOperation<Map<String, Object?>>(
        baseVersion: 3,
        campusId: 'campus-1',
        clientCreatedAt: DateTime.utc(2026, 7, 29),
        idempotencyKey: 'attendance-batch-1',
        operationId: 'operation-1',
        payload: const {'studentId': 'student-1', 'mark': 'present'},
        persona: SchoolPersona.teacher,
        status: MobileSyncStatus.savedOnDevice,
        tenantId: 'tenant-1',
      );

      final synced = operation.copyWith(status: MobileSyncStatus.synced);
      expect(synced.operationId, operation.operationId);
      expect(synced.idempotencyKey, operation.idempotencyKey);
      expect(synced.status, MobileSyncStatus.synced);
    },
  );
}
