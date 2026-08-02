import { afterEach, describe, expect, it, vi } from 'vitest';

import { submitProductionOperatorCommand } from './production-operator-command';

const body = {
  command: 'support.break-glass.request' as const,
  reason: 'Investigate the approved tenant-scoped authentication outage.',
  requestedMinutes: 15,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('production operator command browser client', () => {
  it('submits only the command body plus idempotency header and validates receipts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          replayed: false,
          receipt: {
            commandId: '97000000-0000-4000-8000-000000000001',
            domainEvidenceId: '97000000-0000-4000-8000-000000000002',
            acceptedAt: '2026-08-02T01:15:00.000Z',
          },
        }),
        { status: 202, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitProductionOperatorCommand(body, 'support:97000000-0000-4000-8000-000000000003')).resolves.toEqual({
      state: 'accepted',
      replayed: false,
      commandId: '97000000-0000-4000-8000-000000000001',
      evidenceId: '97000000-0000-4000-8000-000000000002',
      acceptedAt: '2026-08-02T01:15:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/auth/v1/operator/commands',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'support:97000000-0000-4000-8000-000000000003',
        },
        body: JSON.stringify(body),
      }),
    );
  });

  it('preserves bounded step-up and revision-conflict metadata', async () => {
    const responses = [
      new Response(
        JSON.stringify({
          error: { code: 'operator_step_up_required', message: 'Fresh AAL2 authentication is required.' },
          requiredAssurance: 'aal2',
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
      new Response(
        JSON.stringify({
          error: { code: 'operator_revision_conflict', message: 'The record changed before this command was applied.' },
          currentVersion: 4,
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    ];
    const fetchMock = vi.fn().mockImplementation(async () => responses.shift());
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitProductionOperatorCommand(body, 'support:step-up-0001')).resolves.toEqual({
      state: 'rejected',
      code: 'operator_step_up_required',
      message: 'Fresh AAL2 authentication is required.',
      requiredAssurance: 'aal2',
    });
    await expect(submitProductionOperatorCommand(body, 'support:revision-0001')).resolves.toEqual({
      state: 'rejected',
      code: 'operator_revision_conflict',
      message: 'The record changed before this command was applied.',
      currentVersion: 4,
    });
  });

  it('fails closed on malformed success payloads and transport errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ schemaVersion: 1, replayed: false, receipt: { commandId: 'secret' } }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(submitProductionOperatorCommand(body, 'support:malformed-0001')).resolves.toEqual({
      state: 'unavailable',
      message: 'The command response could not be verified.',
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('postgres://secret@internal')));
    await expect(submitProductionOperatorCommand(body, 'support:outage-0001')).resolves.toEqual({
      state: 'unavailable',
      message: 'The command service could not be reached.',
    });
  });
});
