import { cloneAndFreeze } from './common.js';
import { SecureCsvCodec } from './import-export.js';

export type OneRosterSyncMode = 'full' | 'delta';
export type OneRosterObjectType =
  'org' | 'academicSession' | 'course' | 'class' | 'user' | 'enrollment';

export type OneRosterArchive = Readonly<Record<string, string>>;

interface OneRosterFileDefinition {
  fileName: string;
  exportKey: string;
  objectType: OneRosterObjectType;
  requiredHeaders: readonly string[];
}

const fileDefinitions: readonly OneRosterFileDefinition[] = [
  {
    fileName: 'orgs.csv',
    exportKey: 'orgs',
    objectType: 'org',
    requiredHeaders: [
      'sourcedId',
      'status',
      'dateLastModified',
      'name',
      'type',
      'identifier',
      'parentSourcedId',
    ],
  },
  {
    fileName: 'academicSessions.csv',
    exportKey: 'academicSessions',
    objectType: 'academicSession',
    requiredHeaders: [
      'sourcedId',
      'status',
      'dateLastModified',
      'title',
      'type',
      'startDate',
      'endDate',
      'parentSourcedId',
      'schoolYear',
    ],
  },
  {
    fileName: 'courses.csv',
    exportKey: 'courses',
    objectType: 'course',
    requiredHeaders: [
      'sourcedId',
      'status',
      'dateLastModified',
      'title',
      'courseCode',
      'grades',
      'orgSourcedId',
      'schoolYearSourcedId',
      'subjects',
      'subjectCodes',
    ],
  },
  {
    fileName: 'classes.csv',
    exportKey: 'classes',
    objectType: 'class',
    requiredHeaders: [
      'sourcedId',
      'status',
      'dateLastModified',
      'title',
      'classCode',
      'classType',
      'location',
      'grades',
      'subjects',
      'courseSourcedId',
      'schoolSourcedId',
      'terms',
      'periods',
      'resources',
    ],
  },
  {
    fileName: 'users.csv',
    exportKey: 'users',
    objectType: 'user',
    requiredHeaders: [
      'sourcedId',
      'status',
      'dateLastModified',
      'enabledUser',
      'orgSourcedIds',
      'role',
      'username',
      'userIds',
      'givenName',
      'familyName',
      'middleName',
      'identifier',
      'email',
      'phone',
      'sms',
      'grades',
      'password',
    ],
  },
  {
    fileName: 'enrollments.csv',
    exportKey: 'enrollments',
    objectType: 'enrollment',
    requiredHeaders: [
      'sourcedId',
      'status',
      'dateLastModified',
      'classSourcedId',
      'schoolSourcedId',
      'userSourcedId',
      'role',
      'primary',
      'beginDate',
      'endDate',
    ],
  },
];

export interface OneRosterProfileDescriptor {
  standard: 'OneRoster';
  standardVersion: '1.2';
  profileVersion: 1;
  mode: 'csv';
  conformanceClaim: 'supported-subset';
  requiredFiles: readonly string[];
  supportedObjects: readonly OneRosterObjectType[];
  restExtensionStatus: 'contract-only';
}

export interface OneRosterIssue {
  file: string;
  code:
    | 'missing-file'
    | 'missing-header'
    | 'duplicate-sourced-id'
    | 'missing-sourced-id'
    | 'invalid-status'
    | 'unknown-org'
    | 'unknown-school'
    | 'unknown-academic-session'
    | 'unknown-course'
    | 'unknown-class'
    | 'unknown-user';
  rowNumber?: number;
  field?: string;
  sourcedId?: string;
  reference?: string;
}

interface ParsedOneRosterFile {
  definition: OneRosterFileDefinition;
  records: readonly Readonly<Record<string, string>>[];
}

export interface OneRosterValidationResult {
  valid: boolean;
  issues: readonly Readonly<OneRosterIssue>[];
  counts: Readonly<Partial<Record<OneRosterObjectType, number>>>;
}

export interface OneRosterDomainCommand {
  tenantId: string;
  standard: 'OneRoster';
  standardVersion: '1.2';
  objectType: OneRosterObjectType;
  operation: 'upsert' | 'delete';
  externalId: string;
  payload: Readonly<Record<string, string>>;
  idempotencyKey: string;
}

export type OneRosterExportData = Readonly<
  Partial<Record<string, readonly Readonly<Record<string, string>>[]>>
>;

function parseFile(
  definition: OneRosterFileDefinition,
  csv: string,
  codec: SecureCsvCodec,
  issues: OneRosterIssue[],
): ParsedOneRosterFile {
  const table = codec.parse(csv);
  const headers = table[0] ?? [];
  for (const header of definition.requiredHeaders) {
    if (!headers.includes(header)) {
      issues.push({ file: definition.fileName, code: 'missing-header', field: header });
    }
  }
  const sourcedIds = new Set<string>();
  const records = table.slice(1).map((row, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? '']));
    const sourcedId = record.sourcedId ?? '';
    if (sourcedId.length === 0) {
      issues.push({ file: definition.fileName, code: 'missing-sourced-id', rowNumber: index + 2 });
    } else if (sourcedIds.has(sourcedId)) {
      issues.push({
        file: definition.fileName,
        code: 'duplicate-sourced-id',
        rowNumber: index + 2,
        sourcedId,
      });
    } else {
      sourcedIds.add(sourcedId);
    }
    const status = record.status;
    if (status !== undefined && status !== '' && !['active', 'tobedeleted'].includes(status)) {
      issues.push({
        file: definition.fileName,
        code: 'invalid-status',
        rowNumber: index + 2,
        sourcedId,
        field: 'status',
      });
    }
    return record;
  });
  return { definition, records: cloneAndFreeze(records) };
}

function splitReferences(value: string | undefined): readonly string[] {
  return (value ?? '')
    .split(/[|;]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function addUnknownReference(
  issues: OneRosterIssue[],
  file: string,
  code: OneRosterIssue['code'],
  rowNumber: number,
  sourcedId: string,
  field: string,
  reference: string,
): void {
  issues.push({ file, code, rowNumber, sourcedId, field, reference });
}

export class OneRosterCsvProfile {
  readonly profile: Readonly<OneRosterProfileDescriptor> = cloneAndFreeze({
    standard: 'OneRoster',
    standardVersion: '1.2',
    profileVersion: 1,
    mode: 'csv',
    conformanceClaim: 'supported-subset',
    requiredFiles: fileDefinitions.map((definition) => definition.fileName),
    supportedObjects: fileDefinitions.map((definition) => definition.objectType),
    restExtensionStatus: 'contract-only',
  });
  readonly #codec = new SecureCsvCodec({ maxBytes: 25 * 1024 * 1024, maxRows: 500_000 });

  validate(
    archive: OneRosterArchive,
    mode: OneRosterSyncMode,
  ): Readonly<OneRosterValidationResult> {
    const issues: OneRosterIssue[] = [];
    const parsed = new Map<string, ParsedOneRosterFile>();

    for (const definition of fileDefinitions) {
      const csv = archive[definition.fileName];
      if (csv === undefined) {
        if (mode === 'full') issues.push({ file: definition.fileName, code: 'missing-file' });
        continue;
      }
      parsed.set(definition.fileName, parseFile(definition, csv, this.#codec, issues));
    }

    const ids = (fileName: string) =>
      new Set(
        (parsed.get(fileName)?.records ?? [])
          .map((record) => record.sourcedId ?? '')
          .filter(Boolean),
      );
    const orgIds = ids('orgs.csv');
    const sessionIds = ids('academicSessions.csv');
    const courseIds = ids('courses.csv');
    const classIds = ids('classes.csv');
    const userIds = ids('users.csv');

    for (const [fileName, file] of parsed) {
      file.records.forEach((record, index) => {
        const sourcedId = record.sourcedId ?? '';
        const rowNumber = index + 2;
        if (
          fileName === 'academicSessions.csv' &&
          record.parentSourcedId &&
          !sessionIds.has(record.parentSourcedId)
        ) {
          addUnknownReference(
            issues,
            fileName,
            'unknown-academic-session',
            rowNumber,
            sourcedId,
            'parentSourcedId',
            record.parentSourcedId,
          );
        }
        if (fileName === 'courses.csv') {
          if (record.orgSourcedId && !orgIds.has(record.orgSourcedId)) {
            addUnknownReference(
              issues,
              fileName,
              'unknown-org',
              rowNumber,
              sourcedId,
              'orgSourcedId',
              record.orgSourcedId,
            );
          }
          if (record.schoolYearSourcedId && !sessionIds.has(record.schoolYearSourcedId)) {
            addUnknownReference(
              issues,
              fileName,
              'unknown-academic-session',
              rowNumber,
              sourcedId,
              'schoolYearSourcedId',
              record.schoolYearSourcedId,
            );
          }
        }
        if (fileName === 'classes.csv') {
          if (record.courseSourcedId && !courseIds.has(record.courseSourcedId)) {
            addUnknownReference(
              issues,
              fileName,
              'unknown-course',
              rowNumber,
              sourcedId,
              'courseSourcedId',
              record.courseSourcedId,
            );
          }
          if (record.schoolSourcedId && !orgIds.has(record.schoolSourcedId)) {
            addUnknownReference(
              issues,
              fileName,
              'unknown-school',
              rowNumber,
              sourcedId,
              'schoolSourcedId',
              record.schoolSourcedId,
            );
          }
          for (const term of splitReferences(record.terms)) {
            if (!sessionIds.has(term)) {
              addUnknownReference(
                issues,
                fileName,
                'unknown-academic-session',
                rowNumber,
                sourcedId,
                'terms',
                term,
              );
            }
          }
        }
        if (fileName === 'users.csv') {
          for (const org of splitReferences(record.orgSourcedIds)) {
            if (!orgIds.has(org)) {
              addUnknownReference(
                issues,
                fileName,
                'unknown-org',
                rowNumber,
                sourcedId,
                'orgSourcedIds',
                org,
              );
            }
          }
        }
        if (fileName === 'enrollments.csv') {
          if (record.classSourcedId && !classIds.has(record.classSourcedId)) {
            addUnknownReference(
              issues,
              fileName,
              'unknown-class',
              rowNumber,
              sourcedId,
              'classSourcedId',
              record.classSourcedId,
            );
          }
          if (record.schoolSourcedId && !orgIds.has(record.schoolSourcedId)) {
            addUnknownReference(
              issues,
              fileName,
              'unknown-school',
              rowNumber,
              sourcedId,
              'schoolSourcedId',
              record.schoolSourcedId,
            );
          }
          if (record.userSourcedId && !userIds.has(record.userSourcedId)) {
            addUnknownReference(
              issues,
              fileName,
              'unknown-user',
              rowNumber,
              sourcedId,
              'userSourcedId',
              record.userSourcedId,
            );
          }
        }
      });
    }

    const counts: Partial<Record<OneRosterObjectType, number>> = {};
    for (const file of parsed.values()) counts[file.definition.objectType] = file.records.length;
    return cloneAndFreeze({ valid: issues.length === 0, issues, counts });
  }

  toDomainCommands(
    tenantId: string,
    archive: OneRosterArchive,
    mode: OneRosterSyncMode,
  ): readonly Readonly<OneRosterDomainCommand>[] {
    const validation = this.validate(archive, mode);
    if (!validation.valid)
      throw new Error('OneRoster archive is not valid for this supported profile');
    const commands: OneRosterDomainCommand[] = [];
    for (const definition of fileDefinitions) {
      const csv = archive[definition.fileName];
      if (csv === undefined) continue;
      const issues: OneRosterIssue[] = [];
      const parsed = parseFile(definition, csv, this.#codec, issues);
      for (const record of parsed.records) {
        const sourcedId = record.sourcedId ?? '';
        const modified = record.dateLastModified ?? '';
        commands.push({
          tenantId,
          standard: 'OneRoster',
          standardVersion: '1.2',
          objectType: definition.objectType,
          operation: record.status === 'tobedeleted' ? 'delete' : 'upsert',
          externalId: sourcedId,
          payload: record,
          idempotencyKey: `oneroster:1.2:${definition.objectType}:${sourcedId}:${modified}`,
        });
      }
    }
    return cloneAndFreeze(commands);
  }

  export(data: OneRosterExportData): Readonly<OneRosterArchive> {
    const archive: Record<string, string> = {};
    for (const definition of fileDefinitions) {
      const records = data[definition.exportKey];
      if (!records) continue;
      const rows = [
        definition.requiredHeaders,
        ...records.map((record) =>
          definition.requiredHeaders.map((header) => record[header] ?? ''),
        ),
      ];
      archive[definition.fileName] = this.#codec.stringify(rows);
    }
    return cloneAndFreeze(archive);
  }
}

export type OneRosterRestCollection =
  'orgs' | 'academicSessions' | 'courses' | 'classes' | 'users' | 'enrollments';

export class OneRosterRestContract {
  readonly basePath = '/api/v1/standards/oneroster/1.2';

  collectionPath(collection: OneRosterRestCollection): string {
    return `${this.basePath}/${collection}`;
  }

  buildPageLink(
    collection: OneRosterRestCollection,
    input: { limit: number; cursor?: string },
  ): string {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 500) {
      throw new Error('OneRoster page limit must be between 1 and 500');
    }
    const parameters = new URLSearchParams({ limit: String(input.limit) });
    if (input.cursor) parameters.set('cursor', input.cursor);
    return `${this.collectionPath(collection)}?${parameters.toString()}`;
  }
}
