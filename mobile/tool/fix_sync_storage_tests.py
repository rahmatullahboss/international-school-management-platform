#!/usr/bin/env python3
"""Strengthen encrypted sync storage lifecycle assertions."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'packages/sync_storage/test/sync_storage_test.dart'
source = path.read_text(encoding='utf-8')
old_quarantine = """    final names = await directory
        .list()
        .map((entity) => entity.path.split(Platform.pathSeparator).last)
        .toList();
    expect(names.any((name) => name.endsWith('.blocked')), isTrue);
    expect(names.any((name) => name.contains('.quarantine.')), isTrue);
"""
new_quarantine = """    final fingerprint = await SyncStorageScope.fromSession(session).fingerprint();
    final blocked = File(
      '${directory.path}${Platform.pathSeparator}school-sync-$fingerprint.v1.blocked',
    );
    final names = await directory
        .list()
        .map((entity) => entity.path.split(Platform.pathSeparator).last)
        .toList();
    expect(await blocked.exists(), isTrue);
    expect(names.any((name) => name.contains('.quarantine.')), isTrue);
"""
if old_quarantine in source:
    source = source.replace(old_quarantine, new_quarantine, 1)
elif new_quarantine not in source:
    raise SystemExit('Unexpected quarantine assertion shape')

old_account = """    expect(await directory.list().isEmpty, isTrue);
    expect(await catalog.scopesForAccount(firstSession.accountId), isEmpty);
    expect(
      () => keyVault.current(SyncStorageScope.fromSession(firstSession)),
      completes,
    );
"""
new_account = """    expect(await directory.list().isEmpty, isTrue);
    expect(await catalog.scopesForAccount(firstSession.accountId), isEmpty);
    expect(
      () => keyVault.read(SyncStorageScope.fromSession(firstSession), 1),
      throwsA(isA<SyncStorageException>()),
    );
    expect(
      () => keyVault.read(SyncStorageScope.fromSession(secondSession), 1),
      throwsA(isA<SyncStorageException>()),
    );
"""
if old_account in source:
    source = source.replace(old_account, new_account, 1)
elif new_account not in source:
    raise SystemExit('Unexpected account purge assertion shape')
path.write_text(source, encoding='utf-8')
print('Encrypted sync storage lifecycle assertions strengthened.')
