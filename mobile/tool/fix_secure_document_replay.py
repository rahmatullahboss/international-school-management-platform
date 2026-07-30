from pathlib import Path

path = Path(__file__).resolve().parents[1] / "packages/secure_documents/lib/school_secure_documents.dart"
text = path.read_text(encoding="utf-8")
old = """    if (!_activeGrants.add(grant.grantId) ||
        _completedGrants.contains(grant.grantId)) {
"""
new = """    if (_completedGrants.contains(grant.grantId) ||
        !_activeGrants.add(grant.grantId)) {
"""
if new not in text:
    if old not in text:
        raise RuntimeError("secure document replay guard anchor not found")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
