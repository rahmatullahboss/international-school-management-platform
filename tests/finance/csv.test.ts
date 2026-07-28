import { describe, expect, it } from 'vitest';

import {
  exportFinanceCsv,
  importBankStatementCsv,
  importFeeCatalogCsv,
  parseFinanceCsv,
} from '../../packages/modules/billing/src/index.js';

describe('FIN-01 secure CSV import and export', () => {
  it('parses quoted RFC-style cells and validates finance types', () => {
    const rows = importFeeCatalogCsv(
      [
        'code,name,amountMinor,currency,incomeAccountId,taxBasisPoints,taxAccountId',
        'TUITION,"Tuition, Term 1",25000,GBP,income-1,1500,tax-1',
        'BUS,"Bus route ""North""",5000,GBP,income-2,0,',
      ].join('\r\n'),
    );
    expect(rows).toEqual([
      {
        code: 'TUITION',
        name: 'Tuition, Term 1',
        amountMinor: 25000,
        currency: 'GBP',
        incomeAccountId: 'income-1',
        taxBasisPoints: 1500,
        taxAccountId: 'tax-1',
      },
      {
        code: 'BUS',
        name: 'Bus route "North"',
        amountMinor: 5000,
        currency: 'GBP',
        incomeAccountId: 'income-2',
        taxBasisPoints: 0,
        taxAccountId: '',
      },
    ]);
    expect(Object.getPrototypeOf(rows[0]!)).toBeNull();
  });

  it('rejects unknown/missing headers, duplicate keys and invalid typed values', () => {
    expect(() =>
      importFeeCatalogCsv(
        'code,name,amountMinor,currency,incomeAccountId,taxBasisPoints\nA,Fee,100,GBP,income,0',
      ),
    ).toThrow('FIN_CSV_MISSING_HEADER:taxAccountId');
    expect(() =>
      importFeeCatalogCsv(
        'code,name,amountMinor,currency,incomeAccountId,taxBasisPoints,taxAccountId,extra\nA,Fee,100,GBP,income,0,,x',
      ),
    ).toThrow('FIN_CSV_UNKNOWN_HEADER:extra');
    expect(() =>
      importFeeCatalogCsv(
        'code,name,amountMinor,currency,incomeAccountId,taxBasisPoints,taxAccountId\nA,Fee,100,GBP,income,0,\nA,Other,200,GBP,income,0,',
      ),
    ).toThrow('FIN_CSV_DUPLICATE_ROW');
    expect(() =>
      importFeeCatalogCsv(
        'code,name,amountMinor,currency,incomeAccountId,taxBasisPoints,taxAccountId\nA,Fee,10.5,GBP,income,0,',
      ),
    ).toThrow('FIN_CSV_INVALID_MINOR_UNIT');
    expect(() =>
      importFeeCatalogCsv(
        'code,name,amountMinor,currency,incomeAccountId,taxBasisPoints,taxAccountId\nA,Fee,100,gb,income,0,',
      ),
    ).toThrow('FIN_CSV_INVALID_CURRENCY');
  });

  it('rejects spreadsheet formulas on import and neutralizes them on export', () => {
    expect(() =>
      importBankStatementCsv(
        'lineNumber,bookingDate,amountMinor,currency,description,externalReference\n1,2026-07-28,1000,GBP,"=HYPERLINK(""bad"")",ref',
      ),
    ).toThrow('FIN_CSV_FORMULA_REJECTED');
    const csv = exportFinanceCsv(
      ['name', 'reference'],
      [
        { name: '=2+2', reference: '-CMD|calc' },
        { name: 'safe', reference: '+SUM(A1)' },
      ],
    );
    expect(csv).toContain("'=2+2");
    expect(csv).toContain("'-CMD|calc");
    expect(csv).toContain("'+SUM(A1)");
  });

  it('enforces byte, row, column and cell bounds before returning data', () => {
    const schema = { columns: [{ name: 'value', kind: 'text' as const, required: true }] };
    expect(() =>
      parseFinanceCsv('value\nabc', schema, {
        maxBytes: 5,
        maxRows: 10,
        maxColumns: 2,
        maxCellLength: 10,
      }),
    ).toThrow('FIN_CSV_TOO_LARGE');
    expect(() =>
      parseFinanceCsv('value\na\nb', schema, {
        maxBytes: 100,
        maxRows: 1,
        maxColumns: 2,
        maxCellLength: 10,
      }),
    ).toThrow('FIN_CSV_TOO_MANY_ROWS');
    expect(() =>
      parseFinanceCsv('value,extra\na,b', schema, {
        maxBytes: 100,
        maxRows: 10,
        maxColumns: 1,
        maxCellLength: 10,
      }),
    ).toThrow('FIN_CSV_TOO_MANY_COLUMNS');
    expect(() =>
      parseFinanceCsv('value\nabcdefghijk', schema, {
        maxBytes: 100,
        maxRows: 10,
        maxColumns: 2,
        maxCellLength: 10,
      }),
    ).toThrow('FIN_CSV_CELL_TOO_LONG');
  });

  it('imports bank statement lines with stable duplicate detection', () => {
    const input = [
      'lineNumber,bookingDate,amountMinor,currency,description,externalReference',
      '1,2026-07-28,25000,GBP,"Fee receipt, family A",provider-1',
      '2,2026-07-29,-500,GBP,Bank charge,charge-1',
    ].join('\n');
    expect(importBankStatementCsv(input)).toEqual([
      {
        lineNumber: 1,
        bookingDate: '2026-07-28',
        amountMinor: 25000,
        currency: 'GBP',
        description: 'Fee receipt, family A',
        externalReference: 'provider-1',
      },
      {
        lineNumber: 2,
        bookingDate: '2026-07-29',
        amountMinor: -500,
        currency: 'GBP',
        description: 'Bank charge',
        externalReference: 'charge-1',
      },
    ]);
    expect(() => importBankStatementCsv(`${input}\n2,2026-07-30,100,GBP,Duplicate,dup`)).toThrow(
      'FIN_CSV_DUPLICATE_ROW',
    );
  });
});
