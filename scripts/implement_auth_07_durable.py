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
        raise SystemExit(f'{path}: expected one marker, found {count}: {old[:100]!r}')
    target.write_text(source.replace(old, new), encoding='utf-8')


def add_tests() -> None:
    replace_once(
        'packages/policy/src/oidc.test.ts',
        "    sub: 'provider-user-123',\n    aud: configuration.clientId,",
        "    sub: 'provider-user-123',\n    sid: 'provider-session-abc',\n    aud: configuration.clientId,",
    )
    replace_once(
        'packages/policy/src/oidc.test.ts',
        "        subject: 'provider-user-123',\n        email: 'principal@school.test',",
        "        subject: 'provider-user-123',\n        providerSessionId: 'provider-session-abc',\n        email: 'principal@school.test',",
    )
    replace_once(
        'packages/policy/src/browser-session.test.ts',
        "  subject: 'provider-user-123',\n  assurance: 'aal2' as const,",
        "  subject: 'provider-user-123',\n  providerSessionId: 'provider-session-abc',\n  assurance: 'aal2' as const,",
    )
    replace_once(
        'packages/policy/src/browser-session.test.ts',
        "      principalId: 'principal-1',\n      membershipId: 'membership-main-admin',",
        "      principalId: 'principal-1',\n      providerSessionId: 'provider-session-abc',\n      membershipId: 'membership-main-admin',",
    )
    replace_once(
        'apps/platform-api/src/auth-durable-store.test.ts',
        "  subject: 'provider-user-123',\n  assurance: 'aal2',",
        "  subject: 'provider-user-123',\n  providerSessionId: 'provider-session-abc',\n  assurance: 'aal2',",
    )
    replace_once(
        'apps/platform-api/src/auth-durable-store.test.ts',
        "  identitySubject: identity.subject,\n  tenantId: ids.tenant,",
        "  identitySubject: identity.subject,\n  providerSessionId: identity.providerSessionId,\n  tenantId: ids.tenant,",
    )
    replace_once(
        'apps/platform-api/src/auth-durable-store.test.ts',
        "      ids.campus,\n      [ids.role],",
        "      ids.campus,\n      'provider-session-abc',\n      [ids.role],",
    )
    marker = "  it('fails closed for malformed database responses and non-UUID claims', async () => {"
    block = """  it('consumes Logout Token ids and revokes exact provider sessions', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ value: true }])
      .mockResolvedValueOnce([{ value: 2 }]);
    const store = new DurableAuthStore({ query });
    const claims = {
      issuer: identity.issuer,
      subject: identity.subject,
      providerSessionId: identity.providerSessionId,
      tokenId: 'logout-token-123',
      issuedAt: 1_785_382_400,
      expiresAt: 1_785_382_700,
    };

    await expect(store.consumeBackchannelLogoutToken(claims)).resolves.toBe(true);
    await expect(store.revokeProviderSessions(claims, 'provider back-channel logout')).resolves.toBe(2);
    expect(query.mock.calls[0]?.[0]).toContain('iam.consume_oidc_logout_token');
    expect(query.mock.calls[1]?.[0]).toContain('iam.revoke_oidc_provider_sessions');
    expect(query.mock.calls[1]?.[1]).toEqual([
      identity.issuer,
      identity.subject,
      identity.providerSessionId,
      'provider back-channel logout',
    ]);
  });

  it('stores provider cache records only through security-definer functions', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ value: { kind: 'jwks', schemaVersion: 1 } }])
      .mockResolvedValueOnce([{ value: true }]);
    const store = new DurableOidcProviderCacheStore({ query });
    await expect(store.read('oidc-cache:v1:jwks:test')).resolves.toEqual({
      kind: 'jwks',
      schemaVersion: 1,
    });
    await expect(
      store.write('oidc-cache:v1:jwks:test', { kind: 'jwks', schemaVersion: 1 }),
    ).resolves.toBeUndefined();
    expect(query.mock.calls[0]?.[0]).toContain('iam.read_oidc_provider_cache');
    expect(query.mock.calls[1]?.[0]).toContain('iam.write_oidc_provider_cache');
  });

"""
    target = ROOT / 'apps/platform-api/src/auth-durable-store.test.ts'
    source = target.read_text(encoding='utf-8')
    source = source.replace(
        "import { DurableAuthStore } from './auth-durable-store.js';",
        "import { DurableAuthStore, DurableOidcProviderCacheStore } from './auth-durable-store.js';",
    )
    if block not in source:
        if source.count(marker) != 1:
            raise SystemExit('durable store test marker missing')
        source = source.replace(marker, block + marker)
    target.write_text(source, encoding='utf-8')


def apply_implementation() -> None:
    replace_once(
        'packages/policy/src/oidc.ts',
        "  readonly subject: string;\n  readonly email?: string;",
        "  readonly subject: string;\n  readonly providerSessionId?: string;\n  readonly email?: string;",
    )
    replace_once(
        'packages/policy/src/oidc.ts',
        "  readonly sub: string;\n  readonly aud: string | readonly string[];",
        "  readonly sub: string;\n  readonly sid?: string;\n  readonly aud: string | readonly string[];",
    )
    replace_once(
        'packages/policy/src/oidc.ts',
        "  if (value.azp !== undefined && typeof value.azp !== 'string') return undefined;",
        "  if (value.azp !== undefined && typeof value.azp !== 'string') return undefined;\n  if (\n    value.sid !== undefined &&\n    (typeof value.sid !== 'string' || value.sid.trim() === '' || value.sid.length > 512)\n  ) return undefined;",
    )
    replace_once(
        'packages/policy/src/oidc.ts',
        "      subject: claims.sub,\n      ...(claims.email === undefined ? {} : { email: claims.email }),",
        "      subject: claims.sub,\n      ...(claims.sid === undefined ? {} : { providerSessionId: claims.sid }),\n      ...(claims.email === undefined ? {} : { email: claims.email }),",
    )
    replace_once(
        'packages/policy/src/browser-session.ts',
        "  readonly identitySubject: string;\n  readonly tenantId: string;",
        "  readonly identitySubject: string;\n  readonly providerSessionId?: string;\n  readonly tenantId: string;",
    )
    replace_once(
        'packages/policy/src/browser-session.ts',
        "    typeof value.identitySubject !== 'string' ||\n    value.identitySubject.trim() === '' ||",
        "    typeof value.identitySubject !== 'string' ||\n    value.identitySubject.trim() === '' ||\n    (value.providerSessionId !== undefined &&\n      (typeof value.providerSessionId !== 'string' ||\n        value.providerSessionId.trim() === '' ||\n        value.providerSessionId.length > 512)) ||",
    )
    replace_once(
        'packages/policy/src/browser-session.ts',
        "    identitySubject: input.identity.subject,\n    tenantId: input.membership.tenantId,",
        "    identitySubject: input.identity.subject,\n    ...(input.identity.providerSessionId === undefined\n      ? {}\n      : { providerSessionId: input.identity.providerSessionId }),\n    tenantId: input.membership.tenantId,",
    )

    store_path = ROOT / 'apps/platform-api/src/auth-durable-store.ts'
    source = store_path.read_text(encoding='utf-8')
    source = source.replace(
        "  type OidcIdentity,\n} from '@school/policy';",
        "  type OidcBackchannelLogoutClaims,\n  type OidcIdentity,\n  type OidcProviderCacheStore,\n} from '@school/policy';",
    )
    source = source.replace(
        "const UUID_PATTERN = /^[0-9a-f]",
        "interface JsonRow extends Record<string, unknown> {\n  readonly value: unknown;\n}\n\nconst MAX_PROVIDER_IDENTIFIER_LENGTH = 512;\nconst MAX_CACHE_KEY_LENGTH = 512;\n\nconst UUID_PATTERN = /^[0-9a-f]",
    )
    source = source.replace(
        "function requireUuidArray(values: readonly string[], label: string): string[] {",
        "function requireProviderIdentifier(value: string | undefined, label: string): string | null {\n  if (value === undefined) return null;\n  const normalized = value.trim();\n  if (normalized === '' || normalized.length > MAX_PROVIDER_IDENTIFIER_LENGTH) {\n    throw new Error(`${label} is invalid.`);\n  }\n  return normalized;\n}\n\nfunction requireUuidArray(values: readonly string[], label: string): string[] {",
    )
    source = source.replace(
        "         $6::uuid[],\n         $7::text,\n         to_timestamp($8::double precision),\n         to_timestamp($9::double precision)",
        "         $6::text,\n         $7::uuid[],\n         $8::text,\n         to_timestamp($9::double precision),\n         to_timestamp($10::double precision)",
    )
    source = source.replace(
        "        claims.campusId ?? null,\n        roleIds,\n        claims.assurance,\n        claims.issuedAt,\n        claims.expiresAt,",
        "        claims.campusId ?? null,\n        requireProviderIdentifier(claims.providerSessionId, 'providerSessionId'),\n        roleIds,\n        claims.assurance,\n        claims.issuedAt,\n        claims.expiresAt,",
    )
    insert_marker = "  async isSessionActive(sessionId: string): Promise<boolean> {"
    methods = """  async consumeBackchannelLogoutToken(claims: OidcBackchannelLogoutClaims): Promise<boolean> {
    if (claims.issuer.trim() === '' || claims.tokenId.trim() === '') {
      throw new Error('Logout Token identity is required.');
    }
    const rows = await this.#database.query<BooleanRow>(
      `SELECT iam.consume_oidc_logout_token(
         $1::text,
         $2::text,
         to_timestamp($3::double precision),
         to_timestamp($4::double precision)
       ) AS value`,
      [claims.tokenId, claims.issuer, claims.issuedAt, claims.expiresAt],
    );
    return requireBooleanRow(rows, 'Logout Token consumption');
  }

  async revokeProviderSessions(
    claims: OidcBackchannelLogoutClaims,
    reason: string,
  ): Promise<number> {
    if (reason.trim() === '') throw new Error('A revocation reason is required.');
    const subject = requireProviderIdentifier(claims.subject, 'providerSubject');
    const providerSessionId = requireProviderIdentifier(
      claims.providerSessionId,
      'providerSessionId',
    );
    if (subject === null && providerSessionId === null) {
      throw new Error('A provider subject or session id is required.');
    }
    const rows = await this.#database.query<CountRow>(
      'SELECT iam.revoke_oidc_provider_sessions($1::text, $2::text, $3::text, $4::text) AS value',
      [claims.issuer, subject, providerSessionId, reason],
    );
    return requireCountRow(rows, 'Provider session revocation');
  }

"""
    if methods not in source:
        if source.count(insert_marker) != 1:
            raise SystemExit('store method marker missing')
        source = source.replace(insert_marker, methods + insert_marker)
    source += """

export class DurableOidcProviderCacheStore implements OidcProviderCacheStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async read(key: string): Promise<unknown> {
    if (key.length === 0 || key.length > MAX_CACHE_KEY_LENGTH) {
      throw new Error('Provider cache key is invalid.');
    }
    const rows = await this.#database.query<JsonRow>(
      'SELECT iam.read_oidc_provider_cache($1::text) AS value',
      [key],
    );
    if (rows.length !== 1 || rows[0] === undefined) {
      throw new Error('Provider cache read returned an invalid database response.');
    }
    return rows[0].value ?? undefined;
  }

  async write(key: string, value: unknown): Promise<void> {
    if (key.length === 0 || key.length > MAX_CACHE_KEY_LENGTH) {
      throw new Error('Provider cache key is invalid.');
    }
    const rows = await this.#database.query<BooleanRow>(
      'SELECT iam.write_oidc_provider_cache($1::text, $2::jsonb) AS value',
      [key, JSON.stringify(value)],
    );
    if (!requireBooleanRow(rows, 'Provider cache write')) {
      throw new Error('Provider cache write was rejected.');
    }
  }
}
"""
    store_path.write_text(source, encoding='utf-8')

    migration = ROOT / 'infra/database/post-integration-migrations/202607310701_AUTH-07_backchannel_logout.sql'
    migration.write_text(r'''ALTER TABLE iam.browser_session_registry
  ADD COLUMN IF NOT EXISTS provider_session_id text;

ALTER TABLE iam.browser_session_registry
  DROP CONSTRAINT IF EXISTS browser_session_registry_provider_session_id_check;
ALTER TABLE iam.browser_session_registry
  ADD CONSTRAINT browser_session_registry_provider_session_id_check
  CHECK (provider_session_id IS NULL OR (length(btrim(provider_session_id)) > 0 AND length(provider_session_id) <= 512));

CREATE INDEX IF NOT EXISTS browser_session_registry_provider_sid_active_idx
  ON iam.browser_session_registry (provider_session_id, expires_at)
  WHERE provider_session_id IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS iam.oidc_logout_token_consumption (
  provider_issuer text NOT NULL CHECK (length(btrim(provider_issuer)) > 0),
  token_id text NOT NULL CHECK (length(btrim(token_id)) > 0 AND length(token_id) <= 512),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (provider_issuer, token_id),
  CHECK (expires_at > issued_at),
  CHECK (expires_at > consumed_at - interval '1 minute')
);

CREATE INDEX IF NOT EXISTS oidc_logout_token_consumption_expiry_idx
  ON iam.oidc_logout_token_consumption (expires_at);

CREATE TABLE IF NOT EXISTS iam.oidc_provider_cache (
  cache_key text PRIMARY KEY CHECK (length(cache_key) > 0 AND length(cache_key) <= 512),
  cache_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL ON TABLE iam.oidc_logout_token_consumption FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE iam.oidc_provider_cache FROM PUBLIC, app_runtime;

DROP FUNCTION IF EXISTS iam.register_browser_session(uuid, uuid, uuid, uuid, uuid, uuid[], text, timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION iam.register_browser_session(
  p_session_id uuid,
  p_account_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid,
  p_campus_id uuid,
  p_provider_session_id text,
  p_role_ids uuid[],
  p_assurance_level text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
DECLARE
  selected_binding_id uuid;
  expected_role_ids uuid[];
BEGIN
  IF p_session_id IS NULL
     OR p_assurance_level NOT IN ('aal1', 'aal2')
     OR cardinality(p_role_ids) = 0
     OR (p_provider_session_id IS NOT NULL AND (length(btrim(p_provider_session_id)) = 0 OR length(p_provider_session_id) > 512))
     OR p_issued_at > clock_timestamp() + interval '1 minute'
     OR p_expires_at <= clock_timestamp()
     OR p_expires_at > p_issued_at + interval '8 hours' THEN
    RETURN false;
  END IF;

  SELECT binding.binding_id, array_agg(role_binding.role_id ORDER BY role_binding.role_id)
  INTO selected_binding_id, expected_role_ids
  FROM iam.oidc_membership_binding AS binding
  JOIN iam.account AS account ON account.account_id = binding.account_id AND account.disabled_at IS NULL
  JOIN iam.oidc_membership_role_binding AS role_binding
    ON role_binding.binding_id = binding.binding_id AND role_binding.tenant_id = binding.tenant_id
  WHERE binding.account_id = p_account_id
    AND binding.tenant_id = p_tenant_id
    AND binding.membership_id = p_membership_id
    AND binding.campus_id IS NOT DISTINCT FROM p_campus_id
    AND binding.status = 'active'
  GROUP BY binding.binding_id;

  IF selected_binding_id IS NULL OR expected_role_ids IS DISTINCT FROM (
    SELECT array_agg(role_id ORDER BY role_id) FROM unnest(p_role_ids) AS supplied(role_id)
  ) THEN RETURN false; END IF;

  INSERT INTO iam.browser_session_registry (
    session_id, binding_id, account_id, tenant_id, membership_id, campus_id,
    provider_session_id, role_ids, assurance_level, issued_at, expires_at
  ) VALUES (
    p_session_id, selected_binding_id, p_account_id, p_tenant_id, p_membership_id,
    p_campus_id, NULLIF(btrim(p_provider_session_id), ''), expected_role_ids,
    p_assurance_level, p_issued_at, p_expires_at
  ) ON CONFLICT (session_id) DO NOTHING;
  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION iam.consume_oidc_logout_token(
  p_token_id text,
  p_provider_issuer text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
BEGIN
  IF length(btrim(p_token_id)) = 0 OR length(p_token_id) > 512
     OR length(btrim(p_provider_issuer)) = 0
     OR p_issued_at > clock_timestamp() + interval '1 minute'
     OR p_issued_at < clock_timestamp() - interval '6 minutes'
     OR p_expires_at <= clock_timestamp() - interval '1 minute'
     OR p_expires_at > p_issued_at + interval '10 minutes' THEN RETURN false; END IF;
  INSERT INTO iam.oidc_logout_token_consumption(provider_issuer, token_id, issued_at, expires_at)
  VALUES (btrim(p_provider_issuer), btrim(p_token_id), p_issued_at, p_expires_at)
  ON CONFLICT DO NOTHING;
  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION iam.revoke_oidc_provider_sessions(
  p_provider_issuer text,
  p_provider_subject text,
  p_provider_session_id text,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
DECLARE revoked_count integer;
BEGIN
  IF length(btrim(p_provider_issuer)) = 0 OR length(btrim(p_reason)) = 0
     OR (NULLIF(btrim(p_provider_subject), '') IS NULL AND NULLIF(btrim(p_provider_session_id), '') IS NULL)
     OR length(coalesce(p_provider_subject, '')) > 512 OR length(coalesce(p_provider_session_id, '')) > 512 THEN
    RETURN 0;
  END IF;
  UPDATE iam.browser_session_registry AS session
  SET revoked_at = clock_timestamp(), revoke_reason = btrim(p_reason)
  FROM iam.oidc_membership_binding AS binding
  WHERE binding.binding_id = session.binding_id
    AND binding.provider_issuer = btrim(p_provider_issuer)
    AND (NULLIF(btrim(p_provider_subject), '') IS NULL OR binding.provider_subject = btrim(p_provider_subject))
    AND (NULLIF(btrim(p_provider_session_id), '') IS NULL OR session.provider_session_id = btrim(p_provider_session_id))
    AND session.revoked_at IS NULL AND session.expires_at > clock_timestamp();
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END
$function$;

CREATE OR REPLACE FUNCTION iam.read_oidc_provider_cache(p_cache_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, iam AS $function$
  SELECT cache_value FROM iam.oidc_provider_cache WHERE cache_key = p_cache_key AND length(p_cache_key) <= 512;
$function$;

CREATE OR REPLACE FUNCTION iam.write_oidc_provider_cache(p_cache_key text, p_cache_value jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $function$
BEGIN
  IF length(p_cache_key) = 0 OR length(p_cache_key) > 512 OR p_cache_value IS NULL THEN RETURN false; END IF;
  INSERT INTO iam.oidc_provider_cache(cache_key, cache_value, updated_at)
  VALUES (p_cache_key, p_cache_value, clock_timestamp())
  ON CONFLICT (cache_key) DO UPDATE SET cache_value = EXCLUDED.cache_value, updated_at = EXCLUDED.updated_at;
  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION iam.register_browser_session(uuid, uuid, uuid, uuid, uuid, text, uuid[], text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.consume_oidc_logout_token(text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.revoke_oidc_provider_sessions(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.read_oidc_provider_cache(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.write_oidc_provider_cache(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.register_browser_session(uuid, uuid, uuid, uuid, uuid, text, uuid[], text, timestamptz, timestamptz) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.consume_oidc_logout_token(text, text, timestamptz, timestamptz) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.revoke_oidc_provider_sessions(text, text, text, text) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.read_oidc_provider_cache(text) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.write_oidc_provider_cache(text, jsonb) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607310701_AUTH-07_backchannel_logout', 'AUTH-07', 'OIDC back-channel logout replay, provider session revocation and durable provider cache')
ON CONFLICT (migration_id) DO NOTHING;
''', encoding='utf-8')

    manifest_path = ROOT / 'infra/database/post-integration-migration-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['gate'] = 'GATE-AUTH-BACKCHANNEL-LOGOUT-V1'
    if len(manifest['migrations']) == 1:
        manifest['migrations'].append({
            'order': 2,
            'id': '202607310701_AUTH-07_backchannel_logout',
            'stream': 'AUTH-07',
            'path': 'infra/database/post-integration-migrations/202607310701_AUTH-07_backchannel_logout.sql',
        })
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    verify = ROOT / 'tests/integration/verify-auth-durable-context.sh'
    source = verify.read_text(encoding='utf-8')
    source = source.replace("manifest.gate !== 'GATE-AUTH-DURABLE-CONTEXT-V1'", "manifest.gate !== 'GATE-AUTH-BACKCHANNEL-LOGOUT-V1'")
    source = source.replace("migrations.length !== 1", "migrations.length !== 2")
    source = source.replace("expected one AUTH-03 migration", "expected two AUTH migrations")
    source = source.replace("if (migration.stream !== 'AUTH-03') throw new Error(`unexpected stream: ${migration.stream}`);", "if (!['AUTH-03', 'AUTH-07'].includes(migration.stream)) throw new Error(`unexpected stream: ${migration.stream}`);")
    source = source.replace("<> 41", "<> 42")
    source = source.replace("expected 41 total", "expected 42 total")
    source = source.replace(
        "OR to_regclass('iam.browser_session_registry') IS NULL THEN",
        "OR to_regclass('iam.browser_session_registry') IS NULL\n     OR to_regclass('iam.oidc_logout_token_consumption') IS NULL\n     OR to_regclass('iam.oidc_provider_cache') IS NULL THEN",
    )
    source = source.replace(
        "OR has_table_privilege(current_user, 'iam.browser_session_registry', 'SELECT') THEN",
        "OR has_table_privilege(current_user, 'iam.browser_session_registry', 'SELECT')\n     OR has_table_privilege(current_user, 'iam.oidc_logout_token_consumption', 'SELECT')\n     OR has_table_privilege(current_user, 'iam.oidc_provider_cache', 'SELECT') THEN",
    )
    source = source.replace(
        "    '30000000-0000-4000-8000-000000000003',\n    ARRAY['30000000-0000-4000-8000-000000000005'::uuid],",
        "    '30000000-0000-4000-8000-000000000003',\n    'provider-session-abc',\n    ARRAY['30000000-0000-4000-8000-000000000005'::uuid],",
    )
    source = source.replace(
        "    '30000000-0000-4000-8000-000000000003',\n    ARRAY['30000000-0000-4000-8000-000000000005'::uuid],",
        "    '30000000-0000-4000-8000-000000000003',\n    'provider-session-abc',\n    ARRAY['30000000-0000-4000-8000-000000000005'::uuid],",
    )
    insertion = r'''
  IF NOT iam.consume_oidc_logout_token(
    'logout-token-verification',
    'https://identity.school.test',
    clock_timestamp() - interval '10 seconds',
    clock_timestamp() + interval '5 minutes'
  ) THEN RAISE EXCEPTION 'first Logout Token consumption must succeed'; END IF;
  IF iam.consume_oidc_logout_token(
    'logout-token-verification',
    'https://identity.school.test',
    clock_timestamp() - interval '10 seconds',
    clock_timestamp() + interval '5 minutes'
  ) THEN RAISE EXCEPTION 'Logout Token replay must be denied'; END IF;
  IF NOT iam.write_oidc_provider_cache('oidc-cache:test', '{"schemaVersion":1}'::jsonb) THEN
    RAISE EXCEPTION 'provider cache write must succeed';
  END IF;
  IF iam.read_oidc_provider_cache('oidc-cache:test') <> '{"schemaVersion":1}'::jsonb THEN
    RAISE EXCEPTION 'provider cache read must return exact value';
  END IF;
'''
    marker = "  IF NOT iam.register_browser_session("
    if insertion not in source:
        source = source.replace(marker, insertion + "\n" + marker, 1)
    verify.write_text(source, encoding='utf-8')


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {'test', 'implementation'}:
        raise SystemExit('usage: implement_auth_07_durable.py test|implementation')
    if sys.argv[1] == 'test':
        add_tests()
    else:
        apply_implementation()


if __name__ == '__main__':
    main()
