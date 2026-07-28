export type OperationsAssuranceLevel = 'aal1' | 'aal2';

export interface OperationsScope {
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly campusId: string;
}

export interface OperationsPrincipal {
  readonly principalId: string;
  readonly tenantId: string;
  readonly campusIds: readonly string[];
  readonly permissions: readonly string[];
  readonly assurance: OperationsAssuranceLevel;
}

export interface OperationsDomainEvent<Payload = Readonly<Record<string, unknown>>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: 1;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly campusId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly correlationId: string;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly payload: Payload;
}

export interface OperationsEventPublisher {
  publish<Payload>(event: OperationsDomainEvent<Payload>): void;
}

export interface OperationsAuditEntry {
  readonly auditId: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly campusId: string;
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface OperationsAuditWriter {
  append(entry: OperationsAuditEntry): void;
}

export class InMemoryOperationsEventPublisher implements OperationsEventPublisher {
  readonly #events: OperationsDomainEvent<unknown>[] = [];

  get events(): readonly OperationsDomainEvent<unknown>[] {
    return Object.freeze([...this.#events]);
  }

  publish<Payload>(event: OperationsDomainEvent<Payload>): void {
    this.#events.push(Object.freeze({ ...event }));
  }
}

export class InMemoryOperationsAuditWriter implements OperationsAuditWriter {
  readonly #entries: OperationsAuditEntry[] = [];

  get entries(): readonly OperationsAuditEntry[] {
    return Object.freeze([...this.#entries]);
  }

  append(entry: OperationsAuditEntry): void {
    this.#entries.push(Object.freeze({ ...entry, details: Object.freeze({ ...entry.details }) }));
  }
}

export function authorizeOperations(
  principal: OperationsPrincipal,
  permission: string,
  scope: OperationsScope,
  options: { readonly requireAal2?: boolean } = {},
): void {
  if (
    principal.tenantId !== scope.tenantId ||
    (!principal.campusIds.includes('*') && !principal.campusIds.includes(scope.campusId))
  ) {
    throw new Error('OPS_SCOPE_MISMATCH');
  }
  if (
    !principal.permissions.includes(permission) &&
    !principal.permissions.includes('operations.*')
  ) {
    throw new Error(`OPS_PERMISSION_DENIED:${permission}`);
  }
  if (options.requireAal2 === true && principal.assurance !== 'aal2') {
    throw new Error('OPS_STEP_UP_REQUIRED');
  }
}

export function assertIdentifier(value: string, field: string): void {
  if (value.trim().length === 0 || value.length > 200) {
    throw new Error(`OPS_INVALID_IDENTIFIER:${field}`);
  }
}

export function assertDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`OPS_INVALID_DATE:${field}`);
  }
}

export function createOperationsEvent<Payload>(input: {
  readonly eventType: string;
  readonly scope: OperationsScope;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly correlationId: string;
  readonly actorId: string;
  readonly payload: Payload;
  readonly occurredAt?: string;
}): OperationsDomainEvent<Payload> {
  return Object.freeze({
    eventId: crypto.randomUUID(),
    eventType: input.eventType,
    schemaVersion: 1,
    tenantId: input.scope.tenantId,
    legalEntityId: input.scope.legalEntityId,
    campusId: input.scope.campusId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion,
    correlationId: input.correlationId,
    actorId: input.actorId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload,
  });
}

export function createOperationsAudit(input: {
  readonly scope: OperationsScope;
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly occurredAt?: string;
}): OperationsAuditEntry {
  return Object.freeze({
    auditId: crypto.randomUUID(),
    tenantId: input.scope.tenantId,
    legalEntityId: input.scope.legalEntityId,
    campusId: input.scope.campusId,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    details: Object.freeze({ ...(input.details ?? {}) }),
  });
}
