export type DeploymentProfile = 'regional-pooled' | 'dedicated';
export type ProvisioningStatus = 'pending' | 'database-ready' | 'active' | 'suspended';

export interface TenantRegistration {
  tenantId: string;
  slug: string;
  displayName: string;
  homeRegion: string;
  deploymentProfile: DeploymentProfile;
  databaseBinding: string;
}

export interface TenantRecord extends TenantRegistration {
  provisioningStatus: ProvisioningStatus;
  domains: readonly string[];
}

export interface TenantContext {
  tenantId: string;
  homeRegion: string;
  deploymentProfile: DeploymentProfile;
  databaseBinding: string;
}

const provisioningTransitions: Readonly<Record<ProvisioningStatus, readonly ProvisioningStatus[]>> =
  {
    pending: ['database-ready'],
    'database-ready': ['active'],
    active: ['suspended'],
    suspended: ['active'],
  };

function normalizeDomain(domain: string): string {
  const normalized = domain.trim().toLowerCase().replace(/\.$/u, '');
  if (!normalized || normalized.includes('/') || normalized.includes(':')) {
    throw new Error('Invalid tenant domain');
  }
  return normalized;
}

function assertSafeSegment(value: string, label: string): void {
  if (!value || value.includes(':') || value.includes('..') || /[\\/]/u.test(value)) {
    throw new Error(`Unsafe ${label}`);
  }
}

export class TenantDirectory {
  readonly #tenants = new Map<string, TenantRecord>();
  readonly #slugOwners = new Map<string, string>();
  readonly #domainOwners = new Map<string, string>();

  register(registration: TenantRegistration): TenantRecord {
    const slug = registration.slug.trim().toLowerCase();
    assertSafeSegment(slug, 'tenant slug');
    if (this.#tenants.has(registration.tenantId)) {
      throw new Error('Tenant is already registered');
    }
    if (this.#slugOwners.has(slug)) {
      throw new Error('Tenant slug is already assigned');
    }

    const record: TenantRecord = Object.freeze({
      ...registration,
      slug,
      provisioningStatus: 'pending',
      domains: Object.freeze([]),
    });
    this.#tenants.set(registration.tenantId, record);
    this.#slugOwners.set(slug, registration.tenantId);
    return record;
  }

  get(tenantId: string): TenantRecord | undefined {
    return this.#tenants.get(tenantId);
  }

  attachDomain(tenantId: string, domain: string): TenantRecord {
    const record = this.#require(tenantId);
    const normalized = normalizeDomain(domain);
    const currentOwner = this.#domainOwners.get(normalized);
    if (currentOwner && currentOwner !== tenantId) {
      throw new Error('Domain is already assigned');
    }

    const domains = record.domains.includes(normalized)
      ? record.domains
      : Object.freeze([...record.domains, normalized]);
    const updated = Object.freeze({ ...record, domains });
    this.#tenants.set(tenantId, updated);
    this.#domainOwners.set(normalized, tenantId);
    return updated;
  }

  resolveDomain(domain: string): TenantRecord | undefined {
    const owner = this.#domainOwners.get(normalizeDomain(domain));
    return owner ? this.#tenants.get(owner) : undefined;
  }

  transitionProvisioning(tenantId: string, next: ProvisioningStatus): TenantRecord {
    const record = this.#require(tenantId);
    if (!provisioningTransitions[record.provisioningStatus].includes(next)) {
      throw new Error('Invalid provisioning transition');
    }
    const updated = Object.freeze({ ...record, provisioningStatus: next });
    this.#tenants.set(tenantId, updated);
    return updated;
  }

  #require(tenantId: string): TenantRecord {
    const record = this.#tenants.get(tenantId);
    if (!record) {
      throw new Error('Unknown tenant');
    }
    return record;
  }
}

export function createTenantContext(input: TenantContext): Readonly<TenantContext> {
  return Object.freeze({ ...input });
}

export function buildTenantCacheKey(
  tenantId: string,
  namespace: string,
  resourceId: string,
): string {
  assertSafeSegment(tenantId, 'tenant id');
  assertSafeSegment(namespace, 'cache namespace');
  assertSafeSegment(resourceId, 'cache resource id');
  return `tenant:${tenantId}:${namespace}:${resourceId}`;
}

export function buildTenantObjectKey(tenantId: string, relativePath: string): string {
  assertSafeSegment(tenantId, 'tenant id');
  const normalized = relativePath.trim().replace(/^\/+|\/+$/gu, '');
  if (!normalized || normalized.includes('..') || normalized.includes('\\')) {
    throw new Error('Unsafe object path');
  }
  return `tenants/${tenantId}/${normalized}`;
}
