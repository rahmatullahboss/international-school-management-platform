export interface CountryPack {
  packKey: string;
  version: number;
  locales: readonly string[];
  defaultLocale: string;
}

export class CountryPackRegistry {
  readonly #versions = new Map<string, Readonly<CountryPack>>();
  readonly #activations = new Map<string, string>();

  publish(pack: CountryPack): Readonly<CountryPack> {
    const key = `${pack.packKey}:${pack.version}`;
    if (this.#versions.has(key)) {
      throw new Error('Country-pack version is immutable');
    }
    if (!pack.locales.includes(pack.defaultLocale)) {
      throw new Error('Default locale must be included');
    }
    const published = Object.freeze({ ...pack, locales: Object.freeze([...pack.locales]) });
    this.#versions.set(key, published);
    return published;
  }

  activate(tenantId: string, packKey: string, version: number): void {
    const versionKey = `${packKey}:${version}`;
    if (!this.#versions.has(versionKey)) {
      throw new Error('Unknown country-pack version');
    }
    this.#activations.set(`${tenantId}:${packKey}`, versionKey);
  }

  activeFor(tenantId: string, packKey: string): Readonly<CountryPack> | undefined {
    const versionKey = this.#activations.get(`${tenantId}:${packKey}`);
    return versionKey ? this.#versions.get(versionKey) : undefined;
  }
}

export function resolveLocale(
  requested: string,
  supported: readonly string[],
  fallback: string,
): string {
  const exact = supported.find((locale) => locale.toLowerCase() === requested.toLowerCase());
  if (exact) return exact;
  const language = requested.split('-')[0]?.toLowerCase();
  return supported.find((locale) => locale.toLowerCase() === language) ?? fallback;
}

export function localeDirection(locale: string): 'ltr' | 'rtl' {
  const language = locale.toLowerCase().split('-')[0];
  return ['ar', 'fa', 'he', 'ur'].includes(language ?? '') ? 'rtl' : 'ltr';
}

type WorkflowStatus = 'pending' | 'approved' | 'rejected' | 'completed';

interface WorkflowSnapshot {
  workflowId: string;
  status: WorkflowStatus;
  decidedBy?: string;
  decisionNote?: string;
}

export class ApprovalWorkflow {
  #state: WorkflowSnapshot;

  constructor(workflowId: string) {
    this.#state = { workflowId, status: 'pending' };
  }

  approve(decidedBy: string, decisionNote: string): void {
    this.#decide('approved', decidedBy, decisionNote);
  }

  reject(decidedBy: string, decisionNote: string): void {
    this.#decide('rejected', decidedBy, decisionNote);
  }

  complete(): void {
    if (this.#state.status !== 'approved' && this.#state.status !== 'rejected') {
      throw new Error('Workflow requires a decision');
    }
    this.#state = { ...this.#state, status: 'completed' };
  }

  snapshot(): Readonly<WorkflowSnapshot> {
    return Object.freeze({ ...this.#state });
  }

  #decide(status: 'approved' | 'rejected', decidedBy: string, decisionNote: string): void {
    if (this.#state.status !== 'pending') {
      throw new Error('Workflow is already decided');
    }
    this.#state = { ...this.#state, status, decidedBy, decisionNote };
  }
}

export type ScanStatus = 'pending' | 'clean' | 'quarantined';

interface DocumentRegistration {
  tenantId: string;
  objectKey: string;
  contentType: string;
}

interface DocumentRecord extends DocumentRegistration {
  documentId: string;
  scanStatus: ScanStatus;
}

export class DocumentRegistry {
  readonly #documents = new Map<string, Readonly<DocumentRecord>>();

  register(input: DocumentRegistration): Readonly<DocumentRecord> {
    const record = Object.freeze({
      ...input,
      documentId: crypto.randomUUID(),
      scanStatus: 'pending' as const,
    });
    this.#documents.set(record.documentId, record);
    return record;
  }

  recordScan(documentId: string, scanStatus: Exclude<ScanStatus, 'pending'>): void {
    const record = this.#documents.get(documentId);
    if (!record) throw new Error('Unknown document');
    this.#documents.set(documentId, Object.freeze({ ...record, scanStatus }));
  }

  isAvailable(documentId: string): boolean {
    return this.#documents.get(documentId)?.scanStatus === 'clean';
  }
}

export function buildNotificationKey(
  tenantId: string,
  templateKey: string,
  subjectId: string,
  recipientId: string,
): string {
  return `${tenantId}:${templateKey}:${subjectId}:${recipientId}`;
}
