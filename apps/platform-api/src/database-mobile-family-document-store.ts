import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

import type { MobileReadScope } from './database-mobile-read-store.js';
import { requireSchoolTimeZone, schoolLocalTimestamp } from './mobile-school-time.js';

interface PayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
  readonly timeZoneId?: unknown;
}

export interface MobileFamilyDocumentSummary {
  readonly documentId: string;
  readonly title: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly issuedAt: string;
  readonly classification: 'general' | 'personal' | 'restricted';
  readonly cachePolicy: 'noStore' | 'encryptedTemporary';
}

export interface MobileFamilyDocumentPage {
  readonly documents: readonly MobileFamilyDocumentSummary[];
  readonly nextCursor: string | null;
  readonly timeZoneId: string;
}

export interface MobileFamilyDocumentGrant {
  readonly documentId: string;
  readonly expiresAt: string;
  readonly grantId: string;
  readonly requiresStepUp: boolean;
  readonly singleUse: true;
  readonly timeZoneId: string;
}

export type MobileFamilyDocumentGrantResult =
  MobileFamilyDocumentGrant | { readonly status: 'idempotency-conflict' };

export type MobileFamilyDocumentClaim =
  | {
      readonly status: 'claimed';
      readonly documentId: string;
      readonly objectKey: string;
      readonly contentType: string;
      readonly sizeBytes: number;
      readonly sha256Hex: string;
    }
  | { readonly status: 'step-up-required' | 'expired' | 'already-consumed' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const MAX_TEXT = 512;
const MAX_OBJECT_KEY = 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_PAGE_DOCUMENTS = 100;

function invalidResponse(operation: string): Error {
  return new Error(`${operation} returned an invalid database response.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, operation: string): Record<string, unknown> {
  if (!isRecord(value)) throw invalidResponse(operation);
  return value;
}

function requireExactKeys(
  value: Record<string, unknown>,
  operation: string,
  expected: ReadonlySet<string>,
): void {
  const keys = Object.keys(value);
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) {
    throw invalidResponse(operation);
  }
}

function requireUuid(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw invalidResponse(operation);
  return value;
}

function requireText(value: unknown, operation: string, maximum = MAX_TEXT): string {
  if (typeof value !== 'string') throw invalidResponse(operation);
  const normalized = value.trim();
  if (normalized === '' || normalized.length > maximum) throw invalidResponse(operation);
  return normalized;
}

function requireContentType(value: unknown, operation: string): string {
  const contentType = requireText(value, operation, 255);
  const slash = contentType.indexOf('/');
  const invalidCharacter = [...contentType].some((character) => {
    const code = character.charCodeAt(0);
    return code < 33 || code > 126 || character === ';' || character === '"' || character === '\\';
  });
  if (
    slash < 1 ||
    slash !== contentType.lastIndexOf('/') ||
    slash === contentType.length - 1 ||
    invalidCharacter
  ) {
    throw invalidResponse(operation);
  }
  return contentType;
}

function requireTimestamp(value: unknown, operation: string): string {
  const timestamp = requireText(value, operation, 64);
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    throw invalidResponse(operation);
  }
  return timestamp;
}

function requireDocumentBytes(value: unknown, operation: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_DOCUMENT_BYTES
  ) {
    throw invalidResponse(operation);
  }
  return value;
}

function validateDocument(
  value: unknown,
  operation: string,
  timeZoneId: string,
): MobileFamilyDocumentSummary {
  const document = requireRecord(value, operation);
  requireExactKeys(
    document,
    operation,
    new Set([
      'documentId',
      'title',
      'fileName',
      'sizeBytes',
      'issuedAt',
      'classification',
      'cachePolicy',
    ]),
  );
  const classification = document.classification;
  const cachePolicy = document.cachePolicy;
  if (
    classification !== 'general' &&
    classification !== 'personal' &&
    classification !== 'restricted'
  ) {
    throw invalidResponse(operation);
  }
  if (cachePolicy !== 'noStore' && cachePolicy !== 'encryptedTemporary') {
    throw invalidResponse(operation);
  }
  if (classification === 'restricted' && cachePolicy !== 'noStore') {
    throw invalidResponse(operation);
  }
  return {
    documentId: requireUuid(document.documentId, operation),
    title: requireText(document.title, operation),
    fileName: requireText(document.fileName, operation),
    sizeBytes: requireDocumentBytes(document.sizeBytes, operation),
    issuedAt: schoolLocalTimestamp(
      requireTimestamp(document.issuedAt, operation),
      timeZoneId,
      operation,
    ),
    classification,
    cachePolicy,
  };
}

function validatePage(value: unknown, timeZoneValue: unknown): MobileFamilyDocumentPage {
  const operation = 'Mobile family documents';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = requireRecord(value, operation);
  requireExactKeys(payload, operation, new Set(['documents', 'nextCursor']));
  if (!Array.isArray(payload.documents) || payload.documents.length > MAX_PAGE_DOCUMENTS) {
    throw invalidResponse(operation);
  }
  const documents = payload.documents.map((document) =>
    validateDocument(document, operation, timeZoneId),
  );
  if (new Set(documents.map((document) => document.documentId)).size !== documents.length) {
    throw invalidResponse(operation);
  }
  const nextCursor = payload.nextCursor;
  if (nextCursor !== null && (typeof nextCursor !== 'string' || !UUID_PATTERN.test(nextCursor))) {
    throw invalidResponse(operation);
  }
  return { documents, nextCursor, timeZoneId };
}

function validateGrant(value: unknown, timeZoneValue: unknown): MobileFamilyDocumentGrantResult {
  const operation = 'Mobile family document grant';
  const payload = requireRecord(value, operation);
  if (payload.status === 'idempotency-conflict') {
    requireExactKeys(payload, operation, new Set(['status']));
    return { status: 'idempotency-conflict' };
  }
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  requireExactKeys(
    payload,
    operation,
    new Set(['documentId', 'expiresAt', 'grantId', 'requiresStepUp', 'singleUse']),
  );
  if (typeof payload.requiresStepUp !== 'boolean' || payload.singleUse !== true) {
    throw invalidResponse(operation);
  }
  return {
    documentId: requireUuid(payload.documentId, operation),
    expiresAt: schoolLocalTimestamp(
      requireTimestamp(payload.expiresAt, operation),
      timeZoneId,
      operation,
    ),
    grantId: requireUuid(payload.grantId, operation),
    requiresStepUp: payload.requiresStepUp,
    singleUse: true,
    timeZoneId,
  };
}

function validateClaim(value: unknown): MobileFamilyDocumentClaim {
  const operation = 'Mobile family document claim';
  const payload = requireRecord(value, operation);
  const status = payload.status;
  if (status === 'step-up-required' || status === 'expired' || status === 'already-consumed') {
    requireExactKeys(payload, operation, new Set(['status']));
    return { status };
  }
  if (status !== 'claimed') throw invalidResponse(operation);
  requireExactKeys(
    payload,
    operation,
    new Set(['status', 'documentId', 'objectKey', 'contentType', 'sizeBytes', 'sha256Hex']),
  );
  const sha256Hex = requireText(payload.sha256Hex, operation, 64);
  if (!SHA256_PATTERN.test(sha256Hex)) throw invalidResponse(operation);
  return {
    status,
    documentId: requireUuid(payload.documentId, operation),
    objectKey: requireText(payload.objectKey, operation, MAX_OBJECT_KEY),
    contentType: requireContentType(payload.contentType, operation),
    sizeBytes: requireDocumentBytes(payload.sizeBytes, operation),
    sha256Hex,
  };
}

function requireIdentity(
  identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
): readonly [string, string] {
  const issuer = identity.issuer.trim();
  const subject = identity.subject.trim();
  if (issuer === '' || subject === '' || issuer.length > 2048 || subject.length > 512) {
    throw new Error('Mobile identity is invalid.');
  }
  return [issuer, subject];
}

function requireFamilyScope(scope: MobileReadScope): MobileReadScope {
  if (
    !UUID_PATTERN.test(scope.tenantId) ||
    !UUID_PATTERN.test(scope.campusId) ||
    (scope.persona !== 'guardian' && scope.persona !== 'student')
  ) {
    throw new Error('Mobile family request scope is invalid.');
  }
  return scope;
}

export class DatabaseMobileFamilyDocumentStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async listDocuments(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    studentId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<MobileFamilyDocumentPage | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireFamilyScope(scope);
    if (!UUID_PATTERN.test(studentId) || (cursor !== undefined && !UUID_PATTERN.test(cursor))) {
      throw new Error('Mobile family document paging scope is invalid.');
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_DOCUMENTS) {
      throw new Error('Mobile family document page limit is invalid.');
    }
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_family_documents(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text, $6::uuid, $7::uuid, $8::integer
       ) AS payload,
       (SELECT scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text
       ) AS scope) AS "timeZoneId"`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        studentId,
        cursor ?? null,
        limit,
      ],
    );
    return this.#onePayload(rows, validatePage, 'Mobile family documents');
  }

  async issueDownloadGrant(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    documentId: string,
    idempotencyKey: string,
  ): Promise<MobileFamilyDocumentGrantResult | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireFamilyScope(scope);
    if (!UUID_PATTERN.test(documentId) || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new Error('Mobile family document grant request is invalid.');
    }
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.issue_mobile_family_document_download_grant(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text, $6::uuid, $7::text
       ) AS payload,
       (SELECT scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text
       ) AS scope) AS "timeZoneId"`,
      [issuer, subject, scope.tenantId, scope.campusId, scope.persona, documentId, idempotencyKey],
    );
    return this.#onePayload(rows, validateGrant, 'Mobile family document grant');
  }

  async claimDownloadGrant(
    identity: Pick<OidcIdentity, 'issuer' | 'subject' | 'assurance'>,
    scope: MobileReadScope,
    grantId: string,
    idempotencyKey: string,
  ): Promise<MobileFamilyDocumentClaim | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireFamilyScope(scope);
    if (!UUID_PATTERN.test(grantId) || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new Error('Mobile family document exchange request is invalid.');
    }
    if (identity.assurance !== 'aal1' && identity.assurance !== 'aal2') {
      throw new Error('Mobile family document assurance is invalid.');
    }
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.claim_mobile_family_document_download_grant(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::text, $6::uuid, $7::text, $8::text
       ) AS payload`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        grantId,
        identity.assurance,
        idempotencyKey,
      ],
    );
    return this.#onePayload(rows, validateClaim, 'Mobile family document claim');
  }

  #onePayload<T>(
    rows: readonly PayloadRow[],
    validator: (value: unknown, timeZoneValue: unknown) => T,
    operation: string,
  ): T | undefined {
    if (rows.length !== 1) throw invalidResponse(operation);
    const row = rows[0];
    if (row === undefined) throw invalidResponse(operation);
    if (row.payload === null || row.payload === undefined) return undefined;
    return validator(row.payload, row.timeZoneId);
  }
}
