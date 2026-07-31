#!/usr/bin/env python3
from pathlib import Path

boundary = Path('apps/platform-api/src/auth-boundary.ts')
boundary_source = boundary.read_text(encoding='utf-8')
old_boundary = '''  const { sessionId: _sessionId, ...session } = resolution.context;
  return { ok: true, session };
'''
new_boundary = '''  const { sessionId, ...session } = resolution.context;
  void sessionId;
  return { ok: true, session };
'''
if boundary_source.count(old_boundary) != 1:
    raise SystemExit(f'Expected one AUTH-08 public session omission block, found {boundary_source.count(old_boundary)}.')
boundary.write_text(boundary_source.replace(old_boundary, new_boundary), encoding='utf-8')

auth_permission_test = Path('apps/platform-api/src/auth-permission.test.ts')
auth_permission_source = auth_permission_test.read_text(encoding='utf-8')
old_authenticator = '    return { ok: true, sessionId };\n'
new_authenticator = '    return { ok: true as const, sessionId };\n'
if auth_permission_source.count(old_authenticator) != 1:
    raise SystemExit(
        f'Expected one widened AUTH-08 authenticator result, found {auth_permission_source.count(old_authenticator)}.'
    )
auth_permission_test.write_text(
    auth_permission_source.replace(old_authenticator, new_authenticator),
    encoding='utf-8',
)

index_test = Path('apps/platform-api/src/index.test.ts')
index_source = index_test.read_text(encoding='utf-8')
old_assertion = "    expect(databaseQuery.mock.calls[1]?.[1]?.[1]).toBe('finance.read');\n"
new_assertion = """    expect(databaseQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('iam.evaluate_browser_permission'),
      [expect.any(String), 'finance.read'],
    );
"""
if index_source.count(old_assertion) != 1:
    raise SystemExit(f'Expected one unsafe AUTH-08 mock assertion, found {index_source.count(old_assertion)}.')
index_test.write_text(index_source.replace(old_assertion, new_assertion), encoding='utf-8')
