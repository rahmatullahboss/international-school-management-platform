export class InMemoryOperationsEventPublisher {
    #events = [];
    get events() {
        return Object.freeze([...this.#events]);
    }
    publish(event) {
        this.#events.push(Object.freeze({ ...event }));
    }
}
export class InMemoryOperationsAuditWriter {
    #entries = [];
    get entries() {
        return Object.freeze([...this.#entries]);
    }
    append(entry) {
        this.#entries.push(Object.freeze({ ...entry, details: Object.freeze({ ...entry.details }) }));
    }
}
export function authorizeOperations(principal, permission, scope, options = {}) {
    if (principal.tenantId !== scope.tenantId ||
        (!principal.campusIds.includes('*') && !principal.campusIds.includes(scope.campusId))) {
        throw new Error('OPS_SCOPE_MISMATCH');
    }
    if (!principal.permissions.includes(permission) &&
        !principal.permissions.includes('operations.*')) {
        throw new Error(`OPS_PERMISSION_DENIED:${permission}`);
    }
    if (options.requireAal2 === true && principal.assurance !== 'aal2') {
        throw new Error('OPS_STEP_UP_REQUIRED');
    }
}
export function assertIdentifier(value, field) {
    if (value.trim().length === 0 || value.length > 200) {
        throw new Error(`OPS_INVALID_IDENTIFIER:${field}`);
    }
}
export function assertDate(value, field) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
        throw new Error(`OPS_INVALID_DATE:${field}`);
    }
}
export function createOperationsEvent(input) {
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
export function createOperationsAudit(input) {
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
//# sourceMappingURL=contracts.js.map