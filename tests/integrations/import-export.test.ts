import { describe, expect, test } from 'vitest';

import {
  ImportExportStudio,
  SecureCsvCodec,
  XlsxWorkbookAdapter,
  type DomainImportCommand,
  type ImportMapping,
  type TabularWorkbook,
} from '../../packages/modules/integrations/src/index.js';

const studentMapping: ImportMapping = {
  mappingKey: 'student-basic-v1',
  objectType: 'student',
  version: 1,
  fields: [
    { source: 'Student ID', target: 'externalId', required: true, transforms: ['trim'] },
    { source: 'Name', target: 'displayName', required: true, transforms: ['trim'] },
    { source: 'Email', target: 'email', transforms: ['trim', 'lowercase'] },
    { source: 'Active', target: 'active', required: true, transforms: ['trim', 'boolean'] },
  ],
};

describe('secure import and export foundation', () => {
  test('parses quoted CSV safely with bounded size and rows', () => {
    const codec = new SecureCsvCodec({ maxBytes: 1_024, maxRows: 3, maxColumns: 5 });
    const rows = codec.parse(
      'Student ID,Name,Email,Active\nS-1,"Doe, Jane",JANE@EXAMPLE.TEST,true\n',
    );

    expect(rows).toEqual([
      ['Student ID', 'Name', 'Email', 'Active'],
      ['S-1', 'Doe, Jane', 'JANE@EXAMPLE.TEST', 'true'],
    ]);
    expect(() => codec.parse('a,b\n1,2\n3,4\n5,6\n')).toThrow('CSV row limit exceeded');
    expect(() => codec.parse('a,b,c,d,e,f\n')).toThrow('CSV column limit exceeded');
  });

  test('exports CSV while neutralising spreadsheet formulas', () => {
    const codec = new SecureCsvCodec();
    const csv = codec.stringify([
      ['Name', 'Note'],
      ['Jane', '=HYPERLINK("https://example.test")'],
      ['John', '+1+1'],
    ]);

    expect(csv).toContain("'=");
    expect(csv).toContain("'+1+1");
    expect(csv).not.toContain('\r');
  });

  test('adapts a decoded XLSX workbook and rejects hidden or oversized sheets', async () => {
    const workbook: TabularWorkbook = {
      sheets: [
        {
          name: 'Students',
          hidden: false,
          rows: [
            ['Student ID', 'Name'],
            ['S-1', 'Jane Doe'],
          ],
        },
      ],
    };
    const adapter = new XlsxWorkbookAdapter({
      maxSheets: 2,
      maxRowsPerSheet: 10,
      decoder: () => Promise.resolve(workbook),
    });

    await expect(adapter.decode(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).resolves.toEqual(
      workbook,
    );
    await expect(adapter.decode(new Uint8Array([0x00, 0x01]))).rejects.toThrow(
      'XLSX file does not have a ZIP signature',
    );

    const hiddenAdapter = new XlsxWorkbookAdapter({
      decoder: () =>
        Promise.resolve({
          sheets: [{ name: 'Hidden', hidden: true, rows: [['A']] }],
        }),
    });
    await expect(hiddenAdapter.decode(new Uint8Array([0x50, 0x4b]))).rejects.toThrow(
      'Hidden XLSX sheets are not accepted',
    );
  });

  test('stages mapped rows, reports row errors and performs a dry run without commands', async () => {
    const commands: DomainImportCommand[] = [];
    const studio = new ImportExportStudio({
      idFactory: () => 'job-1',
      commandExecutor: (command) => {
        commands.push(command);
        return Promise.resolve({ domainId: `student:${String(command.payload.externalId)}` });
      },
    });

    const job = await studio.stageCsv({
      tenantId: 'tenant-1',
      mapping: studentMapping,
      csv: [
        'Student ID,Name,Email,Active',
        'S-1, Jane Doe ,JANE@EXAMPLE.TEST,true',
        ',Missing Identifier,bad@example.test,true',
        'S-3,Disabled Student,,no',
      ].join('\n'),
      sourceFileName: 'students.csv',
      mode: 'dry-run',
    });

    expect(job.status).toBe('validated');
    expect(job.rows).toHaveLength(3);
    expect(job.rows[0]?.mapped).toEqual({
      externalId: 'S-1',
      displayName: 'Jane Doe',
      email: 'jane@example.test',
      active: true,
    });
    expect(job.rows[1]?.errors).toContain('externalId is required');
    expect(job.rows[2]?.mapped.active).toBe(false);
    expect(commands).toEqual([]);
    expect(job.reconciliation).toMatchObject({
      inputRows: 3,
      validRows: 2,
      invalidRows: 1,
      succeededRows: 0,
      failedRows: 0,
    });
  });

  test('executes valid staged rows through idempotent domain commands and reconciles failures', async () => {
    const calls: DomainImportCommand[] = [];
    const studio = new ImportExportStudio({
      idFactory: () => 'job-2',
      commandExecutor: (command) => {
        calls.push(command);
        return command.rowNumber === 3
          ? Promise.reject(new Error('domain rejected duplicate student'))
          : Promise.resolve({ domainId: `student:${String(command.payload.externalId)}` });
      },
    });

    const staged = await studio.stageCsv({
      tenantId: 'tenant-1',
      mapping: studentMapping,
      csv: [
        'Student ID,Name,Email,Active',
        'S-1,Jane Doe,jane@example.test,true',
        'S-2,John Doe,john@example.test,true',
      ].join('\n'),
      sourceFileName: 'students.csv',
      mode: 'commit',
    });
    const executed = await studio.execute(staged.jobId);
    const repeated = await studio.execute(staged.jobId);

    expect(executed.status).toBe('completed-with-errors');
    expect(executed.rows[0]?.status).toBe('succeeded');
    expect(executed.rows[1]?.status).toBe('failed');
    expect(executed.rows[1]?.errors).toContain('domain rejected duplicate student');
    expect(executed.reconciliation).toMatchObject({ succeededRows: 1, failedRows: 1 });
    expect(repeated).toBe(executed);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.idempotencyKey).toBe('job-2:2');
  });

  test('exports bounded domain rows as safe CSV and workbook models', () => {
    const studio = new ImportExportStudio();
    const rows = [
      { externalId: 'S-1', displayName: 'Jane', note: '@SUM(1,1)' },
      { externalId: 'S-2', displayName: 'John', note: 'Normal' },
    ];

    const csv = studio.exportCsv({
      columns: ['externalId', 'displayName', 'note'],
      rows,
      maxRows: 10,
    });
    const workbook = studio.exportWorkbook({
      sheetName: 'Students',
      columns: ['externalId', 'displayName'],
      rows,
      maxRows: 10,
    });

    expect(csv).toContain("'@SUM(1,1)");
    expect(workbook.sheets[0]?.rows).toEqual([
      ['externalId', 'displayName'],
      ['S-1', 'Jane'],
      ['S-2', 'John'],
    ]);
  });
});
