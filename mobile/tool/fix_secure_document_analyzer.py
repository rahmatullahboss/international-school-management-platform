from pathlib import Path

path = Path(__file__).resolve().parents[1] / "packages/secure_documents/lib/school_secure_documents.dart"
text = path.read_text(encoding="utf-8")

old_constructor = """  SecureDocumentStreamResponse({
    required Stream<List<int>> bytes,
    required int contentLength,
    required String documentId,
    required String mediaType,
    required bool noStore,
    required String sha256Hex,
  }) : bytes = bytes,
       contentLength = _positive(contentLength, 'contentLength'),
       documentId = _identifier(documentId, 'documentId'),
       mediaType = _mediaType(mediaType),
       noStore = noStore,
       sha256Hex = _sha256(sha256Hex);
"""
new_constructor = """  SecureDocumentStreamResponse({
    required this.bytes,
    required int contentLength,
    required String documentId,
    required String mediaType,
    required this.noStore,
    required String sha256Hex,
  }) : contentLength = _positive(contentLength, 'contentLength'),
       documentId = _identifier(documentId, 'documentId'),
       mediaType = _mediaType(mediaType),
       sha256Hex = _sha256(sha256Hex);
"""
if new_constructor not in text:
    if old_constructor not in text:
        raise RuntimeError("stream response constructor anchor not found")
    text = text.replace(old_constructor, new_constructor, 1)

old_digest = """      final completer = Completer<Digest>();
      final digestSink = sha256.startChunkedConversion(
        ByteConversionSink.withCallback(
          (bytes) => completer.complete(Digest(bytes)),
        ),
      );
"""
new_digest = """      final completer = Completer<Digest>();
      final digestSink = sha256.startChunkedConversion(
        _SingleDigestSink(completer),
      );
"""
if new_digest not in text:
    if old_digest not in text:
        raise RuntimeError("digest sink anchor not found")
    text = text.replace(old_digest, new_digest, 1)

marker = """String _identifier(String value, String field) {
"""
helper = """final class _SingleDigestSink implements Sink<Digest> {
  _SingleDigestSink(this._completer);

  final Completer<Digest> _completer;
  bool _closed = false;

  @override
  void add(Digest data) {
    if (_closed || _completer.isCompleted) {
      throw const SecureDocumentException(
        'SECURE_DOCUMENT_DIGEST_SINK_INVALID',
      );
    }
    _completer.complete(data);
  }

  @override
  void close() {
    _closed = true;
    if (!_completer.isCompleted) {
      _completer.completeError(
        const SecureDocumentException('SECURE_DOCUMENT_DIGEST_MISSING'),
      );
    }
  }
}

String _identifier(String value, String field) {
"""
if helper not in text:
    if marker not in text:
        raise RuntimeError("digest helper insertion anchor not found")
    text = text.replace(marker, helper, 1)

text = text.replace("import 'dart:convert';\n", "", 1)
path.write_text(text, encoding="utf-8")
