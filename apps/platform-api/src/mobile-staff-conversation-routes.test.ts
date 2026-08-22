import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMessage = vi.fn();
const markRead = vi.fn();

vi.mock('./database-mobile-staff-conversation-store.js', () => ({
  DatabaseMobileStaffConversationStore: class {
    sendMessage = sendMessage;
    markRead = markRead;
  },
}));
vi.mock('@school/database', () => ({ createHttpDatabase: vi.fn(() => ({})) }));
vi.mock('./mobile-auth.js', () => ({
  authenticateMobileBearer: vi.fn(() => ({
    ok: true,
    identity: { issuer: 'https://identity.school.test', subject: 'provider-mobile-teacher-1' },
  })),
}));

const conversationId = '40000000-0000-4000-8000-000000000810';
const messageId = '40000000-0000-4000-8000-000000000811';
const headers = {
  authorization: 'Bearer token',
  'x-tenant-id': '40000000-0000-4000-8000-000000000001',
  'x-campus-id': '40000000-0000-4000-8000-000000000003',
  'x-persona': 'teacher',
  'idempotency-key': 'teacher-message-idempotency-0001',
};
const env = { DATABASE_URL: 'postgres://test', MOBILE_MEMBERSHIP_SOURCE: 'database' };

describe('mobile staff conversation write routes', () => {
  beforeEach(() => {
    sendMessage.mockReset();
    markRead.mockReset();
  });

  it('sends an authorized teacher message with no-store', async () => {
    sendMessage.mockResolvedValue({
      messageId,
      authorLabel: 'Teacher One',
      body: 'Please review the assignment.',
      sentAt: '2026-08-22T04:00:00.000Z',
    });
    const { default: app } = await import('./mobile-staff-conversation-routes.js');

    const response = await app.request(
      `/v1/mobile/teacher/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Please review the assignment.' }),
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      messageId,
      authorLabel: 'Teacher One',
      body: 'Please review the assignment.',
      sentAt: '2026-08-22T04:00:00.000Z',
    });
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('records an explicit teacher read receipt', async () => {
    markRead.mockResolvedValue({ acceptedRevision: 3 });
    const { default: app } = await import('./mobile-staff-conversation-routes.js');

    const response = await app.request(
      `/v1/mobile/teacher/conversations/${conversationId}/read-receipts`,
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ messageId }),
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ acceptedRevision: 3 });
    expect(markRead).toHaveBeenCalledOnce();
  });

  it('rejects finalize-style or malformed input before persistence', async () => {
    const { default: app } = await import('./mobile-staff-conversation-routes.js');
    const invalidBody = await app.request(
      `/v1/mobile/teacher/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Hello', publish: true }),
      },
      env,
    );
    const invalidPath = await app.request(
      '/v1/mobile/teacher/conversations/not-a-uuid/read-receipts',
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ messageId }),
      },
      env,
    );

    expect(invalidBody.status).toBe(400);
    expect(invalidPath.status).toBe(400);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(markRead).not.toHaveBeenCalled();
  });

  it('maps scope denial and mutation conflicts without leaking persistence details', async () => {
    sendMessage.mockResolvedValue({ status: 'locked' });
    markRead.mockResolvedValue({ status: 'idempotency-conflict' });
    const { default: app } = await import('./mobile-staff-conversation-routes.js');

    const locked = await app.request(
      `/v1/mobile/teacher/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Hello' }),
      },
      env,
    );
    const conflict = await app.request(
      `/v1/mobile/teacher/conversations/${conversationId}/read-receipts`,
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ messageId }),
      },
      env,
    );
    sendMessage.mockResolvedValue(undefined);
    const denied = await app.request(
      `/v1/mobile/teacher/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Hello again' }),
      },
      env,
    );

    expect(locked.status).toBe(409);
    expect(conflict.status).toBe(409);
    expect(denied.status).toBe(403);
  });

  it('sanitizes dependency failures', async () => {
    sendMessage.mockRejectedValue(new Error('postgres secret detail'));
    const { default: app } = await import('./mobile-staff-conversation-routes.js');
    const response = await app.request(
      `/v1/mobile/teacher/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Hello' }),
      },
      env,
    );

    expect(response.status).toBe(503);
    await expect(response.text()).resolves.not.toContain('postgres secret detail');
  });
});
