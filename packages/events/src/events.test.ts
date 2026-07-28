import { describe, expect, it, vi } from 'vitest';

import {
  AppendOnlyAuditLog,
  IdempotentCommandExecutor,
  OptimisticConcurrencyError,
  createDomainEvent,
  requireExpectedVersion,
} from './index.js';

const tenantId = '11111111-1111-4111-8111-111111111111';

describe('shared transactional primitives', () => {
  it('creates versioned events with correlation and causation metadata', () => {
    const event = createDomainEvent({
      eventType: 'student.enrolled',
      schemaVersion: 1,
      tenantId,
      aggregateType: 'student',
      aggregateId: 'student-1',
      aggregateVersion: 3,
      correlationId: 'corr-1',
      causationId: 'command-1',
      payload: { campusId: 'campus-1' },
      occurredAt: new Date('2026-07-28T00:00:00Z'),
    });

    expect(event).toMatchObject({
      eventType: 'student.enrolled',
      schemaVersion: 1,
      tenantId,
      aggregateVersion: 3,
      correlationId: 'corr-1',
      causationId: 'command-1',
    });
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(Object.isFrozen(event)).toBe(true);
  });

  it('executes an idempotent command once and returns the stored result', async () => {
    const handler = vi
      .fn()
      .mockResolvedValue({ result: { studentId: 'student-1' }, events: ['event-1'] });
    const executor = new IdempotentCommandExecutor();

    const first = await executor.execute({
      tenantId,
      operation: 'student.enroll',
      idempotencyKey: 'request-123',
      handler,
    });
    const duplicate = await executor.execute({
      tenantId,
      operation: 'student.enroll',
      idempotencyKey: 'request-123',
      handler,
    });

    expect(first).toEqual(duplicate);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(executor.outbox).toEqual(['event-1']);
  });

  it('raises a typed conflict on stale aggregate versions', () => {
    expect(() => requireExpectedVersion(4, 3)).toThrow(OptimisticConcurrencyError);
    expect(() => requireExpectedVersion(4, 4)).not.toThrow();
  });

  it('keeps audit entries append-only', () => {
    const log = new AppendOnlyAuditLog();
    const entry = log.append({ tenantId, action: 'finance.refund', subjectId: 'invoice-1' });
    expect(log.entries()).toEqual([entry]);
    expect(() => log.replace(entry.auditId, { ...entry, action: 'tampered' })).toThrow(
      'Audit entries are append-only',
    );
  });
});
