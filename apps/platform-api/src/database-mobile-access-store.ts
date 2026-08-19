import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

export type MobilePersona = 'guardian' | 'student' | 'teacher';

export interface MobilePersonaAccess {
  readonly persona: MobilePersona;
  readonly capabilities: readonly string[];
}

export interface MobileCampusAccess {
  readonly campusId: string;
  readonly campusName: string;
  readonly timeZone: string;
  readonly personas: readonly MobilePersonaAccess[];
}

export interface MobileTenantAccess {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly campuses: readonly MobileCampusAccess[];
}

export interface MobileBootstrapPayload {
  readonly accountId: string;
  readonly locale: 'en';
  readonly schools: readonly MobileTenantAccess[];
}

interface MobileAccessRow extends Record<string, unknown> {
  readonly accountId: unknown;
  readonly tenantId: unknown;
  readonly tenantName: unknown;
  readonly campusId: unknown;
  readonly campusName: unknown;
  readonly timeZone: unknown;
  readonly persona: unknown;
  readonly capabilities: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u;
const MAX_NAME_LENGTH = 256;
const MAX_TIME_ZONE_LENGTH = 128;
const MAX_CAPABILITIES = 32;
const MAX_ROWS = 128;
const MOBILE_CAPABILITIES_BY_PERSONA: Readonly<Record<MobilePersona, ReadonlySet<string>>> = {
  guardian: new Set([
    'attendance.read',
    'billing.read',
    'documents.read',
    'forms.consent',
    'grades.read.published',
    'messages.read',
    'messages.send',
    'timetable.read',
  ]),
  student: new Set([
    'attendance.read',
    'documents.read',
    'grades.read.published',
    'messages.read',
    'messages.send',
    'timetable.read',
  ]),
  teacher: new Set([
    'attendance.read',
    'attendance.take',
    'documents.read',
    'grades.write',
    'messages.read',
    'messages.send',
    'timetable.read',
  ]),
};

function invalidResponse(): Error {
  return new Error('Mobile access resolution returned an invalid database response.');
}

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw invalidResponse();
  return value;
}

function requireBoundedText(value: unknown, maximum: number): string {
  if (typeof value !== 'string') throw invalidResponse();
  const normalized = value.trim();
  if (normalized === '' || normalized.length > maximum) throw invalidResponse();
  return normalized;
}

function requirePersona(value: unknown): MobilePersona {
  if (value !== 'guardian' && value !== 'student' && value !== 'teacher') {
    throw invalidResponse();
  }
  return value;
}

function requireCapabilities(value: unknown, persona: MobilePersona): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_CAPABILITIES) throw invalidResponse();
  const personaCapabilities = MOBILE_CAPABILITIES_BY_PERSONA[persona];
  if (
    !value.every(
      (entry) =>
        typeof entry === 'string' &&
        CAPABILITY_PATTERN.test(entry) &&
        personaCapabilities.has(entry),
    )
  ) {
    throw invalidResponse();
  }
  const capabilities = value as string[];
  if (new Set(capabilities).size !== capabilities.length) throw invalidResponse();
  const sorted = [...capabilities].sort((left, right) => left.localeCompare(right));
  if (!capabilities.every((entry, index) => entry === sorted[index])) throw invalidResponse();
  return sorted;
}

interface ValidatedRow {
  readonly accountId: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly campusId: string;
  readonly campusName: string;
  readonly timeZone: string;
  readonly persona: MobilePersona;
  readonly capabilities: readonly string[];
}

function validateRow(row: MobileAccessRow): ValidatedRow {
  const persona = requirePersona(row.persona);
  return {
    accountId: requireUuid(row.accountId),
    tenantId: requireUuid(row.tenantId),
    tenantName: requireBoundedText(row.tenantName, MAX_NAME_LENGTH),
    campusId: requireUuid(row.campusId),
    campusName: requireBoundedText(row.campusName, MAX_NAME_LENGTH),
    timeZone: requireBoundedText(row.timeZone, MAX_TIME_ZONE_LENGTH),
    persona,
    capabilities: requireCapabilities(row.capabilities, persona),
  };
}

export class DatabaseMobileAccessStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async loadBootstrap(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
  ): Promise<MobileBootstrapPayload | undefined> {
    const issuer = identity.issuer.trim();
    const subject = identity.subject.trim();
    if (issuer === '' || subject === '' || issuer.length > 2048 || subject.length > 512) {
      throw new Error('Mobile identity is invalid.');
    }

    const rows = await this.#database.query<MobileAccessRow>(
      `SELECT
         account_id::text AS "accountId",
         tenant_id::text AS "tenantId",
         tenant_name AS "tenantName",
         campus_id::text AS "campusId",
         campus_name AS "campusName",
         time_zone AS "timeZone",
         persona,
         capabilities
       FROM iam.resolve_mobile_bootstrap_access($1::text, $2::text)`,
      [issuer, subject],
    );
    if (rows.length === 0) return undefined;
    if (rows.length > MAX_ROWS) throw invalidResponse();

    const validated = rows.map(validateRow);
    const accountIds = new Set(validated.map((row) => row.accountId));
    if (accountIds.size !== 1) throw invalidResponse();
    const accountId = validated[0]?.accountId;
    if (accountId === undefined) throw invalidResponse();

    const tenantMap = new Map<
      string,
      {
        tenantName: string;
        campuses: Map<
          string,
          {
            campusName: string;
            timeZone: string;
            personas: Map<MobilePersona, MobilePersonaAccess>;
          }
        >;
      }
    >();

    for (const row of validated) {
      let tenant = tenantMap.get(row.tenantId);
      if (tenant === undefined) {
        tenant = { tenantName: row.tenantName, campuses: new Map() };
        tenantMap.set(row.tenantId, tenant);
      } else if (tenant.tenantName !== row.tenantName) {
        throw invalidResponse();
      }

      let campus = tenant.campuses.get(row.campusId);
      if (campus === undefined) {
        campus = {
          campusName: row.campusName,
          timeZone: row.timeZone,
          personas: new Map(),
        };
        tenant.campuses.set(row.campusId, campus);
      } else if (campus.campusName !== row.campusName || campus.timeZone !== row.timeZone) {
        throw invalidResponse();
      }
      if (campus.personas.has(row.persona)) throw invalidResponse();
      campus.personas.set(row.persona, {
        persona: row.persona,
        capabilities: row.capabilities,
      });
    }

    const schools: MobileTenantAccess[] = [...tenantMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([tenantId, tenant]) => ({
        tenantId,
        tenantName: tenant.tenantName,
        campuses: [...tenant.campuses.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([campusId, campus]) => ({
            campusId,
            campusName: campus.campusName,
            timeZone: campus.timeZone,
            personas: [...campus.personas.values()].sort((left, right) =>
              left.persona.localeCompare(right.persona),
            ),
          })),
      }));

    return { accountId, locale: 'en', schools };
  }
}
