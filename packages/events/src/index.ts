export interface DomainEventInput<Payload> {
  eventType: string;
  schemaVersion: number;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  causationId?: string;
  payload: Payload;
  occurredAt?: Date;
}

export interface DomainEvent<Payload> extends DomainEventInput<Payload> {
  eventId: string;
  occurredAt: Date;
}

export function createDomainEvent<Payload>(
  input: DomainEventInput<Payload>,
): Readonly<DomainEvent<Payload>> {
  return Object.freeze({
    ...input,
    eventId: crypto.randomUUID(),
    occurredAt: input.occurredAt ?? new Date(),
  });
}

export class OptimisticConcurrencyError extends Error {
  constructor(
    readonly actualVersion: number,
    readonly expectedVersion: number,
  ) {
    super(`Expected aggregate version ${expectedVersion}, received ${actualVersion}`);
    this.name = 'OptimisticConcurrencyError';
  }
}

export function requireExpectedVersion(actualVersion: number, expectedVersion: number): void {
  if (actualVersion !== expectedVersion) {
    throw new OptimisticConcurrencyError(actualVersion, expectedVersion);
  }
}

interface CommandOutcome<Result, Event> {
  result: Result;
  events: readonly Event[];
}

interface CommandExecution<Result, Event> {
  tenantId: string;
  operation: string;
  idempotencyKey: string;
  handler: () => Promise<CommandOutcome<Result, Event>>;
}

export class IdempotentCommandExecutor {
  readonly #results = new Map<string, unknown>();
  readonly #outbox: unknown[] = [];

  get outbox(): readonly unknown[] {
    return [...this.#outbox];
  }

  async execute<Result, Event>(execution: CommandExecution<Result, Event>): Promise<Result> {
    const key = `${execution.tenantId}:${execution.operation}:${execution.idempotencyKey}`;
    if (this.#results.has(key)) {
      return this.#results.get(key) as Result;
    }

    const outcome = await execution.handler();
    this.#results.set(key, outcome.result);
    this.#outbox.push(...outcome.events);
    return outcome.result;
  }
}

export interface AuditEntryInput {
  tenantId: string;
  action: string;
  subjectId: string;
}

export interface AuditEntry extends AuditEntryInput {
  auditId: string;
  occurredAt: Date;
}

export class AppendOnlyAuditLog {
  readonly #entries: AuditEntry[] = [];

  append(input: AuditEntryInput): Readonly<AuditEntry> {
    const entry = Object.freeze({ ...input, auditId: crypto.randomUUID(), occurredAt: new Date() });
    this.#entries.push(entry);
    return entry;
  }

  entries(): readonly Readonly<AuditEntry>[] {
    return [...this.#entries];
  }

  replace(auditId: string, entry: AuditEntry): never {
    void auditId;
    void entry;
    throw new Error('Audit entries are append-only');
  }
}
