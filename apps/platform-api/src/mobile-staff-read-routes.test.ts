import { beforeEach, describe, expect, it, vi } from 'vitest';

const assessments = vi.fn();
const conversations = vi.fn();
const conversationMessages = vi.fn();

vi.mock('./database-mobile-staff-read-store.js', () => ({
  DatabaseMobileStaffReadStore: class {
    assessments = assessments;
    conversations = conversations;
    conversationMessages = conversationMessages;
  },
}));
vi.mock('@school/database', () => ({ createHttpDatabase: vi.fn(() => ({})) }));
vi.mock('./mobile-auth.js', () => ({
  authenticateMobileBearer: vi.fn(() => ({
    ok: true,
    identity: { issuer: 'https://identity.school.test', subject: 'provider-mobile-teacher-1' },
  })),
}));

const headers = {
  authorization: 'Bearer token',
  'x-tenant-id': '40000000-0000-4000-8000-000000000001',
  'x-campus-id': '40000000-0000-4000-8000-000000000003',
  'x-persona': 'teacher',
};
const env = { DATABASE_URL: 'postgres://test', MOBILE_MEMBERSHIP_SOURCE: 'database' };

describe('mobile staff read routes', () => {
  beforeEach(() => {
    assessments.mockReset();
    conversations.mockReset();
    conversationMessages.mockReset();
  });

  it('returns authorized assessment summaries with no-store', async () => {
    assessments.mockResolvedValue({
      assessments: [],
      generatedAt: '2026-08-22T03:00:00.000Z',
      hasMore: false,
    });
    const { default: app } = await import('./mobile-staff-read-routes.js');

    const response = await app.request('/v1/mobile/teacher/assessments', { headers }, env);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(assessments).toHaveBeenCalledOnce();
  });

  it('returns only explicit teacher conversation reads and rejects malformed ids', async () => {
    conversations.mockResolvedValue({
      conversations: [],
      generatedAt: '2026-08-22T03:00:00.000Z',
      hasMore: false,
    });
    conversationMessages.mockResolvedValue({
      conversationId: '40000000-0000-4000-8000-000000000810',
      studentDisplayName: 'Student One',
      subject: 'Homework support',
      messages: [],
      hasMore: false,
    });
    const { default: app } = await import('./mobile-staff-read-routes.js');

    expect((await app.request('/v1/mobile/teacher/conversations', { headers }, env)).status).toBe(
      200,
    );
    expect(
      (
        await app.request(
          '/v1/mobile/teacher/conversations/40000000-0000-4000-8000-000000000810/messages',
          { headers },
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (await app.request('/v1/mobile/teacher/conversations/not-a-uuid/messages', { headers }, env))
        .status,
    ).toBe(400);
    expect(conversationMessages).toHaveBeenCalledOnce();
  });

  it('rejects query parameters and non-teacher scope before persistence', async () => {
    const { default: app } = await import('./mobile-staff-read-routes.js');
    expect(
      (await app.request('/v1/mobile/teacher/assessments?limit=1', { headers }, env)).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          '/v1/mobile/teacher/conversations',
          { headers: { ...headers, 'x-persona': 'guardian' } },
          env,
        )
      ).status,
    ).toBe(403);
    expect(assessments).not.toHaveBeenCalled();
    expect(conversations).not.toHaveBeenCalled();
  });

  it('maps unauthorized DB scope to 403 and dependency failures to sanitized 503', async () => {
    conversations.mockResolvedValue(undefined);
    assessments.mockRejectedValue(new Error('database secret detail'));
    const { default: app } = await import('./mobile-staff-read-routes.js');

    const denied = await app.request('/v1/mobile/teacher/conversations', { headers }, env);
    expect(denied.status).toBe(403);

    const failed = await app.request('/v1/mobile/teacher/assessments', { headers }, env);
    expect(failed.status).toBe(503);
    await expect(failed.text()).resolves.not.toContain('database secret detail');
  });
});
