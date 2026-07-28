import { cloneAndFreeze } from './common.js';

export type ConnectionHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'down' | 'disabled';

export interface ConnectionHealthSnapshot {
  tenantId: string;
  connectionId: string;
  status: ConnectionHealthStatus;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastError: string | null;
  checkedAt: Date;
}

export interface ConnectionHealthRegistryOptions {
  failureThreshold?: number;
}

export class ConnectionHealthRegistry {
  readonly #health = new Map<string, Readonly<ConnectionHealthSnapshot>>();
  readonly #failureThreshold: number;

  constructor(options: ConnectionHealthRegistryOptions = {}) {
    this.#failureThreshold = options.failureThreshold ?? 3;
    if (this.#failureThreshold < 1) throw new Error('failureThreshold must be positive');
  }

  recordSuccess(
    tenantId: string,
    connectionId: string,
    at: Date,
  ): Readonly<ConnectionHealthSnapshot> {
    const current = this.#health.get(this.#key(tenantId, connectionId));
    const updated = cloneAndFreeze<ConnectionHealthSnapshot>({
      tenantId,
      connectionId,
      status: current?.status === 'disabled' ? 'disabled' : 'healthy',
      consecutiveFailures: 0,
      lastSuccessAt: at,
      lastFailureAt: current?.lastFailureAt ?? null,
      lastError: null,
      checkedAt: at,
    });
    this.#health.set(this.#key(tenantId, connectionId), updated);
    return updated;
  }

  recordFailure(
    tenantId: string,
    connectionId: string,
    error: string,
    at: Date,
  ): Readonly<ConnectionHealthSnapshot> {
    const current = this.#health.get(this.#key(tenantId, connectionId));
    const failures = (current?.consecutiveFailures ?? 0) + 1;
    const updated = cloneAndFreeze<ConnectionHealthSnapshot>({
      tenantId,
      connectionId,
      status:
        current?.status === 'disabled'
          ? 'disabled'
          : failures >= this.#failureThreshold
            ? 'down'
            : 'degraded',
      consecutiveFailures: failures,
      lastSuccessAt: current?.lastSuccessAt ?? null,
      lastFailureAt: at,
      lastError: error,
      checkedAt: at,
    });
    this.#health.set(this.#key(tenantId, connectionId), updated);
    return updated;
  }

  disable(tenantId: string, connectionId: string, at: Date): Readonly<ConnectionHealthSnapshot> {
    const current = this.#health.get(this.#key(tenantId, connectionId));
    const updated = cloneAndFreeze<ConnectionHealthSnapshot>({
      tenantId,
      connectionId,
      status: 'disabled',
      consecutiveFailures: current?.consecutiveFailures ?? 0,
      lastSuccessAt: current?.lastSuccessAt ?? null,
      lastFailureAt: current?.lastFailureAt ?? null,
      lastError: current?.lastError ?? null,
      checkedAt: at,
    });
    this.#health.set(this.#key(tenantId, connectionId), updated);
    return updated;
  }

  get(tenantId: string, connectionId: string): Readonly<ConnectionHealthSnapshot> | undefined {
    return this.#health.get(this.#key(tenantId, connectionId));
  }

  #key(tenantId: string, connectionId: string): string {
    return `${tenantId}:${connectionId}`;
  }
}
