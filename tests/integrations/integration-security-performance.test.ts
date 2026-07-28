import { performance } from 'node:perf_hooks';

import { describe, expect, test } from 'vitest';

import {
  ExternalIdRegistry,
  IntegrationCredentialRegistry,
  IntegrationObservability,
  WebhookDeliveryQueue,
} from '../../packages/modules/integrations/src/index.js';

describe('integration security boundaries', () => {
  test('stores only a digest and rejects cross-tenant credential use', async () => {
    const registry = new IntegrationCredentialRegistry({
      keyIdFactory: () => 'key-1',
      valueFactory: () => 'alpha',
      now: () => new Date('2026-07-28T05:00:00.000Z'),
    });
    const issued = await registry.issue({
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      name: 'Synthetic connector',
      scopes: ['roster.read'],
      dataCategories: ['directory'],
    });
    const record = registry.record('tenant-1', issued.keyId);

    expect(record?.valueDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(record).not.toHaveProperty('value');
    expect(JSON.stringify(record)).not.toContain('alpha');
    await expect(
      registry.authenticate({
        tenantId: 'tenant-2',
        keyId: issued.keyId,
        value: issued.value,
        requiredScope: 'roster.read',
      }),
    ).rejects.toThrow('Invalid integration credential');
  });

  test('partitions external IDs and metrics by tenant', () => {
    const identifiers = new ExternalIdRegistry();
    identifiers.link({
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      objectType: 'student',
      internalId: 'student-a',
      externalId: 'shared-external-id',
      authority: 'external',
    });
    identifiers.link({
      tenantId: 'tenant-2',
      connectionId: 'connection-1',
      objectType: 'student',
      internalId: 'student-b',
      externalId: 'shared-external-id',
      authority: 'external',
    });

    expect(
      identifiers.byExternal('tenant-1', 'connection-1', 'student', 'shared-external-id')
        ?.internalId,
    ).toBe('student-a');
    expect(
      identifiers.byExternal('tenant-2', 'connection-1', 'student', 'shared-external-id')
        ?.internalId,
    ).toBe('student-b');

    const metrics = new IntegrationObservability();
    metrics.recordDelivery('tenant-1', 'connection-1', { status: 'delivered', latencyMs: 10 });
    metrics.recordDelivery('tenant-2', 'connection-1', { status: 'failed', latencyMs: 20 });
    expect(metrics.snapshot('tenant-1', 'connection-1')).toMatchObject({ delivered: 1, failed: 0 });
    expect(metrics.snapshot('tenant-2', 'connection-1')).toMatchObject({ delivered: 0, failed: 1 });
  });
});

describe('integration performance contracts', () => {
  test('links and resolves 10,000 external identifiers within a bounded local budget', () => {
    const registry = new ExternalIdRegistry();
    const started = performance.now();

    for (let index = 0; index < 10_000; index += 1) {
      registry.link({
        tenantId: 'tenant-1',
        connectionId: 'connection-1',
        objectType: 'student',
        internalId: `student-${index}`,
        externalId: `external-${index}`,
        authority: 'external',
      });
    }
    for (let index = 0; index < 10_000; index += 1) {
      expect(
        registry.byExternal('tenant-1', 'connection-1', 'student', `external-${index}`)?.internalId,
      ).toBe(`student-${index}`);
    }

    expect(performance.now() - started).toBeLessThan(3_000);
  });

  test('indexes and selects 10,000 due webhook deliveries within a bounded local budget', () => {
    let sequence = 0;
    const queue = new WebhookDeliveryQueue({ idFactory: () => `delivery-${sequence++}` });
    const now = new Date('2026-07-28T05:00:00.000Z');
    const started = performance.now();

    for (let index = 0; index < 10_000; index += 1) {
      queue.enqueue({
        tenantId: 'tenant-1',
        subscriptionId: 'subscription-1',
        eventId: `event-${index}`,
        body: JSON.stringify({ eventId: `event-${index}` }),
        now,
      });
    }
    const due = queue.due(now);

    expect(due).toHaveLength(10_000);
    expect(due[0]?.deliveryId).toBe('delivery-0');
    expect(performance.now() - started).toBeLessThan(3_000);
  });
});
