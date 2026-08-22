import type { HttpDatabase } from '@school/database';
import type { OidcIdentity } from '@school/policy';

import type { MobileReadScope } from './database-mobile-read-store.js';
import type {
  FamilyConsentDecisionInput,
  FamilyFormSubmissionInput,
} from './mobile-family-forms-consents.js';
import { requireSchoolTimeZone, schoolLocalTimestamp } from './mobile-school-time.js';

interface PayloadRow extends Record<string, unknown> {
  readonly payload: unknown;
  readonly timeZoneId?: unknown;
}

export interface MobileFamilyFormSummary {
  readonly formId: string;
  readonly title: string;
  readonly status: 'open' | 'submitted' | 'closed';
  readonly dueAt: string | null;
}

export interface MobileFamilyFormList {
  readonly forms: readonly MobileFamilyFormSummary[];
  readonly timeZoneId: string;
}

export interface MobileFamilyFormDefinition extends MobileFamilyFormSummary {
  readonly baseVersion: number;
  readonly schemaVersion: number;
  readonly timeZoneId: string;
  readonly fields: readonly {
    readonly fieldId: string;
    readonly label: string;
    readonly type: 'text' | 'boolean' | 'singleChoice' | 'date';
    readonly required: boolean;
    readonly options: readonly string[];
  }[];
}

export interface MobileFamilyConsentRequest {
  readonly consentId: string;
  readonly studentId: string;
  readonly title: string;
  readonly policyVersion: string;
  readonly status: 'pending' | 'granted' | 'declined' | 'expired';
  readonly dueAt: string | null;
}

export interface MobileFamilyConsentList {
  readonly consents: readonly MobileFamilyConsentRequest[];
  readonly timeZoneId: string;
}

export type MobileFamilyInteractionMutationResult =
  | { readonly acceptedRevision: number }
  | {
      readonly status:
        | 'idempotency-conflict'
        | 'stale'
        | 'schema-mismatch'
        | 'policy-mismatch'
        | 'closed'
        | 'invalid-answers';
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const MAX_TEXT = 512;

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
  if (normalized === '' || normalized !== value || normalized.length > maximum) {
    throw invalidResponse(operation);
  }
  return normalized;
}

function requireTimestampOrNull(
  value: unknown,
  operation: string,
  timeZoneId: string,
): string | null {
  if (value === null) return null;
  const timestamp = requireText(value, operation, 64);
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    throw invalidResponse(operation);
  }
  return schoolLocalTimestamp(timestamp, timeZoneId, operation);
}

function requireInteger(value: unknown, operation: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw invalidResponse(operation);
  }
  return value;
}

function requireFormStatus(value: unknown, operation: string): MobileFamilyFormSummary['status'] {
  if (value !== 'open' && value !== 'submitted' && value !== 'closed') {
    throw invalidResponse(operation);
  }
  return value;
}

function validateFormSummary(
  value: unknown,
  operation: string,
  timeZoneId: string,
): MobileFamilyFormSummary {
  const form = requireRecord(value, operation);
  requireExactKeys(form, operation, new Set(['formId', 'title', 'status', 'dueAt']));
  return {
    formId: requireUuid(form.formId, operation),
    title: requireText(form.title, operation),
    status: requireFormStatus(form.status, operation),
    dueAt: requireTimestampOrNull(form.dueAt, operation, timeZoneId),
  };
}

function validateFormField(
  value: unknown,
  operation: string,
): MobileFamilyFormDefinition['fields'][number] {
  const field = requireRecord(value, operation);
  requireExactKeys(field, operation, new Set(['fieldId', 'label', 'type', 'required', 'options']));
  const fieldId = requireText(field.fieldId, operation, 128);
  if (!IDENTIFIER_PATTERN.test(fieldId) || typeof field.required !== 'boolean') {
    throw invalidResponse(operation);
  }
  const type = field.type;
  if (type !== 'text' && type !== 'boolean' && type !== 'singleChoice' && type !== 'date') {
    throw invalidResponse(operation);
  }
  if (!Array.isArray(field.options) || field.options.length > 100) throw invalidResponse(operation);
  const options = field.options.map((option) => requireText(option, operation));
  if (new Set(options).size !== options.length) throw invalidResponse(operation);
  if (
    (type === 'singleChoice' && options.length === 0) ||
    (type !== 'singleChoice' && options.length > 0)
  ) {
    throw invalidResponse(operation);
  }
  return {
    fieldId,
    label: requireText(field.label, operation),
    type,
    required: field.required,
    options,
  };
}

function validateFormDefinition(
  value: unknown,
  timeZoneValue: unknown,
): MobileFamilyFormDefinition {
  const operation = 'Mobile family form';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const form = requireRecord(value, operation);
  requireExactKeys(
    form,
    operation,
    new Set(['formId', 'title', 'status', 'dueAt', 'baseVersion', 'schemaVersion', 'fields']),
  );
  if (!Array.isArray(form.fields) || form.fields.length < 1 || form.fields.length > 128) {
    throw invalidResponse(operation);
  }
  const fields = form.fields.map((field) => validateFormField(field, operation));
  if (new Set(fields.map((field) => field.fieldId)).size !== fields.length) {
    throw invalidResponse(operation);
  }
  return {
    formId: requireUuid(form.formId, operation),
    title: requireText(form.title, operation),
    status: requireFormStatus(form.status, operation),
    dueAt: requireTimestampOrNull(form.dueAt, operation, timeZoneId),
    baseVersion: requireInteger(form.baseVersion, operation, 0),
    schemaVersion: requireInteger(form.schemaVersion, operation, 1),
    timeZoneId,
    fields,
  };
}

function validateFormList(value: unknown, timeZoneValue: unknown): MobileFamilyFormList {
  const operation = 'Mobile family forms';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = requireRecord(value, operation);
  requireExactKeys(payload, operation, new Set(['forms']));
  if (!Array.isArray(payload.forms) || payload.forms.length > 100) throw invalidResponse(operation);
  const forms = payload.forms.map((form) => validateFormSummary(form, operation, timeZoneId));
  if (new Set(forms.map((form) => form.formId)).size !== forms.length)
    throw invalidResponse(operation);
  return { forms, timeZoneId };
}

function validateConsent(
  value: unknown,
  operation: string,
  timeZoneId: string,
): MobileFamilyConsentRequest {
  const consent = requireRecord(value, operation);
  requireExactKeys(
    consent,
    operation,
    new Set(['consentId', 'studentId', 'title', 'policyVersion', 'status', 'dueAt']),
  );
  const status = consent.status;
  if (
    status !== 'pending' &&
    status !== 'granted' &&
    status !== 'declined' &&
    status !== 'expired'
  ) {
    throw invalidResponse(operation);
  }
  return {
    consentId: requireUuid(consent.consentId, operation),
    studentId: requireUuid(consent.studentId, operation),
    title: requireText(consent.title, operation),
    policyVersion: requireText(consent.policyVersion, operation, 128),
    status,
    dueAt: requireTimestampOrNull(consent.dueAt, operation, timeZoneId),
  };
}

function validateConsentList(value: unknown, timeZoneValue: unknown): MobileFamilyConsentList {
  const operation = 'Mobile family consents';
  const timeZoneId = requireSchoolTimeZone(timeZoneValue, operation);
  const payload = requireRecord(value, operation);
  requireExactKeys(payload, operation, new Set(['consents']));
  if (!Array.isArray(payload.consents) || payload.consents.length > 100) {
    throw invalidResponse(operation);
  }
  const consents = payload.consents.map((consent) =>
    validateConsent(consent, operation, timeZoneId),
  );
  if (new Set(consents.map((consent) => consent.consentId)).size !== consents.length) {
    throw invalidResponse(operation);
  }
  return { consents, timeZoneId };
}

function validateMutation(
  value: unknown,
  operation: string,
): MobileFamilyInteractionMutationResult {
  const payload = requireRecord(value, operation);
  if ('acceptedRevision' in payload) {
    requireExactKeys(payload, operation, new Set(['acceptedRevision']));
    return { acceptedRevision: requireInteger(payload.acceptedRevision, operation, 1) };
  }
  requireExactKeys(payload, operation, new Set(['status']));
  const status = payload.status;
  if (
    status !== 'idempotency-conflict' &&
    status !== 'stale' &&
    status !== 'schema-mismatch' &&
    status !== 'policy-mismatch' &&
    status !== 'closed' &&
    status !== 'invalid-answers'
  ) {
    throw invalidResponse(operation);
  }
  return { status };
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

function requireGuardianScope(scope: MobileReadScope): void {
  if (
    !UUID_PATTERN.test(scope.tenantId) ||
    !UUID_PATTERN.test(scope.campusId) ||
    scope.persona !== 'guardian'
  ) {
    throw new Error('Mobile Family guardian scope is invalid.');
  }
}

function requireIdempotency(value: string): void {
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new Error('Mobile Family interaction idempotency key is invalid.');
  }
}

export class DatabaseMobileFamilyFormsConsentsStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async listForms(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    studentId: string,
  ): Promise<MobileFamilyFormList | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireGuardianScope(scope);
    if (!UUID_PATTERN.test(studentId)) throw new Error('Mobile Family student id is invalid.');
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_family_forms($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::uuid) AS payload,
       (SELECT scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text,$2::text,$3::uuid,$4::uuid,$5::text
       ) AS scope) AS "timeZoneId"`,
      [issuer, subject, scope.tenantId, scope.campusId, scope.persona, studentId],
    );
    return this.#onePayload(rows, validateFormList, 'Mobile family forms');
  }

  async loadForm(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    formId: string,
  ): Promise<MobileFamilyFormDefinition | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireGuardianScope(scope);
    if (!UUID_PATTERN.test(formId)) throw new Error('Mobile Family form id is invalid.');
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_family_form($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::uuid) AS payload,
       (SELECT scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text,$2::text,$3::uuid,$4::uuid,$5::text
       ) AS scope) AS "timeZoneId"`,
      [issuer, subject, scope.tenantId, scope.campusId, scope.persona, formId],
    );
    const result = this.#onePayload(rows, validateFormDefinition, 'Mobile family form');
    if (result !== undefined && result.formId !== formId)
      throw invalidResponse('Mobile family form');
    return result;
  }

  async submitForm(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    formId: string,
    idempotencyKey: string,
    input: FamilyFormSubmissionInput,
  ): Promise<MobileFamilyInteractionMutationResult | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireGuardianScope(scope);
    requireIdempotency(idempotencyKey);
    if (!UUID_PATTERN.test(formId) || !UUID_PATTERN.test(input.studentId)) {
      throw new Error('Mobile Family form submission scope is invalid.');
    }
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.submit_mobile_family_form($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::uuid,$7::uuid,$8::integer,$9::bigint,$10::jsonb,$11::text) AS payload`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        formId,
        input.studentId,
        input.schemaVersion,
        input.baseVersion,
        input.answers,
        idempotencyKey,
      ],
    );
    return this.#onePayload(
      rows,
      (value) => validateMutation(value, 'Mobile family form submission'),
      'Mobile family form submission',
    );
  }

  async listConsents(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    studentId: string,
  ): Promise<MobileFamilyConsentList | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireGuardianScope(scope);
    if (!UUID_PATTERN.test(studentId)) throw new Error('Mobile Family student id is invalid.');
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.resolve_mobile_family_consents($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::uuid) AS payload,
       (SELECT scope.time_zone FROM platform.resolve_mobile_request_scope(
         $1::text,$2::text,$3::uuid,$4::uuid,$5::text
       ) AS scope) AS "timeZoneId"`,
      [issuer, subject, scope.tenantId, scope.campusId, scope.persona, studentId],
    );
    return this.#onePayload(rows, validateConsentList, 'Mobile family consents');
  }

  async decideConsent(
    identity: Pick<OidcIdentity, 'issuer' | 'subject'>,
    scope: MobileReadScope,
    consentId: string,
    idempotencyKey: string,
    input: FamilyConsentDecisionInput,
  ): Promise<MobileFamilyInteractionMutationResult | undefined> {
    const [issuer, subject] = requireIdentity(identity);
    requireGuardianScope(scope);
    requireIdempotency(idempotencyKey);
    if (!UUID_PATTERN.test(consentId) || !UUID_PATTERN.test(input.studentId)) {
      throw new Error('Mobile Family consent decision scope is invalid.');
    }
    const rows = await this.#database.query<PayloadRow>(
      `SELECT platform.decide_mobile_family_consent($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::uuid,$7::uuid,$8::text,$9::text,$10::text) AS payload`,
      [
        issuer,
        subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        consentId,
        input.studentId,
        input.policyVersion,
        input.decision,
        idempotencyKey,
      ],
    );
    return this.#onePayload(
      rows,
      (value) => validateMutation(value, 'Mobile family consent decision'),
      'Mobile family consent decision',
    );
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
