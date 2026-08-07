export const operationsEventTypePattern = /^operations\.[a-z0-9]+(?:[.-][a-z0-9]+)*\.v[1-9]\d*$/;

export interface OperationsEventContractInput {
  readonly eventId: string;
  readonly eventType: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly campusId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly correlationId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export interface ParsedOperationsEventType {
  readonly eventType: string;
  readonly domain: string;
  readonly version: number;
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`OPS_EVENT_FIELD_REQUIRED:${field}`);
}

export function parseOperationsEventType(eventType: string): ParsedOperationsEventType {
  if (!operationsEventTypePattern.test(eventType)) {
    throw new Error(`OPS_INVALID_EVENT_TYPE:${eventType}`);
  }
  const parts = eventType.split('.');
  const versionToken = parts.at(-1)!;
  return Object.freeze({
    eventType,
    domain: parts[1]!,
    version: Number(versionToken.slice(1)),
  });
}

export function assertOperationsEventContract(event: OperationsEventContractInput): void {
  parseOperationsEventType(event.eventType);
  for (const [field, value] of Object.entries({
    eventId: event.eventId,
    tenantId: event.tenantId,
    legalEntityId: event.legalEntityId,
    campusId: event.campusId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    correlationId: event.correlationId,
    actorId: event.actorId,
  })) {
    requireText(value, field);
  }
  if (!Number.isSafeInteger(event.aggregateVersion) || event.aggregateVersion <= 0) {
    throw new Error('OPS_INVALID_EVENT_AGGREGATE_VERSION');
  }
  if (Number.isNaN(Date.parse(event.occurredAt))) {
    throw new Error('OPS_INVALID_EVENT_OCCURRED_AT');
  }
}
