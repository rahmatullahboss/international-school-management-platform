import { currencyCode, minorUnit, type CurrencyCode, type MinorUnit } from './contracts/money.js';

export type CsvColumnKind = 'text' | 'reference' | 'date' | 'integer' | 'minor-unit' | 'currency';

export interface CsvColumnDefinition {
  readonly name: string;
  readonly kind: CsvColumnKind;
  readonly headerRequired?: boolean;
  readonly required?: boolean;
  readonly maxLength?: number;
}

export interface CsvSchema {
  readonly columns: readonly CsvColumnDefinition[];
  readonly rejectUnknownColumns?: boolean;
  readonly uniqueBy?: readonly string[];
}

export interface CsvLimits {
  readonly maxBytes: number;
  readonly maxRows: number;
  readonly maxColumns: number;
  readonly maxCellLength: number;
}

export interface ParsedCsv<T extends object> {
  readonly headers: readonly string[];
  readonly rows: readonly T[];
  readonly rowCount: number;
}

export interface FeeCatalogImportRow {
  readonly code: string;
  readonly name: string;
  readonly amountMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly incomeAccountId: string;
  readonly taxBasisPoints: number;
  readonly taxAccountId: string;
}

export interface BankStatementImportRow {
  readonly lineNumber: number;
  readonly bookingDate: string;
  readonly amountMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly externalReference: string;
}

export const DEFAULT_FINANCE_CSV_LIMITS: CsvLimits = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  maxRows: 10_000,
  maxColumns: 50,
  maxCellLength: 10_000,
});

function frozenArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function assertSafeText(
  value: string,
  column: string,
  rowNumber: number,
  maxLength: number,
): string {
  const normalized = value.trim();
  if (normalized.length > maxLength)
    throw new Error(`FIN_CSV_CELL_TOO_LONG:${rowNumber}:${column}`);
  if (/^[=+@\t\r]/.test(normalized) || /^-\D/.test(normalized)) {
    throw new Error(`FIN_CSV_FORMULA_REJECTED:${rowNumber}:${column}`);
  }
  return normalized;
}

function parseRows(input: string, limits: CsvLimits): string[][] {
  if (Buffer.byteLength(input, 'utf8') > limits.maxBytes) throw new Error('FIN_CSV_TOO_LARGE');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      if (cell.length > limits.maxCellLength) throw new Error('FIN_CSV_CELL_TOO_LONG');
      continue;
    }
    if (character === '"') {
      if (cell.length !== 0) throw new Error('FIN_CSV_INVALID_QUOTE');
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
      if (row.length > limits.maxColumns) throw new Error('FIN_CSV_TOO_MANY_COLUMNS');
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell);
      cell = '';
      if (row.length > limits.maxColumns) throw new Error('FIN_CSV_TOO_MANY_COLUMNS');
      if (row.some((value) => value.length > 0) || rows.length === 0) rows.push(row);
      row = [];
      if (rows.length - 1 > limits.maxRows) throw new Error('FIN_CSV_TOO_MANY_ROWS');
    } else {
      cell += character;
      if (cell.length > limits.maxCellLength) throw new Error('FIN_CSV_CELL_TOO_LONG');
    }
  }
  if (quoted) throw new Error('FIN_CSV_UNCLOSED_QUOTE');
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.length > limits.maxColumns) throw new Error('FIN_CSV_TOO_MANY_COLUMNS');
    rows.push(row);
  }
  if (rows.length === 0) throw new Error('FIN_CSV_EMPTY');
  if (rows.length - 1 > limits.maxRows) throw new Error('FIN_CSV_TOO_MANY_ROWS');
  return rows;
}

function validateValue(
  value: string,
  definition: CsvColumnDefinition,
  rowNumber: number,
  limits: CsvLimits,
): string | number {
  const normalized = assertSafeText(
    value,
    definition.name,
    rowNumber,
    definition.maxLength ?? limits.maxCellLength,
  );
  if (definition.required === true && normalized.length === 0)
    throw new Error(`FIN_CSV_REQUIRED:${rowNumber}:${definition.name}`);
  if (normalized.length === 0) return '';
  switch (definition.kind) {
    case 'text':
    case 'reference':
      return normalized;
    case 'date':
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(normalized) ||
        Number.isNaN(Date.parse(`${normalized}T00:00:00.000Z`))
      ) {
        throw new Error(`FIN_CSV_INVALID_DATE:${rowNumber}:${definition.name}`);
      }
      return normalized;
    case 'integer': {
      if (!/^-?\d+$/.test(normalized))
        throw new Error(`FIN_CSV_INVALID_INTEGER:${rowNumber}:${definition.name}`);
      const parsed = Number(normalized);
      if (!Number.isSafeInteger(parsed))
        throw new Error(`FIN_CSV_INTEGER_OUT_OF_RANGE:${rowNumber}:${definition.name}`);
      return parsed;
    }
    case 'minor-unit': {
      if (!/^-?\d+$/.test(normalized))
        throw new Error(`FIN_CSV_INVALID_MINOR_UNIT:${rowNumber}:${definition.name}`);
      const parsed = Number(normalized);
      return minorUnit(parsed);
    }
    case 'currency':
      try {
        return currencyCode(normalized);
      } catch {
        throw new Error(`FIN_CSV_INVALID_CURRENCY:${rowNumber}:${definition.name}`);
      }
  }
}

export function parseFinanceCsv<T extends object>(
  input: string,
  schema: CsvSchema,
  limits: CsvLimits = DEFAULT_FINANCE_CSV_LIMITS,
): ParsedCsv<T> {
  const rawRows = parseRows(input.replace(/^\uFEFF/, ''), limits);
  const headers = rawRows[0]!.map((header) => header.trim());
  if (new Set(headers).size !== headers.length) throw new Error('FIN_CSV_DUPLICATE_HEADER');
  const definitions = new Map(schema.columns.map((column) => [column.name, column]));
  for (const definition of schema.columns) {
    if (definition.headerRequired !== false && !headers.includes(definition.name)) {
      throw new Error(`FIN_CSV_MISSING_HEADER:${definition.name}`);
    }
  }
  if (schema.rejectUnknownColumns !== false) {
    const unknown = headers.find((header) => !definitions.has(header));
    if (unknown !== undefined) throw new Error(`FIN_CSV_UNKNOWN_HEADER:${unknown}`);
  }
  const rows = rawRows.slice(1).map((raw, rowIndex) => {
    const rowNumber = rowIndex + 2;
    if (raw.length !== headers.length) throw new Error(`FIN_CSV_COLUMN_COUNT:${rowNumber}`);
    const result: Record<string, string | number> = Object.create(null) as Record<
      string,
      string | number
    >;
    headers.forEach((header, columnIndex) => {
      const definition = definitions.get(header);
      if (definition !== undefined)
        result[header] = validateValue(raw[columnIndex] ?? '', definition, rowNumber, limits);
    });
    return Object.freeze(result) as T;
  });
  if (schema.uniqueBy !== undefined) {
    const keys = new Set<string>();
    for (const [index, row] of rows.entries()) {
      const record = row as Readonly<Record<string, string | number>>;
      const key = schema.uniqueBy.map((column) => String(record[column] ?? '')).join('\u001f');
      if (keys.has(key))
        throw new Error(`FIN_CSV_DUPLICATE_ROW:${index + 2}:${schema.uniqueBy.join(',')}`);
      keys.add(key);
    }
  }
  return Object.freeze({
    headers: frozenArray(headers),
    rows: frozenArray(rows),
    rowCount: rows.length,
  });
}

function escapeCsvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+@\t\r]/.test(text) || /^-\D/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function exportFinanceCsv(
  headers: readonly string[],
  rows: readonly Readonly<Record<string, string | number | null | undefined>>[],
  limits: CsvLimits = DEFAULT_FINANCE_CSV_LIMITS,
): string {
  if (headers.length === 0 || headers.length > limits.maxColumns)
    throw new Error('FIN_CSV_INVALID_HEADERS');
  if (new Set(headers).size !== headers.length) throw new Error('FIN_CSV_DUPLICATE_HEADER');
  if (rows.length > limits.maxRows) throw new Error('FIN_CSV_TOO_MANY_ROWS');
  const output = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows)
    output.push(headers.map((header) => escapeCsvCell(row[header])).join(','));
  const result = `${output.join('\r\n')}\r\n`;
  if (Buffer.byteLength(result, 'utf8') > limits.maxBytes) throw new Error('FIN_CSV_TOO_LARGE');
  return result;
}

export function importFeeCatalogCsv(
  input: string,
  limits?: CsvLimits,
): readonly FeeCatalogImportRow[] {
  const parsed = parseFinanceCsv<FeeCatalogImportRow>(
    input,
    {
      columns: [
        { name: 'code', kind: 'reference', required: true, maxLength: 50 },
        { name: 'name', kind: 'text', required: true, maxLength: 200 },
        { name: 'amountMinor', kind: 'minor-unit', required: true },
        { name: 'currency', kind: 'currency', required: true },
        { name: 'incomeAccountId', kind: 'reference', required: true, maxLength: 200 },
        { name: 'taxBasisPoints', kind: 'integer', required: true },
        { name: 'taxAccountId', kind: 'reference', maxLength: 200 },
      ],
      uniqueBy: ['code'],
    },
    limits,
  );
  return parsed.rows.map((row) => {
    if (row.amountMinor <= 0) throw new Error(`FIN_CSV_INVALID_AMOUNT:${row.code}`);
    if (row.taxBasisPoints < 0 || row.taxBasisPoints > 10_000)
      throw new Error(`FIN_CSV_INVALID_TAX_RATE:${row.code}`);
    if (row.taxBasisPoints > 0 && row.taxAccountId.length === 0)
      throw new Error(`FIN_CSV_TAX_ACCOUNT_REQUIRED:${row.code}`);
    return row;
  });
}

export function importBankStatementCsv(
  input: string,
  limits?: CsvLimits,
): readonly BankStatementImportRow[] {
  return parseFinanceCsv<BankStatementImportRow>(
    input,
    {
      columns: [
        { name: 'lineNumber', kind: 'integer', required: true },
        { name: 'bookingDate', kind: 'date', required: true },
        { name: 'amountMinor', kind: 'minor-unit', required: true },
        { name: 'currency', kind: 'currency', required: true },
        { name: 'description', kind: 'text', required: true, maxLength: 500 },
        { name: 'externalReference', kind: 'reference', maxLength: 200 },
      ],
      uniqueBy: ['lineNumber'],
    },
    limits,
  ).rows.map((row) => {
    if (row.lineNumber <= 0 || row.amountMinor === 0)
      throw new Error(`FIN_CSV_INVALID_BANK_LINE:${row.lineNumber}`);
    return row;
  });
}
