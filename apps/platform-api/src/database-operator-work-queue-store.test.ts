import { describe, expect, it, vi } from 'vitest';

import { DatabaseOperatorWorkQueueStore } from './database-operator-work-queue-store.js';

const sessionId = '98000000-0000-4000-8000-000000000001';

function databaseWith(rows: unknown[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

const placement = {
  programId: '98000000-0000-4000-8000-000000000020',
  programName: 'Middle School',
  academicYearId: '98000000-0000-4000-8000-000000000021',
  academicYearName: '2026–27',
  gradeLevelId: '98000000-0000-4000-8000-000000000022',
  gradeLevelLabel: 'Grade 7',
};

describe('database operator work queue store', () => {
  it('validates the server-owned admissions lifecycle work queue', async () => {
    const database = databaseWith([
      {
        queue: {
          schemaVersion: 2,
          role: 'admissions',
          items: [
            {
              applicationId: '98000000-0000-4000-8000-000000000002',
              applicationNumber: 'APP-DEMO-0001',
              status: 'under-review',
              version: 2,
              submittedAt: '2026-08-01T08:30:00.000Z',
              action: 'issue-offer',
              placementOptions: [placement],
              offerExpiresAt: null,
              suggestedEffectiveFrom: null,
              effectiveFromMax: null,
            },
          ],
        },
      },
    ]);
    const store = new DatabaseOperatorWorkQueueStore(database);

    await expect(store.resolveAdmissions(sessionId)).resolves.toMatchObject({
      schemaVersion: 2,
      role: 'admissions',
      items: [
        {
          applicationNumber: 'APP-DEMO-0001',
          action: 'issue-offer',
          placementOptions: [{ gradeLevelLabel: 'Grade 7' }],
        },
      ],
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.resolve_admissions_lifecycle_work_queue'),
      [sessionId],
    );
  });

  it('preserves finance bigint minor units through the legacy resolver', async () => {
    const store = new DatabaseOperatorWorkQueueStore(
      databaseWith([
        {
          queue: {
            schemaVersion: 1,
            role: 'finance',
            items: [
              {
                bankStatementLineId: '98000000-0000-4000-8000-000000000003',
                bookingDate: '2026-08-01',
                amountMinor: '9007199254740993',
                currency: 'BDT',
                paymentId: '98000000-0000-4000-8000-000000000004',
                paymentReceivedAt: '2026-08-01T09:05:00.000Z',
              },
            ],
          },
        },
      ]),
    );
    await expect(store.resolve(sessionId)).resolves.toMatchObject({
      role: 'finance',
      items: [{ amountMinor: '9007199254740993' }],
    });
  });

  it('returns undefined when database scope resolves no queue', async () => {
    const store = new DatabaseOperatorWorkQueueStore(databaseWith([{ queue: null }]));
    await expect(store.resolveAdmissions(sessionId)).resolves.toBeUndefined();
  });

  it('fails closed on malformed admissions lifecycle stages and placements', async () => {
    const malformed = [
      {
        schemaVersion: 2,
        role: 'admissions',
        items: [
          {
            applicationId: '98000000-0000-4000-8000-000000000002',
            applicationNumber: 'APP-DEMO-0001',
            status: 'under-review',
            version: 2,
            submittedAt: null,
            action: 'issue-offer',
            placementOptions: [],
            offerExpiresAt: null,
            suggestedEffectiveFrom: null,
            effectiveFromMax: null,
          },
        ],
      },
      {
        schemaVersion: 2,
        role: 'admissions',
        items: [
          {
            applicationId: '98000000-0000-4000-8000-000000000002',
            applicationNumber: 'APP-DEMO-0001',
            status: 'accepted',
            version: 4,
            submittedAt: null,
            action: 'convert-applicant',
            placementOptions: [],
            offerExpiresAt: null,
            suggestedEffectiveFrom: '2026-02-30',
            effectiveFromMax: '2027-06-30',
          },
        ],
      },
      {
        schemaVersion: 2,
        role: 'admissions',
        items: [
          {
            applicationId: '98000000-0000-4000-8000-000000000002',
            applicationNumber: 'APP-DEMO-0001',
            status: 'under-review',
            version: 2,
            submittedAt: null,
            action: 'issue-offer',
            placementOptions: [{ ...placement, gradeLevelId: 'not-a-uuid' }],
            offerExpiresAt: null,
            suggestedEffectiveFrom: null,
            effectiveFromMax: null,
          },
        ],
      },
    ];

    for (const queue of malformed) {
      const store = new DatabaseOperatorWorkQueueStore(databaseWith([{ queue }]));
      await expect(store.resolveAdmissions(sessionId)).rejects.toThrow(/invalid/u);
    }
  });

  it('fails closed on malformed legacy queue rows', async () => {
    const malformedRows: unknown[][] = [
      [],
      [{ queue: { schemaVersion: 1, role: 'support', items: [] } }],
      [
        {
          queue: {
            schemaVersion: 1,
            role: 'finance',
            items: [
              {
                bankStatementLineId: '98000000-0000-4000-8000-000000000003',
                bookingDate: '2026-08-01',
                amountMinor: 1500000,
                currency: 'BDT',
                paymentId: '98000000-0000-4000-8000-000000000004',
                paymentReceivedAt: '2026-08-01T09:05:00.000Z',
              },
            ],
          },
        },
      ],
    ];

    for (const rows of malformedRows) {
      const store = new DatabaseOperatorWorkQueueStore(databaseWith(rows));
      await expect(store.resolve(sessionId)).rejects.toThrow(/invalid|unsupported/u);
    }
  });

  it('rejects malformed session identifiers before database access', async () => {
    const database = databaseWith([]);
    const store = new DatabaseOperatorWorkQueueStore(database);
    await expect(store.resolveAdmissions('not-a-session')).rejects.toThrow(/UUID/u);
    await expect(store.resolve('not-a-session')).rejects.toThrow(/UUID/u);
    expect(database.query).not.toHaveBeenCalled();
  });
});
