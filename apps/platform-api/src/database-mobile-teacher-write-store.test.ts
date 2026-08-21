import { describe, expect, it, vi } from 'vitest';

import { DatabaseMobileTeacherWriteStore } from './database-mobile-teacher-write-store.js';

describe('database mobile teacher write store', () => {
  it('submits attendance through the scoped function and validates the receipt', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        payload: {
          operationId: 'attendance-operation-0001',
          acceptedRevision: 8,
          status: 'accepted',
        },
      },
    ]);
    const store = new DatabaseMobileTeacherWriteStore({ query });

    await expect(
      store.submitAttendance(
        { issuer: 'https://identity.school.test', subject: 'teacher-user' },
        {
          tenantId: '40000000-0000-4000-8000-000000000002',
          campusId: '40000000-0000-4000-8000-000000000003',
          persona: 'teacher',
        },
        'attendance-idempotency-0001',
        {
          operationId: 'attendance-operation-0001',
          meetingId: '40000000-0000-4000-8000-000000000020',
          baseVersion: 7,
          clientCreatedAt: '2026-08-21T09:00:00.000Z',
          lines: [
            {
              studentId: '40000000-0000-4000-8000-000000000010',
              mark: 'present',
            },
          ],
        },
      ),
    ).resolves.toEqual({
      operationId: 'attendance-operation-0001',
      acceptedRevision: 8,
      status: 'accepted',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('submit_mobile_teacher_attendance'),
      expect.arrayContaining([
        'https://identity.school.test',
        'teacher-user',
        '40000000-0000-4000-8000-000000000002',
        '40000000-0000-4000-8000-000000000003',
        'attendance-idempotency-0001',
      ]),
    );
  });

  it('fails closed on unexpected receipt fields', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        payload: {
          operationId: 'grade-operation-0001',
          acceptedRevision: 4,
          status: 'accepted',
          publish: true,
        },
      },
    ]);
    const store = new DatabaseMobileTeacherWriteStore({ query });

    await expect(
      store.saveGradeDraft(
        { issuer: 'https://identity.school.test', subject: 'teacher-user' },
        {
          tenantId: '40000000-0000-4000-8000-000000000002',
          campusId: '40000000-0000-4000-8000-000000000003',
          persona: 'teacher',
        },
        'grade-idempotency-0001',
        '40000000-0000-4000-8000-000000000040',
        {
          operationId: 'grade-operation-0001',
          baseVersion: 3,
          scoreScale: 100,
          maximumScoreUnits: 10000,
          entries: [
            {
              studentId: '40000000-0000-4000-8000-000000000010',
              status: 'scored',
              scoreUnits: 8750,
            },
          ],
        },
      ),
    ).rejects.toThrow('invalid database response');
  });
});
