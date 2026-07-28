import { describe, expect, it } from 'vitest';

import {
  createPrivacyAwareExport,
  ImportPipeline,
} from '../../packages/modules/people/src/imports.js';
import {
  buildAdmissionsFunnel,
  buildEnrollmentSummary,
  buildGuardianDataQuality,
  buildMovementSummary,
  reconcileSis,
  SisReportRegistry,
} from '../../packages/modules/student-lifecycle/src/reporting.js';

const tenantA = '00000000-0000-4000-8000-0000000000a1';
const tenantB = '00000000-0000-4000-8000-0000000000b1';

describe('SIS imports and reporting', () => {
  it('validates rows, creates data-quality issues and replays a batch idempotently', async () => {
    const pipeline = new ImportPipeline();
    const staged = pipeline.stage({
      tenantId: tenantA,
      entity: 'person',
      idempotencyKey: 'people-import-1',
      mappings: [
        { sourceColumn: 'name', targetField: 'legalName', required: true, transform: 'trim' },
        { sourceColumn: 'dob', targetField: 'dateOfBirth', required: true, transform: 'date-iso' },
      ],
      rows: [
        {
          rowNumber: 1,
          sourceKey: 'legacy-1',
          values: { name: ' Amina Rahman ', dob: '2015-05-10' },
        },
        { rowNumber: 2, sourceKey: 'legacy-2', values: { name: '', dob: 'not-a-date' } },
      ],
    });
    const replay = pipeline.stage({
      tenantId: tenantA,
      entity: 'person',
      idempotencyKey: 'people-import-1',
      mappings: [{ sourceColumn: 'ignored', targetField: 'ignored' }],
      rows: [],
    });
    let applyCount = 0;
    const applied = await pipeline.apply(tenantA, staged.importBatchId, (_entity, values) => {
      applyCount += 1;
      return Promise.resolve({ resultReference: `person:${String(values.legalName)}` });
    });
    const applyReplay = await pipeline.apply(tenantA, staged.importBatchId, () => {
      applyCount += 1;
      return Promise.resolve({ resultReference: 'unexpected' });
    });

    expect(replay.importBatchId).toBe(staged.importBatchId);
    expect(applied.status).toBe('completed-with-errors');
    expect(applied.rows.map((row) => row.status)).toEqual(['applied', 'invalid']);
    expect(applyReplay.rows).toEqual(applied.rows);
    expect(applyCount).toBe(1);
    expect(pipeline.listIssues(tenantA)).toHaveLength(2);
    expect(() => pipeline.getBatch(tenantB, staged.importBatchId)).toThrow(
      'Import batch was not found',
    );
  });

  it('supports dry-run validation without applying rows', async () => {
    const pipeline = new ImportPipeline();
    const staged = pipeline.stage({
      tenantId: tenantA,
      entity: 'enrollment',
      idempotencyKey: 'enrollment-dry-run',
      dryRun: true,
      mappings: [
        {
          sourceColumn: 'student',
          targetField: 'studentNumber',
          required: true,
          transform: 'trim',
        },
      ],
      rows: [{ rowNumber: 1, sourceKey: 'E-1', values: { student: 'S-1001' } }],
    });
    let called = false;
    const result = await pipeline.apply(tenantA, staged.importBatchId, () => {
      called = true;
      return Promise.resolve({ resultReference: 'not-used' });
    });

    expect(called).toBe(false);
    expect(result.status).toBe('completed');
    expect(result.rows[0]?.status).toBe('skipped');
  });

  it('rejects non-scalar mapped values with a row-level validation error', () => {
    const pipeline = new ImportPipeline();
    const batch = pipeline.stage({
      tenantId: tenantA,
      entity: 'person',
      idempotencyKey: 'people-object-transform',
      mappings: [{ sourceColumn: 'name', targetField: 'legalName', transform: 'trim' }],
      rows: [{ rowNumber: 1, sourceKey: 'legacy-object', values: { name: { nested: true } } }],
    });

    expect(batch.rows[0]).toMatchObject({
      status: 'invalid',
      errors: [{ code: 'SIS_IMPORT_SCALAR_REQUIRED' }],
    });
    expect(pipeline.listIssues(tenantA)).toHaveLength(1);
  });

  it('creates field-allowlisted exports and excludes restricted documents by default', () => {
    const exported = createPrivacyAwareExport(
      [
        {
          studentNumber: 'S-1001',
          displayName: 'Amina Rahman',
          email: 'family@example.test',
          restrictedDocuments: ['passport.pdf'],
        },
      ],
      {
        fields: ['studentNumber', 'displayName', 'restrictedDocuments'],
        purpose: 'Registrar reconciliation',
      },
    );

    expect(exported).toEqual([{ studentNumber: 'S-1001', displayName: 'Amina Rahman' }]);
    expect(Object.isFrozen(exported[0])).toBe(true);
  });

  it('builds tenant-scoped admissions, enrollment, movement and guardian reports', () => {
    const funnel = buildAdmissionsFunnel(tenantA, [
      {
        tenantId: tenantA,
        applicationId: 'a1',
        status: 'converted',
        cycleId: 'c1',
        submittedAt: '2026-01-01T00:00:00.000Z',
        decisionAt: '2026-01-05T00:00:00.000Z',
      },
      { tenantId: tenantA, applicationId: 'a2', status: 'offered', cycleId: 'c1' },
      { tenantId: tenantB, applicationId: 'b1', status: 'declined', cycleId: 'c1' },
    ]);
    const enrollment = buildEnrollmentSummary(
      tenantA,
      [
        {
          tenantId: tenantA,
          enrollmentId: 'e1',
          studentProfileId: 's1',
          campusId: 'campus-a',
          programId: 'p1',
          academicYearId: 'y1',
          status: 'active',
          effectiveFrom: '2026-01-01',
        },
        {
          tenantId: tenantA,
          enrollmentId: 'e2',
          studentProfileId: 's2',
          campusId: 'campus-a',
          programId: 'p2',
          academicYearId: 'y1',
          status: 'withdrawn',
          effectiveFrom: '2025-01-01',
          effectiveTo: '2025-12-31',
        },
      ],
      '2026-07-28',
    );
    const movement = buildMovementSummary(tenantA, [
      {
        tenantId: tenantA,
        movementId: 'm1',
        studentProfileId: 's1',
        enrollmentId: 'e1',
        movementType: 'transfer',
        effectiveAt: '2026-07-01',
      },
      {
        tenantId: tenantA,
        movementId: 'm2',
        studentProfileId: 's2',
        enrollmentId: 'e2',
        movementType: 'withdrawal',
        effectiveAt: '2026-07-15',
      },
    ]);
    const guardian = buildGuardianDataQuality(
      tenantA,
      ['person-s1', 'person-s2'],
      [
        {
          tenantId: tenantA,
          studentPersonId: 'person-s1',
          guardianPersonId: 'person-g1',
          verified: false,
          portalAccess: true,
          communicationAuthority: false,
        },
      ],
    );

    expect(funnel).toMatchObject({
      total: 2,
      conversionRate: 0.5,
      offerAcceptanceRate: 0.5,
      medianDecisionDays: 4,
    });
    expect(enrollment).toMatchObject({ total: 2, current: 1, byCampus: { 'campus-a': 2 } });
    expect(movement).toMatchObject({ total: 2, byMonth: { '2026-07': 2 } });
    expect(guardian).toMatchObject({
      studentsWithoutGuardian: 1,
      unverifiedAuthorities: 1,
      portalAccessWithoutVerification: 1,
    });
  });

  it('reconciles converted applications, profiles, enrollments and guardian access', () => {
    const issues = reconcileSis({
      tenantId: tenantA,
      applications: [
        {
          applicationId: 'application-1',
          status: 'converted',
          applicantPersonId: 'person-1',
          studentProfileId: 'profile-missing',
          enrollmentId: 'enrollment-missing',
        },
      ],
      profiles: [{ studentProfileId: 'profile-1', personId: 'person-1', status: 'active' }],
      enrollments: [
        { enrollmentId: 'enrollment-orphan', studentProfileId: 'profile-orphan', status: 'active' },
      ],
      guardianAuthorities: [
        {
          authorityId: 'authority-1',
          studentPersonId: 'person-1',
          guardianPersonId: 'guardian-1',
          verified: false,
          portalAccess: true,
        },
      ],
    });

    expect(issues.map((issue) => issue.issueType)).toEqual(
      expect.arrayContaining([
        'converted-application-missing-profile',
        'converted-application-missing-enrollment',
        'profile-missing-enrollment',
        'enrollment-missing-profile',
        'portal-authority-unverified',
      ]),
    );
    expect(issues.filter((issue) => issue.severity === 'critical').length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it('stores immutable report snapshots within tenant scope', () => {
    const registry = new SisReportRegistry();
    const snapshot = registry.createSnapshot({
      tenantId: tenantA,
      reportKey: 'sis.enrollment-summary.v1',
      parameters: { academicYearId: 'y1' },
      data: { current: 250 },
      generatedByAccountId: 'account-1',
    });

    expect(
      registry.getSnapshot<{ current: number }>(tenantA, snapshot.reportSnapshotId).data.current,
    ).toBe(250);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.data)).toBe(true);
    expect(() => registry.getSnapshot(tenantB, snapshot.reportSnapshotId)).toThrow(
      'Report snapshot was not found',
    );
  });

  it('stages 5,000 import rows without losing deterministic row state', () => {
    const pipeline = new ImportPipeline();
    const rows = Array.from({ length: 5_000 }, (_, index) => ({
      rowNumber: index + 1,
      sourceKey: `legacy-${index + 1}`,
      values: { name: `Student ${index + 1}`, active: index % 2 === 0 ? 'yes' : 'no' },
    }));
    const startedAt = performance.now();
    const batch = pipeline.stage({
      tenantId: tenantA,
      entity: 'person',
      idempotencyKey: 'people-load-5000',
      mappings: [
        { sourceColumn: 'name', targetField: 'legalName', required: true, transform: 'trim' },
        { sourceColumn: 'active', targetField: 'active', required: true, transform: 'boolean' },
      ],
      rows,
    });
    const durationMs = performance.now() - startedAt;

    expect(batch.rows).toHaveLength(5_000);
    expect(batch.rows.every((row) => row.status === 'valid')).toBe(true);
    expect(new Set(batch.rows.map((row) => row.checksum)).size).toBe(5_000);
    expect(durationMs).toBeLessThan(5_000);
  });
});
