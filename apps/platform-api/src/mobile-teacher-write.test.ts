import { describe, expect, it } from 'vitest';

import {
  parseTeacherAttendanceWrite,
  parseTeacherGradeDraftWrite,
} from './mobile-teacher-write.js';

describe('mobile teacher write contracts', () => {
  it('accepts an exact attendance batch and rejects finalization authority', () => {
    const parsed = parseTeacherAttendanceWrite(
      JSON.stringify({
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
      }),
    );
    expect(parsed).toEqual({
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
    });

    expect(
      parseTeacherAttendanceWrite(
        JSON.stringify({
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
          finalize: true,
        }),
      ),
    ).toBeUndefined();
  });

  it('accepts exact integer grade drafts and rejects publication or duplicate students', () => {
    const parsed = parseTeacherGradeDraftWrite(
      JSON.stringify({
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
          {
            studentId: '40000000-0000-4000-8000-000000000011',
            status: 'missing',
          },
        ],
      }),
    );
    expect(parsed?.entries).toHaveLength(2);
    expect(parsed?.entries[0]?.scoreUnits).toBe(8750);

    expect(
      parseTeacherGradeDraftWrite(
        JSON.stringify({
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
          publish: true,
        }),
      ),
    ).toBeUndefined();

    expect(
      parseTeacherGradeDraftWrite(
        JSON.stringify({
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
            {
              studentId: '40000000-0000-4000-8000-000000000010',
              status: 'missing',
            },
          ],
        }),
      ),
    ).toBeUndefined();
  });
});
