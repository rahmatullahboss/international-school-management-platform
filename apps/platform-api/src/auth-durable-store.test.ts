import { describe, expect, it, vi } from 'vitest';

import type { HttpDatabase } from '@school/database';
import type { BrowserSessionClaims, OidcIdentity } from '@school/policy';

import { DurableAuthStore } from './auth-durable-store.js';

const ids = {
  transaction: '40000000-0000-4000-8000-000000000001',
  session: '40000000-0000-4000-8000-000000000002',
  account: '40000000-0000-4000-8000-000000000003',
  tenant: '40000000-0000-4000-8000-000000000004',
  membership: '40000000-0000-4000-8000-000000000005',
  campus: '40000000-0000-4000-8000-000000000006',
  role: '40000000-0000-4000-8000-000000000007',
};

const identity: OidcIdentity = {
  issuer: 'https://identity.school.test',
  subject: 'provider-user-123',
  assurance: 'aal2',
  issuedAt: 1_785_382_400,
  expiresAt: 1_785_383_000,
};

const session: BrowserSessionClaims = {
  version: 1,
  issuer: 'international-school-platform',
  audience: 'international-school-platform-web',
  sessionId: ids.session,
  principalId: ids.account,
  membershipId: ids.membership,
  identityIssuer: identity.issuer,
  identitySubject: identity.subject,
  tenantId: ids.tenant,
  campusId: ids.campus,
  roleIds: [ids.role],
  assurance: 'aal2',
  issuedAt: 1_785_382_400,
  expiresAt: 1_785_384_200,
};

function databaseReturning(rows: Record<string, unknown>[]): {
  database: HttpDatabase;
  query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn().mockResolvedValue(rows);
  return {
    database: { query },
    query,
  };
}

describe('DurableAuthStore', () => {
  it('consumes a transaction through the security-definer database function', async () => {
    const { database, query } = databaseReturning([{ value: true }]);
    const store = new DurableAuthStore(database);

    await expect(
      store.consumeTransaction(ids.transaction, identity.issuer, 1_785_382_700),
    ).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('iam.consume_oauth_transaction'),
      [ids.transaction, identity.issuer, 1_785_382_700],
    );
  });

  it('resolves exact server-owned membership scope and roles', async () => {
    const { database } = databaseReturning([
      {
        membershipId: ids.membership,
        accountId: ids.account,
        tenantId: ids.tenant,
        campusId: ids.campus,
        roleIds: [ids.role],
      },
    ]);
    const store = new DurableAuthStore(database);

    await expect(store.resolveMembership(identity)).resolves.toEqual({
      ok: true,
      context: {
        membershipId: ids.membership,
        principalId: ids.account,
        tenantId: ids.tenant,
        campusId: ids.campus,
        roleIds: [ids.role],
      },
    });
  });

  it('preserves tenant and campus selection boundaries from durable rows', async () => {
    const secondTenant = '40000000-0000-4000-8000-000000000008';
    const secondMembership = '40000000-0000-4000-8000-000000000009';
    const { database } = databaseReturning([
      {
        membershipId: ids.membership,
        accountId: ids.account,
        tenantId: ids.tenant,
        campusId: ids.campus,
        roleIds: [ids.role],
      },
      {
        membershipId: secondMembership,
        accountId: ids.account,
        tenantId: secondTenant,
        campusId: null,
        roleIds: [ids.role],
      },
    ]);
    const store = new DurableAuthStore(database);

    await expect(store.resolveMembership(identity)).resolves.toMatchObject({
      ok: false,
      code: 'membership_selection_required',
    });
    await expect(
      store.resolveMembership(identity, { tenantId: secondTenant }),
    ).resolves.toMatchObject({
      ok: true,
      context: { tenantId: secondTenant, membershipId: secondMembership },
    });
  });

  it('registers and checks a browser session using only validated UUID context', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ value: true }])
      .mockResolvedValueOnce([{ value: true }]);
    const store = new DurableAuthStore({ query });

    await expect(store.registerSession(session)).resolves.toBe(true);
    await expect(store.isSessionActive(ids.session)).resolves.toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual([
      ids.session,
      ids.account,
      ids.tenant,
      ids.membership,
      ids.campus,
      [ids.role],
      'aal2',
      session.issuedAt,
      session.expiresAt,
    ]);
  });

  it('revokes one session or every active session for an account', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ value: true }])
      .mockResolvedValueOnce([{ value: 3 }]);
    const store = new DurableAuthStore({ query });

    await expect(store.revokeSession(ids.session, 'user logout')).resolves.toBe(true);
    await expect(store.revokeAccountSessions(ids.account, 'credential reset')).resolves.toBe(3);
  });

  it('fails closed for malformed database responses and non-UUID claims', async () => {
    const malformed = new DurableAuthStore(databaseReturning([{ value: 'true' }]).database);
    await expect(
      malformed.consumeTransaction(ids.transaction, identity.issuer, 1_785_382_700),
    ).rejects.toThrow('invalid database response');

    const store = new DurableAuthStore(databaseReturning([{ value: true }]).database);
    await expect(
      store.registerSession({ ...session, sessionId: 'browser-declared-session' }),
    ).rejects.toThrow('sessionId must be a UUID');
    await expect(store.revokeSession(ids.session, '   ')).rejects.toThrow(
      'revocation reason is required',
    );
  });

  it('rejects malformed membership rows instead of accepting partial scope', async () => {
    const store = new DurableAuthStore(
      databaseReturning([
        {
          membershipId: ids.membership,
          accountId: ids.account,
          tenantId: 'not-a-uuid',
          campusId: ids.campus,
          roleIds: [ids.role],
        },
      ]).database,
    );
    await expect(store.resolveMembership(identity)).rejects.toThrow('tenantId must be a UUID');
  });
});
