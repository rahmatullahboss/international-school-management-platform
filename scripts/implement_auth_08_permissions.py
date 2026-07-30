#!/usr/bin/env python3
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one marker, found {count}: {old[:120]!r}')
    target.write_text(source.replace(old, new), encoding='utf-8')


def add_tests() -> None:
    target = ROOT / 'apps/platform-api/src/auth-durable-store.test.ts'
    source = target.read_text(encoding='utf-8')
    marker = "  it('stores provider cache records only through security-definer functions', async () => {"
    block = """  it('evaluates active database permissions without browser-declared scope', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ value: { allowed: true, reason: 'role-grant' } }])
      .mockResolvedValueOnce([
        { value: { allowed: false, reason: 'step-up-required', requiredAssurance: 'aal2' } },
      ])
      .mockResolvedValueOnce([{ value: { allowed: false, reason: 'permission-not-granted' } }])
      .mockResolvedValueOnce([{ value: { allowed: false, reason: 'session-inactive' } }]);
    const store = new DurableAuthStore({ query });

    await expect(
      store.evaluatePermission(ids.session, 'finance.read'),
    ).resolves.toEqual({ allowed: true, reason: 'role-grant' });
    await expect(
      store.evaluatePermission(ids.session, 'records.approve'),
    ).resolves.toEqual({
      allowed: false,
      reason: 'step-up-required',
      requiredAssurance: 'aal2',
    });
    await expect(
      store.evaluatePermission(ids.session, 'care.restricted.read'),
    ).resolves.toEqual({ allowed: false, reason: 'permission-not-granted' });
    await expect(
      store.evaluatePermission(ids.session, 'finance.read'),
    ).resolves.toEqual({ allowed: false, reason: 'session-inactive' });

    expect(query.mock.calls[0]?.[0]).toContain('iam.evaluate_browser_permission');
    expect(query.mock.calls[0]?.[1]).toEqual([ids.session, 'finance.read']);
  });

  it('rejects malformed permission keys before database access', async () => {
    const query = vi.fn();
    const store = new DurableAuthStore({ query });
    for (const permission of ['', 'Finance.Read', 'finance read', 'x'.repeat(129)]) {
      await expect(store.evaluatePermission(ids.session, permission)).rejects.toThrow(
        'permission is invalid',
      );
    }
    expect(query).not.toHaveBeenCalled();
  });

"""
    if block not in source:
        if source.count(marker) != 1:
            raise SystemExit('durable permission test marker missing')
        source = source.replace(marker, block + marker)
    target.write_text(source, encoding='utf-8')


def apply_implementation() -> None:
    store = ROOT / 'apps/platform-api/src/auth-durable-store.ts'
    source = store.read_text(encoding='utf-8')
    source = source.replace(
        "const MAX_CACHE_KEY_LENGTH = 512;",
        "const MAX_CACHE_KEY_LENGTH = 512;\nconst PERMISSION_KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/u;",
    )
    parser_marker = "function validateMembershipRow(row: MembershipRow): MembershipRow {"
    parser = """export type DatabasePermissionDecision =
  | { readonly allowed: true; readonly reason: 'role-grant' }
  | {
      readonly allowed: false;
      readonly reason: 'permission-not-granted' | 'session-inactive';
    }
  | {
      readonly allowed: false;
      readonly reason: 'step-up-required';
      readonly requiredAssurance: 'aal2';
    };

function requirePermissionDecision(rows: readonly JsonRow[]): DatabasePermissionDecision {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined || !isRecord(row.value)) {
    throw new Error('Permission evaluation returned an invalid database response.');
  }
  if (row.value.allowed === true && row.value.reason === 'role-grant') {
    return { allowed: true, reason: 'role-grant' };
  }
  if (
    row.value.allowed === false &&
    (row.value.reason === 'permission-not-granted' || row.value.reason === 'session-inactive')
  ) {
    return { allowed: false, reason: row.value.reason };
  }
  if (
    row.value.allowed === false &&
    row.value.reason === 'step-up-required' &&
    row.value.requiredAssurance === 'aal2'
  ) {
    return { allowed: false, reason: 'step-up-required', requiredAssurance: 'aal2' };
  }
  throw new Error('Permission evaluation returned an invalid database response.');
}

"""
    if parser not in source:
        if source.count(parser_marker) != 1:
            raise SystemExit('permission parser marker missing')
        source = source.replace(parser_marker, parser + parser_marker)
    method_marker = "  async isSessionActive(sessionId: string): Promise<boolean> {"
    method = """  async evaluatePermission(
    sessionId: string,
    permission: string,
  ): Promise<DatabasePermissionDecision> {
    requireUuid(sessionId, 'sessionId');
    if (!PERMISSION_KEY_PATTERN.test(permission)) {
      throw new Error('permission is invalid.');
    }
    const rows = await this.#database.query<JsonRow>(
      'SELECT iam.evaluate_browser_permission($1::uuid, $2::text) AS value',
      [sessionId, permission],
    );
    return requirePermissionDecision(rows);
  }

"""
    if method not in source:
        if source.count(method_marker) != 1:
            raise SystemExit('permission method marker missing')
        source = source.replace(method_marker, method + method_marker)
    store.write_text(source, encoding='utf-8')

    migration = ROOT / 'infra/database/post-integration-migrations/202607310801_AUTH-08_database_permission_evaluation.sql'
    migration.write_text(r'''CREATE OR REPLACE FUNCTION iam.evaluate_browser_permission(
  p_session_id uuid,
  p_permission_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
DECLARE
  session_binding_id uuid;
  session_tenant_id uuid;
  session_assurance text;
  current_role_ids uuid[];
  required_assurance text;
BEGIN
  IF p_session_id IS NULL
     OR p_permission_key IS NULL
     OR p_permission_key !~ '^[a-z0-9][a-z0-9._:-]{0,127}$' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'permission-not-granted');
  END IF;

  SELECT
    session.binding_id,
    session.tenant_id,
    session.assurance_level,
    array_agg(role_binding.role_id ORDER BY role_binding.role_id)
  INTO
    session_binding_id,
    session_tenant_id,
    session_assurance,
    current_role_ids
  FROM iam.browser_session_registry AS session
  JOIN iam.oidc_membership_binding AS binding
    ON binding.binding_id = session.binding_id
   AND binding.account_id = session.account_id
   AND binding.tenant_id = session.tenant_id
   AND binding.membership_id = session.membership_id
   AND binding.campus_id IS NOT DISTINCT FROM session.campus_id
   AND binding.status = 'active'
  JOIN iam.account AS account
    ON account.account_id = session.account_id
   AND account.disabled_at IS NULL
  JOIN iam.oidc_membership_role_binding AS role_binding
    ON role_binding.binding_id = session.binding_id
   AND role_binding.tenant_id = session.tenant_id
  WHERE session.session_id = p_session_id
    AND session.revoked_at IS NULL
    AND session.expires_at > clock_timestamp()
  GROUP BY session.binding_id, session.tenant_id, session.assurance_level, session.role_ids
  HAVING session.role_ids = array_agg(role_binding.role_id ORDER BY role_binding.role_id);

  IF session_binding_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'session-inactive');
  END IF;

  SELECT permission.required_assurance
  INTO required_assurance
  FROM iam.permission AS permission
  WHERE permission.permission_key = p_permission_key
    AND EXISTS (
      SELECT 1
      FROM iam.oidc_membership_role_binding AS role_binding
      JOIN iam.role_permission AS role_permission
        ON role_permission.tenant_id = role_binding.tenant_id
       AND role_permission.role_id = role_binding.role_id
       AND role_permission.permission_key = permission.permission_key
      WHERE role_binding.binding_id = session_binding_id
        AND role_binding.tenant_id = session_tenant_id
    );

  IF required_assurance IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'permission-not-granted');
  END IF;
  IF required_assurance = 'aal2' AND session_assurance <> 'aal2' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'step-up-required',
      'requiredAssurance', 'aal2'
    );
  END IF;
  RETURN jsonb_build_object('allowed', true, 'reason', 'role-grant');
END
$function$;

REVOKE ALL ON FUNCTION iam.evaluate_browser_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.evaluate_browser_permission(uuid, text) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607310801_AUTH-08_database_permission_evaluation',
  'AUTH-08',
  'Database-backed assurance-aware browser permission evaluation'
)
ON CONFLICT (migration_id) DO NOTHING;
''', encoding='utf-8')

    manifest_path = ROOT / 'infra/database/post-integration-migration-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['gate'] = 'GATE-AUTH-DATABASE-PERMISSION-V1'
    if len(manifest['migrations']) == 2:
        manifest['migrations'].append({
            'order': 3,
            'id': '202607310801_AUTH-08_database_permission_evaluation',
            'stream': 'AUTH-08',
            'path': 'infra/database/post-integration-migrations/202607310801_AUTH-08_database_permission_evaluation.sql',
        })
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    verify = ROOT / 'tests/integration/verify-auth-durable-context.sh'
    source = verify.read_text(encoding='utf-8')
    source = source.replace("manifest.gate !== 'GATE-AUTH-BACKCHANNEL-LOGOUT-V1'", "manifest.gate !== 'GATE-AUTH-DATABASE-PERMISSION-V1'")
    source = source.replace("migrations.length !== 2", "migrations.length !== 3")
    source = source.replace("expected two AUTH migrations", "expected three AUTH migrations")
    source = source.replace("!['AUTH-03', 'AUTH-07'].includes", "!['AUTH-03', 'AUTH-07', 'AUTH-08'].includes")
    source = source.replace("<> 42", "<> 43")
    source = source.replace("expected 42 total", "expected 43 total")
    source = source.replace(
        "IF (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'AUTH-03') <> 1 THEN\n    RAISE EXCEPTION 'expected two AUTH migrations ledger row';",
        "IF (SELECT count(*) FROM platform.schema_migration WHERE stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08')) <> 3 THEN\n    RAISE EXCEPTION 'expected three AUTH migration ledger rows';",
    )
    permission_fixture = r'''

INSERT INTO iam.permission(permission_key, description, required_assurance) VALUES
  ('finance.read', 'Read finance summaries', 'aal1'),
  ('records.approve', 'Approve academic records', 'aal2'),
  ('care.restricted.read', 'Read restricted care records', 'aal2')
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description,
    required_assurance = EXCLUDED.required_assurance;

INSERT INTO iam.role_permission(tenant_id, role_id, permission_key) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000005',
    'finance.read'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000005',
    'records.approve'
  )
ON CONFLICT DO NOTHING;
'''
    fixture_marker = "INSERT INTO iam.membership ("
    if permission_fixture not in source:
        source = source.replace(fixture_marker, permission_fixture + "\n" + fixture_marker, 1)

    permission_tests = r'''
  IF iam.evaluate_browser_permission(
    '30000000-0000-4000-8000-000000000009',
    'finance.read'
  ) <> '{"allowed": true, "reason": "role-grant"}'::jsonb THEN
    RAISE EXCEPTION 'database-granted AAL1 permission must be allowed';
  END IF;
  IF iam.evaluate_browser_permission(
    '30000000-0000-4000-8000-000000000009',
    'care.restricted.read'
  ) <> '{"allowed": false, "reason": "permission-not-granted"}'::jsonb THEN
    RAISE EXCEPTION 'ungranted restricted permission must be denied';
  END IF;
'''
    test_marker = "  IF iam.process_oidc_backchannel_logout("
    if permission_tests not in source:
        source = source.replace(test_marker, permission_tests + "\n" + test_marker, 1)

    second_session = r'''

  IF NOT iam.register_browser_session(
    '30000000-0000-4000-8000-00000000000b',
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-aal1',
    ARRAY['30000000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'AAL1 browser session registration must succeed';
  END IF;
  IF iam.evaluate_browser_permission(
    '30000000-0000-4000-8000-00000000000b',
    'records.approve'
  ) <> '{"allowed": false, "reason": "step-up-required", "requiredAssurance": "aal2"}'::jsonb THEN
    RAISE EXCEPTION 'AAL1 session must require AAL2 step-up';
  END IF;
'''
    second_marker = "  IF iam.process_oidc_backchannel_logout("
    if second_session not in source:
        source = source.replace(second_marker, second_session + "\n" + second_marker, 1)

    invalidation = r'''
  IF iam.evaluate_browser_permission(
    '30000000-0000-4000-8000-00000000000a',
    'finance.read'
  ) <> '{"allowed": false, "reason": "session-inactive"}'::jsonb THEN
    RAISE EXCEPTION 'role removal must invalidate permission evaluation';
  END IF;
'''
    invalid_marker = "  IF iam.is_browser_session_active('30000000-0000-4000-8000-00000000000a') THEN\n    RAISE EXCEPTION 'role removal must invalidate the session';\n  END IF;"
    if invalidation not in source:
        source = source.replace(invalid_marker, invalid_marker + "\n" + invalidation)
    verify.write_text(source, encoding='utf-8')


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {'test', 'implementation'}:
        raise SystemExit('usage: implement_auth_08_permissions.py test|implementation')
    if sys.argv[1] == 'test':
        add_tests()
    else:
        apply_implementation()


if __name__ == '__main__':
    main()
