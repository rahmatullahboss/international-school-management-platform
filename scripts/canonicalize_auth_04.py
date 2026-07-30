#!/usr/bin/env python3
from pathlib import Path

path = Path("apps/platform-api/src/index.ts")
source = path.read_text(encoding="utf-8")
old = """  const result = await terminateBrowserSession({
    sessionSecret: context.env.AUTH_SESSION_SECRET,
    registrySource: context.env.AUTH_SESSION_REGISTRY_SOURCE,
    allowedOrigins: context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
    contentType: context.req.header('content-type'),
    cookieHeader: context.req.header('cookie'),
    scope,
    ...(durableLogoutRegistry(context.env) === undefined
      ? {}
      : { registry: durableLogoutRegistry(context.env) }),
  });
"""
new = """  const registry = durableLogoutRegistry(context.env);
  const result = await terminateBrowserSession({
    sessionSecret: context.env.AUTH_SESSION_SECRET,
    registrySource: context.env.AUTH_SESSION_REGISTRY_SOURCE,
    allowedOrigins: context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
    contentType: context.req.header('content-type'),
    cookieHeader: context.req.header('cookie'),
    scope,
    ...(registry === undefined ? {} : { registry }),
  });
"""
if old not in source:
    raise SystemExit("Expected logout registry construction was not found.")
path.write_text(source.replace(old, new), encoding="utf-8")

test_path = Path("apps/platform-api/src/auth-logout.test.ts")
test_source = test_path.read_text(encoding="utf-8")
expected = "code: 'browser_session_missing'"
if expected not in test_source:
    raise SystemExit("Expected missing-session assertion was not found.")
test_path.write_text(
    test_source.replace(expected, "code: 'browser_session_required'"),
    encoding="utf-8",
)
