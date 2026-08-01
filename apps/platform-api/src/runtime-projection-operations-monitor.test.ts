import { describe, expect, it, vi } from 'vitest';

import {
  readRuntimeProjectionOperationsSnapshot,
  type RuntimeProjectionOperationsMonitorStore,
} from './runtime-projection-operations-monitor.js';

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
    schemaVersion: 1 as const,
    tenantId,
    health: 'warning' as const,
    generatedAt: '2026-08-01T02:10:00.000Z',
    controls: {
      exactEventAllowlist: true as const,
      tenantScoped: true as const,
      payloadRedacted: true as const,
      functionOnlyAccess: true as const,
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

function storeWith(result: unknown) {
  const read = vi.fn().mockResolvedValue(result);
  const store: RuntimeProjectionOperationsMonitorStore = { read };
  return { read, store };
}

describe('runtime projection operations monitor', () => {
  it('reads one validated tenant-scoped redacted operations snapshot', async () => {
    const expected = snapshot();
    const { read, store } = storeWith(expected);

    await expect(
      readRuntimeProjectionOperationsSnapshot({ configured: true, input: input(), store }),
    ).resolves.toEqual({ ok: true, snapshot: expected });
    expect(read).toHaveBeenCalledWith(input());
  });

  it('stays disabled without an explicitly configured privileged monitor', async () => {
    const { read, store } = storeWith(snapshot());
    await expect(
      readRuntimeProjectionOperationsSnapshot({ configured: false, input: input(), store }),
    ).resolves.toEqual({ ok: false, reason: 'monitor-disabled' });
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects malformed or caller-expanded monitoring inputs before storage', async () => {
    const { read, store } = storeWith(snapshot());
    const invalidInputs = [
      { ...input(), tenantId: 'browser-selected-tenant' },
      { ...input(), warningAgeSeconds: 59 },
      { ...input(), warningAgeSeconds: 86_401 },
      { ...input(), warningAgeSeconds: 300.5 },
      { ...input(), staleSourceSeconds: 299 },
      { ...input(), staleSourceSeconds: 604_801 },
      { ...input(), staleSourceSeconds: Number.POSITIVE_INFINITY },
      { ...input(), campusId: '50000000-0000-4000-8000-000000000002' },
      { ...input(), includePayloads: true },
      { ...input(), membershipId: '50000000-0000-4000-8000-000000000003' },
    ];

    for (const candidate of invalidInputs) {
      await expect(
        readRuntimeProjectionOperationsSnapshot({ configured: true, input: candidate, store }),
      ).resolves.toEqual({ ok: false, reason: 'invalid-monitor-request' });
    }
    expect(read).not.toHaveBeenCalled();
  });

  it('sanitizes privileged monitor outages', async () => {
    const read = vi
      .fn()
      .mockRejectedValue(new Error('postgres://secret@database.internal/projection-monitor'));
    const store: RuntimeProjectionOperationsMonitorStore = { read };

    await expect(
      readRuntimeProjectionOperationsSnapshot({ configured: true, input: input(), store }),
    ).resolves.toEqual({ ok: false, reason: 'monitor-unavailable' });
  });
});
