#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one marker, found {count}: {old[:120]!r}')
    target.write_text(source.replace(old, new), encoding='utf-8')


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    target = ROOT / path
    source = target.read_text(encoding='utf-8')
    start_index = source.find(start)
    if start_index < 0:
        raise SystemExit(f'{path}: start marker missing: {start!r}')
    end_index = source.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f'{path}: end marker missing: {end!r}')
    target.write_text(source[:start_index] + replacement + source[end_index:], encoding='utf-8')


def add_tests() -> None:
    policy_test = ROOT / 'packages/policy/src/oidc-backchannel-logout.test.ts'
    source = policy_test.read_text(encoding='utf-8')
    source = source.replace(
        "      signToken({ events: {} }),\n      signToken({ nonce: 'forbidden' }),",
        "      signToken({ events: {} }),\n      signToken({ events: { [event]: { unexpected: true } } }),\n      signToken({ nonce: 'forbidden' }),",
    )
    start = "  it('atomically consumes the jti and revokes exact provider sessions only once', async () => {"
    end = "  it('fails closed when replay or session-revocation storage is unavailable', async () => {"
    replacement = """  it('persists replay denial and provider-session revocation in one atomic operation', async () => {
    const applyLogout = vi
      .fn<
        (
          claims: OidcBackchannelLogoutClaims,
        ) => Promise<{ readonly replayed: boolean; readonly revokedSessions: number }>
      >()
      .mockResolvedValueOnce({ replayed: false, revokedSessions: 2 })
      .mockResolvedValueOnce({ replayed: true, revokedSessions: 0 });
    const input = {
      logoutToken: await signToken(),
      configuration,
      resolveJwks: async () => {
        await Promise.resolve();
        return jwksResult([publicJwk]);
      },
      applyLogout,
      now,
    };

    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      revokedSessions: 2,
    });
    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: true,
      replayed: true,
      revokedSessions: 0,
    });
    expect(applyLogout).toHaveBeenCalledTimes(2);
    expect(applyLogout.mock.calls[0]?.[0]).toMatchObject({
      tokenId: 'logout-token-123',
      subject: 'provider-user-123',
      providerSessionId: 'provider-session-abc',
    });
  });

"""
    start_index = source.find(start)
    end_index = source.find(end, start_index)
    if start_index < 0 or end_index < 0:
        raise SystemExit('policy atomic test markers missing')
    source = source[:start_index] + replacement + source[end_index:]

    start = end
    final = source.rfind('\n});')
    if final < 0:
        raise SystemExit('policy test final marker missing')
    replacement = """  it('allows a provider retry after atomic persistence is unavailable', async () => {
    const applyLogout = vi
      .fn<
        (
          claims: OidcBackchannelLogoutClaims,
        ) => Promise<{ readonly replayed: boolean; readonly revokedSessions: number }>
      >()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ replayed: false, revokedSessions: 1 });
    const input = {
      logoutToken: await signToken(),
      configuration,
      resolveJwks: async () => {
        await Promise.resolve();
        return jwksResult([publicJwk]);
      },
      applyLogout,
      now,
    };

    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: false,
      code: 'oidc_backchannel_persistence_unavailable',
    });
    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      revokedSessions: 1,
    });
    expect(applyLogout).toHaveBeenCalledTimes(2);
  });
"""
    start_index = source.find(start)
    if start_index < 0:
        raise SystemExit('policy failure test marker missing')
    source = source[:start_index] + replacement + source[final:]
    policy_test.write_text(source, encoding='utf-8')

    replace_between(
        'apps/platform-api/src/auth-durable-store.test.ts',
        "  it('consumes Logout Token ids and revokes exact provider sessions', async () => {",
        "  it('stores provider cache records only through security-definer functions', async () => {",
        """  it('atomically consumes a Logout Token and revokes exact provider sessions', async () => {
    const query = vi.fn().mockResolvedValueOnce([
      { value: { replayed: false, revokedSessions: 2 } },
    ]);
    const store = new DurableAuthStore({ query });
    const claims = {
      issuer: identity.issuer,
      subject: identity.subject,
      providerSessionId: 'provider-session-abc',
      tokenId: 'logout-token-123',
      issuedAt: 1_785_382_400,
      expiresAt: 1_785_382_700,
    };

    await expect(
      store.processBackchannelLogout(claims, 'provider back-channel logout'),
    ).resolves.toEqual({ replayed: false, revokedSessions: 2 });
    expect(query.mock.calls[0]?.[0]).toContain('iam.process_oidc_backchannel_logout');
    expect(query.mock.calls[0]?.[1]).toEqual([
      'logout-token-123',
      identity.issuer,
      identity.subject,
      'provider-session-abc',
      1_785_382_400,
      1_785_382_700,
      'provider back-channel logout',
    ]);
  });

""",
    )

    endpoint_test = ROOT / 'apps/platform-api/src/auth-backchannel.test.ts'
    source = endpoint_test.read_text(encoding='utf-8')
    source = source.replace(
        "  handleOidcBackchannelLogoutRequest,\n  type OidcBackchannelProcessor,",
        "  handleOidcBackchannelLogoutRequest,\n  isOidcBackchannelDeclaredLengthAllowed,\n  type OidcBackchannelProcessor,",
    )
    source = source.replace(
        "      { contentType: 'application/json', rawBody: `logout_token=${token}` },",
        "      { contentType: 'application/json', rawBody: `logout_token=${token}` },\n      {\n        contentType: 'application/x-www-form-urlencoded',\n        contentLength: '20garbage',\n        rawBody: `logout_token=${token}`,\n      },",
    )
    marker = "  it('fails closed before token processing when durable configuration is absent', async () => {"
    block = """  it('rejects an oversized declared body before the route reads it', () => {
    expect(isOidcBackchannelDeclaredLengthAllowed(undefined)).toBe(true);
    expect(isOidcBackchannelDeclaredLengthAllowed('00042')).toBe(true);
    expect(isOidcBackchannelDeclaredLengthAllowed('20garbage')).toBe(false);
    expect(isOidcBackchannelDeclaredLengthAllowed(String(17 * 1024 + 1))).toBe(false);
  });

"""
    if block not in source:
        if source.count(marker) != 1:
            raise SystemExit('endpoint length test marker missing')
        source = source.replace(marker, block + marker)
    source = source.replace(
        "        code: 'oidc_backchannel_replay_unavailable',",
        "        code: 'oidc_backchannel_persistence_unavailable',",
    )
    endpoint_test.write_text(source, encoding='utf-8')


def apply_implementation() -> None:
    policy = ROOT / 'packages/policy/src/oidc-backchannel-logout.ts'
    source = policy.read_text(encoding='utf-8')
    source = source.replace(
        "  | 'oidc_backchannel_replay_unavailable'\n  | 'oidc_backchannel_revocation_unavailable';",
        "  | 'oidc_backchannel_persistence_unavailable';",
    )
    source = source.replace(
        """export interface ProcessOidcBackchannelLogoutInput extends VerifyOidcBackchannelLogoutWithRotationInput {
  readonly consumeToken: (claims: OidcBackchannelLogoutClaims) => Promise<boolean>;
  readonly revokeSessions: (claims: OidcBackchannelLogoutClaims) => Promise<number>;
}
""",
        """export interface OidcBackchannelLogoutPersistenceResult {
  readonly replayed: boolean;
  readonly revokedSessions: number;
}

export interface ProcessOidcBackchannelLogoutInput extends VerifyOidcBackchannelLogoutWithRotationInput {
  readonly applyLogout: (
    claims: OidcBackchannelLogoutClaims,
  ) => Promise<OidcBackchannelLogoutPersistenceResult>;
}
""",
    )
    source = source.replace(
        "    !isRecord(events[BACKCHANNEL_LOGOUT_EVENT]) ||",
        "    !isRecord(events[BACKCHANNEL_LOGOUT_EVENT]) ||\n    Object.keys(events[BACKCHANNEL_LOGOUT_EVENT]).length !== 0 ||",
    )
    process_marker = "export async function processOidcBackchannelLogout("
    process_index = source.find(process_marker)
    if process_index < 0:
        raise SystemExit('policy process marker missing')
    process = """export async function processOidcBackchannelLogout(
  input: ProcessOidcBackchannelLogoutInput,
): Promise<OidcBackchannelLogoutProcessResult> {
  const verification = await verifyOidcBackchannelLogoutTokenWithRotation(input);
  if (!verification.ok) return verification;

  try {
    const persistence = await input.applyLogout(verification.claims);
    if (
      typeof persistence.replayed !== 'boolean' ||
      !Number.isInteger(persistence.revokedSessions) ||
      persistence.revokedSessions < 0 ||
      (persistence.replayed && persistence.revokedSessions !== 0)
    ) {
      throw new Error('invalid persistence result');
    }
    return {
      ok: true,
      replayed: persistence.replayed,
      revokedSessions: persistence.revokedSessions,
      claims: verification.claims,
    };
  } catch {
    return {
      ok: false,
      code: 'oidc_backchannel_persistence_unavailable',
      message: 'Back-channel logout persistence is unavailable.',
    };
  }
}
"""
    policy.write_text(source[:process_index] + process, encoding='utf-8')

    store = ROOT / 'apps/platform-api/src/auth-durable-store.ts'
    source = store.read_text(encoding='utf-8')
    parser_marker = "function validateMembershipRow(row: MembershipRow): MembershipRow {"
    parser = """function requireBackchannelLogoutResult(
  rows: readonly JsonRow[],
): { readonly replayed: boolean; readonly revokedSessions: number } {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined || !isRecord(row.value)) {
    throw new Error('Back-channel logout returned an invalid database response.');
  }
  const replayed = row.value.replayed;
  const revokedSessions = row.value.revokedSessions;
  if (
    typeof replayed !== 'boolean' ||
    typeof revokedSessions !== 'number' ||
    !Number.isInteger(revokedSessions) ||
    revokedSessions < 0 ||
    (replayed && revokedSessions !== 0)
  ) {
    throw new Error('Back-channel logout returned an invalid database response.');
  }
  return { replayed, revokedSessions };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

"""
    if parser not in source:
        if source.count(parser_marker) != 1:
            raise SystemExit('durable parser marker missing')
        source = source.replace(parser_marker, parser + parser_marker)
    start = source.find('  async consumeBackchannelLogoutToken(')
    end = source.find('  async isSessionActive(', start)
    if start < 0 or end < 0:
        raise SystemExit('durable backchannel method markers missing')
    method = """  async processBackchannelLogout(
    claims: OidcBackchannelLogoutClaims,
    reason: string,
  ): Promise<{ readonly replayed: boolean; readonly revokedSessions: number }> {
    if (claims.issuer.trim() === '' || claims.tokenId.trim() === '') {
      throw new Error('Logout Token identity is required.');
    }
    if (reason.trim() === '') throw new Error('A revocation reason is required.');
    const subject = requireProviderIdentifier(claims.subject, 'providerSubject');
    const providerSessionId = requireProviderIdentifier(
      claims.providerSessionId,
      'providerSessionId',
    );
    if (subject === null && providerSessionId === null) {
      throw new Error('A provider subject or session id is required.');
    }
    const rows = await this.#database.query<JsonRow>(
      `SELECT iam.process_oidc_backchannel_logout(
         $1::text,
         $2::text,
         $3::text,
         $4::text,
         to_timestamp($5::double precision),
         to_timestamp($6::double precision),
         $7::text
       ) AS value`,
      [
        claims.tokenId,
        claims.issuer,
        subject,
        providerSessionId,
        claims.issuedAt,
        claims.expiresAt,
        reason,
      ],
    );
    return requireBackchannelLogoutResult(rows);
  }

"""
    store.write_text(source[:start] + method + source[end:], encoding='utf-8')

    migration = ROOT / 'infra/database/post-integration-migrations/202607310701_AUTH-07_backchannel_logout.sql'
    source = migration.read_text(encoding='utf-8')
    start = source.find('CREATE OR REPLACE FUNCTION iam.consume_oidc_logout_token(')
    end = source.find('CREATE OR REPLACE FUNCTION iam.read_oidc_provider_cache', start)
    if start < 0 or end < 0:
        raise SystemExit('migration atomic function markers missing')
    atomic = r'''CREATE OR REPLACE FUNCTION iam.process_oidc_backchannel_logout(
  p_token_id text,
  p_provider_issuer text,
  p_provider_subject text,
  p_provider_session_id text,
  p_issued_at timestamptz,
  p_expires_at timestamptz,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
DECLARE
  revoked_count integer;
BEGIN
  IF length(btrim(p_token_id)) = 0 OR length(p_token_id) > 512
     OR length(btrim(p_provider_issuer)) = 0
     OR length(btrim(p_reason)) = 0
     OR (NULLIF(btrim(p_provider_subject), '') IS NULL AND NULLIF(btrim(p_provider_session_id), '') IS NULL)
     OR length(coalesce(p_provider_subject, '')) > 512
     OR length(coalesce(p_provider_session_id, '')) > 512
     OR p_issued_at > clock_timestamp() + interval '1 minute'
     OR p_issued_at < clock_timestamp() - interval '6 minutes'
     OR p_expires_at <= clock_timestamp() - interval '1 minute'
     OR p_expires_at > p_issued_at + interval '10 minutes' THEN
    RAISE EXCEPTION 'invalid back-channel logout request';
  END IF;

  INSERT INTO iam.oidc_logout_token_consumption(provider_issuer, token_id, issued_at, expires_at)
  VALUES (btrim(p_provider_issuer), btrim(p_token_id), p_issued_at, p_expires_at)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('replayed', true, 'revokedSessions', 0);
  END IF;

  UPDATE iam.browser_session_registry AS session
  SET revoked_at = clock_timestamp(), revoke_reason = btrim(p_reason)
  FROM iam.oidc_membership_binding AS binding
  WHERE binding.binding_id = session.binding_id
    AND binding.provider_issuer = btrim(p_provider_issuer)
    AND (NULLIF(btrim(p_provider_subject), '') IS NULL OR binding.provider_subject = btrim(p_provider_subject))
    AND (NULLIF(btrim(p_provider_session_id), '') IS NULL OR session.provider_session_id = btrim(p_provider_session_id))
    AND session.revoked_at IS NULL
    AND session.expires_at > clock_timestamp();
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN jsonb_build_object('replayed', false, 'revokedSessions', revoked_count);
END
$function$;

'''
    source = source[:start] + atomic + source[end:]
    source = source.replace(
        "REVOKE ALL ON FUNCTION iam.consume_oidc_logout_token(text, text, timestamptz, timestamptz) FROM PUBLIC;\nREVOKE ALL ON FUNCTION iam.revoke_oidc_provider_sessions(text, text, text, text) FROM PUBLIC;",
        "REVOKE ALL ON FUNCTION iam.process_oidc_backchannel_logout(text, text, text, text, timestamptz, timestamptz, text) FROM PUBLIC;",
    )
    source = source.replace(
        "GRANT EXECUTE ON FUNCTION iam.consume_oidc_logout_token(text, text, timestamptz, timestamptz) TO app_runtime;\nGRANT EXECUTE ON FUNCTION iam.revoke_oidc_provider_sessions(text, text, text, text) TO app_runtime;",
        "GRANT EXECUTE ON FUNCTION iam.process_oidc_backchannel_logout(text, text, text, text, timestamptz, timestamptz, text) TO app_runtime;",
    )
    migration.write_text(source, encoding='utf-8')

    verify = ROOT / 'tests/integration/verify-auth-durable-context.sh'
    source = verify.read_text(encoding='utf-8')
    old = """

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
"""
    if source.count(old) != 1:
        raise SystemExit(f'integration old token block count: {source.count(old)}')
    source = source.replace(old, '\n')
    old = """  IF NOT iam.revoke_browser_session(
    '30000000-0000-4000-8000-000000000009',
    'verification logout'
  ) THEN
    RAISE EXCEPTION 'session revocation must succeed';
  END IF;
  IF iam.is_browser_session_active('30000000-0000-4000-8000-000000000009') THEN
    RAISE EXCEPTION 'revoked session must be inactive';
  END IF;
"""
    new = """  IF iam.process_oidc_backchannel_logout(
    'logout-token-verification',
    'https://identity.school.test',
    'provider-user-123',
    'provider-session-abc',
    clock_timestamp() - interval '10 seconds',
    clock_timestamp() + interval '5 minutes',
    'provider back-channel logout'
  ) <> '{"replayed": false, "revokedSessions": 1}'::jsonb THEN
    RAISE EXCEPTION 'atomic Logout Token processing must revoke the exact session';
  END IF;
  IF iam.is_browser_session_active('30000000-0000-4000-8000-000000000009') THEN
    RAISE EXCEPTION 'provider-revoked session must be inactive';
  END IF;
  IF iam.process_oidc_backchannel_logout(
    'logout-token-verification',
    'https://identity.school.test',
    'provider-user-123',
    'provider-session-abc',
    clock_timestamp() - interval '10 seconds',
    clock_timestamp() + interval '5 minutes',
    'provider back-channel logout'
  ) <> '{"replayed": true, "revokedSessions": 0}'::jsonb THEN
    RAISE EXCEPTION 'Logout Token replay must be idempotent';
  END IF;
"""
    if source.count(old) != 1:
        raise SystemExit(f'integration manual revocation block count: {source.count(old)}')
    verify.write_text(source.replace(old, new), encoding='utf-8')

    index = ROOT / 'apps/platform-api/src/index.ts'
    source = index.read_text(encoding='utf-8')
    source = source.replace(
        "import { handleOidcBackchannelLogoutRequest } from './auth-backchannel.js';",
        "import {\n  handleOidcBackchannelLogoutRequest,\n  isOidcBackchannelDeclaredLengthAllowed,\n} from './auth-backchannel.js';",
    )
    source = source.replace(
        """  let rawBody = '';
  if (configured) {
""",
        """  const contentLength = context.req.header('content-length');
  const declaredLengthAllowed = isOidcBackchannelDeclaredLengthAllowed(contentLength);
  let rawBody = '';
  if (configured && declaredLengthAllowed) {
""",
    )
    source = source.replace(
        """    ...(context.req.header('content-length') === undefined
      ? {}
      : { contentLength: context.req.header('content-length')! }),
""",
        """    ...(contentLength === undefined ? {} : { contentLength }),
""",
    )
    source = source.replace(
        """        consumeToken: (claims) => durableAuth.consumeBackchannelLogoutToken(claims),
        revokeSessions: (claims) =>
          durableAuth.revokeProviderSessions(claims, 'provider back-channel logout'),
""",
        """        applyLogout: (claims) =>
          durableAuth.processBackchannelLogout(claims, 'provider back-channel logout'),
""",
    )
    index.write_text(source, encoding='utf-8')

    endpoint = ROOT / 'apps/platform-api/src/auth-backchannel.ts'
    source = endpoint.read_text(encoding='utf-8')
    marker = "function parseLogoutToken(rawBody: string): string | undefined {"
    helper = """export function isOidcBackchannelDeclaredLengthAllowed(
  value: string | undefined,
): boolean {
  if (value === undefined) return true;
  if (!/^\\d+$/u.test(value)) return false;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 && length <= MAX_REQUEST_LENGTH;
}

"""
    if helper not in source:
        if source.count(marker) != 1:
            raise SystemExit('endpoint helper marker missing')
        source = source.replace(marker, helper + marker)
    source = source.replace(
        """  if (input.contentLength !== undefined) {
    const length = Number.parseInt(input.contentLength, 10);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_REQUEST_LENGTH) {
      return invalidRequest();
    }
  }
""",
        """  if (!isOidcBackchannelDeclaredLengthAllowed(input.contentLength)) {
    return invalidRequest();
  }
""",
    )
    source = source.replace(
        "    code === 'oidc_backchannel_replay_unavailable' ||\n    code === 'oidc_backchannel_revocation_unavailable'",
        "    code === 'oidc_backchannel_persistence_unavailable'",
    )
    endpoint.write_text(source, encoding='utf-8')


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {'test', 'implementation'}:
        raise SystemExit('usage: harden_auth_07_atomic.py test|implementation')
    if sys.argv[1] == 'test':
        add_tests()
    else:
        apply_implementation()


if __name__ == '__main__':
    main()
