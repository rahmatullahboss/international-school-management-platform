import { cloneAndFreeze, sha256, stableStringify } from './common.js';

export type TabularCell = string | number | boolean | null;

export interface TabularSheet {
  name: string;
  hidden?: boolean;
  rows: readonly (readonly TabularCell[])[];
}

export interface TabularWorkbook {
  sheets: readonly Readonly<TabularSheet>[];
}

export interface SecureCsvCodecOptions {
  maxBytes?: number;
  maxRows?: number;
  maxColumns?: number;
}

function neutraliseFormula(value: string): string {
  return /^[=+\-@\t]/u.test(value) ? `'${value}` : value;
}

function encodeCsvCell(value: TabularCell): string {
  const text = neutraliseFormula(value === null ? '' : String(value));
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export class SecureCsvCodec {
  readonly #maxBytes: number;
  readonly #maxRows: number;
  readonly #maxColumns: number;

  constructor(options: SecureCsvCodecOptions = {}) {
    this.#maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
    this.#maxRows = options.maxRows ?? 100_000;
    this.#maxColumns = options.maxColumns ?? 500;
  }

  parse(input: string): readonly (readonly string[])[] {
    if (new TextEncoder().encode(input).byteLength > this.#maxBytes) {
      throw new Error('CSV byte limit exceeded');
    }
    const text = input.startsWith('\uFEFF') ? input.slice(1) : input;
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;

    const pushCell = () => {
      row.push(cell);
      cell = '';
      if (row.length > this.#maxColumns) throw new Error('CSV column limit exceeded');
    };
    const pushRow = () => {
      pushCell();
      if (row.some((value) => value.length > 0) || rows.length === 0) rows.push(row);
      row = [];
      if (rows.length > this.#maxRows) throw new Error('CSV row limit exceeded');
    };

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index] ?? '';
      if (quoted) {
        if (character === '"') {
          if (text[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            quoted = false;
          }
        } else {
          cell += character;
        }
        continue;
      }
      if (character === '"') {
        if (cell.length > 0) throw new Error('CSV quote must start at the beginning of a cell');
        quoted = true;
      } else if (character === ',') {
        pushCell();
      } else if (character === '\n') {
        pushRow();
      } else if (character === '\r') {
        if (text[index + 1] === '\n') index += 1;
        pushRow();
      } else {
        cell += character;
      }
    }
    if (quoted) throw new Error('CSV contains an unterminated quoted cell');
    if (cell.length > 0 || row.length > 0) pushRow();
    return cloneAndFreeze(rows);
  }

  stringify(rows: readonly (readonly TabularCell[])[]): string {
    if (rows.length > this.#maxRows) throw new Error('CSV row limit exceeded');
    return rows
      .map((row) => {
        if (row.length > this.#maxColumns) throw new Error('CSV column limit exceeded');
        return row.map(encodeCsvCell).join(',');
      })
      .join('\n');
  }
}

export interface XlsxWorkbookAdapterOptions {
  decoder: (bytes: Uint8Array) => Promise<TabularWorkbook>;
  maxBytes?: number;
  maxSheets?: number;
  maxRowsPerSheet?: number;
  maxColumnsPerSheet?: number;
}

export class XlsxWorkbookAdapter {
  readonly #decoder: (bytes: Uint8Array) => Promise<TabularWorkbook>;
  readonly #maxBytes: number;
  readonly #maxSheets: number;
  readonly #maxRowsPerSheet: number;
  readonly #maxColumnsPerSheet: number;

  constructor(options: XlsxWorkbookAdapterOptions) {
    this.#decoder = options.decoder;
    this.#maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
    this.#maxSheets = options.maxSheets ?? 20;
    this.#maxRowsPerSheet = options.maxRowsPerSheet ?? 100_000;
    this.#maxColumnsPerSheet = options.maxColumnsPerSheet ?? 500;
  }

  async decode(bytes: Uint8Array): Promise<Readonly<TabularWorkbook>> {
    if (bytes.byteLength > this.#maxBytes) throw new Error('XLSX byte limit exceeded');
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new Error('XLSX file does not have a ZIP signature');
    }
    const workbook = await this.#decoder(bytes);
    if (workbook.sheets.length === 0) throw new Error('XLSX workbook has no sheets');
    if (workbook.sheets.length > this.#maxSheets) throw new Error('XLSX sheet limit exceeded');
    for (const sheet of workbook.sheets) {
      if (sheet.hidden) throw new Error('Hidden XLSX sheets are not accepted');
      if (sheet.rows.length > this.#maxRowsPerSheet) throw new Error('XLSX row limit exceeded');
      if (sheet.rows.some((row) => row.length > this.#maxColumnsPerSheet)) {
        throw new Error('XLSX column limit exceeded');
      }
    }
    return cloneAndFreeze(workbook);
  }
}

export type ImportTransform = 'trim' | 'lowercase' | 'uppercase' | 'boolean' | 'integer';

export interface ImportMappingField {
  source: string;
  target: string;
  required?: boolean;
  transforms?: readonly ImportTransform[];
}

export interface ImportMapping {
  mappingKey: string;
  objectType: string;
  version: number;
  fields: readonly Readonly<ImportMappingField>[];
}

export type ImportMode = 'dry-run' | 'commit';
export type ImportJobStatus =
  'validated' | 'ready' | 'executing' | 'completed' | 'completed-with-errors';
export type ImportRowStatus = 'valid' | 'invalid' | 'succeeded' | 'failed';

export interface ImportRow {
  rowNumber: number;
  source: Readonly<Record<string, string>>;
  mapped: Readonly<Record<string, unknown>>;
  errors: readonly string[];
  status: ImportRowStatus;
  domainId: string | null;
}

export interface ImportReconciliation {
  inputRows: number;
  validRows: number;
  invalidRows: number;
  succeededRows: number;
  failedRows: number;
  sourceChecksum: string;
}

export interface ImportJob {
  jobId: string;
  tenantId: string;
  objectType: string;
  mappingKey: string;
  mappingVersion: number;
  sourceFileName: string;
  mode: ImportMode;
  status: ImportJobStatus;
  rows: readonly Readonly<ImportRow>[];
  reconciliation: Readonly<ImportReconciliation>;
}

export interface DomainImportCommand {
  tenantId: string;
  objectType: string;
  payload: Readonly<Record<string, unknown>>;
  rowNumber: number;
  idempotencyKey: string;
}

export interface DomainImportResult {
  domainId: string;
}

export interface StageCsvInput {
  tenantId: string;
  mapping: ImportMapping;
  csv: string;
  sourceFileName: string;
  mode: ImportMode;
}

export interface ImportExportStudioOptions {
  idFactory?: () => string;
  commandExecutor?: (command: DomainImportCommand) => Promise<DomainImportResult>;
  csvCodec?: SecureCsvCodec;
}

function transformValue(value: string, transforms: readonly ImportTransform[]): unknown {
  let transformed: unknown = value;
  for (const transform of transforms) {
    if (transform === 'trim') transformed = String(transformed).trim();
    else if (transform === 'lowercase') transformed = String(transformed).toLowerCase();
    else if (transform === 'uppercase') transformed = String(transformed).toUpperCase();
    else if (transform === 'boolean') {
      const normalized = String(transformed).trim().toLowerCase();
      if (['true', 'yes', '1'].includes(normalized)) transformed = true;
      else if (['false', 'no', '0'].includes(normalized)) transformed = false;
      else throw new Error('must be a boolean');
    } else if (transform === 'integer') {
      const parsed = Number.parseInt(String(transformed), 10);
      if (!Number.isSafeInteger(parsed) || String(parsed) !== String(transformed).trim()) {
        throw new Error('must be an integer');
      }
      transformed = parsed;
    }
  }
  return transformed;
}

function reconciliation(rows: readonly ImportRow[], sourceChecksum: string): ImportReconciliation {
  return {
    inputRows: rows.length,
    validRows: rows.filter((row) => row.status !== 'invalid').length,
    invalidRows: rows.filter((row) => row.status === 'invalid').length,
    succeededRows: rows.filter((row) => row.status === 'succeeded').length,
    failedRows: rows.filter((row) => row.status === 'failed').length,
    sourceChecksum,
  };
}

export class ImportExportStudio {
  readonly #jobs = new Map<string, Readonly<ImportJob>>();
  readonly #idFactory: () => string;
  readonly #commandExecutor: (command: DomainImportCommand) => Promise<DomainImportResult>;
  readonly #csvCodec: SecureCsvCodec;

  constructor(options: ImportExportStudioOptions = {}) {
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.#commandExecutor =
      options.commandExecutor ??
      (() => Promise.reject(new Error('Domain command executor is required')));
    this.#csvCodec = options.csvCodec ?? new SecureCsvCodec();
  }

  async stageCsv(input: StageCsvInput): Promise<Readonly<ImportJob>> {
    if (input.mapping.version < 1) throw new Error('Mapping version must be positive');
    const table = this.#csvCodec.parse(input.csv);
    const headers = table[0];
    if (!headers || headers.length === 0) throw new Error('Import file requires a header row');
    if (new Set(headers).size !== headers.length) throw new Error('Import headers must be unique');
    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    for (const field of input.mapping.fields) {
      if (!headerIndex.has(field.source)) throw new Error(`Missing source column: ${field.source}`);
    }

    const rows: ImportRow[] = table.slice(1).map((values, index) => {
      const source = Object.fromEntries(
        headers.map((header, column) => [header, values[column] ?? '']),
      );
      const mapped: Record<string, unknown> = {};
      const errors: string[] = [];
      for (const field of input.mapping.fields) {
        const raw = source[field.source] ?? '';
        try {
          const transformed = transformValue(raw, field.transforms ?? []);
          if (
            field.required &&
            (transformed === '' || transformed === null || transformed === undefined)
          ) {
            errors.push(`${field.target} is required`);
          } else if (transformed !== '') {
            mapped[field.target] = transformed;
          }
        } catch (error) {
          errors.push(`${field.target} ${error instanceof Error ? error.message : 'is invalid'}`);
        }
      }
      return {
        rowNumber: index + 2,
        source,
        mapped,
        errors,
        status: errors.length === 0 ? 'valid' : 'invalid',
        domainId: null,
      };
    });
    const sourceChecksum = await sha256(input.csv);
    const job = cloneAndFreeze<ImportJob>({
      jobId: this.#idFactory(),
      tenantId: input.tenantId,
      objectType: input.mapping.objectType,
      mappingKey: input.mapping.mappingKey,
      mappingVersion: input.mapping.version,
      sourceFileName: input.sourceFileName,
      mode: input.mode,
      status: input.mode === 'dry-run' ? 'validated' : 'ready',
      rows,
      reconciliation: reconciliation(rows, sourceChecksum),
    });
    this.#jobs.set(job.jobId, job);
    return job;
  }

  async execute(jobId: string): Promise<Readonly<ImportJob>> {
    const job = this.#jobs.get(jobId);
    if (!job) throw new Error('Unknown import job');
    if (job.mode === 'dry-run') throw new Error('Dry-run jobs cannot execute');
    if (job.status === 'completed' || job.status === 'completed-with-errors') return job;

    const executedRows: ImportRow[] = [];
    for (const row of job.rows) {
      if (row.status === 'invalid') {
        executedRows.push(structuredClone(row));
        continue;
      }
      try {
        const result = await this.#commandExecutor({
          tenantId: job.tenantId,
          objectType: job.objectType,
          payload: row.mapped,
          rowNumber: row.rowNumber,
          idempotencyKey: `${job.jobId}:${row.rowNumber}`,
        });
        executedRows.push({
          ...structuredClone(row),
          status: 'succeeded',
          domainId: result.domainId,
        });
      } catch (error) {
        executedRows.push({
          ...structuredClone(row),
          status: 'failed',
          errors: [...row.errors, error instanceof Error ? error.message : 'Domain command failed'],
        });
      }
    }
    const sourceChecksum = job.reconciliation.sourceChecksum;
    const failed = executedRows.some((row) => row.status === 'failed' || row.status === 'invalid');
    const completed = cloneAndFreeze<ImportJob>({
      ...job,
      status: failed ? 'completed-with-errors' : 'completed',
      rows: executedRows,
      reconciliation: reconciliation(executedRows, sourceChecksum),
    });
    this.#jobs.set(jobId, completed);
    return completed;
  }

  exportCsv(input: {
    columns: readonly string[];
    rows: readonly Readonly<Record<string, unknown>>[];
    maxRows: number;
  }): string {
    return this.#csvCodec.stringify(this.#exportRows(input));
  }

  exportWorkbook(input: {
    sheetName: string;
    columns: readonly string[];
    rows: readonly Readonly<Record<string, unknown>>[];
    maxRows: number;
  }): Readonly<TabularWorkbook> {
    if (input.sheetName.trim().length === 0 || input.sheetName.length > 31) {
      throw new Error('Workbook sheet name is invalid');
    }
    return cloneAndFreeze({
      sheets: [{ name: input.sheetName, hidden: false, rows: this.#exportRows(input) }],
    });
  }

  #exportRows(input: {
    columns: readonly string[];
    rows: readonly Readonly<Record<string, unknown>>[];
    maxRows: number;
  }): readonly (readonly TabularCell[])[] {
    if (input.rows.length > input.maxRows) throw new Error('Export row limit exceeded');
    if (new Set(input.columns).size !== input.columns.length)
      throw new Error('Export columns must be unique');
    return [
      [...input.columns],
      ...input.rows.map((row) =>
        input.columns.map((column) => {
          const value = row[column];
          if (value === undefined || value === null) return '';
          if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          ) {
            return value;
          }
          return stableStringify(value);
        }),
      ),
    ];
  }
}
