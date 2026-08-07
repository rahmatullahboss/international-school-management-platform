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
export declare class InMemoryOperationsEventPublisher implements OperationsEventPublisher {
    #private;
    get events(): readonly OperationsDomainEvent<unknown>[];
    publish<Payload>(event: OperationsDomainEvent<Payload>): void;
}
export declare class InMemoryOperationsAuditWriter implements OperationsAuditWriter {
    #private;
    get entries(): readonly OperationsAuditEntry[];
    append(entry: OperationsAuditEntry): void;
}
export declare function authorizeOperations(principal: OperationsPrincipal, permission: string, scope: OperationsScope, options?: {
    readonly requireAal2?: boolean;
}): void;
export declare function assertIdentifier(value: string, field: string): void;
export declare function assertDate(value: string, field: string): void;
export declare function createOperationsEvent<Payload>(input: {
    readonly eventType: string;
    readonly scope: OperationsScope;
    readonly aggregateType: string;
    readonly aggregateId: string;
    readonly aggregateVersion: number;
    readonly correlationId: string;
    readonly actorId: string;
    readonly payload: Payload;
    readonly occurredAt?: string;
}): OperationsDomainEvent<Payload>;
export declare function createOperationsAudit(input: {
    readonly scope: OperationsScope;
    readonly action: string;
    readonly subjectType: string;
    readonly subjectId: string;
    readonly actorId: string;
    readonly correlationId: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly occurredAt?: string;
}): OperationsAuditEntry;
//# sourceMappingURL=contracts.d.ts.map