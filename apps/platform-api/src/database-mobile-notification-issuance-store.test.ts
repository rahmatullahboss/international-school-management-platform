import { describe, expect, it, vi } from 'vitest';

import { DatabaseMobileNotificationIssuanceStore } from './database-mobile-notification-issuance-store.js';
import type { MobileNotificationIssuanceInput } from './mobile-notification-issuance.js';

const input: MobileNotificationIssuanceInput = {
  accountId: '40000000-0000-4000-8000-000000000004',
  application: 'family',
  campusId: '40000000-0000-4000-8000-000000000003',
  expiresAt: '2026-08-21T16:00:00.000Z',
  kind: 'familyConversation',
  notificationEnvironment: 'development',
  notificationKey: 'family-conversation-notification-0001',
  persona: 'guardian',
  resourceId: '40000000-0000-4000-8000-000000000810',
  tenantId: '40000000-0000-4000-8000-000000000001',
};

function database(payload: unknown) {
  const query = vi.fn().mockResolvedValue([{ payload }]);
  return { query, store: new DatabaseMobileNotificationIssuanceStore({ query } as never) };
}

describe('DatabaseMobileNotificationIssuanceStore', () => {
  it('issues an exact provider-neutral notification request', async () => {
    const { query, store } = database({
      notificationId: '40000000-0000-4000-8000-000000000900',
      status: 'queued',
      targetCount: 2,
      issuedAt: '2026-08-21T15:00:00.000Z',
      expiresAt: input.expiresAt,
    });

    await expect(store.issue(input)).resolves.toEqual({
      notificationId: '40000000-0000-4000-8000-000000000900',
      status: 'queued',
      targetCount: 2,
      issuedAt: '2026-08-21T15:00:00.000Z',
      expiresAt: input.expiresAt,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('platform.issue_mobile_notification'),
      [
        input.tenantId,
        input.campusId,
        input.accountId,
        input.application,
        input.persona,
        input.kind,
        input.resourceId,
        input.notificationEnvironment,
        input.notificationKey,
        input.expiresAt,
      ],
    );
  });

  it('accepts suppression and idempotency conflict but rejects internal delivery fields', async () => {
    await expect(
      database({
        notificationId: '40000000-0000-4000-8000-000000000900',
        status: 'suppressed',
        targetCount: 0,
        issuedAt: '2026-08-21T15:00:00.000Z',
        expiresAt: input.expiresAt,
      }).store.issue(input),
    ).resolves.toMatchObject({ status: 'suppressed', targetCount: 0 });
    await expect(database({ status: 'idempotency-conflict' }).store.issue(input)).resolves.toEqual({
      status: 'idempotency-conflict',
    });
    await expect(
      database({
        notificationId: '40000000-0000-4000-8000-000000000900',
        status: 'queued',
        targetCount: 1,
        issuedAt: '2026-08-21T15:00:00.000Z',
        expiresAt: input.expiresAt,
        deviceSessionId: '40000000-0000-4000-8000-000000000901',
      }).store.issue(input),
    ).rejects.toThrow(/invalid database response/i);
  });

  it('fails closed on malformed result cardinality, fan-out or timestamps', async () => {
    await expect(
      database({
        notificationId: '40000000-0000-4000-8000-000000000900',
        status: 'queued',
        targetCount: 33,
        issuedAt: '2026-08-21T15:00:00.000Z',
        expiresAt: input.expiresAt,
      }).store.issue(input),
    ).rejects.toThrow(/invalid database response/i);
    await expect(
      database({
        notificationId: '40000000-0000-4000-8000-000000000900',
        status: 'queued',
        targetCount: 1,
        issuedAt: '2026-08-21 15:00:00',
        expiresAt: input.expiresAt,
      }).store.issue(input),
    ).rejects.toThrow(/invalid database response/i);

    const query = vi.fn().mockResolvedValue([]);
    const store = new DatabaseMobileNotificationIssuanceStore({ query } as never);
    await expect(store.issue(input)).rejects.toThrow(/invalid database response/i);
  });
});
