#!/usr/bin/env python3
from pathlib import Path

path = Path('apps/platform-api/src/index.ts')
source = path.read_text(encoding='utf-8')
old = """  const resolution = await resolveDatabaseReadModel({
    sessionId: session.context.sessionId,
    store: stores.readModel,
    cache: runtimeReadModelCache,
    ...(context.req.header('if-none-match') === undefined
      ? {}
      : { ifNoneMatch: context.req.header('if-none-match') }),
  });
"""
new = """  const ifNoneMatch = context.req.header('if-none-match');
  const resolution = await resolveDatabaseReadModel({
    sessionId: session.context.sessionId,
    store: stores.readModel,
    cache: runtimeReadModelCache,
    ...(ifNoneMatch === undefined ? {} : { ifNoneMatch }),
  });
"""
if source.count(old) != 1:
    raise SystemExit('Expected one PILOT-04 snapshot resolution block.')
path.write_text(source.replace(old, new), encoding='utf-8')
