from pathlib import Path

path = Path("tests/operations/inventory-assets.test.ts")
text = path.read_text(encoding="utf-8")
old = """  return new InventoryAssetService(
    scope,
    new InMemoryOperationsEventPublisher(),
    new InMemoryOperationsAuditWriter(),
  );
"""
new = """  return new InventoryAssetService(
    scope,
    new InMemoryOperationsEventPublisher(),
    new InMemoryOperationsAuditWriter(),
    { now: () => new Date('2026-07-30T00:00:00.000Z') },
  );
"""
if text.count(old) != 1:
    raise SystemExit(f"expected one inventory service setup block, got {text.count(old)}")
text = text.replace(old, new, 1)
if text.count("2026-07-30T00:00:00.000Z") != 1:
    raise SystemExit("deterministic inventory test clock was not applied exactly once")
path.write_text(text, encoding="utf-8")
