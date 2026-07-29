#!/usr/bin/env python3
"""Apply Dart compatibility fixes to the durable sync package."""

from pathlib import Path

library_path = Path(__file__).resolve().parents[1] / 'packages/sync_engine/lib/school_sync_engine.dart'
source = library_path.read_text(encoding='utf-8')
old_payload = """    return EncryptedSyncPayload._(
      ciphertext: Uint8List.unmodifiable(ciphertext),
      contentType: _required(contentType, 'contentType'),
      keyAlias: _required(keyAlias, 'keyAlias'),
      schemaVersion: _required(schemaVersion, 'schemaVersion'),
    );
  }

  const EncryptedSyncPayload._({
    required this.ciphertext,
    required this.contentType,
    required this.keyAlias,
    required this.schemaVersion,
  });

  final Uint8List ciphertext;
  final String contentType;
  final String keyAlias;
  final String schemaVersion;

  @override
  String toString() =>
      'EncryptedSyncPayload(contentType: $contentType, schemaVersion: $schemaVersion, bytes: ${ciphertext.length})';
"""
new_payload = """    return EncryptedSyncPayload._(
      ciphertext: Uint8List.fromList(ciphertext),
      contentType: _required(contentType, 'contentType'),
      keyAlias: _required(keyAlias, 'keyAlias'),
      schemaVersion: _required(schemaVersion, 'schemaVersion'),
    );
  }

  EncryptedSyncPayload._({
    required Uint8List ciphertext,
    required this.contentType,
    required this.keyAlias,
    required this.schemaVersion,
  }) : _ciphertext = ciphertext;

  final Uint8List _ciphertext;
  final String contentType;
  final String keyAlias;
  final String schemaVersion;

  Uint8List get ciphertext => Uint8List.fromList(_ciphertext);

  @override
  String toString() =>
      'EncryptedSyncPayload(contentType: $contentType, schemaVersion: $schemaVersion, bytes: ${_ciphertext.length})';
"""
if old_payload in source:
    source = source.replace(old_payload, new_payload, 1)
elif new_payload not in source:
    raise SystemExit('Unexpected encrypted payload declaration shape')

old_retry = """final class RetrySchedule {
  const RetrySchedule({
    this.baseDelay = const Duration(seconds: 5),
    this.maximumDelay = const Duration(minutes: 15),
  }) : assert(!baseDelay.isNegative),
       assert(!maximumDelay.isNegative);

  final Duration baseDelay;
  final Duration maximumDelay;
"""
new_retry = """final class RetrySchedule {
  factory RetrySchedule({
    Duration baseDelay = const Duration(seconds: 5),
    Duration maximumDelay = const Duration(minutes: 15),
  }) {
    if (baseDelay.isNegative ||
        maximumDelay.isNegative ||
        maximumDelay < baseDelay) {
      throw const SyncContractException('SYNC_RETRY_SCHEDULE_INVALID');
    }
    return RetrySchedule._(
      baseDelay: baseDelay,
      maximumDelay: maximumDelay,
    );
  }

  const RetrySchedule._({
    required this.baseDelay,
    required this.maximumDelay,
  });

  final Duration baseDelay;
  final Duration maximumDelay;
"""
if old_retry in source:
    source = source.replace(old_retry, new_retry, 1)
elif new_retry not in source:
    raise SystemExit('Unexpected retry schedule declaration shape')
source = source.replace('const RetrySchedule(', 'RetrySchedule(')
library_path.write_text(source, encoding='utf-8')

test_path = Path(__file__).resolve().parents[1] / 'packages/sync_engine/test/sync_engine_test.dart'
tests = test_path.read_text(encoding='utf-8')
tests = tests.replace('const RetrySchedule(', 'RetrySchedule(')
tests = tests.replace('containsInOrder(<Object?>[', 'orderedEquals(<Object?>[')
old_immutability = """    expect(payload.ciphertext, <int>[1, 2, 3]);
    expect(() => payload.ciphertext[0] = 8, throwsUnsupportedError);
    expect(payload.toString(), isNot(contains('[1, 2, 3]')));
"""
new_immutability = """    expect(payload.ciphertext, <int>[1, 2, 3]);
    final exposed = payload.ciphertext;
    exposed[0] = 8;
    expect(payload.ciphertext, <int>[1, 2, 3]);
    expect(payload.toString(), isNot(contains('[1, 2, 3]')));
"""
if old_immutability in tests:
    tests = tests.replace(old_immutability, new_immutability, 1)
elif new_immutability not in tests:
    raise SystemExit('Unexpected ciphertext immutability test shape')
test_path.write_text(tests, encoding='utf-8')
print('Durable sync compatibility fixes applied.')
