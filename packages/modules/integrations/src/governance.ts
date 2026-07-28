import { cloneAndFreeze } from './common.js';

export type ConnectorAuthenticationMode = 'oauth2' | 'api-key' | 'basic' | 'mtls' | 'saml' | 'oidc';

export interface ConnectorSubprocessor {
  legalName: string;
  countryCode: string;
  privacyUrl: string;
  purpose: string;
}

export interface ConnectorManifest {
  connectorKey: string;
  version: number;
  displayName: string;
  provider: string;
  supportedRegions: readonly string[];
  dataCategories: readonly string[];
  authenticationModes: readonly ConnectorAuthenticationMode[];
  requiredScopes: readonly string[];
  inboundEvents: readonly string[];
  outboundCommands: readonly string[];
  rateLimit: Readonly<{ requests: number; intervalSeconds: number }>;
  retryPolicy: Readonly<{ maxAttempts: number; baseDelaySeconds: number }>;
  retentionDays: number;
  subprocessor: Readonly<ConnectorSubprocessor>;
}

function requireUniqueList(
  values: readonly string[],
  field: string,
  allowEmpty = false,
): readonly string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (!allowEmpty && normalized.length === 0) throw new Error(`${field} must not be empty`);
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} must be unique`);
  return Object.freeze(normalized);
}

export class ConnectorManifestRegistry {
  readonly #manifests = new Map<string, Readonly<ConnectorManifest>>();

  publish(manifest: ConnectorManifest): Readonly<ConnectorManifest> {
    if (!Number.isInteger(manifest.version) || manifest.version < 1) {
      throw new Error('Connector manifest version must be positive');
    }
    const privacyUrl = new URL(manifest.subprocessor.privacyUrl);
    if (privacyUrl.protocol !== 'https:')
      throw new Error('Subprocessor privacy URL must use HTTPS');
    if (!/^[A-Z]{2}$/u.test(manifest.subprocessor.countryCode)) {
      throw new Error('Subprocessor country code must use two uppercase letters');
    }
    if (manifest.rateLimit.requests < 1 || manifest.rateLimit.intervalSeconds < 1) {
      throw new Error('Connector rate limit must be positive');
    }
    if (manifest.retryPolicy.maxAttempts < 1 || manifest.retryPolicy.baseDelaySeconds < 1) {
      throw new Error('Connector retry policy must be positive');
    }
    if (!Number.isInteger(manifest.retentionDays) || manifest.retentionDays < 0) {
      throw new Error('Connector retention days must be a non-negative integer');
    }
    const key = `${manifest.connectorKey}@${manifest.version}`;
    if (this.#manifests.has(key)) throw new Error('Connector manifest version is immutable');
    const published = cloneAndFreeze<ConnectorManifest>({
      ...manifest,
      supportedRegions: requireUniqueList(manifest.supportedRegions, 'Supported regions'),
      dataCategories: requireUniqueList(manifest.dataCategories, 'Data categories'),
      authenticationModes: requireUniqueList(
        manifest.authenticationModes,
        'Authentication modes',
      ) as readonly ConnectorAuthenticationMode[],
      requiredScopes: requireUniqueList(manifest.requiredScopes, 'Required scopes'),
      inboundEvents: requireUniqueList(manifest.inboundEvents, 'Inbound events', true),
      outboundCommands: requireUniqueList(manifest.outboundCommands, 'Outbound commands', true),
    });
    this.#manifests.set(key, published);
    return published;
  }

  resolve(connectorKey: string, version: number): Readonly<ConnectorManifest> | undefined {
    return this.#manifests.get(`${connectorKey}@${version}`);
  }

  list(): readonly Readonly<ConnectorManifest>[] {
    return [...this.#manifests.values()].sort((left, right) =>
      left.connectorKey === right.connectorKey
        ? left.version - right.version
        : left.connectorKey.localeCompare(right.connectorKey),
    );
  }
}

export interface ConnectorSandboxEvidence {
  passed: boolean;
  checks: Readonly<{
    configuration: boolean;
    connection: boolean;
    inboundMapping: boolean;
    outboundMapping: boolean;
  }>;
  executedAt: Date;
  evidence: Readonly<Record<string, unknown>>;
}

export type ConnectorApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ConnectorApprovalRequest {
  requestId: string;
  tenantId: string;
  connectorKey: string;
  connectorVersion: number;
  requestedBy: string;
  requestedAt: Date;
  purpose: string;
  approvedScopes: readonly string[];
  approvedDataCategories: readonly string[];
  retentionDays: number;
  status: ConnectorApprovalStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  decisionNote: string | null;
  sandbox: Readonly<ConnectorSandboxEvidence> | null;
}

export interface ConnectorConnection {
  connectionId: string;
  tenantId: string;
  connectorKey: string;
  connectorVersion: number;
  requestId: string;
  status: 'active' | 'disabled';
  scopes: readonly string[];
  dataCategories: readonly string[];
  retentionDays: number;
  enabledAt: Date;
}

export interface ConnectorGovernanceOptions {
  idFactory?: () => string;
  now?: () => Date;
}

export class ConnectorGovernance {
  readonly #registry: ConnectorManifestRegistry;
  readonly #requests = new Map<string, Readonly<ConnectorApprovalRequest>>();
  readonly #connections = new Map<string, Readonly<ConnectorConnection>>();
  readonly #idFactory: () => string;
  readonly #now: () => Date;

  constructor(registry: ConnectorManifestRegistry, options: ConnectorGovernanceOptions = {}) {
    this.#registry = registry;
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
  }

  request(input: {
    tenantId: string;
    connectorKey: string;
    connectorVersion: number;
    requestedBy: string;
    purpose: string;
    approvedScopes: readonly string[];
    approvedDataCategories: readonly string[];
    retentionDays: number;
  }): Readonly<ConnectorApprovalRequest> {
    const manifest = this.#registry.resolve(input.connectorKey, input.connectorVersion);
    if (!manifest) throw new Error('Unknown connector manifest');
    if (input.purpose.trim().length === 0) throw new Error('Connector purpose is required');
    for (const scope of input.approvedScopes) {
      if (!manifest.requiredScopes.includes(scope)) {
        throw new Error('Requested connector scope is not declared by the manifest');
      }
    }
    for (const category of input.approvedDataCategories) {
      if (!manifest.dataCategories.includes(category)) {
        throw new Error('Requested data category is not declared by the manifest');
      }
    }
    if (input.retentionDays < 0 || input.retentionDays > manifest.retentionDays) {
      throw new Error('Requested retention exceeds the connector manifest');
    }
    const requestId = this.#idFactory();
    if (this.#requests.has(requestId))
      throw new Error('Connector request identifier already exists');
    const request = cloneAndFreeze<ConnectorApprovalRequest>({
      ...input,
      requestId,
      requestedAt: this.#now(),
      approvedScopes: requireUniqueList(input.approvedScopes, 'Approved scopes'),
      approvedDataCategories: requireUniqueList(
        input.approvedDataCategories,
        'Approved data categories',
      ),
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      decisionNote: null,
      sandbox: null,
    });
    this.#requests.set(requestId, request);
    return request;
  }

  approve(
    requestId: string,
    reviewedBy: string,
    decision: 'approved' | 'rejected',
    decisionNote: string | null = null,
  ): Readonly<ConnectorApprovalRequest> {
    const request = this.#requireRequest(requestId);
    if (request.status !== 'pending') throw new Error('Connector request is already decided');
    if (request.requestedBy === reviewedBy) {
      throw new Error('Connector approval requires an independent reviewer');
    }
    const updated = cloneAndFreeze<ConnectorApprovalRequest>({
      ...request,
      status: decision,
      reviewedBy,
      reviewedAt: this.#now(),
      decisionNote,
    });
    this.#requests.set(requestId, updated);
    return updated;
  }

  recordSandbox(
    requestId: string,
    sandbox: ConnectorSandboxEvidence,
  ): Readonly<ConnectorApprovalRequest> {
    const request = this.#requireRequest(requestId);
    if (request.status !== 'approved') {
      throw new Error('Connector request must be approved before sandbox evidence');
    }
    const updated = cloneAndFreeze<ConnectorApprovalRequest>({ ...request, sandbox });
    this.#requests.set(requestId, updated);
    return updated;
  }

  enable(requestId: string): Readonly<ConnectorConnection> {
    const request = this.#requireRequest(requestId);
    if (request.status !== 'approved') throw new Error('Connector request is not approved');
    if (!request.sandbox?.passed) throw new Error('Connector sandbox must pass before enablement');
    const connectionId = this.#idFactory();
    if (this.#connections.has(connectionId))
      throw new Error('Connector connection identifier exists');
    const connection = cloneAndFreeze<ConnectorConnection>({
      connectionId,
      tenantId: request.tenantId,
      connectorKey: request.connectorKey,
      connectorVersion: request.connectorVersion,
      requestId,
      status: 'active',
      scopes: request.approvedScopes,
      dataCategories: request.approvedDataCategories,
      retentionDays: request.retentionDays,
      enabledAt: this.#now(),
    });
    this.#connections.set(connectionId, connection);
    return connection;
  }

  requestById(requestId: string): Readonly<ConnectorApprovalRequest> | undefined {
    return this.#requests.get(requestId);
  }

  connectionsForTenant(tenantId: string): readonly Readonly<ConnectorConnection>[] {
    return [...this.#connections.values()].filter((connection) => connection.tenantId === tenantId);
  }

  #requireRequest(requestId: string): Readonly<ConnectorApprovalRequest> {
    const request = this.#requests.get(requestId);
    if (!request) throw new Error('Unknown connector request');
    return request;
  }
}

export interface ConnectorSandboxAdapter {
  validateConfiguration(configuration: Readonly<Record<string, unknown>>): Promise<boolean>;
  testConnection(): Promise<Readonly<{ reachable: boolean; latencyMs: number }>>;
  mapInbound(
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>>;
  mapOutbound(
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>>;
}

export class ConnectorSandbox {
  readonly #adapter: ConnectorSandboxAdapter;

  constructor(adapter: ConnectorSandboxAdapter) {
    this.#adapter = adapter;
  }

  async run(input: {
    configuration: Readonly<Record<string, unknown>>;
    syntheticInbound: Readonly<Record<string, unknown>>;
    syntheticOutbound: Readonly<Record<string, unknown>>;
    allowedDataCategories: readonly string[];
    requestedDataCategories: readonly string[];
  }): Promise<Readonly<ConnectorSandboxEvidence>> {
    for (const category of input.requestedDataCategories) {
      if (!input.allowedDataCategories.includes(category)) {
        throw new Error('Sandbox requested an undeclared data category');
      }
    }
    const configuration = await this.#adapter.validateConfiguration(input.configuration);
    const connection = await this.#adapter.testConnection();
    const inbound = await this.#adapter.mapInbound(input.syntheticInbound);
    const outbound = await this.#adapter.mapOutbound(input.syntheticOutbound);
    const checks = {
      configuration,
      connection: connection.reachable,
      inboundMapping: Boolean(inbound && typeof inbound === 'object'),
      outboundMapping: Boolean(outbound && typeof outbound === 'object'),
    };
    return cloneAndFreeze({
      passed: Object.values(checks).every(Boolean),
      checks,
      executedAt: new Date(),
      evidence: {
        syntheticOnly: true,
        latencyMs: connection.latencyMs,
        inboundFields: Object.keys(inbound).sort(),
        outboundFields: Object.keys(outbound).sort(),
      },
    });
  }
}

export type DeliveryMetricStatus = 'delivered' | 'failed' | 'dead-letter';

export interface IntegrationObservabilitySnapshot {
  tenantId: string;
  connectionId: string;
  deliveries: number;
  delivered: number;
  failed: number;
  deadLetters: number;
  averageDeliveryLatencyMs: number;
  importedRows: number;
  importFailedRows: number;
  importRuns: number;
  averageImportDurationMs: number;
}

export interface IntegrationAlert {
  code: 'dead-letter-present' | 'delivery-failure-rate' | 'import-row-failure-rate';
  severity: 'warning' | 'critical';
  message: string;
}

interface MutableMetrics {
  deliveries: number;
  delivered: number;
  failed: number;
  deadLetters: number;
  deliveryLatencyTotalMs: number;
  importedRows: number;
  importFailedRows: number;
  importRuns: number;
  importDurationTotalMs: number;
}

export class IntegrationObservability {
  readonly #metrics = new Map<string, MutableMetrics>();

  recordDelivery(
    tenantId: string,
    connectionId: string,
    input: { status: DeliveryMetricStatus; latencyMs: number },
  ): void {
    if (!Number.isFinite(input.latencyMs) || input.latencyMs < 0) {
      throw new Error('Delivery latency must be a non-negative number');
    }
    const metrics = this.#getMutable(tenantId, connectionId);
    metrics.deliveries += 1;
    metrics.deliveryLatencyTotalMs += input.latencyMs;
    if (input.status === 'delivered') metrics.delivered += 1;
    else if (input.status === 'failed') metrics.failed += 1;
    else metrics.deadLetters += 1;
  }

  recordImport(
    tenantId: string,
    connectionId: string,
    input: { rows: number; failedRows: number; durationMs: number },
  ): void {
    if (
      !Number.isInteger(input.rows) ||
      !Number.isInteger(input.failedRows) ||
      input.rows < 0 ||
      input.failedRows < 0 ||
      input.failedRows > input.rows ||
      !Number.isFinite(input.durationMs) ||
      input.durationMs < 0
    ) {
      throw new Error('Import metrics are invalid');
    }
    const metrics = this.#getMutable(tenantId, connectionId);
    metrics.importedRows += input.rows;
    metrics.importFailedRows += input.failedRows;
    metrics.importRuns += 1;
    metrics.importDurationTotalMs += input.durationMs;
  }

  snapshot(tenantId: string, connectionId: string): Readonly<IntegrationObservabilitySnapshot> {
    const metrics = this.#getMutable(tenantId, connectionId);
    return cloneAndFreeze({
      tenantId,
      connectionId,
      deliveries: metrics.deliveries,
      delivered: metrics.delivered,
      failed: metrics.failed,
      deadLetters: metrics.deadLetters,
      averageDeliveryLatencyMs:
        metrics.deliveries === 0
          ? 0
          : Math.round(metrics.deliveryLatencyTotalMs / metrics.deliveries),
      importedRows: metrics.importedRows,
      importFailedRows: metrics.importFailedRows,
      importRuns: metrics.importRuns,
      averageImportDurationMs:
        metrics.importRuns === 0
          ? 0
          : Math.round(metrics.importDurationTotalMs / metrics.importRuns),
    });
  }

  alerts(tenantId: string, connectionId: string): readonly Readonly<IntegrationAlert>[] {
    const snapshot = this.snapshot(tenantId, connectionId);
    const alerts: IntegrationAlert[] = [];
    if (snapshot.deadLetters > 0) {
      alerts.push({
        code: 'dead-letter-present',
        severity: 'critical',
        message: `${snapshot.deadLetters} webhook deliveries require replay or investigation`,
      });
    }
    const deliveryFailures = snapshot.failed + snapshot.deadLetters;
    if (snapshot.deliveries > 0 && deliveryFailures / snapshot.deliveries >= 0.2) {
      alerts.push({
        code: 'delivery-failure-rate',
        severity: 'warning',
        message: 'Webhook delivery failure rate is above 20%',
      });
    }
    if (snapshot.importedRows > 0 && snapshot.importFailedRows / snapshot.importedRows >= 0.01) {
      alerts.push({
        code: 'import-row-failure-rate',
        severity: 'warning',
        message: 'Import row failure rate is at least 1%',
      });
    }
    return cloneAndFreeze(alerts);
  }

  #getMutable(tenantId: string, connectionId: string): MutableMetrics {
    const key = `${tenantId}:${connectionId}`;
    let metrics = this.#metrics.get(key);
    if (!metrics) {
      metrics = {
        deliveries: 0,
        delivered: 0,
        failed: 0,
        deadLetters: 0,
        deliveryLatencyTotalMs: 0,
        importedRows: 0,
        importFailedRows: 0,
        importRuns: 0,
        importDurationTotalMs: 0,
      };
      this.#metrics.set(key, metrics);
    }
    return metrics;
  }
}
