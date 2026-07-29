import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_sync_engine/school_sync_engine.dart';
import 'package:school_sync_storage/school_sync_storage.dart';

void main() {
  late Directory directory;
  late MemorySyncKeyVault keyVault;
  late MemorySyncScopeCatalog catalog;
  late FixedSyncDirectoryProvider directoryProvider;
  late PlatformEncryptedSyncStoreFactory factory;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('school-sync-storage-');
    keyVault = MemorySyncKeyVault();
    catalog = MemorySyncScopeCatalog();
    directoryProvider = FixedSyncDirectoryProvider(directory);
    factory = PlatformEncryptedSyncStoreFactory(
      directoryProvider: directoryProvider,
      keyVault: keyVault,
      scopeCatalog: catalog,
    );
  });

  tearDown(() async {
    if (await directory.exists()) {
      await directory.delete(recursive: true);
    }
  });

  test('persists encrypted operations without plaintext identifiers', () async {
    final session = teacherSession();
    final store = await factory.open(session);
    final operation = syncOperation();

    await store.upsert(operation);
    final reopened = await factory.open(session);
    final loaded = await reopened.find(operation.operationId);

    expect(loaded?.operationId, operation.operationId);
    expect(loaded?.idempotencyKey, operation.idempotencyKey);
    expect(loaded?.payload.ciphertext, operation.payload.ciphertext);

    final file = await activeFile(directory);
    final document = await file.readAsString();
    expect(document, isNot(contains(operation.operationId)));
    expect(document, isNot(contains(operation.idempotencyKey)));
    expect(document, isNot(contains(operation.aggregateId)));
    expect(document, isNot(contains(operation.payload.keyAlias)));
  });

  test('ready operations remain persona and retry-time scoped', () async {
    final session = teacherSession();
    final store = await factory.open(session);
    final now = DateTime.parse('2026-07-30T04:00:00+06:00');
    await store.upsert(syncOperation(operationId: 'ready-now'));
    await store.upsert(
      syncOperation(
        nextAttemptAt: now.subtract(const Duration(seconds: 1)),
        operationId: 'ready-retry',
        state: SyncOperationState.waitingForNetwork,
      ),
    );
    await store.upsert(
      syncOperation(
        nextAttemptAt: now.add(const Duration(minutes: 5)),
        operationId: 'future-retry',
        state: SyncOperationState.waitingForNetwork,
      ),
    );
    await store.upsert(
      syncOperation(
        operationId: 'guardian-operation',
        persona: SchoolPersona.guardian,
      ),
    );

    final ready = await store.ready(now: now, session: session);

    expect(ready.map((operation) => operation.operationId), <String>[
      'ready-now',
      'ready-retry',
    ]);
  });

  test('persists and reloads a scope-bound delta cursor', () async {
    final session = teacherSession();
    final store = await factory.open(session);
    final cursor = SyncCursor(
      accountId: session.accountId,
      campusId: session.campusId,
      cursor: 'delta-cursor-100',
      receivedAt: DateTime.parse('2026-07-30T04:00:00+06:00'),
      tenantId: session.tenantId,
    );

    await store.saveCursor(cursor);
    final reopened = await factory.open(session);
    final loaded = await reopened.readCursor(session);

    expect(loaded?.cursor, 'delta-cursor-100');
    expect(
      await activeFile(directory).then((file) => file.readAsString()),
      isNot(contains('delta-cursor-100')),
    );
  });

  test(
    'key rotation re-encrypts records and preserves readable data',
    () async {
      final session = teacherSession();
      final store = await factory.open(session);
      await store.upsert(syncOperation());
      final file = await activeFile(directory);
      final before =
          jsonDecode(await file.readAsString()) as Map<String, Object?>;
      final beforeVersion = firstRecordVersion(before);
      final beforeText = await file.readAsString();

      await store.rotateKey();

      final after =
          jsonDecode(await file.readAsString()) as Map<String, Object?>;
      expect(firstRecordVersion(after), beforeVersion + 1);
      expect(await file.readAsString(), isNot(beforeText));
      expect((await store.find('operation-1'))?.operationId, 'operation-1');
    },
  );

  test(
    'tampered ciphertext quarantines the store instead of resetting it',
    () async {
      final session = teacherSession();
      final store = await factory.open(session);
      await store.upsert(syncOperation());
      final file = await activeFile(directory);
      final document =
          jsonDecode(await file.readAsString()) as Map<String, Object?>;
      final records = document['records'] as Map<String, Object?>;
      final record = records.values.single as Map<String, Object?>;
      final bytes = base64Decode(record['box']! as String);
      bytes[bytes.length ~/ 2] ^= 1;
      record['box'] = base64Encode(bytes);
      await file.writeAsString(jsonEncode(document), flush: true);

      expect(
        () => store.find('operation-1'),
        throwsA(
          isA<SyncStorageException>().having(
            (error) => error.code,
            'code',
            'SYNC_STORE_QUARANTINED',
          ),
        ),
      );
      final fingerprint = await SyncStorageScope.fromSession(
        session,
      ).fingerprint();
      final blocked = File(
        '${directory.path}${Platform.pathSeparator}school-sync-$fingerprint.v1.blocked',
      );
      final names = await directory
          .list()
          .map((entity) => entity.path.split(Platform.pathSeparator).last)
          .toList();
      expect(await blocked.exists(), isTrue);
      expect(names.any((name) => name.contains('.quarantine.')), isTrue);
      expect(
        () => store.ready(
          now: DateTime.parse('2026-07-30T04:00:00+06:00'),
          session: session,
        ),
        throwsA(
          isA<SyncStorageException>().having(
            (error) => error.code,
            'code',
            'SYNC_STORE_QUARANTINED',
          ),
        ),
      );
    },
  );

  test('school purge deletes encrypted files and all key versions', () async {
    final session = teacherSession();
    final scope = SyncStorageScope.fromSession(session);
    final store = await factory.open(session);
    await store.upsert(syncOperation());
    await store.rotateKey();

    await factory.purgeSchool(session);

    expect(await directory.list().isEmpty, isTrue);
    expect(await catalog.scopesForAccount(session.accountId), isEmpty);
    expect(() => keyVault.read(scope, 1), throwsA(isA<SyncStorageException>()));
    expect(() => keyVault.read(scope, 2), throwsA(isA<SyncStorageException>()));
  });

  test('account purge removes every registered school scope', () async {
    final firstSession = teacherSession();
    final secondSession = teacherSession(
      campusId: 'campus-2',
      tenantId: 'tenant-2',
    );
    final firstStore = await factory.open(firstSession);
    final secondStore = await factory.open(secondSession);
    await firstStore.upsert(syncOperation());
    await secondStore.upsert(
      syncOperation(campusId: 'campus-2', tenantId: 'tenant-2'),
    );

    await factory.purgeAccount(firstSession.accountId);
    expect(await directory.list().isEmpty, isTrue);
    expect(await catalog.scopesForAccount(firstSession.accountId), isEmpty);
    expect(
      () => keyVault.read(SyncStorageScope.fromSession(firstSession), 1),
      throwsA(isA<SyncStorageException>()),
    );
    expect(
      () => keyVault.read(SyncStorageScope.fromSession(secondSession), 1),
      throwsA(isA<SyncStorageException>()),
    );
  });

  test('cross-school operations are rejected before writing', () async {
    final store = await factory.open(teacherSession());

    expect(
      () => store.upsert(syncOperation(campusId: 'campus-other')),
      throwsA(
        isA<SyncStorageException>().having(
          (error) => error.code,
          'code',
          'SYNC_STORAGE_OPERATION_SCOPE_MISMATCH',
        ),
      ),
    );
    expect(await directory.list().isEmpty, isTrue);
  });
}

Future<File> activeFile(Directory directory) async {
  await for (final entity in directory.list()) {
    if (entity is File && entity.path.endsWith('.json')) {
      return entity;
    }
  }
  throw StateError('Active sync store file not found.');
}

int firstRecordVersion(Map<String, Object?> document) {
  final records = document['records'] as Map<String, Object?>;
  final record = records.values.single as Map<String, Object?>;
  return record['keyVersion']! as int;
}

SyncOperationEnvelope syncOperation({
  String campusId = 'campus-1',
  DateTime? nextAttemptAt,
  String operationId = 'operation-1',
  SchoolPersona persona = SchoolPersona.teacher,
  SyncOperationState state = SyncOperationState.savedOnDevice,
  String tenantId = 'tenant-1',
}) => SyncOperationEnvelope(
  accountId: 'account-1',
  aggregateId: 'meeting-1',
  aggregateType: 'attendanceMeeting',
  attemptCount: 0,
  baseVersion: 4,
  campusId: campusId,
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
  persona: persona,
  state: state,
  tenantId: tenantId,
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
