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

path.write_text(source, encoding='utf-8')
print('Encrypted sync storage lifecycle assertions strengthened.')
