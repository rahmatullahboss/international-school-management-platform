import type { HttpDatabase } from '@school/database';
import {
  MembershipDirectory,
  type BrowserSessionClaims,
  type MembershipResolution,
  type MembershipSelection,
  type OidcBackchannelLogoutClaims,
  type OidcIdentity,
  type OidcProviderCacheStore,
} from '@school/policy';

interface BooleanRow extends Record<string, unknown> {
  readonly value: boolean;
}

interface CountRow extends Record<string, unknown> {
  readonly value: number;
}

interface MembershipRow extends Record<string, unknown> {
  readonly membershipId: string;
  readonly accountId: string;
  readonly tenantId: string;
  readonly campusId: string | null;
  readonly roleIds: string[];
}

interface JsonRow extends Record<string, unknown> {
  readonly value: unknown;
}

const MAX_PROVIDER_IDENTIFIER_LENGTH = 512;
const MAX_CACHE_KEY_LENGTH = 512;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} must be a UUID.`);
  return value;
}

function requireProviderIdentifier(value: string | undefined, label: string): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (normalized === '' || normalized.length > MAX_PROVIDER_IDENTIFIER_LENGTH) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

function requireUuidArray(values: readonly string[], label: string): string[] {
  if (values.length === 0) throw new Error(`${label} must not be empty.`);
  return values.map((value) => requireUuid(value, label));
}

function requireBooleanRow(rows: readonly BooleanRow[], operation: string): boolean {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined || typeof row.value !== 'boolean') {
    throw new Error(`${operation} returned an invalid database response.`);
  }
  return row.value;
}

function requireCountRow(rows: readonly CountRow[], operation: string): number {
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    typeof row.value !== 'number' ||
    !Number.isInteger(row.value) ||
    row.value < 0
  ) {
    throw new Error(`${operation} returned an invalid database response.`);
  }
  return row.value;
}

function requireBackchannelLogoutResult(rows: readonly JsonRow[]): {
  readonly replayed: boolean;
  readonly revokedSessions: number;
} {
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

function validateMembershipRow(row: MembershipRow): MembershipRow {
  requireUuid(row.membershipId, 'membershipId');
  requireUuid(row.accountId, 'accountId');
  requireUuid(row.tenantId, 'tenantId');
  if (row.campusId !== null) requireUuid(row.campusId, 'campusId');
  if (!Array.isArray(row.roleIds)) throw new Error('roleIds must be an array.');
  requireUuidArray(row.roleIds, 'roleId');
  return row;
}

export class DurableAuthStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async consumeTransaction(
    transactionId: string,
    providerIssuer: string,
    expiresAt: number,
  ): Promise<boolean> {
    requireUuid(transactionId, 'transactionId');
    if (providerIssuer.trim() === '') throw new Error('providerIssuer is required.');
    if (!Number.isInteger(expiresAt)) throw new Error('expiresAt must be an integer timestamp.');
    const rows = await this.#database.query<BooleanRow>(
      `SELECT iam.consume_oauth_transaction(
         $1::uuid,
         $2::text,
         to_timestamp($3::double precision)
       ) AS value`,
      [transactionId, providerIssuer, expiresAt],
    );
    return requireBooleanRow(rows, 'OAuth transaction consumption');
  }

  async resolveMembership(
    identity: OidcIdentity,
    selection: MembershipSelection = {},
  ): Promise<MembershipResolution> {
    const rows = await this.#database.query<MembershipRow>(
      `SELECT
         membership_id::text AS "membershipId",
         account_id::text AS "accountId",
         tenant_id::text AS "tenantId",
         campus_id::text AS "campusId",
         ARRAY(SELECT role_id::text FROM unnest(role_ids) AS role_id) AS "roleIds"
       FROM iam.resolve_oidc_memberships($1::text, $2::text)`,
      [identity.issuer, identity.subject],
    );
    const directory = new MembershipDirectory();
    for (const rawRow of rows) {
      const row = validateMembershipRow(rawRow);
      directory.register({
        membershipId: row.membershipId,
        issuer: identity.issuer,
        providerSubject: identity.subject,
        principalId: row.accountId,
        tenantId: row.tenantId,
        campusIds: row.campusId === null ? [] : [row.campusId],
        roleIds: row.roleIds,
        status: 'active',
      });
    }
    return directory.resolve(identity.issuer, identity.subject, selection);
  }

  async registerSession(claims: BrowserSessionClaims): Promise<boolean> {
    requireUuid(claims.sessionId, 'sessionId');
    requireUuid(claims.principalId, 'principalId');
    requireUuid(claims.membershipId, 'membershipId');
    requireUuid(claims.tenantId, 'tenantId');
    if (claims.campusId !== undefined) requireUuid(claims.campusId, 'campusId');
    const roleIds = requireUuidArray(claims.roleIds, 'roleId');
    const rows = await this.#database.query<BooleanRow>(
      `SELECT iam.register_browser_session(
         $1::uuid,
         $2::uuid,
         $3::uuid,
         $4::uuid,
         $5::uuid,
         $6::text,
         $7::uuid[],
         $8::text,
         to_timestamp($9::double precision),
         to_timestamp($10::double precision)
       ) AS value`,
      [
        claims.sessionId,
        claims.principalId,
        claims.tenantId,
        claims.membershipId,
        claims.campusId ?? null,
        requireProviderIdentifier(claims.providerSessionId, 'providerSessionId'),
        roleIds,
        claims.assurance,
        claims.issuedAt,
        claims.expiresAt,
      ],
    );
    return requireBooleanRow(rows, 'Browser session registration');
  }

  async processBackchannelLogout(
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

  async isSessionActive(sessionId: string): Promise<boolean> {
    requireUuid(sessionId, 'sessionId');
    const rows = await this.#database.query<BooleanRow>(
      'SELECT iam.is_browser_session_active($1::uuid) AS value',
      [sessionId],
    );
    return requireBooleanRow(rows, 'Browser session activity check');
  }

  async revokeSession(sessionId: string, reason: string): Promise<boolean> {
    requireUuid(sessionId, 'sessionId');
    if (reason.trim() === '') throw new Error('A revocation reason is required.');
    const rows = await this.#database.query<BooleanRow>(
      'SELECT iam.revoke_browser_session($1::uuid, $2::text) AS value',
      [sessionId, reason],
    );
    return requireBooleanRow(rows, 'Browser session revocation');
  }

  async revokeAccountSessions(accountId: string, reason: string): Promise<number> {
    requireUuid(accountId, 'accountId');
    if (reason.trim() === '') throw new Error('A revocation reason is required.');
    const rows = await this.#database.query<CountRow>(
      'SELECT iam.revoke_account_browser_sessions($1::uuid, $2::text) AS value',
      [accountId, reason],
    );
    return requireCountRow(rows, 'Account session revocation');
  }
}

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
