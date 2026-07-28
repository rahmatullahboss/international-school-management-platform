import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  ConnectionHealthRegistry,
  ExternalIdRegistry,
  InboundWebhookProcessor,
  IntegrationCredentialRegistry,
  IntegrationDisclosureAudit,
  OpenApiRegistry,
  WebhookDeliveryQueue,
  WebhookSigner,
  createIntegrationOpenApiV1,
} from '../../packages/modules/integrations/src/index.js';

describe('integration runtime', () => {
  test('publishes immutable versioned OpenAPI documents', () => {
    const registry = new OpenApiRegistry();
    const specification = createIntegrationOpenApiV1();
    const published = registry.publish(specification);

    expect(published.info.version).toBe('1.0.0');
    expect(published.openapi).toMatch(/^3\./u);
    expect(Object.isFrozen(published)).toBe(true);
    expect(registry.resolve('1.0.0')).toBe(published);
    expect(() => registry.publish(specification)).toThrow('OpenAPI version is immutable');
  });

  test('keeps the source-controlled OpenAPI artefact consistent with the runtime contract', async () => {
    const artefact: unknown = JSON.parse(
      await readFile(
        path.join(process.cwd(), 'packages/modules/integrations/openapi/v1.0.0.json'),
        'utf8',
      ),
    );

    expect(artefact).toEqual(createIntegrationOpenApiV1());
  });

  test('issues scoped credentials, rotates values and revokes access', async () => {
    const values = ['alpha', 'beta'];
    const registry = new IntegrationCredentialRegistry({
      now: () => new Date('2026-07-28T03:00:00.000Z'),
      valueFactory: () => values.shift() ?? 'unexpected',
    });

    const issued = await registry.issue({
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      name: 'Roster exporter',
      scopes: ['roster.read', 'webhook.manage'],
      dataCategories: ['directory', 'enrollment'],
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(issued.value).toBe('alpha');
    await expect(
      registry.authenticate({
        tenantId: 'tenant-1',
        keyId: issued.keyId,
        value: issued.value,
        requiredScope: 'roster.read',
      }),
    ).resolves.toMatchObject({
      connectionId: 'connection-1',
      scopes: ['roster.read', 'webhook.manage'],
    });
    await expect(
      registry.authenticate({
        tenantId: 'tenant-1',
        keyId: issued.keyId,
        value: issued.value,
        requiredScope: 'finance.write',
      }),
    ).rejects.toThrow('Credential does not grant the required scope');

    const rotated = await registry.rotate('tenant-1', issued.keyId);
    expect(rotated.value).toBe('beta');
    await expect(
      registry.authenticate({
        tenantId: 'tenant-1',
        keyId: issued.keyId,
        value: issued.value,
        requiredScope: 'roster.read',
      }),
    ).rejects.toThrow('Invalid integration credential');
    await expect(
      registry.authenticate({
        tenantId: 'tenant-1',
        keyId: issued.keyId,
        value: rotated.value,
        requiredScope: 'roster.read',
      }),
    ).resolves.toMatchObject({ keyId: issued.keyId });

    registry.revoke('tenant-1', issued.keyId, 'tenant administrator revoked the key');
    await expect(
      registry.authenticate({
        tenantId: 'tenant-1',
        keyId: issued.keyId,
        value: rotated.value,
        requiredScope: 'roster.read',
      }),
    ).rejects.toThrow('Integration credential is revoked');
  });

  test('keeps external identifiers unique and resolves both directions', () => {
    const registry = new ExternalIdRegistry();
    const linked = registry.link({
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      objectType: 'student',
      internalId: 'student-1',
      externalId: 'ext-100',
      externalVersion: '7',
      etag: 'etag-7',
      authority: 'external',
    });

    expect(registry.byInternal('tenant-1', 'connection-1', 'student', 'student-1')).toBe(linked);
    expect(registry.byExternal('tenant-1', 'connection-1', 'student', 'ext-100')).toBe(linked);
    expect(() =>
      registry.link({
        tenantId: 'tenant-1',
        connectionId: 'connection-1',
        objectType: 'student',
        internalId: 'student-2',
        externalId: 'ext-100',
        authority: 'external',
      }),
    ).toThrow('External identifier is already linked');

    const updated = registry.recordSynchronization({
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      objectType: 'student',
      internalId: 'student-1',
      externalVersion: '8',
      etag: 'etag-8',
      synchronizedAt: new Date('2026-07-28T03:15:00.000Z'),
    });
    expect(updated.externalVersion).toBe('8');
    expect(updated.etag).toBe('etag-8');
  });

  test('signs outbound webhooks and rejects tampering or stale timestamps', async () => {
    const signer = new WebhookSigner({ toleranceSeconds: 300 });
    const body = JSON.stringify({ eventId: 'event-1', type: 'student.updated.v1' });
    const timestamp = 1_784_000_000;
    const signature = await signer.sign({ value: 'gamma', body, timestamp });

    await expect(
      signer.verify({ value: 'gamma', body, signature, now: timestamp + 60 }),
    ).resolves.toBe(true);
    await expect(
      signer.verify({ value: 'gamma', body: `${body} `, signature, now: timestamp + 60 }),
    ).resolves.toBe(false);
    await expect(
      signer.verify({ value: 'gamma', body, signature, now: timestamp + 301 }),
    ).resolves.toBe(false);
  });

  test('deduplicates inbound events and rejects identifier reuse with another payload', async () => {
    const processor = new InboundWebhookProcessor();
    let calls = 0;
    const first = await processor.process({
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      providerEventId: 'provider-event-1',
      payload: { student: 'ext-100', version: 8 },
      handler: () => {
        calls += 1;
        return Promise.resolve({ internalId: 'student-1' });
      },
    });
    const duplicate = await processor.process({
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      providerEventId: 'provider-event-1',
      payload: { student: 'ext-100', version: 8 },
      handler: () => {
        calls += 1;
        return Promise.resolve({ internalId: 'ignored-duplicate' });
      },
    });

    expect(first.duplicate).toBe(false);
    expect(duplicate).toEqual({ duplicate: true, result: { internalId: 'student-1' } });
    expect(calls).toBe(1);
    await expect(
      processor.process({
        tenantId: 'tenant-1',
        connectionId: 'connection-1',
        providerEventId: 'provider-event-1',
        payload: { student: 'ext-100', version: 9 },
        handler: () => Promise.resolve({ internalId: 'student-1' }),
      }),
    ).rejects.toThrow('Provider event identifier was reused with a different payload');
  });

  test('retries delivery, dead-letters exhausted events and replays safely', () => {
    const queue = new WebhookDeliveryQueue({
      maxAttempts: 2,
      retryDelaySeconds: () => 60,
      idFactory: () => 'delivery-1',
    });
    const enqueued = queue.enqueue({
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      eventId: 'event-1',
      body: '{"eventId":"event-1"}',
      now: new Date('2026-07-28T03:00:00.000Z'),
    });

    expect(
      queue.enqueue({
        tenantId: enqueued.tenantId,
        subscriptionId: enqueued.subscriptionId,
        eventId: enqueued.eventId,
        body: enqueued.body,
        now: new Date('2026-07-28T03:00:01.000Z'),
      }),
    ).toBe(enqueued);
    expect(queue.due(new Date('2026-07-28T03:00:00.000Z'))).toEqual([enqueued]);

    const retrying = queue.recordFailure(
      'delivery-1',
      'HTTP 503',
      new Date('2026-07-28T03:00:00.000Z'),
    );
    expect(retrying.status).toBe('retrying');
    expect(queue.due(new Date('2026-07-28T03:00:59.000Z'))).toEqual([]);
    expect(queue.due(new Date('2026-07-28T03:01:00.000Z'))).toHaveLength(1);

    const deadLetter = queue.recordFailure(
      'delivery-1',
      'HTTP 503',
      new Date('2026-07-28T03:01:00.000Z'),
    );
    expect(deadLetter.status).toBe('dead-letter');
    expect(queue.deadLetters('tenant-1')).toEqual([deadLetter]);

    const replayed = queue.replayDeadLetter('delivery-1', new Date('2026-07-28T04:00:00.000Z'));
    expect(replayed).toMatchObject({ status: 'pending', attempts: 0, replayCount: 1 });
    const delivered = queue.recordSuccess('delivery-1', 202, new Date('2026-07-28T04:00:05.000Z'));
    expect(delivered.status).toBe('delivered');
  });

  test('tracks connection health and append-only disclosure evidence', () => {
    const health = new ConnectionHealthRegistry({ failureThreshold: 2 });
    health.recordSuccess('tenant-1', 'connection-1', new Date('2026-07-28T03:00:00.000Z'));
    expect(health.get('tenant-1', 'connection-1')?.status).toBe('healthy');
    health.recordFailure(
      'tenant-1',
      'connection-1',
      'timeout',
      new Date('2026-07-28T03:05:00.000Z'),
    );
    expect(health.get('tenant-1', 'connection-1')?.status).toBe('degraded');
    health.recordFailure(
      'tenant-1',
      'connection-1',
      'timeout',
      new Date('2026-07-28T03:10:00.000Z'),
    );
    expect(health.get('tenant-1', 'connection-1')?.status).toBe('down');

    const audit = new IntegrationDisclosureAudit({ idFactory: () => 'disclosure-1' });
    const entry = audit.append({
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      direction: 'outbound',
      destination: 'https://lms.example.test/webhooks',
      dataCategories: ['directory', 'enrollment'],
      purpose: 'roster synchronization',
      recordCount: 25,
      status: 'delivered',
      correlationId: 'correlation-1',
      occurredAt: new Date('2026-07-28T03:15:00.000Z'),
    });

    expect(Object.isFrozen(entry)).toBe(true);
    expect(audit.entriesForTenant('tenant-1')).toEqual([entry]);
  });
});
