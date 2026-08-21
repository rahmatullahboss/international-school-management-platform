import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseQuery = vi.hoisted(() => vi.fn());
const authenticateMobileBearer = vi.hoisted(() => vi.fn());

vi.mock('@school/database', () => ({
  createHttpDatabase: () => ({ query: databaseQuery }),
}));
vi.mock('./mobile-auth.js', () => ({
  authenticateMobileBearer,
  resolveMobileAuthReadiness: vi.fn(() => ({
    schemaVersion: 1,
    mode: 'oidc-bearer',
    state: 'ready',
    tokenValidationEnabled: true,
    controls: {
      rs256Only: true,
      issuerValidation: true,
      audienceValidation: true,
      exactScopeValidation: true,
      boundedJwks: true,
      jwksOriginPin: true,
      redirectDenied: true,
      boundedJwksCache: true,
      unknownKidSingleRefresh: true,
      databaseMembershipProjection: true,
    },
    missingConfiguration: [],
  })),
}));

import app from './index.js';

const environment = {
  APP_ENV: 'test',
  APP_REGION: 'local',
  DATABASE_URL: 'postgresql://test.invalid/school',
  MOBILE_MEMBERSHIP_SOURCE: 'database',
};
const headers = {
  authorization: 'Bearer test-credential',
  'x-tenant-id': '40000000-0000-4000-8000-000000000002',
  'x-campus-id': '40000000-0000-4000-8000-000000000003',
  'x-persona': 'guardian',
};
const studentId = '40000000-0000-4000-8000-000000000010';
const conversationId = '40000000-0000-4000-8000-000000000020';
const messageId = '40000000-0000-4000-8000-000000000030';

beforeEach(() => {
  databaseQuery.mockReset();
  authenticateMobileBearer.mockReset();
  authenticateMobileBearer.mockResolvedValue({
    ok: true,
    identity: {
      issuer: 'https://identity.school.test',
      subject: 'family-user',
      assurance: 'aal1',
      issuedAt: 1,
      expiresAt: 2,
    },
  });
});

describe('mobile Family conversation routes', () => {
  it('lists scoped conversations and paginated messages without hidden read mutation', async () => {
    databaseQuery.mockResolvedValueOnce([
      {
        payload: {
          conversations: [
            {
              conversationId,
              subject: 'Class updates',
              unreadCount: 2,
              latestMessageAt: '2026-08-21T12:34:56.789Z',
            },
          ],
          nextCursor: null,
        },
      },
    ]);
    const conversations = await app.request(
      `/v1/mobile/family/students/${studentId}/conversations?limit=25`,
      { headers },
      environment,
    );
    expect(conversations.status).toBe(200);
    expect(conversations.headers.get('cache-control')).toBe('no-store');
    await expect(conversations.json()).resolves.toMatchObject({
      conversations: [{ conversationId, unreadCount: 2 }],
    });

    databaseQuery.mockResolvedValueOnce([
      {
        payload: {
          conversationId,
          messages: [
            {
              messageId,
              authorLabel: 'Teacher One',
              body: 'Please bring the signed form.',
              sentAt: '2026-08-21T12:34:56.789Z',
            },
          ],
          nextCursor: null,
        },
      },
    ]);
    const messages = await app.request(
      `/v1/mobile/family/conversations/${conversationId}/messages?limit=50`,
      { headers },
      environment,
    );
    expect(messages.status).toBe(200);
    await expect(messages.json()).resolves.toMatchObject({
      conversationId,
      messages: [{ messageId, authorLabel: 'Teacher One' }],
    });
    expect(databaseQuery).toHaveBeenCalledTimes(2);
  });

  it('sends a message and records read state only through explicit idempotent POST commands', async () => {
    databaseQuery.mockResolvedValueOnce([
      {
        payload: {
          messageId,
          authorLabel: 'Guardian Tester',
          body: 'Thank you.',
          sentAt: '2026-08-21T12:35:56.789Z',
        },
      },
    ]);
    const sent = await app.request(
      `/v1/mobile/family/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'idempotency-key': 'family-message-route-idempotency-0001',
        },
        body: JSON.stringify({ body: 'Thank you.' }),
      },
      environment,
    );
    expect(sent.status).toBe(200);
    await expect(sent.json()).resolves.toMatchObject({ messageId, body: 'Thank you.' });

    databaseQuery.mockResolvedValueOnce([{ payload: { acceptedRevision: 3 } }]);
    const read = await app.request(
      `/v1/mobile/family/conversations/${conversationId}/read-receipts`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'idempotency-key': 'family-read-route-idempotency-0001',
        },
        body: JSON.stringify({ messageId }),
      },
      environment,
    );
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toEqual({ acceptedRevision: 3 });
  });

  it('supports the student Family persona when canonical student authority resolves', async () => {
    databaseQuery.mockResolvedValueOnce([{ payload: { conversations: [], nextCursor: null } }]);
    const response = await app.request(
      `/v1/mobile/family/students/${studentId}/conversations`,
      { headers: { ...headers, 'x-persona': 'student' } },
      environment,
    );
    expect(response.status).toBe(200);
  });

  it('maps locked/idempotency conflicts without leaking persistence details', async () => {
    databaseQuery.mockResolvedValueOnce([{ payload: { status: 'locked' } }]);
    const locked = await app.request(
      `/v1/mobile/family/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'idempotency-key': 'family-message-route-idempotency-0002',
        },
        body: JSON.stringify({ body: 'Hello' }),
      },
      environment,
    );
    expect(locked.status).toBe(409);
    const lockedPayload = await locked.json();
    expect(lockedPayload).toMatchObject({ error: { code: 'mobile_family_conversation_locked' } });
    expect(JSON.stringify(lockedPayload)).not.toContain('requestDigest');

    databaseQuery.mockResolvedValueOnce([{ payload: { status: 'idempotency-conflict' } }]);
    const conflict = await app.request(
      `/v1/mobile/family/conversations/${conversationId}/read-receipts`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'idempotency-key': 'family-read-route-idempotency-0002',
        },
        body: JSON.stringify({ messageId }),
      },
      environment,
    );
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: { code: 'mobile_family_conversation_idempotency_conflict' },
    });
  });

  it('rejects malformed cursors, bodies and identifiers before touching the database', async () => {
    const badCursor = await app.request(
      `/v1/mobile/family/students/${studentId}/conversations?cursor=not-a-cursor`,
      { headers },
      environment,
    );
    expect(badCursor.status).toBe(400);

    const badBody = await app.request(
      `/v1/mobile/family/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'idempotency-key': 'family-message-route-idempotency-0003',
        },
        body: JSON.stringify({ body: ' Hello', studentId }),
      },
      environment,
    );
    expect(badBody.status).toBe(400);

    const badConversation = await app.request(
      '/v1/mobile/family/conversations/not-a-uuid/messages',
      { headers },
      environment,
    );
    expect(badConversation.status).toBe(400);
    expect(databaseQuery).not.toHaveBeenCalled();
  });
});
