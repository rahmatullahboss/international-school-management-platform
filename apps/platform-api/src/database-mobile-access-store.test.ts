import { describe, expect, it, vi } from 'vitest';

import type { HttpDatabase } from '@school/database';

import { DatabaseMobileAccessStore } from './database-mobile-access-store.js';

const identity = {
  issuer: 'https://identity.school.test',
  subject: 'provider-mobile-user-1',
};

function database(rows: Record<string, unknown>[]): {
  readonly client: HttpDatabase;
  readonly query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn(() => Promise.resolve(rows));
  return { client: { query: query as unknown as HttpDatabase['query'] }, query };
}

describe('DatabaseMobileAccessStore', () => {
  it('groups only validated account tenant campus persona capabilities', async () => {
    const db = database([
      {
        accountId: '40000000-0000-4000-8000-000000000001',
        tenantId: '40000000-0000-4000-8000-000000000002',
        tenantName: 'International School',
        campusId: '40000000-0000-4000-8000-000000000003',
        campusName: 'Main Campus',
        timeZone: 'Asia/Dhaka',
        persona: 'guardian',
        capabilities: [
          'attendance.read',
          'billing.read',
          'documents.read',
          'forms.consent',
          'grades.read.published',
          'messages.read',
          'messages.send',
          'timetable.read',
        ],
      },
      {
        accountId: '40000000-0000-4000-8000-000000000001',
        tenantId: '40000000-0000-4000-8000-000000000002',
        tenantName: 'International School',
        campusId: '40000000-0000-4000-8000-000000000003',
        campusName: 'Main Campus',
        timeZone: 'Asia/Dhaka',
        persona: 'student',
        capabilities: [
          'attendance.read',
          'documents.read',
          'grades.read.published',
          'messages.read',
          'messages.send',
          'timetable.read',
        ],
      },
    ]);

    const store = new DatabaseMobileAccessStore(db.client);
    await expect(store.loadBootstrap(identity)).resolves.toEqual({
      accountId: '40000000-0000-4000-8000-000000000001',
      locale: 'en',
      schools: [
        {
          tenantId: '40000000-0000-4000-8000-000000000002',
          tenantName: 'International School',
          campuses: [
            {
              campusId: '40000000-0000-4000-8000-000000000003',
              campusName: 'Main Campus',
              timeZone: 'Asia/Dhaka',
              personas: [
                {
                  persona: 'guardian',
                  capabilities: [
                    'attendance.read',
                    'billing.read',
                    'documents.read',
                    'forms.consent',
                    'grades.read.published',
                    'messages.read',
                    'messages.send',
                    'timetable.read',
                  ],
                },
                {
                  persona: 'student',
                  capabilities: [
                    'attendance.read',
                    'documents.read',
                    'grades.read.published',
                    'messages.read',
                    'messages.send',
                    'timetable.read',
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('resolve_mobile_bootstrap_access'),
      [identity.issuer, identity.subject],
    );
  });

  it('returns undefined when the identity has no active mobile access', async () => {
    const store = new DatabaseMobileAccessStore(database([]).client);
    await expect(store.loadBootstrap(identity)).resolves.toBeUndefined();
  });

  it('rejects arbitrary capabilities and inconsistent account identity', async () => {
    const invalidCapability = new DatabaseMobileAccessStore(
      database([
        {
          accountId: '40000000-0000-4000-8000-000000000001',
          tenantId: '40000000-0000-4000-8000-000000000002',
          tenantName: 'International School',
          campusId: '40000000-0000-4000-8000-000000000003',
          campusName: 'Main Campus',
          timeZone: 'Asia/Dhaka',
          persona: 'guardian',
          capabilities: ['attendance.take'],
        },
      ]).client,
    );
    await expect(invalidCapability.loadBootstrap(identity)).rejects.toThrow(
      'Mobile access resolution returned an invalid database response.',
    );

    const inconsistentAccount = new DatabaseMobileAccessStore(
      database([
        {
          accountId: '40000000-0000-4000-8000-000000000001',
          tenantId: '40000000-0000-4000-8000-000000000002',
          tenantName: 'International School',
          campusId: '40000000-0000-4000-8000-000000000003',
          campusName: 'Main Campus',
          timeZone: 'Asia/Dhaka',
          persona: 'guardian',
          capabilities: ['attendance.read'],
        },
        {
          accountId: '40000000-0000-4000-8000-000000000009',
          tenantId: '40000000-0000-4000-8000-000000000004',
          tenantName: 'Other School',
          campusId: '40000000-0000-4000-8000-000000000005',
          campusName: 'Other Campus',
          timeZone: 'Asia/Kolkata',
          persona: 'student',
          capabilities: ['attendance.read'],
        },
      ]).client,
    );
    await expect(inconsistentAccount.loadBootstrap(identity)).rejects.toThrow(
      'Mobile access resolution returned an invalid database response.',
    );
  });
});
