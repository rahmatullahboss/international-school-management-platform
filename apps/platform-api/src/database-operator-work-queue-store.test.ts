import { describe, expect, it, vi } from 'vitest';

import { DatabaseOperatorWorkQueueStore } from './database-operator-work-queue-store.js';

const sessionId = '98000000-0000-4000-8000-000000000001';

function databaseWith(rows: unknown[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database operator work queue store', () => {
  it('validates a bounded admissions work queue', async () => {
    const database = databaseWith([
      {
        queue: {
          schemaVersion: 1,
          role: 'admissions',
          items: [
            {
              applicationId: '98000000-0000-4000-8000-000000000002',
              applicationNumber: 'APP-DEMO-0001',
              status: 'submitted',
              version: 1,
              submittedAt: '2026-08-01T08:30:00.000Z',
            },
          ],
        },
      },
    ]);
    const store = new DatabaseOperatorWorkQueueStore(database);

    await expect(store.resolve(sessionId)).resolves.toMatchObject({
      schemaVersion: 1,
      role: 'admissions',
      items: [{ applicationNumber: 'APP-DEMO-0001', version: 1 }],
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.resolve_operator_work_queue'),
      [sessionId],
    );
  });

  it('preserves finance bigint minor units as strings', async () => {
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
    await expect(store.resolve(sessionId)).resolves.toBeUndefined();
  });

  it.each([
    [],
    [{ queue: { schemaVersion: 2, role: 'admissions', items: [] } }],
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
  ])('fails closed on malformed queue rows', async (rows) => {
    const store = new DatabaseOperatorWorkQueueStore(databaseWith(rows));
    await expect(store.resolve(sessionId)).rejects.toThrow(/invalid/u);
  });

  it('rejects malformed session identifiers before database access', async () => {
    const database = databaseWith([]);
    const store = new DatabaseOperatorWorkQueueStore(database);
    await expect(store.resolve('not-a-session')).rejects.toThrow(/UUID/u);
    expect(database.query).not.toHaveBeenCalled();
  });
});
