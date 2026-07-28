import { cloneAndFreeze } from './common.js';

export type ExternalIdAuthority = 'internal' | 'external' | 'shared';
export type ExternalIdStatus = 'active' | 'tombstoned';

export interface LinkExternalIdInput {
  tenantId: string;
  connectionId: string;
  objectType: string;
  internalId: string;
  externalId: string;
  externalVersion?: string;
  etag?: string;
  authority: ExternalIdAuthority;
  status?: ExternalIdStatus;
}

export interface ExternalIdRecord {
  tenantId: string;
  connectionId: string;
  objectType: string;
  internalId: string;
  externalId: string;
  externalVersion: string | null;
  etag: string | null;
  authority: ExternalIdAuthority;
  status: ExternalIdStatus;
  lastSynchronizedAt: Date | null;
}

export interface RecordExternalSynchronizationInput {
  tenantId: string;
  connectionId: string;
  objectType: string;
  internalId: string;
  externalVersion?: string;
  etag?: string;
  synchronizedAt: Date;
  status?: ExternalIdStatus;
}

export class ExternalIdRegistry {
  readonly #byInternal = new Map<string, Readonly<ExternalIdRecord>>();
  readonly #byExternal = new Map<string, Readonly<ExternalIdRecord>>();

  link(input: LinkExternalIdInput): Readonly<ExternalIdRecord> {
    const internalKey = this.#internalKey(
      input.tenantId,
      input.connectionId,
      input.objectType,
      input.internalId,
    );
    const externalKey = this.#externalKey(
      input.tenantId,
      input.connectionId,
      input.objectType,
      input.externalId,
    );
    const existingInternal = this.#byInternal.get(internalKey);
    const existingExternal = this.#byExternal.get(externalKey);
    if (existingExternal && existingExternal.internalId !== input.internalId) {
      throw new Error('External identifier is already linked');
    }
    if (existingInternal && existingInternal.externalId !== input.externalId) {
      throw new Error('Internal object already has another external identifier');
    }
    if (existingInternal) return existingInternal;

    const record = cloneAndFreeze<ExternalIdRecord>({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      objectType: input.objectType,
      internalId: input.internalId,
      externalId: input.externalId,
      externalVersion: input.externalVersion ?? null,
      etag: input.etag ?? null,
      authority: input.authority,
      status: input.status ?? 'active',
      lastSynchronizedAt: null,
    });
    this.#byInternal.set(internalKey, record);
    this.#byExternal.set(externalKey, record);
    return record;
  }

  byInternal(
    tenantId: string,
    connectionId: string,
    objectType: string,
    internalId: string,
  ): Readonly<ExternalIdRecord> | undefined {
    return this.#byInternal.get(this.#internalKey(tenantId, connectionId, objectType, internalId));
  }

  byExternal(
    tenantId: string,
    connectionId: string,
    objectType: string,
    externalId: string,
  ): Readonly<ExternalIdRecord> | undefined {
    return this.#byExternal.get(this.#externalKey(tenantId, connectionId, objectType, externalId));
  }

  recordSynchronization(input: RecordExternalSynchronizationInput): Readonly<ExternalIdRecord> {
    const internalKey = this.#internalKey(
      input.tenantId,
      input.connectionId,
      input.objectType,
      input.internalId,
    );
    const record = this.#byInternal.get(internalKey);
    if (!record) throw new Error('Unknown external identifier link');
    const updated = cloneAndFreeze<ExternalIdRecord>({
      ...record,
      externalVersion: input.externalVersion ?? record.externalVersion,
      etag: input.etag ?? record.etag,
      status: input.status ?? record.status,
      lastSynchronizedAt: input.synchronizedAt,
    });
    this.#byInternal.set(internalKey, updated);
    this.#byExternal.set(
      this.#externalKey(record.tenantId, record.connectionId, record.objectType, record.externalId),
      updated,
    );
    return updated;
  }

  #internalKey(
    tenantId: string,
    connectionId: string,
    objectType: string,
    internalId: string,
  ): string {
    return `${tenantId}:${connectionId}:${objectType}:internal:${internalId}`;
  }

  #externalKey(
    tenantId: string,
    connectionId: string,
    objectType: string,
    externalId: string,
  ): string {
    return `${tenantId}:${connectionId}:${objectType}:external:${externalId}`;
  }
}
