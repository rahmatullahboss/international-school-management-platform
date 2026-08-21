import { describe, expect, it, vi } from 'vitest';

import { DatabaseMobileFamilyConversationStore } from './database-mobile-family-conversation-store.js';

const identity = { issuer: 'https://identity.school.test', subject: 'guardian-user' };
const scope = {
  tenantId: '40000000-0000-4000-8000-000000000001',
  campusId: '40000000-0000-4000-8000-000000000003',
  persona: 'guardian' as const,
};
const studentId = '40000000-0000-4000-8000-000000000010';
const conversationId = '40000000-0000-4000-8000-000000000020';
const messageId = '40000000-0000-4000-8000-000000000030';
const cursor = '20260821123456789.40000000-0000-4000-8000-000000000040';

function database(payload: unknown) {
  const query = vi.fn().mockResolvedValue([{ payload }]);
  return { query, store: new DatabaseMobileFamilyConversationStore({ query } as never) };
}

describe('DatabaseMobileFamilyConversationStore', () => {
  it('calls the scoped Family conversation directory function and validates exact summaries', async () => {
    const { query, store } = database({
      conversations: [
        {
          conversationId,
          subject: 'Class updates',
          unreadCount: 2,
          latestMessageAt: '2026-08-21T12:34:56.789Z',
        },
      ],
      nextCursor: cursor,
    });
    await expect(
      store.listConversations(identity, scope, studentId, undefined, 25),
    ).resolves.toEqual({
      conversations: [
        {
          conversationId,
          subject: 'Class updates',
          unreadCount: 2,
          latestMessageAt: '2026-08-21T12:34:56.789Z',
        },
      ],
      nextCursor: cursor,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('platform.resolve_mobile_family_conversations'),
      [
        identity.issuer,
        identity.subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        studentId,
        null,
        25,
      ],
    );
  });

  it('loads exact paginated messages without accepting response scope drift', async () => {
    const { store } = database({
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
    });
    await expect(
      store.listMessages(identity, scope, conversationId, cursor, 50),
    ).resolves.toMatchObject({
      conversationId,
      messages: [{ messageId, authorLabel: 'Teacher One' }],
    });

    const drift = database({ conversationId: studentId, messages: [], nextCursor: null }).store;
    await expect(
      drift.listMessages(identity, scope, conversationId, undefined, 50),
    ).rejects.toThrow(/invalid database response/i);
  });

  it('sends an idempotent message and returns only the safe message contract', async () => {
    const { query, store } = database({
      messageId,
      authorLabel: 'Guardian Tester',
      body: 'Thank you.',
      sentAt: '2026-08-21T12:35:56.789Z',
    });
    await expect(
      store.sendMessage(identity, scope, conversationId, 'family-message-idempotency-0001', {
        body: 'Thank you.',
      }),
    ).resolves.toEqual({
      messageId,
      authorLabel: 'Guardian Tester',
      body: 'Thank you.',
      sentAt: '2026-08-21T12:35:56.789Z',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('platform.send_mobile_family_conversation_message'),
      [
        identity.issuer,
        identity.subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        conversationId,
        'Thank you.',
        'family-message-idempotency-0001',
      ],
    );
  });

  it('records an explicit idempotent read receipt', async () => {
    const { query, store } = database({ acceptedRevision: 4 });
    await expect(
      store.markRead(identity, scope, conversationId, 'family-read-idempotency-0001', {
        messageId,
      }),
    ).resolves.toEqual({ acceptedRevision: 4 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('platform.mark_mobile_family_conversation_read'),
      [
        identity.issuer,
        identity.subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        conversationId,
        messageId,
        'family-read-idempotency-0001',
      ],
    );
  });

  it('fails closed on unexpected database fields and explicit mutation conflicts', async () => {
    const leaked = database({
      messageId,
      authorLabel: 'Teacher One',
      body: 'Hello',
      sentAt: '2026-08-21T12:34:56.789Z',
      authorPersonId: '40000000-0000-4000-8000-000000000099',
    }).store;
    await expect(
      leaked.sendMessage(identity, scope, conversationId, 'family-message-idempotency-0002', {
        body: 'Hello',
      }),
    ).rejects.toThrow(/invalid database response/i);

    const conflict = database({ status: 'idempotency-conflict' }).store;
    await expect(
      conflict.markRead(identity, scope, conversationId, 'family-read-idempotency-0002', {
        messageId,
      }),
    ).resolves.toEqual({ status: 'idempotency-conflict' });
  });
});
