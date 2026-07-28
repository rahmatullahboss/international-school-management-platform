import { describe, expect, test } from 'vitest';

import {
  ConnectorGovernance,
  ConnectorManifestRegistry,
  ConnectorSandbox,
  IntegrationObservability,
  type ConnectorManifest,
} from '../../packages/modules/integrations/src/index.js';

const manifest: ConnectorManifest = {
  connectorKey: 'synthetic-lms',
  version: 1,
  displayName: 'Synthetic LMS',
  provider: 'Synthetic Provider',
  supportedRegions: ['global'],
  dataCategories: ['directory', 'enrollment'],
  authenticationModes: ['oauth2'],
  requiredScopes: ['roster.read', 'roster.write'],
  inboundEvents: ['roster.changed.v1'],
  outboundCommands: ['roster.upsert.v1'],
  rateLimit: { requests: 100, intervalSeconds: 60 },
  retryPolicy: { maxAttempts: 5, baseDelaySeconds: 30 },
  retentionDays: 30,
  subprocessor: {
    legalName: 'Synthetic Provider Ltd',
    countryCode: 'GB',
    privacyUrl: 'https://provider.example.test/privacy',
    purpose: 'Roster synchronisation',
  },
};

describe('connector governance', () => {
  test('publishes immutable manifests with privacy and operational metadata', () => {
    const registry = new ConnectorManifestRegistry();
    const published = registry.publish(manifest);

    expect(Object.isFrozen(published)).toBe(true);
    expect(registry.resolve('synthetic-lms', 1)).toBe(published);
    expect(() => registry.publish(manifest)).toThrow('Connector manifest version is immutable');
    expect(() =>
      registry.publish({
        ...manifest,
        connectorKey: 'bad-provider',
        subprocessor: { ...manifest.subprocessor, privacyUrl: 'http://provider.example.test' },
      }),
    ).toThrow('Subprocessor privacy URL must use HTTPS');
  });

  test('requires independent privacy approval and a passing sandbox before enablement', () => {
    const ids = ['request-1', 'connection-1'];
    const registry = new ConnectorManifestRegistry();
    registry.publish(manifest);
    const governance = new ConnectorGovernance(registry, {
      idFactory: () => ids.shift() ?? 'generated',
      now: () => new Date('2026-07-28T05:00:00.000Z'),
    });
    const request = governance.request({
      tenantId: 'tenant-1',
      connectorKey: 'synthetic-lms',
      connectorVersion: 1,
      requestedBy: 'operator-1',
      purpose: 'Synchronise class rosters',
      approvedScopes: ['roster.read'],
      approvedDataCategories: ['directory', 'enrollment'],
      retentionDays: 14,
    });

    expect(() => governance.approve(request.requestId, 'operator-1', 'approved')).toThrow(
      'Connector approval requires an independent reviewer',
    );
    const approved = governance.approve(request.requestId, 'privacy-officer-1', 'approved');
    expect(approved.status).toBe('approved');
    expect(() => governance.enable(request.requestId)).toThrow(
      'Connector sandbox must pass before enablement',
    );

    governance.recordSandbox(request.requestId, {
      passed: true,
      checks: {
        configuration: true,
        connection: true,
        inboundMapping: true,
        outboundMapping: true,
      },
      executedAt: new Date('2026-07-28T05:05:00.000Z'),
      evidence: { syntheticOnly: true },
    });
    const connection = governance.enable(request.requestId);

    expect(connection).toMatchObject({
      connectionId: 'connection-1',
      tenantId: 'tenant-1',
      status: 'active',
      scopes: ['roster.read'],
      dataCategories: ['directory', 'enrollment'],
    });
  });

  test('rejects scopes, data categories and retention outside the manifest', () => {
    const registry = new ConnectorManifestRegistry();
    registry.publish(manifest);
    const governance = new ConnectorGovernance(registry);

    expect(() =>
      governance.request({
        tenantId: 'tenant-1',
        connectorKey: 'synthetic-lms',
        connectorVersion: 1,
        requestedBy: 'operator-1',
        purpose: 'Unapproved finance access',
        approvedScopes: ['finance.write'],
        approvedDataCategories: ['finance'],
        retentionDays: 365,
      }),
    ).toThrow('Requested connector scope is not declared by the manifest');
  });
});

describe('connector sandbox and observability', () => {
  test('uses synthetic payloads and checks both mapping directions', async () => {
    const calls: string[] = [];
    const sandbox = new ConnectorSandbox({
      validateConfiguration: (configuration) => {
        calls.push('configuration');
        return Promise.resolve(configuration.endpoint === 'https://sandbox.example.test');
      },
      testConnection: () => {
        calls.push('connection');
        return Promise.resolve({ reachable: true, latencyMs: 42 });
      },
      mapInbound: (payload) => {
        calls.push('inbound');
        return Promise.resolve({ externalId: String(payload.id) });
      },
      mapOutbound: (payload) => {
        calls.push('outbound');
        return Promise.resolve({ id: String(payload.externalId) });
      },
    });

    const result = await sandbox.run({
      configuration: { endpoint: 'https://sandbox.example.test' },
      syntheticInbound: { id: 'student-1' },
      syntheticOutbound: { externalId: 'student-1' },
      allowedDataCategories: ['directory'],
      requestedDataCategories: ['directory'],
    });

    expect(result.passed).toBe(true);
    expect(result.evidence).toMatchObject({ syntheticOnly: true, latencyMs: 42 });
    expect(calls).toEqual(['configuration', 'connection', 'inbound', 'outbound']);
    await expect(
      sandbox.run({
        configuration: {},
        syntheticInbound: {},
        syntheticOutbound: {},
        allowedDataCategories: ['directory'],
        requestedDataCategories: ['finance'],
      }),
    ).rejects.toThrow('Sandbox requested an undeclared data category');
  });

  test('records bounded metrics, latency and actionable health alerts', () => {
    const metrics = new IntegrationObservability();
    metrics.recordDelivery('tenant-1', 'connection-1', { status: 'delivered', latencyMs: 80 });
    metrics.recordDelivery('tenant-1', 'connection-1', { status: 'failed', latencyMs: 250 });
    metrics.recordDelivery('tenant-1', 'connection-1', { status: 'dead-letter', latencyMs: 300 });
    metrics.recordImport('tenant-1', 'connection-1', {
      rows: 500,
      failedRows: 5,
      durationMs: 1_200,
    });

    const snapshot = metrics.snapshot('tenant-1', 'connection-1');
    expect(snapshot).toMatchObject({
      deliveries: 3,
      delivered: 1,
      failed: 1,
      deadLetters: 1,
      importedRows: 500,
      importFailedRows: 5,
    });
    expect(snapshot.averageDeliveryLatencyMs).toBe(210);
    expect(metrics.alerts('tenant-1', 'connection-1')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'dead-letter-present' }),
        expect.objectContaining({ code: 'delivery-failure-rate' }),
      ]),
    );
  });
});
