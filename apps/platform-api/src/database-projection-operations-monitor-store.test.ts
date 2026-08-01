import { describe, expect, it, vi } from 'vitest';

import { DatabaseProjectionOperationsMonitorStore } from './database-projection-operations-monitor-store.js';

const tenantId = '50000000-0000-4000-8000-000000000001';

function input() {
  return {
    tenantId,
    warningAgeSeconds: 300,
    staleSourceSeconds: 3600,
  } as const;
}

function snapshot() {
  return {
    schemaVersion: 1,
    tenantId,
    health: 'warning',
    generatedAt: '2026-08-01T02:10:00.000Z',
    controls: {
      exactEventAllowlist: true,
      tenantScoped: true,
      payloadRedacted: true,
      functionOnlyAccess: true,
    },
    backlog: {
      eligible: 2,
      retryScheduled: 1,
      oldestEligibleSeconds: 420,
    },
    delivery: {
      appliedLastHour: 3,
      deadLetterTotal: 5,
      deadLettersLast24Hours: 1,
      byCode: {
        invalidEvent: 0,
        sourceUnavailable: 1,
        projectionStateConflict: 0,
        processorError: 0,
      },
    },
    sources: {
      current: 4,
      stale: 1,
      unapplied: 1,
      missingForMappedMemberships: 2,
    },
    mappings: {
      activeUnique: 6,
      unmapped: 1,
      ambiguous: 0,
    },
  };
}

function databaseWith(rows: readonly Record<string, unknown>[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database projection operations monitor store', () => {
  it('calls the reviewed privileged tenant operations function', async () => {
    const expected = snapshot();
    const database = databaseWith([{ value: expected }]);
    const store = new DatabaseProjectionOperationsMonitorStore(database);

    await expect(store.read(input())).resolves.toEqual(expected);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.read_runtime_projection_operations_snapshot'),
      [tenantId, 300, 3600],
    );
  });

  it('accepts healthy and critical snapshots with bounded integer counters', async () => {
    const healthy = {
      ...snapshot(),
      health: 'healthy',
      backlog: { eligible: 0, retryScheduled: 0, oldestEligibleSeconds: 0 },
      delivery: {
        ...snapshot().delivery,
        deadLettersLast24Hours: 0,
        byCode: {
          invalidEvent: 0,
          sourceUnavailable: 0,
          projectionStateConflict: 0,
          processorError: 0,
        },
      },
      sources: { current: 4, stale: 0, unapplied: 0, missingForMappedMemberships: 0 },
      mappings: { activeUnique: 4, unmapped: 0, ambiguous: 0 },
    };
    await expect(
      new DatabaseProjectionOperationsMonitorStore(databaseWith([{ value: healthy }])).read(
        input(),
      ),
    ).resolves.toEqual(healthy);

    const critical = { ...snapshot(), health: 'critical' };
    await expect(
      new DatabaseProjectionOperationsMonitorStore(databaseWith([{ value: critical }])).read(
        input(),
      ),
    ).resolves.toEqual(critical);
  });

  it('fails closed on malformed, secret-bearing or ambiguous database responses', async () => {
    const invalidValues = [
      [],
      [{ value: snapshot() }, { value: snapshot() }],
      [{ value: { ...snapshot(), tenantId: 'cross-tenant' } }],
      [{ value: { ...snapshot(), health: 'unknown' } }],
      [
        {
          value: {
            ...snapshot(),
            controls: { ...snapshot().controls, payloadRedacted: false },
          },
        },
      ],
      [{ value: { ...snapshot(), backlog: { ...snapshot().backlog, eligible: -1 } } }],
      [{ value: { ...snapshot(), payload: { secret: 'leaked' } } }],
      [{ value: { ...snapshot(), databaseUrl: 'postgres://secret@database.internal' } }],
    ];

    for (const rows of invalidValues) {
      await expect(
        new DatabaseProjectionOperationsMonitorStore(databaseWith(rows)).read(input()),
      ).rejects.toThrow(/invalid database response/u);
    }
  });
});
