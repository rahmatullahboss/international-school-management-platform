import { describe, expect, it } from 'vitest';

import { ConnectionHealthRegistry } from '../../packages/modules/integrations/src/health.js';

describe('integration connection health boundaries', () => {
  it('uses the default failure threshold and rejects non-positive thresholds', () => {
    const health = new ConnectionHealthRegistry();
    const first = health.recordFailure(
      'tenant-1',
      'connection-1',
      'synthetic timeout',
      new Date('2026-08-19T09:00:00.000Z'),
    );
    const second = health.recordFailure(
      'tenant-1',
      'connection-1',
      'synthetic timeout',
      new Date('2026-08-19T09:01:00.000Z'),
    );
    const third = health.recordFailure(
      'tenant-1',
      'connection-1',
      'synthetic timeout',
      new Date('2026-08-19T09:02:00.000Z'),
    );

    expect(first.status).toBe('degraded');
    expect(second.status).toBe('degraded');
    expect(third.status).toBe('down');
    expect(() => new ConnectionHealthRegistry({ failureThreshold: 0 })).toThrow(
      'failureThreshold must be positive',
    );
  });

  it('disables an unknown connection without inventing prior success or failure evidence', () => {
    const health = new ConnectionHealthRegistry({ failureThreshold: 2 });
    const checkedAt = new Date('2026-08-19T10:00:00.000Z');

    const disabled = health.disable('tenant-1', 'connection-1', checkedAt);

    expect(disabled).toEqual({
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      status: 'disabled',
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      checkedAt,
    });
    expect(Object.isFrozen(disabled)).toBe(true);
  });

  it('retains prior health evidence when disabled and cannot be re-enabled by passive checks', () => {
    const health = new ConnectionHealthRegistry({ failureThreshold: 2 });
    const successAt = new Date('2026-08-19T10:00:00.000Z');
    const failureAt = new Date('2026-08-19T10:05:00.000Z');
    const disabledAt = new Date('2026-08-19T10:10:00.000Z');

    health.recordSuccess('tenant-1', 'connection-1', successAt);
    health.recordFailure('tenant-1', 'connection-1', 'synthetic timeout', failureAt);
    const disabled = health.disable('tenant-1', 'connection-1', disabledAt);

    expect(disabled).toMatchObject({
      status: 'disabled',
      consecutiveFailures: 1,
      lastSuccessAt: successAt,
      lastFailureAt: failureAt,
      lastError: 'synthetic timeout',
      checkedAt: disabledAt,
    });

    const successWhileDisabled = health.recordSuccess(
      'tenant-1',
      'connection-1',
      new Date('2026-08-19T10:15:00.000Z'),
    );
    expect(successWhileDisabled).toMatchObject({
      status: 'disabled',
      consecutiveFailures: 0,
      lastFailureAt: failureAt,
      lastError: null,
    });

    const failureWhileDisabled = health.recordFailure(
      'tenant-1',
      'connection-1',
      'synthetic post-disable failure',
      new Date('2026-08-19T10:20:00.000Z'),
    );
    expect(failureWhileDisabled).toMatchObject({
      status: 'disabled',
      consecutiveFailures: 1,
      lastFailureAt: new Date('2026-08-19T10:20:00.000Z'),
      lastError: 'synthetic post-disable failure',
    });
    expect(health.get('tenant-1', 'connection-1')).toEqual(failureWhileDisabled);
  });
});
