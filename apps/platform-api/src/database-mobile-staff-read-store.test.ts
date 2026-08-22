import { describe, expect, it, vi } from 'vitest';

import { DatabaseMobileStaffReadStore } from './database-mobile-staff-read-store.js';

const identity = { issuer: 'https://identity.school.test', subject: 'provider-mobile-teacher-1' };
const scope = {
  tenantId: '40000000-0000-4000-8000-000000000001',
  campusId: '40000000-0000-4000-8000-000000000003',
  persona: 'teacher' as const,
};

describe('DatabaseMobileStaffReadStore', () => {
  it('queries the bounded assessment read function and strips no reviewed fields', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        payload: {
          generatedAt: '2026-08-22T03:00:00.000Z',
          hasMore: false,
          assessments: [
            {
              assessmentId: '40000000-0000-4000-8000-000000000701',
              sectionId: '40000000-0000-4000-8000-000000000064',
              sectionLabel: 'Grade 5A',
              subjectLabel: 'Mathematics',
              assessmentTitle: 'Fractions quiz',
              categoryLabel: 'Quiz',
              dueAt: '2026-08-23T03:00:00.000Z',
              state: 'published',
              lockState: 'open',
              version: 3,
              scoreScale: 100,
              maximumScoreUnits: 2000,
              rosterCount: 24,
              enteredCount: 12,
            },
          ],
        },
      },
    ]);
    const store = new DatabaseMobileStaffReadStore({ query } as never);

    const payload = await store.assessments(identity, scope);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('platform.resolve_mobile_teacher_assessments'),
      [identity.issuer, identity.subject, scope.tenantId, scope.campusId],
    );
    expect(payload?.assessments).toHaveLength(1);
  });

  it('rejects internal fields in conversation responses', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        payload: {
          generatedAt: '2026-08-22T03:00:00.000Z',
          hasMore: false,
          conversations: [
            {
              conversationId: '40000000-0000-4000-8000-000000000810',
              studentId: '40000000-0000-4000-8000-000000000013',
              studentDisplayName: 'Student One',
              subject: 'Homework support',
              latestMessageAt: '2026-08-22T02:55:00.000Z',
              canReply: true,
              personId: '40000000-0000-4000-8000-000000000056',
            },
          ],
        },
      },
    ]);
    const store = new DatabaseMobileStaffReadStore({ query } as never);

    await expect(store.conversations(identity, scope)).rejects.toThrow('invalid database response');
  });

  it('fails closed on malformed message cardinality and validates conversation ids', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const store = new DatabaseMobileStaffReadStore({ query } as never);

    await expect(
      store.conversationMessages(identity, scope, '40000000-0000-4000-8000-000000000810'),
    ).rejects.toThrow('invalid database response');
    await expect(store.conversationMessages(identity, scope, 'not-a-uuid')).rejects.toThrow(
      'identifier is invalid',
    );
  });
});
