#!/usr/bin/env python3
"""Strengthen encrypted sync storage lifecycle assertions."""

import re
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'packages/sync_storage/test/sync_storage_test.dart'
source = path.read_text(encoding='utf-8')

quarantine_replacement = """      final fingerprint = await SyncStorageScope.fromSession(session).fingerprint();
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
if 'final fingerprint = await SyncStorageScope.fromSession(session).fingerprint();' not in source:
    source, count = re.subn(
        r"(?m)^\s*final names = await directory\n"
        r"\s*\.list\(\)\n"
        r"\s*\.map\(\(entity\) => entity\.path\.split\(Platform\.pathSeparator\)\.last\)\n"
        r"\s*\.toList\(\);\n"
        r"\s*expect\(names\.any\(\(name\) => name\.endsWith\('\.blocked'\)\), isTrue\);\n"
        r"\s*expect\(names\.any\(\(name\) => name\.contains\('\.quarantine\.'\)\), isTrue\);\n",
        quarantine_replacement,
        source,
        count=1,
    )
    if count != 1:
        raise SystemExit('Unexpected quarantine assertion shape')

account_replacement = """      expect(await directory.list().isEmpty, isTrue);
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
if 'keyVault.read(SyncStorageScope.fromSession(secondSession), 1)' not in source:
    source, count = re.subn(
        r"(?m)^\s*expect\(await directory\.list\(\)\.isEmpty, isTrue\);\n"
        r"\s*expect\(await catalog\.scopesForAccount\(firstSession\.accountId\), isEmpty\);\n"
        r"\s*expect\(\n"
        r"\s*\(\) => keyVault\.current\(SyncStorageScope\.fromSession\(firstSession\)\),\n"
        r"\s*completes,\n"
        r"\s*\);\n",
        account_replacement,
        source,
        count=1,
    )
    if count != 1:
        raise SystemExit('Unexpected account purge assertion shape')

find_old = """      expect(
        () => store.find('operation-1'),
        throwsA(
          isA<SyncStorageException>().having(
            (error) => error.code,
            'code',
            'SYNC_STORE_QUARANTINED',
          ),
        ),
      );
"""
find_new = """      await expectLater(
        store.find('operation-1'),
        throwsA(
          isA<SyncStorageException>().having(
            (error) => error.code,
            'code',
            'SYNC_STORE_QUARANTINED',
          ),
        ),
      );
"""
if find_old in source:
    source = source.replace(find_old, find_new, 1)
elif find_new not in source:
    raise SystemExit('Unexpected quarantine find assertion shape')

ready_old = """      expect(
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
"""
ready_new = """      await expectLater(
        store.ready(
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
"""
if ready_old in source:
    source = source.replace(ready_old, ready_new, 1)
elif ready_new not in source:
    raise SystemExit('Unexpected quarantined ready assertion shape')

path.write_text(source, encoding='utf-8')
print('Encrypted sync storage lifecycle assertions strengthened.')
