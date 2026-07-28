import { AppendOnlyAuditLog, createDomainEvent, type DomainEvent } from '@school/events';

import type { StudentStatus } from './contracts.js';

export type StaffProfileStatus = 'active' | 'leave' | 'inactive' | 'terminated';
export type ProfileKind = 'student' | 'staff';

export interface StatusHistoryEntry<Status extends string> {
  statusHistoryId: string;
  status: Status;
  effectiveFrom: string;
  effectiveTo?: string;
  reasonCode: string;
  recordedAt: string;
}

export interface ProfileIdentifier {
  identifierId: string;
  identifierType: string;
  value: string;
  campusId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface ProfileDocument {
  profileDocumentId: string;
  documentId: string;
  documentType: string;
  visibility: 'standard' | 'restricted' | 'guardian-visible';
  validFrom?: string;
  validTo?: string;
}

export interface StudentProfile {
  tenantId: string;
  studentProfileId: string;
  personId: string;
  status: StudentStatus;
  version: number;
  identifiers: readonly ProfileIdentifier[];
  documents: readonly ProfileDocument[];
  statusHistory: readonly StatusHistoryEntry<StudentStatus>[];
}

export interface StaffProfile {
  tenantId: string;
  staffProfileId: string;
  personId: string;
  status: StaffProfileStatus;
  version: number;
  identifiers: readonly ProfileIdentifier[];
  documents: readonly ProfileDocument[];
  statusHistory: readonly StatusHistoryEntry<StaffProfileStatus>[];
}

interface MutableStudentProfile {
  tenantId: string;
  studentProfileId: string;
  personId: string;
  status: StudentStatus;
  version: number;
  identifiers: ProfileIdentifier[];
  documents: ProfileDocument[];
  statusHistory: StatusHistoryEntry<StudentStatus>[];
}

interface MutableStaffProfile {
  tenantId: string;
  staffProfileId: string;
  personId: string;
  status: StaffProfileStatus;
  version: number;
  identifiers: ProfileIdentifier[];
  documents: ProfileDocument[];
  statusHistory: StatusHistoryEntry<StaffProfileStatus>[];
}

export interface LifecycleAccessEffect {
  subjectType: ProfileKind;
  subjectId: string;
  status: string;
  interactiveAccess: 'enabled' | 'suspended' | 'revoked';
  guardianPortalVisibility?: 'visible' | 'historical' | 'hidden';
  futureOperationalExpectations: 'active' | 'paused' | 'closed';
}

export interface ProfileCommandResult<T> {
  value: T;
  events: readonly DomainEvent<unknown>[];
}

export class ProfileDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProfileDomainError';
  }
}

function periodValid(from: string, to?: string): boolean {
  return to === undefined || to >= from;
}

function cloneStudent(profile: MutableStudentProfile): StudentProfile {
  return {
    ...profile,
    identifiers: profile.identifiers.map((identifier) => ({ ...identifier })),
    documents: profile.documents.map((document) => ({ ...document })),
    statusHistory: profile.statusHistory.map((entry) => ({ ...entry })),
  };
}

function cloneStaff(profile: MutableStaffProfile): StaffProfile {
  return {
    ...profile,
    identifiers: profile.identifiers.map((identifier) => ({ ...identifier })),
    documents: profile.documents.map((document) => ({ ...document })),
    statusHistory: profile.statusHistory.map((entry) => ({ ...entry })),
  };
}

function closeCurrentStatus<Status extends string>(
  history: StatusHistoryEntry<Status>[],
  nextEffectiveFrom: string,
): void {
  const current = history.find((entry) => entry.effectiveTo === undefined);
  if (!current) return;
  if (nextEffectiveFrom <= current.effectiveFrom) {
    throw new ProfileDomainError(
      'SIS_PROFILE_STATUS_DATE_INVALID',
      'A new status must start after the current status',
    );
  }
  current.effectiveTo = nextEffectiveFrom;
}

function identifierKey(identifier: Pick<ProfileIdentifier, 'identifierType' | 'value'>): string {
  return `${identifier.identifierType.trim().toLowerCase()}:${identifier.value.trim().toLowerCase()}`;
}

export class ProfileRegistry {
  readonly #students = new Map<string, MutableStudentProfile>();
  readonly #staff = new Map<string, MutableStaffProfile>();
  readonly #studentByPerson = new Map<string, string>();
  readonly #staffByPerson = new Map<string, string>();
  readonly #identifierOwners = new Map<string, string>();
  readonly #audit = new AppendOnlyAuditLog();

  get auditLog(): AppendOnlyAuditLog {
    return this.#audit;
  }

  createStudentProfile(input: {
    tenantId: string;
    personId: string;
    effectiveFrom: string;
    correlationId: string;
  }): ProfileCommandResult<StudentProfile> {
    const personKey = `${input.tenantId}:${input.personId}`;
    const existing = this.#studentByPerson.get(personKey);
    if (existing) return { value: this.getStudent(input.tenantId, existing), events: [] };

    const statusEntry: StatusHistoryEntry<StudentStatus> = {
      statusHistoryId: crypto.randomUUID(),
      status: 'prospective',
      effectiveFrom: input.effectiveFrom,
      reasonCode: 'profile-created',
      recordedAt: new Date().toISOString(),
    };
    const profile: MutableStudentProfile = {
      tenantId: input.tenantId,
      studentProfileId: crypto.randomUUID(),
      personId: input.personId,
      status: 'prospective',
      version: 1,
      identifiers: [],
      documents: [],
      statusHistory: [statusEntry],
    };
    this.#students.set(profile.studentProfileId, profile);
    this.#studentByPerson.set(personKey, profile.studentProfileId);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.lifecycle.student-profile-created',
      subjectId: profile.studentProfileId,
    });

    return {
      value: cloneStudent(profile),
      events: [
        createDomainEvent({
          eventType: 'sis.lifecycle.student-profile-created.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'student-profile',
          aggregateId: profile.studentProfileId,
          aggregateVersion: profile.version,
          correlationId: input.correlationId,
          payload: { studentProfileId: profile.studentProfileId, personId: input.personId },
        }),
      ],
    };
  }

  createStaffProfile(input: {
    tenantId: string;
    personId: string;
    effectiveFrom: string;
  }): StaffProfile {
    const personKey = `${input.tenantId}:${input.personId}`;
    const existing = this.#staffByPerson.get(personKey);
    if (existing) return this.getStaff(input.tenantId, existing);

    const profile: MutableStaffProfile = {
      tenantId: input.tenantId,
      staffProfileId: crypto.randomUUID(),
      personId: input.personId,
      status: 'active',
      version: 1,
      identifiers: [],
      documents: [],
      statusHistory: [
        {
          statusHistoryId: crypto.randomUUID(),
          status: 'active',
          effectiveFrom: input.effectiveFrom,
          reasonCode: 'profile-created',
          recordedAt: new Date().toISOString(),
        },
      ],
    };
    this.#staff.set(profile.staffProfileId, profile);
    this.#staffByPerson.set(personKey, profile.staffProfileId);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.lifecycle.staff-profile-created',
      subjectId: profile.staffProfileId,
    });
    return cloneStaff(profile);
  }

  changeStudentStatus(input: {
    tenantId: string;
    studentProfileId: string;
    status: StudentStatus;
    effectiveFrom: string;
    reasonCode: string;
  }): StudentProfile {
    const profile = this.#requireStudent(input.tenantId, input.studentProfileId);
    if (profile.status === input.status) return cloneStudent(profile);
    closeCurrentStatus(profile.statusHistory, input.effectiveFrom);
    profile.statusHistory.push({
      statusHistoryId: crypto.randomUUID(),
      status: input.status,
      effectiveFrom: input.effectiveFrom,
      reasonCode: input.reasonCode,
      recordedAt: new Date().toISOString(),
    });
    profile.status = input.status;
    profile.version += 1;
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.lifecycle.student-status-changed',
      subjectId: profile.studentProfileId,
    });
    return cloneStudent(profile);
  }

  changeStaffStatus(input: {
    tenantId: string;
    staffProfileId: string;
    status: StaffProfileStatus;
    effectiveFrom: string;
    reasonCode: string;
  }): StaffProfile {
    const profile = this.#requireStaff(input.tenantId, input.staffProfileId);
    if (profile.status === input.status) return cloneStaff(profile);
    closeCurrentStatus(profile.statusHistory, input.effectiveFrom);
    profile.statusHistory.push({
      statusHistoryId: crypto.randomUUID(),
      status: input.status,
      effectiveFrom: input.effectiveFrom,
      reasonCode: input.reasonCode,
      recordedAt: new Date().toISOString(),
    });
    profile.status = input.status;
    profile.version += 1;
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.lifecycle.staff-status-changed',
      subjectId: profile.staffProfileId,
    });
    return cloneStaff(profile);
  }

  assignIdentifier(input: {
    tenantId: string;
    profileKind: ProfileKind;
    profileId: string;
    identifierType: string;
    value: string;
    campusId?: string;
    effectiveFrom: string;
    effectiveTo?: string;
  }): ProfileIdentifier {
    if (!periodValid(input.effectiveFrom, input.effectiveTo)) {
      throw new ProfileDomainError(
        'SIS_PROFILE_IDENTIFIER_PERIOD_INVALID',
        'Identifier period is invalid',
      );
    }
    const uniquenessKey = `${input.tenantId}:${identifierKey(input)}`;
    const owner = this.#identifierOwners.get(uniquenessKey);
    if (owner && owner !== input.profileId) {
      throw new ProfileDomainError(
        'SIS_PROFILE_IDENTIFIER_DUPLICATE',
        'Identifier is already assigned in the tenant',
      );
    }
    const identifier: ProfileIdentifier = {
      identifierId: crypto.randomUUID(),
      identifierType: input.identifierType,
      value: input.value,
      ...(input.campusId === undefined ? {} : { campusId: input.campusId }),
      effectiveFrom: input.effectiveFrom,
      ...(input.effectiveTo === undefined ? {} : { effectiveTo: input.effectiveTo }),
    };
    const profile = this.#requireProfile(input.tenantId, input.profileKind, input.profileId);
    profile.identifiers.push(identifier);
    profile.version += 1;
    this.#identifierOwners.set(uniquenessKey, input.profileId);
    return { ...identifier };
  }

  attachDocument(input: {
    tenantId: string;
    profileKind: ProfileKind;
    profileId: string;
    documentId: string;
    documentType: string;
    visibility: ProfileDocument['visibility'];
    validFrom?: string;
    validTo?: string;
  }): ProfileDocument {
    if (input.validFrom !== undefined && !periodValid(input.validFrom, input.validTo)) {
      throw new ProfileDomainError(
        'SIS_PROFILE_DOCUMENT_PERIOD_INVALID',
        'Document period is invalid',
      );
    }
    const document: ProfileDocument = {
      profileDocumentId: crypto.randomUUID(),
      documentId: input.documentId,
      documentType: input.documentType,
      visibility: input.visibility,
      ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }),
      ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
    };
    const profile = this.#requireProfile(input.tenantId, input.profileKind, input.profileId);
    profile.documents.push(document);
    profile.version += 1;
    return { ...document };
  }

  getStudent(tenantId: string, studentProfileId: string): StudentProfile {
    return cloneStudent(this.#requireStudent(tenantId, studentProfileId));
  }

  getStaff(tenantId: string, staffProfileId: string): StaffProfile {
    return cloneStaff(this.#requireStaff(tenantId, staffProfileId));
  }

  accessEffect(
    tenantId: string,
    profileKind: ProfileKind,
    profileId: string,
  ): LifecycleAccessEffect {
    if (profileKind === 'student') {
      const profile = this.#requireStudent(tenantId, profileId);
      if (profile.status === 'active') {
        return {
          subjectType: 'student',
          subjectId: profileId,
          status: profile.status,
          interactiveAccess: 'enabled',
          guardianPortalVisibility: 'visible',
          futureOperationalExpectations: 'active',
        };
      }
      if (profile.status === 'prospective' || profile.status === 'leave') {
        return {
          subjectType: 'student',
          subjectId: profileId,
          status: profile.status,
          interactiveAccess: 'suspended',
          guardianPortalVisibility: 'visible',
          futureOperationalExpectations: 'paused',
        };
      }
      return {
        subjectType: 'student',
        subjectId: profileId,
        status: profile.status,
        interactiveAccess: 'revoked',
        guardianPortalVisibility: 'historical',
        futureOperationalExpectations: 'closed',
      };
    }

    const profile = this.#requireStaff(tenantId, profileId);
    if (profile.status === 'active') {
      return {
        subjectType: 'staff',
        subjectId: profileId,
        status: profile.status,
        interactiveAccess: 'enabled',
        futureOperationalExpectations: 'active',
      };
    }
    if (profile.status === 'leave') {
      return {
        subjectType: 'staff',
        subjectId: profileId,
        status: profile.status,
        interactiveAccess: 'suspended',
        futureOperationalExpectations: 'paused',
      };
    }
    return {
      subjectType: 'staff',
      subjectId: profileId,
      status: profile.status,
      interactiveAccess: 'revoked',
      futureOperationalExpectations: 'closed',
    };
  }

  #requireProfile(
    tenantId: string,
    kind: ProfileKind,
    profileId: string,
  ): MutableStudentProfile | MutableStaffProfile {
    return kind === 'student'
      ? this.#requireStudent(tenantId, profileId)
      : this.#requireStaff(tenantId, profileId);
  }

  #requireStudent(tenantId: string, profileId: string): MutableStudentProfile {
    const profile = this.#students.get(profileId);
    if (!profile || profile.tenantId !== tenantId) {
      throw new ProfileDomainError(
        'SIS_STUDENT_PROFILE_NOT_FOUND',
        'Student profile was not found',
      );
    }
    return profile;
  }

  #requireStaff(tenantId: string, profileId: string): MutableStaffProfile {
    const profile = this.#staff.get(profileId);
    if (!profile || profile.tenantId !== tenantId) {
      throw new ProfileDomainError('SIS_STAFF_PROFILE_NOT_FOUND', 'Staff profile was not found');
    }
    return profile;
  }
}
