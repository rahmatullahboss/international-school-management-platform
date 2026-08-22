import { describe, expect, it, vi } from 'vitest';

import { DatabaseMobileStaffConversationStore } from './database-mobile-staff-conversation-store.js';

const identity = { issuer: 'https://identity.school.test', subject: 'teacher-subject' };
const scope = {
  tenantId: '40000000-0000-4000-8000-000000000001',
  campusId: '40000000-0000-4000-8000-000000000003',
  persona: 'teacher' as const,
};
const conversationId = '40000000-0000-4000-8000-000000000810';
const messageId = '40000000-0000-4000-8000-000000000811';
const idempotencyKey = 'teacher-message-idempotency-0001';

describe('DatabaseMobileStaffConversationStore', () => {
  it('validates the exact send response and query arguments', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        timeZoneId: 'Asia/Dhaka',
        payload: {
          messageId,
          authorLabel: 'Teacher One',
          body: 'Please review this.',
          sentAt: '2026-08-22T04:00:00.000Z',
        },
      },
    ]);
    const store = new DatabaseMobileStaffConversationStore({ query } as never);

    await expect(
      store.sendMessage(identity, scope, conversationId, idempotencyKey, {
        body: 'Please review this.',
      }),
    ).resolves.toEqual({
      messageId,
      authorLabel: 'Teacher One',
      body: 'Please review this.',
      sentAt: '2026-08-22T10:00:00.000+06:00',
      timeZoneId: 'Asia/Dhaka',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('send_mobile_teacher_conversation_message'),
      [
        identity.issuer,
        identity.subject,
        scope.tenantId,
        scope.campusId,
        conversationId,
        'Please review this.',
        idempotencyKey,
      ],
    );
  });

  it('fails closed when send timestamp timezone metadata is absent', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        payload: {
          messageId,
          authorLabel: 'Teacher One',
          body: 'Please review this.',
          sentAt: '2026-08-22T04:00:00.000Z',
        },
      },
    ]);
    const store = new DatabaseMobileStaffConversationStore({ query } as never);

    await expect(
      store.sendMessage(identity, scope, conversationId, idempotencyKey, {
        body: 'Please review this.',
      }),
    ).rejects.toThrow('invalid school timestamp metadata');
  });

  it('accepts only bounded mutation statuses and read receipts', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ payload: { status: 'locked' } }])
      .mockResolvedValueOnce([{ payload: { acceptedRevision: 4 } }]);
    const store = new DatabaseMobileStaffConversationStore({ query } as never);

    await expect(
      store.sendMessage(identity, scope, conversationId, idempotencyKey, { body: 'Hello' }),
    ).resolves.toEqual({ status: 'locked' });
    await expect(
      store.markRead(identity, scope, conversationId, idempotencyKey, { messageId }),
    ).resolves.toEqual({ acceptedRevision: 4 });
  });

  it('fails closed on malformed or unexpected database responses', async () => {
    const malformed = new DatabaseMobileStaffConversationStore({
      query: vi.fn().mockResolvedValue([
        {
          timeZoneId: 'Asia/Dhaka',
          payload: {
            messageId,
            authorLabel: 'Teacher One',
            body: 'Hello',
            sentAt: '2026-08-22T04:00:00.000Z',
            internalPersonId: 'secret',
          },
        },
      ]),
    } as never);
    const badStatus = new DatabaseMobileStaffConversationStore({
      query: vi.fn().mockResolvedValue([{ payload: { status: 'published' } }]),
    } as never);

    await expect(
      malformed.sendMessage(identity, scope, conversationId, idempotencyKey, { body: 'Hello' }),
    ).rejects.toThrow('invalid database response');
    await expect(
      badStatus.markRead(identity, scope, conversationId, idempotencyKey, { messageId }),
    ).rejects.toThrow('invalid database response');
  });

  it('rejects invalid scope, ids, idempotency keys and body before the database', async () => {
    const query = vi.fn();
    const store = new DatabaseMobileStaffConversationStore({ query } as never);

    await expect(
      store.sendMessage(
        identity,
        { ...scope, persona: 'guardian' } as never,
        conversationId,
        idempotencyKey,
        {
          body: 'Hello',
        },
      ),
    ).rejects.toThrow('scope is invalid');
    await expect(
      store.sendMessage(identity, scope, conversationId, 'short', { body: 'Hello' }),
    ).rejects.toThrow('idempotency key is invalid');
    await expect(
      store.sendMessage(identity, scope, conversationId, idempotencyKey, { body: ' hello ' }),
    ).rejects.toThrow('message is invalid');
    await expect(
      store.markRead(identity, scope, conversationId, idempotencyKey, { messageId: 'bad' }),
    ).rejects.toThrow('read receipt is invalid');
    expect(query).not.toHaveBeenCalled();
  });
});
