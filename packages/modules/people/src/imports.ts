export type ImportEntity =
  'person' | 'household' | 'guardian-authority' | 'student-profile' | 'enrollment';
export type ImportBatchStatus =
  'draft' | 'validated' | 'applying' | 'completed' | 'completed-with-errors' | 'failed';

export interface ImportColumnMapping {
  sourceColumn: string;
  targetField: string;
  required?: boolean;
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'date-iso' | 'boolean';
}

export interface ImportRow {
  rowNumber: number;
  sourceKey: string;
  values: Readonly<Record<string, unknown>>;
}

export interface ImportRowError {
  rowNumber: number;
  sourceKey: string;
  field?: string;
  code: string;
  message: string;
}

export interface StagedImportRow {
  rowNumber: number;
  sourceKey: string;
  normalized: Readonly<Record<string, unknown>>;
  checksum: string;
  status: 'valid' | 'invalid' | 'applied' | 'skipped';
  errors: readonly ImportRowError[];
  resultReference?: string;
}

export interface ImportBatch {
  tenantId: string;
  importBatchId: string;
  entity: ImportEntity;
  idempotencyKey: string;
  status: ImportBatchStatus;
  dryRun: boolean;
  mappings: readonly ImportColumnMapping[];
  rows: readonly StagedImportRow[];
  createdAt: string;
  completedAt?: string;
}

export interface DataQualityIssue {
  tenantId: string;
  issueId: string;
  issueType:
    | 'duplicate-source-key'
    | 'missing-required-field'
    | 'invalid-value'
    | 'duplicate-identity'
    | 'orphan-reference'
    | 'reconciliation-mismatch';
  severity: 'info' | 'warning' | 'error' | 'critical';
  entityType: ImportEntity | 'application' | 'profile';
  entityReference: string;
  summary: string;
  details: Readonly<Record<string, unknown>>;
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
}

export interface ImportApplyResult {
  resultReference: string;
}

export class ImportDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImportDomainError';
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function checksum(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function transformValue(value: unknown, transform?: ImportColumnMapping['transform']): unknown {
  if (value === null || value === undefined || transform === undefined) return value;
  let text: string;
  switch (typeof value) {
    case 'string':
      text = value;
      break;
    case 'number':
    case 'bigint':
    case 'boolean':
      text = value.toString();
      break;
    default:
      throw new ImportDomainError(
        'SIS_IMPORT_SCALAR_REQUIRED',
        'Mapped values must be strings, numbers, bigints or booleans',
      );
  }
  switch (transform) {
    case 'trim':
      return text.trim();
    case 'lowercase':
      return text.trim().toLowerCase();
    case 'uppercase':
      return text.trim().toUpperCase();
    case 'date-iso': {
      const date = new Date(text);
      if (Number.isNaN(date.valueOf())) {
        throw new ImportDomainError('SIS_IMPORT_DATE_INVALID', `Invalid date: ${text}`);
      }
      return date.toISOString().slice(0, 10);
    }
    case 'boolean': {
      const normalized = text.trim().toLowerCase();
      if (['true', 'yes', '1', 'y'].includes(normalized)) return true;
      if (['false', 'no', '0', 'n'].includes(normalized)) return false;
      throw new ImportDomainError('SIS_IMPORT_BOOLEAN_INVALID', `Invalid boolean: ${text}`);
    }
  }
}

function cloneIssue(issue: DataQualityIssue): DataQualityIssue {
  return { ...issue, details: { ...issue.details } };
}

export class ImportPipeline {
  readonly #batches = new Map<string, ImportBatch>();
  readonly #batchByIdempotency = new Map<string, string>();
  readonly #batchFingerprintByIdempotency = new Map<string, string>();
  readonly #appliedRows = new Map<string, string>();
  readonly #issues = new Map<string, DataQualityIssue>();

  stage(input: {
    tenantId: string;
    entity: ImportEntity;
    idempotencyKey: string;
    mappings: readonly ImportColumnMapping[];
    rows: readonly ImportRow[];
    dryRun?: boolean;
  }): ImportBatch {
    const retryKey = `${input.tenantId}:${input.idempotencyKey}`;
    const requestFingerprint = checksum({
      entity: input.entity,
      dryRun: input.dryRun ?? false,
      mappings: input.mappings,
      rows: input.rows,
    });
    const existingId = this.#batchByIdempotency.get(retryKey);
    if (existingId) {
      if (this.#batchFingerprintByIdempotency.get(retryKey) !== requestFingerprint) {
        throw new ImportDomainError(
          'SIS_IMPORT_IDEMPOTENCY_CONFLICT',
          'Import idempotency key is already bound to another request',
        );
      }
      return this.getBatch(input.tenantId, existingId);
    }
    if (input.mappings.length === 0) {
      throw new ImportDomainError(
        'SIS_IMPORT_MAPPING_REQUIRED',
        'At least one mapping is required',
      );
    }
    const duplicateSourceKeys = new Set<string>();
    const seenSourceKeys = new Set<string>();
    for (const row of input.rows) {
      if (seenSourceKeys.has(row.sourceKey)) duplicateSourceKeys.add(row.sourceKey);
      seenSourceKeys.add(row.sourceKey);
    }

    const stagedRows = input.rows.map((row): StagedImportRow => {
      const normalized: Record<string, unknown> = {};
      const errors: ImportRowError[] = [];
      if (!row.sourceKey.trim()) {
        errors.push({
          rowNumber: row.rowNumber,
          sourceKey: row.sourceKey,
          code: 'SIS_IMPORT_SOURCE_KEY_REQUIRED',
          message: 'Source key is required',
        });
      }
      if (duplicateSourceKeys.has(row.sourceKey)) {
        errors.push({
          rowNumber: row.rowNumber,
          sourceKey: row.sourceKey,
          code: 'SIS_IMPORT_DUPLICATE_SOURCE_KEY',
          message: 'Source key is duplicated in the batch',
        });
      }
      for (const mapping of input.mappings) {
        const raw = row.values[mapping.sourceColumn];
        if (
          mapping.required &&
          (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === ''))
        ) {
          errors.push({
            rowNumber: row.rowNumber,
            sourceKey: row.sourceKey,
            field: mapping.targetField,
            code: 'SIS_IMPORT_REQUIRED_FIELD_MISSING',
            message: `${mapping.sourceColumn} is required`,
          });
          continue;
        }
        try {
          normalized[mapping.targetField] = transformValue(raw, mapping.transform);
        } catch (error) {
          errors.push({
            rowNumber: row.rowNumber,
            sourceKey: row.sourceKey,
            field: mapping.targetField,
            code: error instanceof ImportDomainError ? error.code : 'SIS_IMPORT_TRANSFORM_FAILED',
            message: error instanceof Error ? error.message : 'Transform failed',
          });
        }
      }
      return {
        rowNumber: row.rowNumber,
        sourceKey: row.sourceKey,
        normalized: Object.freeze(normalized),
        checksum: checksum(normalized),
        status: errors.length === 0 ? 'valid' : 'invalid',
        errors,
      };
    });

    const batch: ImportBatch = {
      tenantId: input.tenantId,
      importBatchId: crypto.randomUUID(),
      entity: input.entity,
      idempotencyKey: input.idempotencyKey,
      status: 'validated',
      dryRun: input.dryRun ?? false,
      mappings: input.mappings.map((mapping) => ({ ...mapping })),
      rows: stagedRows,
      createdAt: new Date().toISOString(),
    };
    this.#batches.set(batch.importBatchId, batch);
    this.#batchByIdempotency.set(retryKey, batch.importBatchId);
    this.#batchFingerprintByIdempotency.set(retryKey, requestFingerprint);
    this.#createIssuesForInvalidRows(batch);
    return this.#cloneBatch(batch);
  }

  async apply(
    tenantId: string,
    importBatchId: string,
    applyRow: (
      entity: ImportEntity,
      values: Readonly<Record<string, unknown>>,
    ) => Promise<ImportApplyResult>,
  ): Promise<ImportBatch> {
    const batch = this.#requireBatch(tenantId, importBatchId);
    if (batch.status === 'completed' || batch.status === 'completed-with-errors') {
      return this.#cloneBatch(batch);
    }
    batch.status = 'applying';
    const rows = batch.rows.map((row) => ({ ...row, errors: [...row.errors] }));
    for (const row of rows) {
      if (row.status === 'invalid') continue;
      if (batch.dryRun) {
        row.status = 'skipped';
        continue;
      }
      const replayKey = `${tenantId}:${batch.entity}:${row.sourceKey}:${row.checksum}`;
      const previousReference = this.#appliedRows.get(replayKey);
      if (previousReference) {
        row.status = 'applied';
        row.resultReference = previousReference;
        continue;
      }
      try {
        const result = await applyRow(batch.entity, row.normalized);
        row.status = 'applied';
        row.resultReference = result.resultReference;
        this.#appliedRows.set(replayKey, result.resultReference);
      } catch (error) {
        const rowError: ImportRowError = {
          rowNumber: row.rowNumber,
          sourceKey: row.sourceKey,
          code: 'SIS_IMPORT_APPLY_FAILED',
          message: error instanceof Error ? error.message : 'Apply failed',
        };
        row.status = 'invalid';
        row.errors = [...row.errors, rowError];
        this.#createIssue({
          tenantId,
          issueType: 'invalid-value',
          severity: 'error',
          entityType: batch.entity,
          entityReference: `${batch.importBatchId}:${row.rowNumber}`,
          summary: rowError.message,
          details: { sourceKey: row.sourceKey, code: rowError.code },
        });
      }
    }
    const hasErrors = rows.some((row) => row.status === 'invalid');
    const completed: ImportBatch = {
      ...batch,
      status: hasErrors ? 'completed-with-errors' : 'completed',
      rows,
      completedAt: new Date().toISOString(),
    };
    this.#batches.set(batch.importBatchId, completed);
    return this.#cloneBatch(completed);
  }

  getBatch(tenantId: string, importBatchId: string): ImportBatch {
    return this.#cloneBatch(this.#requireBatch(tenantId, importBatchId));
  }

  listIssues(
    tenantId: string,
    status: DataQualityIssue['status'] = 'open',
  ): readonly DataQualityIssue[] {
    return [...this.#issues.values()]
      .filter((issue) => issue.tenantId === tenantId && issue.status === status)
      .map(cloneIssue);
  }

  resolveIssue(
    tenantId: string,
    issueId: string,
    resolution: 'resolved' | 'dismissed',
  ): DataQualityIssue {
    const issue = this.#issues.get(issueId);
    if (!issue || issue.tenantId !== tenantId) {
      throw new ImportDomainError(
        'SIS_DATA_QUALITY_ISSUE_NOT_FOUND',
        'Data-quality issue was not found',
      );
    }
    issue.status = resolution;
    issue.resolvedAt = new Date().toISOString();
    return cloneIssue(issue);
  }

  #createIssuesForInvalidRows(batch: ImportBatch): void {
    for (const row of batch.rows) {
      for (const error of row.errors) {
        this.#createIssue({
          tenantId: batch.tenantId,
          issueType:
            error.code === 'SIS_IMPORT_DUPLICATE_SOURCE_KEY'
              ? 'duplicate-source-key'
              : error.code === 'SIS_IMPORT_REQUIRED_FIELD_MISSING'
                ? 'missing-required-field'
                : 'invalid-value',
          severity: 'error',
          entityType: batch.entity,
          entityReference: `${batch.importBatchId}:${row.rowNumber}`,
          summary: error.message,
          details: { sourceKey: row.sourceKey, field: error.field, code: error.code },
        });
      }
    }
  }

  #createIssue(input: Omit<DataQualityIssue, 'issueId' | 'status' | 'createdAt'>): void {
    const issue: DataQualityIssue = {
      ...input,
      issueId: crypto.randomUUID(),
      details: Object.freeze({ ...input.details }),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.#issues.set(issue.issueId, issue);
  }

  #requireBatch(tenantId: string, importBatchId: string): ImportBatch {
    const batch = this.#batches.get(importBatchId);
    if (!batch || batch.tenantId !== tenantId) {
      throw new ImportDomainError('SIS_IMPORT_BATCH_NOT_FOUND', 'Import batch was not found');
    }
    return batch;
  }

  #cloneBatch(batch: ImportBatch): ImportBatch {
    return {
      ...batch,
      mappings: batch.mappings.map((mapping) => ({ ...mapping })),
      rows: batch.rows.map((row) => ({
        ...row,
        normalized: { ...row.normalized },
        errors: row.errors.map((error) => ({ ...error })),
      })),
    };
  }
}

export interface ExportPermission {
  fields: readonly string[];
  includeRestrictedDocuments?: boolean;
  purpose: string;
}

export function createPrivacyAwareExport(
  records: readonly Readonly<Record<string, unknown>>[],
  permission: ExportPermission,
): readonly Readonly<Record<string, unknown>>[] {
  const allowed = new Set(permission.fields);
  if (!permission.purpose.trim()) {
    throw new ImportDomainError('SIS_EXPORT_PURPOSE_REQUIRED', 'Export purpose is required');
  }
  return records.map((record) => {
    const exported: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(record)) {
      if (!allowed.has(field)) continue;
      if (field === 'restrictedDocuments' && !permission.includeRestrictedDocuments) continue;
      exported[field] = value;
    }
    return Object.freeze(exported);
  });
}
