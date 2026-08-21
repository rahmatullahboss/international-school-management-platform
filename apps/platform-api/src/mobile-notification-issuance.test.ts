import { describe, expect, it } from 'vitest';

import {
  parseMobileNotificationIssuance,
  type MobileNotificationIssuanceInput,
} from './mobile-notification-issuance.js';

const base = {
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
} as const;

describe('mobile notification issuance contract', () => {
  const now = new Date('2026-08-21T15:00:00.000Z');

  it('accepts the exact privacy-minimised internal issuance shape', () => {
    const parsed = parseMobileNotificationIssuance(JSON.stringify(base), now);

    expect(parsed).toEqual(base satisfies MobileNotificationIssuanceInput);
  });

  it('rejects display/provider extras and invalid lifetime/application policy', () => {
    expect(
      parseMobileNotificationIssuance(JSON.stringify({ ...base, body: 'forbidden-field' }), now),
    ).toBeUndefined();
    expect(
      parseMobileNotificationIssuance(
        JSON.stringify({ ...base, providerOpaque: 'forbidden-field' }),
        now,
      ),
    ).toBeUndefined();
    expect(
      parseMobileNotificationIssuance(JSON.stringify({ ...base, application: 'staff' }), now),
    ).toBeUndefined();
    expect(
      parseMobileNotificationIssuance(
        JSON.stringify({ ...base, expiresAt: '2026-08-23T16:00:00.000Z' }),
        now,
      ),
    ).toBeUndefined();
  });

  it('allows resource identifiers only for forms and conversations', () => {
    expect(
      parseMobileNotificationIssuance(
        JSON.stringify({ ...base, kind: 'familyAttendance', resourceId: null }),
        now,
      ),
    ).toMatchObject({ kind: 'familyAttendance', resourceId: null });
    expect(
      parseMobileNotificationIssuance(JSON.stringify({ ...base, kind: 'familyAttendance' }), now),
    ).toBeUndefined();
    expect(
      parseMobileNotificationIssuance(
        JSON.stringify({ ...base, kind: 'familyAttendance', resourceId: 'student-1' }),
        now,
      ),
    ).toBeUndefined();
  });
});
