import { cloneAndFreeze, constantTimeEqual, sha256 } from './common.js';

export type IntegrationCredentialStatus = 'active' | 'revoked';

export interface IssueIntegrationCredentialInput {
  tenantId: string;
  connectionId: string;
  name: string;
  scopes: readonly string[];
  dataCategories: readonly string[];
  expiresAt?: Date;
}

export interface IntegrationCredentialRecord {
  tenantId: string;
  connectionId: string;
  keyId: string;
  name: string;
  scopes: readonly string[];
  dataCategories: readonly string[];
  valueDigest: string;
  status: IntegrationCredentialStatus;
  createdAt: Date;
  expiresAt: Date | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string | null;
}

export interface IssuedIntegrationCredential {
  keyId: string;
  value: string;
  expiresAt: Date | null;
}

export interface AuthenticateIntegrationCredentialInput {
  tenantId: string;
  keyId: string;
  value: string;
  requiredScope: string;
}

export interface IntegrationPrincipal {
  tenantId: string;
  connectionId: string;
  keyId: string;
  scopes: readonly string[];
  dataCategories: readonly string[];
}

export interface IntegrationCredentialRegistryOptions {
  now?: () => Date;
  keyIdFactory?: () => string;
  valueFactory?: () => string;
}

function createRandomValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function requireUniqueValues(values: readonly string[], field: string): readonly string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) throw new Error(`${field} must not be empty`);
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} must be unique`);
  return Object.freeze(normalized);
}

export class IntegrationCredentialRegistry {
  readonly #records = new Map<string, Readonly<IntegrationCredentialRecord>>();
  readonly #now: () => Date;
  readonly #keyIdFactory: () => string;
  readonly #valueFactory: () => string;

  constructor(options: IntegrationCredentialRegistryOptions = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#keyIdFactory = options.keyIdFactory ?? (() => crypto.randomUUID());
    this.#valueFactory = options.valueFactory ?? createRandomValue;
  }

  async issue(
    input: IssueIntegrationCredentialInput,
  ): Promise<Readonly<IssuedIntegrationCredential>> {
    const now = this.#now();
    if (input.expiresAt && input.expiresAt <= now) {
      throw new Error('Credential expiration must be in the future');
    }
    const keyId = this.#keyIdFactory();
    const mapKey = this.#key(input.tenantId, keyId);
    if (this.#records.has(mapKey)) throw new Error('Credential key identifier already exists');
    const value = this.#valueFactory();
    const record = cloneAndFreeze<IntegrationCredentialRecord>({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      keyId,
      name: input.name,
      scopes: requireUniqueValues(input.scopes, 'Credential scopes'),
      dataCategories: requireUniqueValues(input.dataCategories, 'Credential data categories'),
      valueDigest: await sha256(value),
      status: 'active',
      createdAt: now,
      expiresAt: input.expiresAt ?? null,
      rotatedAt: null,
      revokedAt: null,
      revocationReason: null,
    });
    this.#records.set(mapKey, record);
    return cloneAndFreeze({ keyId, value, expiresAt: record.expiresAt });
  }

  async authenticate(
    input: AuthenticateIntegrationCredentialInput,
  ): Promise<Readonly<IntegrationPrincipal>> {
    const record = this.#records.get(this.#key(input.tenantId, input.keyId));
    if (!record) throw new Error('Invalid integration credential');
    if (record.status === 'revoked') throw new Error('Integration credential is revoked');
    if (record.expiresAt && record.expiresAt <= this.#now()) {
      throw new Error('Integration credential is expired');
    }
    const digest = await sha256(input.value);
    if (!constantTimeEqual(record.valueDigest, digest)) {
      throw new Error('Invalid integration credential');
    }
    if (!record.scopes.includes(input.requiredScope)) {
      throw new Error('Credential does not grant the required scope');
    }
    return cloneAndFreeze({
      tenantId: record.tenantId,
      connectionId: record.connectionId,
      keyId: record.keyId,
      scopes: record.scopes,
      dataCategories: record.dataCategories,
    });
  }

  async rotate(tenantId: string, keyId: string): Promise<Readonly<IssuedIntegrationCredential>> {
    const mapKey = this.#key(tenantId, keyId);
    const record = this.#records.get(mapKey);
    if (!record) throw new Error('Unknown integration credential');
    if (record.status === 'revoked') throw new Error('Integration credential is revoked');
    const value = this.#valueFactory();
    const updated = cloneAndFreeze<IntegrationCredentialRecord>({
      ...record,
      valueDigest: await sha256(value),
      rotatedAt: this.#now(),
    });
    this.#records.set(mapKey, updated);
    return cloneAndFreeze({ keyId, value, expiresAt: updated.expiresAt });
  }

  revoke(tenantId: string, keyId: string, reason: string): Readonly<IntegrationCredentialRecord> {
    if (reason.trim().length === 0) throw new Error('Revocation reason is required');
    const mapKey = this.#key(tenantId, keyId);
    const record = this.#records.get(mapKey);
    if (!record) throw new Error('Unknown integration credential');
    const updated = cloneAndFreeze<IntegrationCredentialRecord>({
      ...record,
      status: 'revoked',
      revokedAt: this.#now(),
      revocationReason: reason,
    });
    this.#records.set(mapKey, updated);
    return updated;
  }

  record(tenantId: string, keyId: string): Readonly<IntegrationCredentialRecord> | undefined {
    return this.#records.get(this.#key(tenantId, keyId));
  }

  #key(tenantId: string, keyId: string): string {
    return `${tenantId}:${keyId}`;
  }
}
