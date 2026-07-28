import { cloneAndFreeze } from './common.js';

export type DisclosureDirection = 'inbound' | 'outbound';
export type DisclosureStatus = 'attempted' | 'delivered' | 'failed' | 'suppressed';

export interface DisclosureAuditInput {
  tenantId: string;
  connectionId: string;
  direction: DisclosureDirection;
  destination: string;
  dataCategories: readonly string[];
  purpose: string;
  recordCount: number;
  status: DisclosureStatus;
  correlationId: string;
  occurredAt: Date;
}

export interface DisclosureAuditEntry extends DisclosureAuditInput {
  disclosureId: string;
}

export interface IntegrationDisclosureAuditOptions {
  idFactory?: () => string;
}

export class IntegrationDisclosureAudit {
  readonly #entries: Readonly<DisclosureAuditEntry>[] = [];
  readonly #idFactory: () => string;

  constructor(options: IntegrationDisclosureAuditOptions = {}) {
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  append(input: DisclosureAuditInput): Readonly<DisclosureAuditEntry> {
    if (input.purpose.trim().length === 0) throw new Error('Disclosure purpose is required');
    if (input.dataCategories.length === 0)
      throw new Error('Disclosure data categories are required');
    if (!Number.isInteger(input.recordCount) || input.recordCount < 0) {
      throw new Error('Disclosure record count must be a non-negative integer');
    }
    const entry = cloneAndFreeze<DisclosureAuditEntry>({
      ...input,
      dataCategories: [...new Set(input.dataCategories)],
      disclosureId: this.#idFactory(),
    });
    this.#entries.push(entry);
    return entry;
  }

  entriesForTenant(tenantId: string): readonly Readonly<DisclosureAuditEntry>[] {
    return this.#entries.filter((entry) => entry.tenantId === tenantId);
  }
}
