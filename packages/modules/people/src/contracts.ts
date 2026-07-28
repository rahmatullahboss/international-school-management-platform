export const PEOPLE_SCHEMA_VERSION = 1 as const;

export type PersonStatus = 'active' | 'inactive' | 'deceased' | 'merged';
export type NameUsage = 'legal' | 'preferred' | 'former' | 'local-script';
export type ContactKind = 'email' | 'phone' | 'messaging';
export type AuthorityKind =
  'legal' | 'education' | 'billing' | 'communication' | 'pickup' | 'portal';

export interface EffectivePeriod {
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface PersonReference {
  tenantId: string;
  personId: string;
  version: number;
  displayName: string;
  status: PersonStatus;
}

export interface GuardianAuthoritySnapshot extends EffectivePeriod {
  tenantId: string;
  authorityId: string;
  guardianPersonId: string;
  studentPersonId: string;
  authorities: readonly AuthorityKind[];
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'expired';
  portalAccess: boolean;
  restrictionReference?: string;
}

export interface PeopleEventPayloads {
  'sis.people.person-created.v1': {
    personId: string;
    displayName: string;
  };
  'sis.people.person-merged.v1': {
    survivingPersonId: string;
    mergedPersonId: string;
  };
  'sis.people.guardian-authority-changed.v1': {
    authorityId: string;
    guardianPersonId: string;
    studentPersonId: string;
    portalAccess: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
  };
}

export const peopleApiContract = Object.freeze({
  version: 'v1',
  commands: [
    'CreatePerson',
    'AddPersonName',
    'AddIdentifier',
    'AddContactPoint',
    'CreateHousehold',
    'SetGuardianAuthority',
    'RecordConsent',
    'MergePerson',
  ],
  queries: [
    'GetPerson',
    'SearchPeople',
    'GetHousehold',
    'ListStudentGuardians',
    'ListDuplicateCandidates',
  ],
});
