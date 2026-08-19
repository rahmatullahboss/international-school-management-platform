import { describe, expect, it } from 'vitest';

import {
  ConnectorGovernance,
  ConnectorManifestRegistry,
  type ConnectorManifest,
} from '../../packages/modules/integrations/src/index.js';

const baseManifest: ConnectorManifest = {
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

function approvedRequest(
  governance: ConnectorGovernance,
  tenantId = 'tenant-1',
  connectorKey = 'synthetic-lms',
  connectorVersion = 1,
) {
  const request = governance.request({
    tenantId,
    connectorKey,
    connectorVersion,
    requestedBy: 'operator-1',
    purpose: 'Synchronise class rosters',
    approvedScopes: ['roster.read'],
    approvedDataCategories: ['directory'],
    retentionDays: 14,
  });
  return governance.approve(request.requestId, 'privacy-officer-1', 'approved');
}

function passingSandbox() {
  return {
    passed: true,
    checks: {
      configuration: true,
      connection: true,
      inboundMapping: true,
      outboundMapping: true,
    },
    executedAt: new Date('2026-08-19T12:05:00.000Z'),
    evidence: { syntheticOnly: true },
  } as const;
}

describe('connector governance boundary coverage', () => {
  it('sorts immutable manifest versions and rejects malformed operational metadata', () => {
    const registry = new ConnectorManifestRegistry();
    registry.publish({ ...baseManifest, connectorKey: 'zeta', version: 2 });
    registry.publish({ ...baseManifest, connectorKey: 'alpha', version: 2 });
    registry.publish({ ...baseManifest, connectorKey: 'alpha', version: 1 });

    expect(
      registry.list().map((manifest) => `${manifest.connectorKey}@${String(manifest.version)}`),
    ).toEqual(['alpha@1', 'alpha@2', 'zeta@2']);

    expect(() =>
      registry.publish({ ...baseManifest, connectorKey: 'bad-version', version: 0 }),
    ).toThrow('Connector manifest version must be positive');
    expect(() =>
      registry.publish({
        ...baseManifest,
        connectorKey: 'bad-country',
        subprocessor: { ...baseManifest.subprocessor, countryCode: 'gb' },
      }),
    ).toThrow('Subprocessor country code must use two uppercase letters');
    expect(() =>
      registry.publish({
        ...baseManifest,
        connectorKey: 'bad-rate-limit',
        rateLimit: { requests: 0, intervalSeconds: 60 },
      }),
    ).toThrow('Connector rate limit must be positive');
    expect(() =>
      registry.publish({
        ...baseManifest,
        connectorKey: 'bad-retry-policy',
        retryPolicy: { maxAttempts: 0, baseDelaySeconds: 30 },
      }),
    ).toThrow('Connector retry policy must be positive');
    expect(() =>
      registry.publish({ ...baseManifest, connectorKey: 'bad-retention', retentionDays: -1 }),
    ).toThrow('Connector retention days must be a non-negative integer');
    expect(() =>
      registry.publish({ ...baseManifest, connectorKey: 'empty-regions', supportedRegions: [] }),
    ).toThrow('Supported regions must not be empty');
    expect(() =>
      registry.publish({
        ...baseManifest,
        connectorKey: 'duplicate-scope',
        requiredScopes: ['roster.read', 'roster.read'],
      }),
    ).toThrow('Required scopes must be unique');
  });

  it('fails closed for unknown manifests, empty purposes, undeclared data and excessive retention', () => {
    const registry = new ConnectorManifestRegistry();
    registry.publish(baseManifest);
    const governance = new ConnectorGovernance(registry, {
      idFactory: () => 'request-1',
      now: () => new Date('2026-08-19T12:00:00.000Z'),
    });

    expect(() =>
      governance.request({
        tenantId: 'tenant-1',
        connectorKey: 'missing-connector',
        connectorVersion: 1,
        requestedBy: 'operator-1',
        purpose: 'Roster sync',
        approvedScopes: ['roster.read'],
        approvedDataCategories: ['directory'],
        retentionDays: 14,
      }),
    ).toThrow('Unknown connector manifest');
    expect(() =>
      governance.request({
        tenantId: 'tenant-1',
        connectorKey: 'synthetic-lms',
        connectorVersion: 1,
        requestedBy: 'operator-1',
        purpose: '   ',
        approvedScopes: ['roster.read'],
        approvedDataCategories: ['directory'],
        retentionDays: 14,
      }),
    ).toThrow('Connector purpose is required');
    expect(() =>
      governance.request({
        tenantId: 'tenant-1',
        connectorKey: 'synthetic-lms',
        connectorVersion: 1,
        requestedBy: 'operator-1',
        purpose: 'Roster sync',
        approvedScopes: ['roster.read'],
        approvedDataCategories: ['finance'],
        retentionDays: 14,
      }),
    ).toThrow('Requested data category is not declared by the manifest');
    expect(() =>
      governance.request({
        tenantId: 'tenant-1',
        connectorKey: 'synthetic-lms',
        connectorVersion: 1,
        requestedBy: 'operator-1',
        purpose: 'Roster sync',
        approvedScopes: ['roster.read'],
        approvedDataCategories: ['directory'],
        retentionDays: 31,
      }),
    ).toThrow('Requested retention exceeds the connector manifest');

    const request = governance.request({
      tenantId: 'tenant-1',
      connectorKey: 'synthetic-lms',
      connectorVersion: 1,
      requestedBy: 'operator-1',
      purpose: 'Roster sync',
      approvedScopes: ['roster.read'],
      approvedDataCategories: ['directory'],
      retentionDays: 14,
    });
    expect(governance.requestById(request.requestId)).toEqual(request);
    expect(() =>
      governance.request({
        tenantId: 'tenant-2',
        connectorKey: 'synthetic-lms',
        connectorVersion: 1,
        requestedBy: 'operator-2',
        purpose: 'Second roster sync',
        approvedScopes: ['roster.read'],
        approvedDataCategories: ['directory'],
        retentionDays: 7,
      }),
    ).toThrow('Connector request identifier already exists');
  });

  it('keeps rejected and already-decided requests from reaching sandbox or enablement', () => {
    const registry = new ConnectorManifestRegistry();
    registry.publish(baseManifest);
    const governance = new ConnectorGovernance(registry, {
      idFactory: () => 'request-rejected',
      now: () => new Date('2026-08-19T12:00:00.000Z'),
    });
    const request = governance.request({
      tenantId: 'tenant-1',
      connectorKey: 'synthetic-lms',
      connectorVersion: 1,
      requestedBy: 'operator-1',
      purpose: 'Roster sync',
      approvedScopes: ['roster.read'],
      approvedDataCategories: ['directory'],
      retentionDays: 14,
    });
    const rejected = governance.approve(
      request.requestId,
      'privacy-officer-1',
      'rejected',
      'Purpose not justified',
    );

    expect(rejected).toMatchObject({
      status: 'rejected',
      reviewedBy: 'privacy-officer-1',
      decisionNote: 'Purpose not justified',
    });
    expect(() => governance.approve(request.requestId, 'privacy-officer-2', 'approved')).toThrow(
      'Connector request is already decided',
    );
    expect(() => governance.recordSandbox(request.requestId, passingSandbox())).toThrow(
      'Connector request must be approved before sandbox evidence',
    );
    expect(() => governance.enable(request.requestId)).toThrow('Connector request is not approved');
    expect(() => governance.enable('missing-request')).toThrow('Unknown connector request');
  });

  it('enables only sandbox-approved requests, protects connection ids and scopes tenant lookups', () => {
    const registry = new ConnectorManifestRegistry();
    registry.publish(baseManifest);
    const ids = ['request-1', 'connection-shared', 'request-2', 'connection-shared'];
    const governance = new ConnectorGovernance(registry, {
      idFactory: () => ids.shift() ?? 'generated-id',
      now: () => new Date('2026-08-19T12:00:00.000Z'),
    });

    const first = approvedRequest(governance, 'tenant-1');
    governance.recordSandbox(first.requestId, passingSandbox());
    const connection = governance.enable(first.requestId);
    expect(connection).toMatchObject({
      connectionId: 'connection-shared',
      tenantId: 'tenant-1',
      status: 'active',
      scopes: ['roster.read'],
      dataCategories: ['directory'],
    });
    expect(governance.connectionsForTenant('tenant-1')).toEqual([connection]);
    expect(governance.connectionsForTenant('tenant-2')).toEqual([]);

    const second = approvedRequest(governance, 'tenant-2');
    governance.recordSandbox(second.requestId, passingSandbox());
    expect(() => governance.enable(second.requestId)).toThrow(
      'Connector connection identifier exists',
    );
  });
});
