import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  newOperatorIdempotencyKey,
  submitProductionOperatorCommand,
  type ProductionOperatorCommandBody,
} from './production-operator-command.js';

const supportBody: ProductionOperatorCommandBody = {
  command: 'support.break-glass.request',
  reason: 'Investigate the approved tenant-scoped authentication outage.',
  requestedMinutes: 15,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('production operator command response validation', () => {
  it('fails closed on unverifiable success and rejection envelopes', async () => {
    const responses = [
      new Response(JSON.stringify({ schemaVersion: 2, replayed: false }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
      new Response(JSON.stringify({ error: { code: 409, message: 'Wrong code type.' } }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => responses.shift()),
    );

    await expect(
      submitProductionOperatorCommand(supportBody, 'support:invalid-success'),
    ).resolves.toEqual({
      state: 'unavailable',
      message: 'The command response could not be verified.',
    });
    await expect(
      submitProductionOperatorCommand(supportBody, 'support:invalid-rejection'),
    ).resolves.toEqual({
      state: 'unavailable',
      message: 'The command response could not be verified.',
    });
  });

  it('uses command-family prefixes with a fresh random idempotency UUID', () => {
    const randomUUID = vi.fn(() => '12345678-1234-4234-8234-123456789abc');
    vi.stubGlobal('crypto', { randomUUID });

    expect(newOperatorIdempotencyKey('admissions.application.review.record')).toBe(
      'admissions:12345678-1234-4234-8234-123456789abc',
    );
    expect(newOperatorIdempotencyKey('finance.bank-line.reconcile')).toBe(
      'finance:12345678-1234-4234-8234-123456789abc',
    );
    expect(newOperatorIdempotencyKey('support.break-glass.request')).toBe(
      'support:12345678-1234-4234-8234-123456789abc',
    );
    expect(randomUUID).toHaveBeenCalledTimes(3);
  });
});
