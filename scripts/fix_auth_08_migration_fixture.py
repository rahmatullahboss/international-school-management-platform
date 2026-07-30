#!/usr/bin/env python3
from pathlib import Path

path = Path('tests/integration/verify-auth-durable-context.sh')
source = path.read_text(encoding='utf-8')
old = """  IF revoked_count <> 1 THEN
    RAISE EXCEPTION 'expected one active account session to be revoked, got %', revoked_count;
  END IF;
  IF iam.is_browser_session_active('30000000-0000-4000-8000-00000000000a') THEN
    RAISE EXCEPTION 'account-wide revocation must invalidate the session';
  END IF;
"""
new = """  IF revoked_count <> 2 THEN
    RAISE EXCEPTION 'expected two active account sessions to be revoked, got %', revoked_count;
  END IF;
  IF iam.is_browser_session_active('30000000-0000-4000-8000-00000000000a')
     OR iam.is_browser_session_active('30000000-0000-4000-8000-00000000000b') THEN
    RAISE EXCEPTION 'account-wide revocation must invalidate every active session';
  END IF;
"""
if source.count(old) != 1:
    raise SystemExit(f'Expected one account revocation fixture, found {source.count(old)}.')
path.write_text(source.replace(old, new), encoding='utf-8')
