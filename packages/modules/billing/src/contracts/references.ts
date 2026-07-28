export type OpaqueRef<T extends string> = string & { readonly __brand: T };

export type TenantRef = OpaqueRef<'tenant'>;
export type LegalEntityRef = OpaqueRef<'legal-entity'>;
export type CampusRef = OpaqueRef<'campus'>;
export type PersonRef = OpaqueRef<'person'>;

export interface TenantSnapshot {
  readonly id: TenantRef;
  readonly displayName: string;
}

export interface LegalEntitySnapshot {
  readonly id: LegalEntityRef;
  readonly displayName: string;
  readonly registrationNumber?: string;
}

export interface CampusSnapshot {
  readonly id: CampusRef;
  readonly displayName: string;
}

export interface PersonSnapshot {
  readonly id: PersonRef;
  readonly displayName: string;
}

function assertReference(value: string, kind: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 200) throw new Error(`Invalid ${kind} reference`);
  return normalized;
}

export function createTenantRef(value: string): TenantRef {
  return assertReference(value, 'tenant') as TenantRef;
}

export function createLegalEntityRef(value: string): LegalEntityRef {
  return assertReference(value, 'legal entity') as LegalEntityRef;
}

export function createCampusRef(value: string): CampusRef {
  return assertReference(value, 'campus') as CampusRef;
}

export function createPersonRef(value: string): PersonRef {
  return assertReference(value, 'person') as PersonRef;
}
