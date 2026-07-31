#!/usr/bin/env python3
from pathlib import Path

path = Path('tests/integration/verify-auth-durable-context.sh')
source = path.read_text(encoding='utf-8')

early_grant = """  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000005',
    'runtime.snapshot.refresh'
  )
ON CONFLICT DO NOTHING;

INSERT INTO iam.membership (
"""
original_end = """  )
ON CONFLICT DO NOTHING;

INSERT INTO iam.membership (
"""
if source.count(early_grant) != 1:
    raise SystemExit('Expected one early runtime mutation grant fixture.')
source = source.replace(early_grant, original_end)

session_marker = """INSERT INTO iam.browser_session_registry (
  session_id, binding_id, account_id, tenant_id, membership_id, campus_id,
  role_ids, assurance_level, issued_at, expires_at
) VALUES (
  '30000000-0000-4000-8000-00000000000c',
"""
late_grant = """INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000005',
  'runtime.snapshot.refresh'
)
ON CONFLICT DO NOTHING;

""" + session_marker
if source.count(session_marker) != 1:
    raise SystemExit('Expected one PILOT-05 AAL2 session fixture marker.')
path.write_text(source.replace(session_marker, late_grant), encoding='utf-8')
