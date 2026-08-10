import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadProductionOperatorWorkQueue } from './production-operator-work-queue';

const placement = {
  programId: '99000000-0000-4000-8000-000000000020',
  programName: 'Middle School',
  academicYearId: '99000000-0000-4000-8000-000000000021',
  academicYearName: '2026–27',
  gradeLevelId: '99000000-0000-4000-8000-000000000022',
  gradeLevelLabel: 'Grade 7',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('production operator work queue browser client', () => {
  it('loads and validates the current admissions lifecycle candidate', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 2,
          role: 'admissions',
          items: [
            {
              applicationId: '99000000-0000-4000-8000-000000000010',
              applicationNumber: 'APP-DEMO-0001',
              status: 'under-review',
              version: 2,
              submittedAt: '2026-08-01T08:30:00.000Z',
              action: 'issue-offer',
              placementOptions: [placement],
              offerExpiresAt: null,
              suggestedEffectiveFrom: null,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadProductionOperatorWorkQueue()).resolves.toMatchObject({
      state: 'ready',
      role: 'admissions',
      items: [
        {
          applicationNumber: 'APP-DEMO-0001',
          action: 'issue-offer',
          placementOptions: [{ gradeLevelLabel: 'Grade 7' }],
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith('/auth/v1/operator/work-queue', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
  });

  it('preserves finance bigint minor units as verified strings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            role: 'finance',
            items: [
              {
                bankStatementLineId: '99000000-0000-4000-8000-000000000011',
                bookingDate: '2026-08-01',
                amountMinor: '9007199254740993',
                currency: 'BDT',
                paymentId: '99000000-0000-4000-8000-000000000012',
                paymentReceivedAt: '2026-08-01T09:05:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(loadProductionOperatorWorkQueue()).resolves.toMatchObject({
      state: 'ready',
      role: 'finance',
      items: [{ amountMinor: '9007199254740993' }],
    });
  });

  it('fails closed on malformed admissions placement and stage payloads', async () => {
    const malformedQueues = [
      {
        schemaVersion: 2,
        role: 'admissions',
        items: [
          {
            applicationId: '99000000-0000-4000-8000-000000000010',
            applicationNumber: 'APP-DEMO-0001',
            status: 'under-review',
            version: 2,
            submittedAt: null,
            action: 'issue-offer',
            placementOptions: [],
            offerExpiresAt: null,
            suggestedEffectiveFrom: null,
          },
        ],
      },
      {
        schemaVersion: 2,
        role: 'admissions',
        items: [
          {
            applicationId: '99000000-0000-4000-8000-000000000010',
            applicationNumber: 'APP-DEMO-0001',
            status: 'under-review',
            version: 2,
            submittedAt: null,
            action: 'issue-offer',
            placementOptions: [{ ...placement, gradeLevelId: 'browser-chosen-grade' }],
            offerExpiresAt: null,
            suggestedEffectiveFrom: null,
          },
        ],
      },
      {
        schemaVersion: 2,
        role: 'admissions',
        items: [
          {
            applicationId: '99000000-0000-4000-8000-000000000010',
            applicationNumber: 'APP-DEMO-0001',
            status: 'accepted',
            version: 4,
            submittedAt: null,
            action: 'convert-applicant',
            placementOptions: [],
            offerExpiresAt: null,
            suggestedEffectiveFrom: '2026-02-30',
          },
        ],
      },
    ];

    for (const queue of malformedQueues) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(queue), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      );
      await expect(loadProductionOperatorWorkQueue()).resolves.toEqual({
        state: 'unavailable',
        message: 'The work queue response could not be verified.',
      });
    }
  });

  it('fails closed on malformed finance queues', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            role: 'finance',
            items: [
              {
                bankStatementLineId: 'not-a-uuid',
                bookingDate: '2026-08-01',
                amountMinor: 1500000,
                currency: 'BDT',
                paymentId: 'also-not-a-uuid',
                paymentReceivedAt: '2026-08-01T09:05:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    await expect(loadProductionOperatorWorkQueue()).resolves.toEqual({
      state: 'unavailable',
      message: 'The work queue response could not be verified.',
    });
  });

  it('bounds denied responses and transport failures', async () => {
    const responses = [
      new Response(
        JSON.stringify({
          error: {
            code: 'operator_work_queue_denied',
            message: 'No operator work queue is available.',
          },
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => responses.shift()),
    );
    await expect(loadProductionOperatorWorkQueue()).resolves.toEqual({
      state: 'denied',
      message: 'No operator work queue is available.',
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('postgresql://secret@internal')));
    await expect(loadProductionOperatorWorkQueue()).resolves.toEqual({
      state: 'unavailable',
      message: 'The work queue could not be reached.',
    });
  });
});
