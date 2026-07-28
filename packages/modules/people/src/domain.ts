import { AppendOnlyAuditLog, createDomainEvent, type DomainEvent } from '@school/events';

import type { AuthorityKind, ContactKind, NameUsage, PersonStatus } from './contracts.js';

export interface PersonNameInput {
  usage: NameUsage;
  givenName: string;
  familyName: string;
  middleNames?: readonly string[];
  locale?: string;
  script?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface PersonIdentifierInput {
  identifierType: string;
  value: string;
  issuingCountry?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface ContactPointInput {
  kind: ContactKind;
  value: string;
  label?: string;
  primary?: boolean;
  verifiedAt?: string;
}

export interface PostalAddressInput {
  addressType: 'home' | 'mailing' | 'work' | 'other';
  lines: readonly string[];
  locality: string;
  administrativeArea?: string;
  postalCode?: string;
  countryCode: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface CreatePersonInput {
  tenantId: string;
  names: readonly PersonNameInput[];
  dateOfBirth?: string;
  identifiers?: readonly PersonIdentifierInput[];
  contacts?: readonly ContactPointInput[];
  addresses?: readonly PostalAddressInput[];
  correlationId: string;
}

export interface PersonRecord {
  tenantId: string;
  personId: string;
  status: PersonStatus;
  version: number;
  names: readonly PersonNameInput[];
  identifiers: readonly PersonIdentifierInput[];
  contacts: readonly ContactPointInput[];
  addresses: readonly PostalAddressInput[];
  dateOfBirth?: string;
  mergedIntoPersonId?: string;
  createdAt: string;
  updatedAt: string;
}

interface MutablePerson {
  tenantId: string;
  personId: string;
  status: PersonStatus;
  version: number;
  names: PersonNameInput[];
  identifiers: PersonIdentifierInput[];
  contacts: ContactPointInput[];
  addresses: PostalAddressInput[];
  dateOfBirth?: string;
  mergedIntoPersonId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMemberInput {
  personId: string;
  role: 'adult' | 'child' | 'dependent' | 'sponsor' | 'other';
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface HouseholdRecord {
  tenantId: string;
  householdId: string;
  displayName: string;
  members: readonly HouseholdMemberInput[];
  version: number;
}

export interface GuardianAuthorityInput {
  tenantId: string;
  guardianPersonId: string;
  studentPersonId: string;
  authorities: readonly AuthorityKind[];
  verificationStatus: 'pending' | 'verified' | 'rejected';
  effectiveFrom: string;
  effectiveTo?: string;
  restrictionReference?: string;
  correlationId: string;
}

export interface GuardianAuthorityRecord extends Omit<GuardianAuthorityInput, 'correlationId'> {
  authorityId: string;
  version: number;
}

export interface ConsentRecord {
  tenantId: string;
  consentId: string;
  subjectPersonId: string;
  grantedByPersonId: string;
  purpose: string;
  status: 'granted' | 'withdrawn' | 'expired';
  effectiveFrom: string;
  effectiveTo?: string;
  version: number;
}

export interface DuplicateCandidate {
  tenantId: string;
  candidateId: string;
  leftPersonId: string;
  rightPersonId: string;
  score: number;
  reasons: readonly string[];
  status: 'open' | 'dismissed' | 'merged';
}

export interface PersonMergeRecord {
  tenantId: string;
  mergeId: string;
  survivingPersonId: string;
  mergedPersonId: string;
  reason: string;
  mergedAt: string;
}

export interface PeopleCommandResult<T> {
  value: T;
  events: readonly DomainEvent<unknown>[];
}

export class PeopleDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PeopleDomainError';
  }
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('en').replaceAll(/\s+/gu, ' ');
}

function displayName(person: MutablePerson): string {
  const preferred = person.names.find((name) => name.usage === 'preferred');
  const legal = person.names.find((name) => name.usage === 'legal');
  const selected = preferred ?? legal ?? person.names[0];
  if (!selected) return person.personId;
  return [selected.givenName, ...(selected.middleNames ?? []), selected.familyName]
    .filter(Boolean)
    .join(' ');
}

function dateWithin(at: string, from: string, to?: string): boolean {
  return at >= from && (to === undefined || at <= to);
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const identity = key(item);
    if (!seen.has(identity)) {
      seen.add(identity);
      result.push(item);
    }
  }
  return result;
}

function clonePerson(person: MutablePerson): PersonRecord {
  return {
    tenantId: person.tenantId,
    personId: person.personId,
    status: person.status,
    version: person.version,
    names: [...person.names],
    identifiers: [...person.identifiers],
    contacts: [...person.contacts],
    addresses: [...person.addresses],
    ...(person.dateOfBirth === undefined ? {} : { dateOfBirth: person.dateOfBirth }),
    ...(person.mergedIntoPersonId === undefined
      ? {}
      : { mergedIntoPersonId: person.mergedIntoPersonId }),
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
}

export class PeopleDirectory {
  readonly #people = new Map<string, MutablePerson>();
  readonly #households = new Map<string, HouseholdRecord>();
  readonly #authorities = new Map<string, GuardianAuthorityRecord>();
  readonly #consents = new Map<string, ConsentRecord>();
  readonly #duplicates = new Map<string, DuplicateCandidate>();
  readonly #merges: PersonMergeRecord[] = [];
  readonly #audit = new AppendOnlyAuditLog();

  get auditLog(): AppendOnlyAuditLog {
    return this.#audit;
  }

  createPerson(input: CreatePersonInput): PeopleCommandResult<PersonRecord> {
    if (input.names.length === 0 || !input.names.some((name) => name.usage === 'legal')) {
      throw new PeopleDomainError('SIS_PEOPLE_LEGAL_NAME_REQUIRED', 'A legal name is required');
    }

    const now = new Date().toISOString();
    const person: MutablePerson = {
      tenantId: input.tenantId,
      personId: crypto.randomUUID(),
      status: 'active',
      version: 1,
      names: [...input.names],
      identifiers: [...(input.identifiers ?? [])],
      contacts: [...(input.contacts ?? [])],
      addresses: [...(input.addresses ?? [])],
      ...(input.dateOfBirth === undefined ? {} : { dateOfBirth: input.dateOfBirth }),
      createdAt: now,
      updatedAt: now,
    };
    this.#people.set(person.personId, person);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.people.person-created',
      subjectId: person.personId,
    });

    return {
      value: clonePerson(person),
      events: [
        createDomainEvent({
          eventType: 'sis.people.person-created.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'person',
          aggregateId: person.personId,
          aggregateVersion: person.version,
          correlationId: input.correlationId,
          payload: { personId: person.personId, displayName: displayName(person) },
        }),
      ],
    };
  }

  getPerson(tenantId: string, personId: string): PersonRecord {
    return clonePerson(this.#requirePerson(tenantId, personId));
  }

  createHousehold(
    tenantId: string,
    displayNameValue: string,
    members: readonly HouseholdMemberInput[],
  ): HouseholdRecord {
    if (members.length === 0) {
      throw new PeopleDomainError('SIS_HOUSEHOLD_MEMBER_REQUIRED', 'A household needs a member');
    }
    for (const member of members) this.#requirePerson(tenantId, member.personId);
    const record: HouseholdRecord = {
      tenantId,
      householdId: crypto.randomUUID(),
      displayName: displayNameValue.trim(),
      members: [...members],
      version: 1,
    };
    this.#households.set(record.householdId, record);
    this.#audit.append({
      tenantId,
      action: 'sis.people.household-created',
      subjectId: record.householdId,
    });
    return { ...record, members: [...record.members] };
  }

  setGuardianAuthority(
    input: GuardianAuthorityInput,
  ): PeopleCommandResult<GuardianAuthorityRecord> {
    this.#requirePerson(input.tenantId, input.guardianPersonId);
    this.#requirePerson(input.tenantId, input.studentPersonId);
    if (input.guardianPersonId === input.studentPersonId) {
      throw new PeopleDomainError(
        'SIS_GUARDIAN_SELF_AUTHORITY_INVALID',
        'A person cannot be their own guardian',
      );
    }
    if (input.authorities.length === 0) {
      throw new PeopleDomainError(
        'SIS_GUARDIAN_AUTHORITY_REQUIRED',
        'Authority flags are required',
      );
    }
    if (input.effectiveTo !== undefined && input.effectiveTo < input.effectiveFrom) {
      throw new PeopleDomainError('SIS_EFFECTIVE_PERIOD_INVALID', 'Authority period is invalid');
    }

    const authority: GuardianAuthorityRecord = {
      tenantId: input.tenantId,
      authorityId: crypto.randomUUID(),
      guardianPersonId: input.guardianPersonId,
      studentPersonId: input.studentPersonId,
      authorities: [...new Set(input.authorities)],
      verificationStatus: input.verificationStatus,
      effectiveFrom: input.effectiveFrom,
      ...(input.effectiveTo === undefined ? {} : { effectiveTo: input.effectiveTo }),
      ...(input.restrictionReference === undefined
        ? {}
        : { restrictionReference: input.restrictionReference }),
      version: 1,
    };
    this.#authorities.set(authority.authorityId, authority);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.people.guardian-authority-set',
      subjectId: authority.authorityId,
    });

    const portalAccess = authority.authorities.includes('portal');
    return {
      value: { ...authority, authorities: [...authority.authorities] },
      events: [
        createDomainEvent({
          eventType: 'sis.people.guardian-authority-changed.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'guardian-authority',
          aggregateId: authority.authorityId,
          aggregateVersion: authority.version,
          correlationId: input.correlationId,
          payload: {
            authorityId: authority.authorityId,
            guardianPersonId: authority.guardianPersonId,
            studentPersonId: authority.studentPersonId,
            portalAccess,
            effectiveFrom: authority.effectiveFrom,
            ...(authority.effectiveTo === undefined ? {} : { effectiveTo: authority.effectiveTo }),
          },
        }),
      ],
    };
  }

  canGuardian(
    tenantId: string,
    guardianPersonId: string,
    studentPersonId: string,
    authority: AuthorityKind,
    at: string,
  ): boolean {
    return [...this.#authorities.values()].some(
      (record) =>
        record.tenantId === tenantId &&
        record.guardianPersonId === guardianPersonId &&
        record.studentPersonId === studentPersonId &&
        record.verificationStatus === 'verified' &&
        record.authorities.includes(authority) &&
        dateWithin(at, record.effectiveFrom, record.effectiveTo),
    );
  }

  recordConsent(input: Omit<ConsentRecord, 'consentId' | 'version'>): ConsentRecord {
    this.#requirePerson(input.tenantId, input.subjectPersonId);
    this.#requirePerson(input.tenantId, input.grantedByPersonId);
    const consent: ConsentRecord = {
      ...input,
      consentId: crypto.randomUUID(),
      version: 1,
    };
    this.#consents.set(consent.consentId, consent);
    this.#audit.append({
      tenantId: input.tenantId,
      action: `sis.people.consent-${input.status}`,
      subjectId: consent.consentId,
    });
    return { ...consent };
  }

  findDuplicateCandidates(tenantId: string, minimumScore = 50): readonly DuplicateCandidate[] {
    const people = [...this.#people.values()].filter(
      (person) => person.tenantId === tenantId && person.status !== 'merged',
    );
    const candidates: DuplicateCandidate[] = [];

    for (let leftIndex = 0; leftIndex < people.length; leftIndex += 1) {
      const left = people[leftIndex];
      if (!left) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < people.length; rightIndex += 1) {
        const right = people[rightIndex];
        if (!right) continue;
        const reasons: string[] = [];
        let score = 0;
        if (normalized(displayName(left)) === normalized(displayName(right))) {
          score += 35;
          reasons.push('normalized-name');
        }
        if (left.dateOfBirth !== undefined && left.dateOfBirth === right.dateOfBirth) {
          score += 30;
          reasons.push('date-of-birth');
        }
        const leftIdentifiers = new Set(
          left.identifiers.map(
            (identifier) =>
              `${normalized(identifier.identifierType)}:${normalized(identifier.value)}`,
          ),
        );
        if (
          right.identifiers.some((identifier) =>
            leftIdentifiers.has(
              `${normalized(identifier.identifierType)}:${normalized(identifier.value)}`,
            ),
          )
        ) {
          score += 50;
          reasons.push('identifier');
        }
        const leftContacts = new Set(
          left.contacts.map((contact) => `${contact.kind}:${normalized(contact.value)}`),
        );
        if (
          right.contacts.some((contact) =>
            leftContacts.has(`${contact.kind}:${normalized(contact.value)}`),
          )
        ) {
          score += 25;
          reasons.push('contact');
        }
        if (score >= minimumScore) {
          const ordered = [left.personId, right.personId].sort();
          const candidateId = `${tenantId}:${ordered[0]}:${ordered[1]}`;
          const candidate: DuplicateCandidate = {
            tenantId,
            candidateId,
            leftPersonId: left.personId,
            rightPersonId: right.personId,
            score,
            reasons,
            status: this.#duplicates.get(candidateId)?.status ?? 'open',
          };
          this.#duplicates.set(candidateId, candidate);
          candidates.push(candidate);
        }
      }
    }
    return candidates;
  }

  mergePeople(
    tenantId: string,
    survivingPersonId: string,
    mergedPersonId: string,
    reason: string,
    correlationId: string,
  ): PeopleCommandResult<PersonMergeRecord> {
    if (survivingPersonId === mergedPersonId) {
      throw new PeopleDomainError(
        'SIS_PERSON_MERGE_SELF_INVALID',
        'Cannot merge a person into itself',
      );
    }
    const surviving = this.#requirePerson(tenantId, survivingPersonId);
    const merged = this.#requirePerson(tenantId, mergedPersonId);
    if (surviving.status === 'merged' || merged.status === 'merged') {
      throw new PeopleDomainError(
        'SIS_PERSON_ALREADY_MERGED',
        'A merged person is not authoritative',
      );
    }

    surviving.names = uniqueBy(
      [...surviving.names, ...merged.names],
      (name) => `${name.usage}:${normalized(name.givenName)}:${normalized(name.familyName)}`,
    );
    surviving.identifiers = uniqueBy(
      [...surviving.identifiers, ...merged.identifiers],
      (identifier) => `${normalized(identifier.identifierType)}:${normalized(identifier.value)}`,
    );
    surviving.contacts = uniqueBy(
      [...surviving.contacts, ...merged.contacts],
      (contact) => `${contact.kind}:${normalized(contact.value)}`,
    );
    surviving.addresses = uniqueBy(
      [...surviving.addresses, ...merged.addresses],
      (address) => `${address.addressType}:${address.countryCode}:${address.lines.join('|')}`,
    );
    if (surviving.dateOfBirth === undefined && merged.dateOfBirth !== undefined) {
      surviving.dateOfBirth = merged.dateOfBirth;
    }
    surviving.version += 1;
    surviving.updatedAt = new Date().toISOString();
    merged.status = 'merged';
    merged.mergedIntoPersonId = survivingPersonId;
    merged.version += 1;
    merged.updatedAt = surviving.updatedAt;

    for (const [authorityId, authority] of this.#authorities) {
      if (authority.tenantId !== tenantId) continue;
      const updated: GuardianAuthorityRecord = {
        ...authority,
        guardianPersonId:
          authority.guardianPersonId === mergedPersonId
            ? survivingPersonId
            : authority.guardianPersonId,
        studentPersonId:
          authority.studentPersonId === mergedPersonId
            ? survivingPersonId
            : authority.studentPersonId,
        version: authority.version + 1,
      };
      this.#authorities.set(authorityId, updated);
    }

    const merge: PersonMergeRecord = {
      tenantId,
      mergeId: crypto.randomUUID(),
      survivingPersonId,
      mergedPersonId,
      reason,
      mergedAt: surviving.updatedAt,
    };
    this.#merges.push(merge);
    for (const [candidateId, candidate] of this.#duplicates) {
      if (
        candidate.tenantId === tenantId &&
        [candidate.leftPersonId, candidate.rightPersonId].includes(survivingPersonId) &&
        [candidate.leftPersonId, candidate.rightPersonId].includes(mergedPersonId)
      ) {
        this.#duplicates.set(candidateId, { ...candidate, status: 'merged' });
      }
    }
    this.#audit.append({
      tenantId,
      action: 'sis.people.person-merged',
      subjectId: merge.mergeId,
    });

    return {
      value: merge,
      events: [
        createDomainEvent({
          eventType: 'sis.people.person-merged.v1',
          schemaVersion: 1,
          tenantId,
          aggregateType: 'person',
          aggregateId: survivingPersonId,
          aggregateVersion: surviving.version,
          correlationId,
          payload: { survivingPersonId, mergedPersonId },
        }),
      ],
    };
  }

  listMerges(tenantId: string): readonly PersonMergeRecord[] {
    return this.#merges
      .filter((merge) => merge.tenantId === tenantId)
      .map((merge) => ({ ...merge }));
  }

  #requirePerson(tenantId: string, personId: string): MutablePerson {
    const person = this.#people.get(personId);
    if (!person || person.tenantId !== tenantId) {
      throw new PeopleDomainError('SIS_PERSON_NOT_FOUND', 'Person was not found in tenant scope');
    }
    return person;
  }
}
