#!/usr/bin/env python3
"""Register teacher sync and add durable encrypted journal support."""

from pathlib import Path

root = Path(__file__).resolve().parents[1]

workspace_path = root / 'pubspec.yaml'
workspace = workspace_path.read_text(encoding='utf-8')
workspace_entry = '  - packages/teacher_sync\n'
if workspace_entry not in workspace:
    anchor = '  - packages/sync_storage\n'
    if anchor not in workspace:
        raise SystemExit('Unexpected mobile workspace shape')
    workspace = workspace.replace(anchor, anchor + workspace_entry, 1)
workspace_path.write_text(workspace, encoding='utf-8')

staff_pubspec_path = root / 'apps/staff_app/pubspec.yaml'
staff_pubspec = staff_pubspec_path.read_text(encoding='utf-8')
for dependency in (
    '  school_sync_engine: ^0.1.0\n',
    '  school_sync_storage: ^0.1.0\n',
    '  school_teacher_sync: ^0.1.0\n',
):
    if dependency not in staff_pubspec:
        anchor = '  school_staff_domain: ^0.1.0\n'
        if anchor not in staff_pubspec:
            raise SystemExit('Unexpected staff pubspec dependency shape')
        staff_pubspec = staff_pubspec.replace(anchor, anchor + dependency, 1)
staff_pubspec_path.write_text(staff_pubspec, encoding='utf-8')

store_path = root / 'packages/sync_storage/lib/src/file_encrypted_sync_store.dart'
store = store_path.read_text(encoding='utf-8')
import_line = "import 'package:school_sync_engine/sync_journal.dart';\n"
if import_line not in store:
    anchor = "import 'package:school_sync_engine/school_sync_engine.dart';\n"
    if anchor not in store:
        raise SystemExit('Unexpected sync storage import shape')
    store = store.replace(anchor, anchor + import_line, 1)

old_class = 'final class FileEncryptedSyncStore implements EncryptedSyncStore {'
new_class = (
    'final class FileEncryptedSyncStore\n'
    '    implements EncryptedSyncStore, SyncOperationJournal {'
)
if old_class in store:
    store = store.replace(old_class, new_class, 1)
elif new_class not in store:
    raise SystemExit('Unexpected sync store declaration shape')

method_marker = '  Future<List<SyncOperationEnvelope>> listOperations({'
if method_marker not in store:
    anchor = '''  @override
  Future<List<SyncOperationEnvelope>> ready({
'''
    if anchor not in store:
        raise SystemExit('Unexpected sync store ready method shape')
    method = '''  @override
  Future<List<SyncOperationEnvelope>> listOperations({
    required SchoolSession session,
    Set<SyncOperationKind>? kinds,
    Set<SyncOperationState>? states,
    int limit = 100,
  }) => _serial.run(
    () async => _guardDecryption(() async {
      _validateSession(session);
      if (limit < 1 || limit > 500) {
        throw const SyncStorageException('SYNC_JOURNAL_LIMIT_INVALID');
      }
      final files = await _files();
      final snapshot = await _load(files);
      final operations = <SyncOperationEnvelope>[];
      for (final entry in snapshot.records.entries) {
        final operation = await _decryptOperation(
          files,
          entry.key,
          entry.value,
        );
        if (operation.accountId != session.accountId ||
            operation.tenantId != session.tenantId ||
            operation.campusId != session.campusId ||
            operation.persona != session.activePersona) {
          continue;
        }
        if (kinds != null && !kinds.contains(operation.kind)) {
          continue;
        }
        if (states != null && !states.contains(operation.state)) {
          continue;
        }
        operations.add(operation);
      }
      operations.sort((first, second) {
        final byTime = second.clientCreatedAt.compareTo(first.clientCreatedAt);
        return byTime != 0
            ? byTime
            : first.operationId.compareTo(second.operationId);
      });
      return List<SyncOperationEnvelope>.unmodifiable(operations.take(limit));
    }),
  );

'''
    store = store.replace(anchor, method + anchor, 1)
store_path.write_text(store, encoding='utf-8')

print('Teacher sync workspace and durable journal integration applied.')
