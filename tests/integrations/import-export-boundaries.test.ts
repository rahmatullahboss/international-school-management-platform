import { describe, expect, it } from 'vitest';

import {
  ImportExportStudio,
  SecureCsvCodec,
  XlsxWorkbookAdapter,
  type ImportMapping,
  type TabularWorkbook,
} from '../../packages/modules/integrations/src/import-export.js';

const baseMapping: ImportMapping = {
  mappingKey: 'student-boundary-v1',
  objectType: 'student',
  version: 1,
  fields: [{ source: 'Student ID', target: 'externalId', required: true, transforms: ['trim'] }],
};

function zipBytes(): Uint8Array {
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
}

describe('secure CSV boundary coverage', () => {
  it('enforces byte, row and column bounds and rejects malformed quoting', () => {
    expect(() => new SecureCsvCodec({ maxBytes: 3 }).parse('abcd')).toThrow(
      'CSV byte limit exceeded',
    );
    expect(() => new SecureCsvCodec().parse('ab"c,d')).toThrow(
      'CSV quote must start at the beginning of a cell',
    );
    expect(() => new SecureCsvCodec().parse('"unterminated')).toThrow(
      'CSV contains an unterminated quoted cell',
    );
    expect(() => new SecureCsvCodec({ maxRows: 1 }).stringify([['a'], ['b']])).toThrow(
      'CSV row limit exceeded',
    );
    expect(() => new SecureCsvCodec({ maxColumns: 1 }).stringify([['a', 'b']])).toThrow(
      'CSV column limit exceeded',
    );
  });

  it('accepts BOM, CRLF and escaped quotes without creating phantom rows', () => {
    const codec = new SecureCsvCodec();
    expect(codec.parse('\uFEFFa,b\r\n"c""d",e\r\n')).toEqual([
      ['a', 'b'],
      ['c"d', 'e'],
    ]);
    expect(codec.parse('a,b\n\n')).toEqual([['a', 'b']]);
    expect(codec.stringify([[null, true, 42, 'plain']])).toBe(',true,42,plain');
  });
});

describe('XLSX workbook boundary coverage', () => {
  it('rejects oversized, empty and over-wide workbook structures', async () => {
    await expect(
      new XlsxWorkbookAdapter({
        maxBytes: 3,
        decoder: () => Promise.resolve({ sheets: [] }),
      }).decode(zipBytes()),
    ).rejects.toThrow('XLSX byte limit exceeded');

    await expect(
      new XlsxWorkbookAdapter({ decoder: () => Promise.resolve({ sheets: [] }) }).decode(
        zipBytes(),
      ),
    ).rejects.toThrow('XLSX workbook has no sheets');

    const twoSheets: TabularWorkbook = {
      sheets: [
        { name: 'One', rows: [['a']] },
        { name: 'Two', rows: [['b']] },
      ],
    };
    await expect(
      new XlsxWorkbookAdapter({ maxSheets: 1, decoder: () => Promise.resolve(twoSheets) }).decode(
        zipBytes(),
      ),
    ).rejects.toThrow('XLSX sheet limit exceeded');

    await expect(
      new XlsxWorkbookAdapter({
        maxRowsPerSheet: 1,
        decoder: () => Promise.resolve({ sheets: [{ name: 'Rows', rows: [['a'], ['b']] }] }),
      }).decode(zipBytes()),
    ).rejects.toThrow('XLSX row limit exceeded');

    await expect(
      new XlsxWorkbookAdapter({
        maxColumnsPerSheet: 1,
        decoder: () => Promise.resolve({ sheets: [{ name: 'Columns', rows: [['a', 'b']] }] }),
      }).decode(zipBytes()),
    ).rejects.toThrow('XLSX column limit exceeded');
  });
});

describe('import staging and execution boundaries', () => {
  it('requires valid mapping versions, headers and declared source columns', async () => {
    const studio = new ImportExportStudio({ idFactory: () => 'job-validation' });

    await expect(
      studio.stageCsv({
        tenantId: 'tenant-1',
        mapping: { ...baseMapping, version: 0 },
        csv: 'Student ID\nS-1',
        sourceFileName: 'students.csv',
        mode: 'dry-run',
      }),
    ).rejects.toThrow('Mapping version must be positive');
    await expect(
      studio.stageCsv({
        tenantId: 'tenant-1',
        mapping: baseMapping,
        csv: '',
        sourceFileName: 'students.csv',
        mode: 'dry-run',
      }),
    ).rejects.toThrow('Import file requires a header row');
    await expect(
      studio.stageCsv({
        tenantId: 'tenant-1',
        mapping: baseMapping,
        csv: 'Student ID,Student ID\nS-1,S-1',
        sourceFileName: 'students.csv',
        mode: 'dry-run',
      }),
    ).rejects.toThrow('Import headers must be unique');
    await expect(
      studio.stageCsv({
        tenantId: 'tenant-1',
        mapping: baseMapping,
        csv: 'Name\nJane',
        sourceFileName: 'students.csv',
        mode: 'dry-run',
      }),
    ).rejects.toThrow('Missing source column: Student ID');
  });

  it('applies uppercase, boolean and integer transforms while isolating row validation errors', async () => {
    const mapping: ImportMapping = {
      mappingKey: 'transform-v1',
      objectType: 'student',
      version: 1,
      fields: [
        { source: 'Code', target: 'code', transforms: ['trim', 'uppercase'] },
        { source: 'Active', target: 'active', transforms: ['boolean'] },
        { source: 'Year', target: 'year', transforms: ['integer'] },
      ],
    };
    const studio = new ImportExportStudio({ idFactory: () => 'job-transforms' });
    const job = await studio.stageCsv({
      tenantId: 'tenant-1',
      mapping,
      csv: ['Code,Active,Year', ' ab ,YES,2026', 'cd,maybe,20.5', 'ef,0,2027'].join('\n'),
      sourceFileName: 'transforms.csv',
      mode: 'dry-run',
    });

    expect(job.rows[0]?.mapped).toEqual({ code: 'AB', active: true, year: 2026 });
    expect(job.rows[1]?.status).toBe('invalid');
    expect(job.rows[1]?.errors).toEqual(['active must be a boolean', 'year must be an integer']);
    expect(job.rows[2]?.mapped).toEqual({ code: 'EF', active: false, year: 2027 });
  });

  it('fails closed for unknown and dry-run execution and records a missing executor as a row failure', async () => {
    const studio = new ImportExportStudio({ idFactory: () => 'job-execution' });
    await expect(studio.execute('missing-job')).rejects.toThrow('Unknown import job');

    const dryRun = await studio.stageCsv({
      tenantId: 'tenant-1',
      mapping: baseMapping,
      csv: 'Student ID\nS-1',
      sourceFileName: 'students.csv',
      mode: 'dry-run',
    });
    await expect(studio.execute(dryRun.jobId)).rejects.toThrow('Dry-run jobs cannot execute');

    const commitStudio = new ImportExportStudio({ idFactory: () => 'job-no-executor' });
    const commitJob = await commitStudio.stageCsv({
      tenantId: 'tenant-1',
      mapping: baseMapping,
      csv: ['Student ID,Name', ',Missing identifier', 'S-1,Valid row'].join('\n'),
      sourceFileName: 'students.csv',
      mode: 'commit',
    });
    const completed = await commitStudio.execute(commitJob.jobId);
    expect(completed).toMatchObject({ status: 'completed-with-errors' });
    expect(completed.rows[0]).toMatchObject({
      status: 'invalid',
      errors: ['externalId is required'],
    });
    expect(completed.rows[1]).toMatchObject({
      status: 'failed',
      errors: ['Domain command executor is required'],
    });
  });
});

describe('export minimization boundaries', () => {
  it('enforces row, column and workbook-name limits', () => {
    const studio = new ImportExportStudio();
    const rows = [{ id: 'S-1' }, { id: 'S-2' }];

    expect(() => studio.exportCsv({ columns: ['id'], rows, maxRows: 1 })).toThrow(
      'Export row limit exceeded',
    );
    expect(() => studio.exportCsv({ columns: ['id', 'id'], rows: [], maxRows: 1 })).toThrow(
      'Export columns must be unique',
    );
    expect(() =>
      studio.exportWorkbook({ sheetName: '   ', columns: ['id'], rows: [], maxRows: 1 }),
    ).toThrow('Workbook sheet name is invalid');
    expect(() =>
      studio.exportWorkbook({ sheetName: 'x'.repeat(32), columns: ['id'], rows: [], maxRows: 1 }),
    ).toThrow('Workbook sheet name is invalid');
  });

  it('exports only selected columns and safely serializes primitive, missing and structured values', () => {
    const studio = new ImportExportStudio();
    const workbook = studio.exportWorkbook({
      sheetName: 'Safe Export',
      columns: ['missing', 'active', 'count', 'metadata'],
      rows: [{ active: true, count: 3, metadata: { b: 2, a: 1 }, ignored: 'not-exported' }],
      maxRows: 10,
    });

    expect(workbook.sheets[0]?.rows).toEqual([
      ['missing', 'active', 'count', 'metadata'],
      ['', true, 3, '{"a":1,"b":2}'],
    ]);
    expect(JSON.stringify(workbook)).not.toContain('not-exported');
  });
});
