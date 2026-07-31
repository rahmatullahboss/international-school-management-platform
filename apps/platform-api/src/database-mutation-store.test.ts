import { describe, expect, it, vi } from 'vitest';

import { DatabaseMutationStore } from './database-mutation-store.js';

const sessionId = '60000000-0000-4000-8000-000000000001';
const commandId = '60000000-0000-4000-8000-000000000002';
const correlationId = '60000000-0000-4000-8000-000000000003';

function databaseWith(rows: readonly Record<string, unknown>[]) {
  return {
    query: vi.fn().mockResolvedValue(rows),
  };
}

describe('database mutation store', () => {
  it('submits the allowlisted command through the atomic database function', async () => {
    const database = databaseWith([
      {
        value: {
          accepted: true,
          replayed: false,
          receipt: {
            commandId,
            commandType: 'runtime.snapshot.refresh',
            state: 'accepted',
            expectedRevision: 7,
            correlationId,
            acceptedAt: '2026-07-31T05:10:00.000Z',
          },
        },
      },
    ]);
    const store = new DatabaseMutationStore(database);

    await expect(
      store.submitRuntimeSnapshotRefresh({
        sessionId,
        idempotencyKey: 'refresh-admin-home-0001',
        expectedRevision: 7,
        reason: 'Refresh after the approved timetable publication.',
        correlationId,
      }),
    ).resolves.toEqual({
      accepted: true,
      replayed: false,
      receipt: {
        commandId,
        commandType: 'runtime.snapshot.refresh',
        state: 'accepted',
        expectedRevision: 7,
        correlationId,
        acceptedAt: '2026-07-31T05:10:00.000Z',
      },
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('platform.submit_runtime_snapshot_refresh'),
      [
        sessionId,
        'refresh-admin-home-0001',
        7,
        'Refresh after the approved timetable publication.',
        correlationId,
      ],
    );
  });

  it('accepts typed replay and conflict decisions only', async () => {
    const replayDatabase = databaseWith([
      {
        value: {
          accepted: true,
          replayed: true,
          receipt: {
            commandId,
            commandType: 'runtime.snapshot.refresh',
            state: 'accepted',
            expectedRevision: 7,
            correlationId,
            acceptedAt: '2026-07-31T05:10:00.000Z',
          },
        },
      },
    ]);
    await expect(
      new DatabaseMutationStore(replayDatabase).submitRuntimeSnapshotRefresh({
        sessionId,
        idempotencyKey: 'refresh-admin-home-0001',
        expectedRevision: 7,
        reason: 'Refresh after the approved timetable publication.',
        correlationId,
      }),
    ).resolves.toMatchObject({ accepted: true, replayed: true });

    const conflictDatabase = databaseWith([
      {
        value: {
          accepted: false,
          reason: 'revision-conflict',
          currentRevision: 8,
        },
      },
    ]);
    await expect(
      new DatabaseMutationStore(conflictDatabase).submitRuntimeSnapshotRefresh({
        sessionId,
        idempotencyKey: 'refresh-admin-home-0002',
        expectedRevision: 7,
        reason: 'Refresh after the approved timetable publication.',
        correlationId,
      }),
    ).resolves.toEqual({
      accepted: false,
      reason: 'revision-conflict',
      currentRevision: 8,
    });
  });

  it('rejects malformed inputs before a database query', async () => {
    const database = databaseWith([]);
    const store = new DatabaseMutationStore(database);

    await expect(
      store.submitRuntimeSnapshotRefresh({
        sessionId: 'not-a-session',
        idempotencyKey: 'refresh-admin-home-0001',
        expectedRevision: 7,
        reason: 'Refresh after publication.',
        correlationId,
      }),
    ).rejects.toThrow(/sessionId/u);
    await expect(
      store.submitRuntimeSnapshotRefresh({
        sessionId,
        idempotencyKey: 'bad key',
        expectedRevision: 7,
        reason: 'Refresh after publication.',
        correlationId,
      }),
    ).rejects.toThrow(/idempotencyKey/u);
    await expect(
      store.submitRuntimeSnapshotRefresh({
        sessionId,
        idempotencyKey: 'refresh-admin-home-0001',
        expectedRevision: 0,
        reason: 'Refresh after publication.',
        correlationId,
      }),
    ).rejects.toThrow(/expectedRevision/u);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('fails closed on malformed or ambiguous database responses', async () => {
    const inputs = {
      sessionId,
      idempotencyKey: 'refresh-admin-home-0001',
      expectedRevision: 7,
      reason: 'Refresh after publication.',
      correlationId,
    } as const;

    await expect(
      new DatabaseMutationStore(databaseWith([])).submitRuntimeSnapshotRefresh(inputs),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseMutationStore(databaseWith([{ value: {} }, { value: {} }])).submitRuntimeSnapshotRefresh(
        inputs,
      ),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseMutationStore(
        databaseWith([{ value: { accepted: false, reason: 'unknown-decision' } }]),
      ).submitRuntimeSnapshotRefresh(inputs),
    ).rejects.toThrow(/invalid database response/u);
    await expect(
      new DatabaseMutationStore(
        databaseWith([
          {
            value: {
              accepted: true,
              replayed: false,
              receipt: {
                commandId: 'bad-id',
                commandType: 'runtime.snapshot.refresh',
                state: 'accepted',
                expectedRevision: 7,
                correlationId,
                acceptedAt: 'not-a-time',
              },
            },
          },
        ]),
      ).submitRuntimeSnapshotRefresh(inputs),
    ).rejects.toThrow(/invalid database response/u);
  });
});
