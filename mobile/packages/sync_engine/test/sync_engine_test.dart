import 'dart:typed_data';

import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:test/test.dart';

void main() {
  test('encrypted payload is immutable and diagnostics stay redacted', () {
    final source = Uint8List.fromList(<int>[1, 2, 3]);
    final payload = EncryptedSyncPayload(
      ciphertext: source,
      contentType: 'application/json',
      keyAlias: 'mobile-sync-v1',
      schemaVersion: 'attendance.v1',
    );
    source[0] = 9;

    expect(payload.ciphertext, <int>[1, 2, 3]);
    final exposed = payload.ciphertext;
    exposed[0] = 8;
    expect(payload.ciphertext, <int>[1, 2, 3]);
    expect(payload.toString(), isNot(contains('[1, 2, 3]')));
    expect(payload.toString(), contains('bytes: 3'));
  });

  test('operation scope must match the active account and school session', () {
    final operation = syncOperation();

    expect(() => operation.validateSession(teacherSession()), returnsNormally);
    expect(
      () => operation.validateSession(teacherSession(campusId: 'campus-other')),
      throwsA(
        isA<SyncContractException>().having(
          (error) => error.code,
          'code',
          'SYNC_SESSION_SCOPE_MISMATCH',
        ),
      ),
    );
  });

  test(
    'retry transition schedules deterministic capped exponential backoff',
    () {
      final schedule = RetrySchedule(
        baseDelay: Duration(seconds: 5),
        maximumDelay: Duration(seconds: 20),
      );
      final now = DateTime.parse('2026-07-30T03:30:00+06:00');

      final first = syncOperation().transition(
        now: now,
        outcome: SyncAttemptOutcome.retryableFailure,
        retrySchedule: schedule,
      );
      final second = first.transition(
        now: now,
        outcome: SyncAttemptOutcome.retryableFailure,
        retrySchedule: schedule,
      );
      final third = second.transition(
        now: now,
        outcome: SyncAttemptOutcome.retryableFailure,
        retrySchedule: schedule,
      );

      expect(first.nextAttemptAt, now.add(const Duration(seconds: 5)));
      expect(second.nextAttemptAt, now.add(const Duration(seconds: 10)));
      expect(third.nextAttemptAt, now.add(const Duration(seconds: 20)));
      expect(third.attemptCount, 3);
    },
  );

  test(
    'accepted, duplicate and conflict outcomes remain explicit terminals',
    () {
      final schedule = RetrySchedule();
      final now = DateTime.parse('2026-07-30T03:30:00+06:00');

      final accepted = syncOperation().transition(
        now: now,
        outcome: SyncAttemptOutcome.accepted,
        retrySchedule: schedule,
      );
      final duplicate = syncOperation(operationId: 'operation-2').transition(
        now: now,
        outcome: SyncAttemptOutcome.duplicate,
        retrySchedule: schedule,
      );
      final conflict = syncOperation(operationId: 'operation-3').transition(
        now: now,
        outcome: SyncAttemptOutcome.conflict,
        reasonCode: 'BASE_VERSION_STALE',
        retrySchedule: schedule,
      );

      expect(accepted.state, SyncOperationState.synced);
      expect(duplicate.state, SyncOperationState.duplicate);
      expect(conflict.state, SyncOperationState.conflict);
      expect(conflict.lastReasonCode, 'BASE_VERSION_STALE');
      expect(
        () => conflict.markInFlight(),
        throwsA(isA<SyncContractException>()),
      );
    },
  );

  test('terminal operations cannot carry a future retry timestamp', () {
    expect(
      () => syncOperation(
        nextAttemptAt: DateTime.parse('2026-07-30T03:31:00+06:00'),
        state: SyncOperationState.synced,
      ),
      throwsA(
        isA<SyncContractException>().having(
          (error) => error.code,
          'code',
          'SYNC_TERMINAL_RETRY_NOT_ALLOWED',
        ),
      ),
    );
  });

  test('cursor cannot cross tenant or campus boundaries', () {
    final cursor = SyncCursor(
      accountId: 'account-1',
      campusId: 'campus-1',
      cursor: 'cursor-100',
      persona: SchoolPersona.teacher,
      receivedAt: DateTime.parse('2026-07-30T03:30:00+06:00'),
      tenantId: 'tenant-1',
    );

    expect(() => cursor.validateSession(teacherSession()), returnsNormally);
    expect(
      () => cursor.validateSession(teacherSession(tenantId: 'tenant-other')),
      throwsA(
        isA<SyncContractException>().having(
          (error) => error.code,
          'code',
          'SYNC_CURSOR_SCOPE_MISMATCH',
        ),
      ),
    );
  });

  test('cursor cannot cross persona boundaries', () {
    final cursor = SyncCursor(
      accountId: 'account-1',
      campusId: 'campus-1',
      cursor: 'cursor-101',
      persona: SchoolPersona.guardian,
      receivedAt: DateTime.parse('2026-08-22T00:00:00Z'),
      tenantId: 'tenant-1',
    );
    expect(
      () => cursor.validateSession(teacherSession()),
      throwsA(
        isA<SyncContractException>().having(
          (error) => error.code,
          'code',
          'SYNC_CURSOR_SCOPE_MISMATCH',
        ),
      ),
    );
  });

  test(
    'delta coordinator persists the server cursor for the exact persona',
    () async {
      final store = MemoryEncryptedSyncStore(const <SyncOperationEnvelope>[]);
      final previous = SyncCursor(
        accountId: 'account-1',
        campusId: 'campus-1',
        cursor: '40000000-0000-4000-8000-000000000001',
        persona: SchoolPersona.teacher,
        receivedAt: DateTime.parse('2026-08-21T23:00:00Z'),
        tenantId: 'tenant-1',
      );
      await store.saveCursor(previous);
      final transport = FakeSyncDeltaTransport(
        SyncDelta(
          changed: true,
          cursor: '40000000-0000-4000-8000-000000000002',
          serverTime: DateTime.parse('2026-08-22T00:00:00Z'),
        ),
      );
      final coordinator = SyncDeltaCoordinator(
        store: store,
        transport: transport,
      );

      final result = await coordinator.pull(teacherSession());

      expect(result.changed, isTrue);
      expect(transport.cursor, previous.cursor);
      final saved = await store.readCursor(teacherSession());
      expect(saved?.cursor, result.cursor);
      expect(saved?.persona, SchoolPersona.teacher);
      expect(saved?.receivedAt, result.serverTime);
    },
  );

  test(
    'delta coordinator clears an invalid cursor and retries once from baseline',
    () async {
      final store = MemoryEncryptedSyncStore(const <SyncOperationEnvelope>[]);
      await store.saveCursor(
        SyncCursor(
          accountId: 'account-1',
          campusId: 'campus-1',
          cursor: '40000000-0000-4000-8000-000000000009',
          persona: SchoolPersona.teacher,
          receivedAt: DateTime.parse('2026-08-21T22:00:00Z'),
          tenantId: 'tenant-1',
        ),
      );
      final transport = RecoveringSyncDeltaTransport();
      final coordinator = SyncDeltaCoordinator(
        store: store,
        transport: transport,
      );

      final result = await coordinator.pull(teacherSession());

      expect(transport.cursors, <String?>[
        '40000000-0000-4000-8000-000000000009',
        null,
      ]);
      expect(result.changed, isFalse);
      expect((await store.readCursor(teacherSession()))?.cursor, result.cursor);
    },
  );

  test('coordinator persists in-flight and accepted terminal states', () async {
    final store = MemoryEncryptedSyncStore(<SyncOperationEnvelope>[
      syncOperation(),
    ]);
    final transport = FakeSyncTransport(
      SyncAttemptResult(outcome: SyncAttemptOutcome.accepted),
    );
    final coordinator = OfflineSyncCoordinator(
      retrySchedule: RetrySchedule(),
      store: store,
      transport: transport,
    );

    final receipt = await coordinator.flush(
      now: DateTime.parse('2026-07-30T03:30:00+06:00'),
      session: teacherSession(),
    );

    expect(receipt.operations.single.state, SyncOperationState.synced);
    expect(
      store.history.map((item) => item.state),
      orderedEquals(<Object?>[
        SyncOperationState.inFlight,
        SyncOperationState.synced,
      ]),
    );
    expect(transport.sentOperationIds, <String>['operation-1']);
  });

  test(
    'transport errors become retryable without losing encrypted payload',
    () async {
      final original = syncOperation();
      final store = MemoryEncryptedSyncStore(<SyncOperationEnvelope>[original]);
      final coordinator = OfflineSyncCoordinator(
        retrySchedule: RetrySchedule(baseDelay: Duration(seconds: 5)),
        store: store,
        transport: ThrowingSyncTransport(),
      );
      final now = DateTime.parse('2026-07-30T03:30:00+06:00');

      final receipt = await coordinator.flush(
        now: now,
        session: teacherSession(),
      );
      final retriable = receipt.operations.single;

      expect(retriable.state, SyncOperationState.waitingForNetwork);
      expect(retriable.nextAttemptAt, now.add(const Duration(seconds: 5)));
      expect(retriable.lastReasonCode, 'SYNC_TRANSPORT_UNAVAILABLE');
      expect(retriable.payload.ciphertext, original.payload.ciphertext);
    },
  );

  test('batch receipts reject duplicate operation identities', () {
    final operation = syncOperation();

    expect(
      () => SyncBatchReceipt(
        nextCursor: null,
        operations: <SyncOperationEnvelope>[operation, operation],
      ),
      throwsA(
        isA<SyncContractException>().having(
          (error) => error.code,
          'code',
          'SYNC_RECEIPT_OPERATION_DUPLICATE',
        ),
      ),
    );
  });
}

SyncOperationEnvelope syncOperation({
  DateTime? nextAttemptAt,
  String operationId = 'operation-1',
  SyncOperationState state = SyncOperationState.savedOnDevice,
}) => SyncOperationEnvelope(
  accountId: 'account-1',
  aggregateId: 'meeting-1',
  aggregateType: 'attendanceMeeting',
  attemptCount: 0,
  baseVersion: 4,
  campusId: 'campus-1',
  clientCreatedAt: DateTime.parse('2026-07-30T03:25:00+06:00'),
  idempotencyKey: 'idempotency-$operationId',
  kind: SyncOperationKind.attendanceBatch,
  nextAttemptAt: nextAttemptAt,
  operationId: operationId,
  payload: EncryptedSyncPayload(
    ciphertext: Uint8List.fromList(<int>[7, 8, 9]),
    contentType: 'application/json',
    keyAlias: 'mobile-sync-v1',
    schemaVersion: 'attendance.v1',
  ),
  persona: SchoolPersona.teacher,
  state: state,
  tenantId: 'tenant-1',
);

SchoolSession teacherSession({
  String campusId = 'campus-1',
  String tenantId = 'tenant-1',
}) => SchoolSession(
  accountId: 'account-1',
  activePersona: SchoolPersona.teacher,
  availablePersonas: const <SchoolPersona>{SchoolPersona.teacher},
  campusId: campusId,
  capabilities: const <String>{SchoolCapability.attendanceTake},
  locale: 'en-BD',
  tenantId: tenantId,
  timeZone: 'Asia/Dhaka',
);

final class MemoryEncryptedSyncStore implements EncryptedSyncStore {
  MemoryEncryptedSyncStore(Iterable<SyncOperationEnvelope> operations)
    : _operations = <String, SyncOperationEnvelope>{
        for (final operation in operations) operation.operationId: operation,
      };

  final Map<String, SyncOperationEnvelope> _operations;
  final List<SyncOperationEnvelope> history = <SyncOperationEnvelope>[];
  SyncCursor? _cursor;

  @override
  Future<SyncOperationEnvelope?> find(String operationId) async =>
      _operations[operationId];

  @override
  Future<void> purgeTerminalBefore(DateTime cutoff) async {
    _operations.removeWhere(
      (key, operation) =>
          operation.isTerminal && operation.clientCreatedAt.isBefore(cutoff),
    );
  }

  @override
  Future<List<SyncOperationEnvelope>> ready({
    required DateTime now,
    required SchoolSession session,
    int limit = 25,
  }) async => _operations.values
      .where((operation) {
        if (operation.accountId != session.accountId ||
            operation.tenantId != session.tenantId ||
            operation.campusId != session.campusId ||
            operation.persona != session.activePersona) {
          return false;
        }
        return switch (operation.state) {
          SyncOperationState.savedOnDevice => true,
          SyncOperationState.waitingForNetwork =>
            !operation.nextAttemptAt!.isAfter(now),
          _ => false,
        };
      })
      .take(limit)
      .toList(growable: false);

  @override
  Future<SyncCursor?> readCursor(SchoolSession session) async => _cursor;

  @override
  Future<void> clearCursor(SchoolSession session) async {
    _cursor = null;
  }

  @override
  Future<void> saveCursor(SyncCursor cursor) async {
    _cursor = cursor;
  }

  @override
  Future<void> upsert(SyncOperationEnvelope operation) async {
    _operations[operation.operationId] = operation;
    history.add(operation);
  }
}

final class FakeSyncDeltaTransport implements SyncDeltaTransport {
  FakeSyncDeltaTransport(this.result);

  final SyncDelta result;
  String? cursor;

  @override
  Future<SyncDelta> pull({
    required SchoolSession session,
    required String? cursor,
  }) async {
    this.cursor = cursor;
    return result;
  }
}

final class RecoveringSyncDeltaTransport implements SyncDeltaTransport {
  final List<String?> cursors = <String?>[];

  @override
  Future<SyncDelta> pull({
    required SchoolSession session,
    required String? cursor,
  }) async {
    cursors.add(cursor);
    if (cursor != null) {
      throw const SyncDeltaCursorInvalidException();
    }
    return SyncDelta(
      changed: false,
      cursor: '40000000-0000-4000-8000-000000000010',
      serverTime: DateTime.parse('2026-08-22T00:05:00Z'),
    );
  }
}

final class FakeSyncTransport implements SyncTransport {
  FakeSyncTransport(this.result);

  final SyncAttemptResult result;
  final List<String> sentOperationIds = <String>[];

  @override
  Future<SyncAttemptResult> send(
    SyncOperationEnvelope operation,
    SchoolSession session,
  ) async {
    sentOperationIds.add(operation.operationId);
    return result;
  }
}

final class ThrowingSyncTransport implements SyncTransport {
  @override
  Future<SyncAttemptResult> send(
    SyncOperationEnvelope operation,
    SchoolSession session,
  ) => throw StateError('offline');
}
