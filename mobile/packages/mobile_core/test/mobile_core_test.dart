import 'package:school_mobile_core/mobile_core.dart';
import 'package:test/test.dart';

void main() {
  group('SchoolSession', () {
    final session = SchoolSession(
      accountId: 'account-1',
      activePersona: SchoolPersona.guardian,
      availablePersonas: const {
        SchoolPersona.guardian,
        SchoolPersona.student,
      },
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

  test('pending operation preserves idempotency identity across status changes', () {
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
  });
}
