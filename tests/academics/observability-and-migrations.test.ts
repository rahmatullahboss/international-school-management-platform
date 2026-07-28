import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  ACADEMIC_METRICS,
  AcademicObservabilityError,
  AcademicObservabilityRegistry,
} from '../../packages/modules/academics/src/observability.js';

interface MigrationManifest {
  stream: string;
  reviewedBaseSha: string;
  migrations: readonly {
    id: string;
    path: string;
    ownsSchemas: readonly string[];
    dependsOn: readonly string[];
  }[];
}

const manifestPath = new URL(
  '../../packages/modules/academics/migrations/manifest.json',
  import.meta.url,
);

function manifest(): MigrationManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as MigrationManifest;
}

describe('ACAD-01 observability and migration contract', () => {
  it('records operation duration and failures without academic personal data', () => {
    const registry = new AcademicObservabilityRegistry();
    registry.operation({
      tenantId: 'tenant-a',
      actorId: 'actor-a',
      correlationId: 'corr-a',
      operation: 'attendance.sync',
      outcome: 'rejected',
      durationMs: 42,
      errorCode: 'ATTENDANCE_BATCH_ID_CONFLICT',
      aggregateType: 'attendance-session',
      aggregateId: 'session-a',
    });

    expect(registry.operations()).toEqual([
      expect.objectContaining({
        tenantId: 'tenant-a',
        actorId: 'actor-a',
        correlationId: 'corr-a',
        operation: 'attendance.sync',
        outcome: 'rejected',
        durationMs: 42,
        errorCode: 'ATTENDANCE_BATCH_ID_CONFLICT',
      }),
    ]);
    expect(registry.metrics()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: ACADEMIC_METRICS.commandDurationMs,
          kind: 'histogram',
          value: 42,
        }),
        expect.objectContaining({
          name: ACADEMIC_METRICS.commandFailuresTotal,
          kind: 'counter',
          value: 1,
          labels: expect.objectContaining({ errorCode: 'ATTENDANCE_BATCH_ID_CONFLICT' }),
        }),
      ]),
    );

    expect(() =>
      registry.counter(ACADEMIC_METRICS.transcriptReissuesTotal, 1, {
        studentDisplayName: 'Student A',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ACADEMIC_OBSERVABILITY_PII_LABEL_FORBIDDEN' }));
  });

  it('derives ready, degraded and not-ready health states with actionable reasons', () => {
    const registry = new AcademicObservabilityRegistry();
    expect(
      registry.health({
        migrationReady: true,
        publicationBlockers: 0,
        timetableConflicts: 0,
        incompleteAttendanceSessions: 0,
        unmoderatedAssessments: 0,
        pendingRecordApprovals: 0,
        staleReadModelSeconds: 30,
      }),
    ).toMatchObject({ status: 'ready', reasons: [] });

    expect(
      registry.health({
        migrationReady: true,
        publicationBlockers: 1,
        timetableConflicts: 1,
        incompleteAttendanceSessions: 2,
        unmoderatedAssessments: 1,
        pendingRecordApprovals: 3,
        staleReadModelSeconds: 600,
      }),
    ).toMatchObject({
      status: 'degraded',
      reasons: [
        'academic publication blockers exist',
        'blocking timetable conflicts exist',
        'attendance sessions are incomplete',
        'assessments await moderation',
        'academic records await approval',
        'academic read model is stale',
      ],
    });

    expect(
      registry.health({
        migrationReady: false,
        publicationBlockers: 0,
        timetableConflicts: 0,
        incompleteAttendanceSessions: 0,
        unmoderatedAssessments: 0,
        pendingRecordApprovals: 0,
      }),
    ).toMatchObject({ status: 'not-ready', reasons: ['database migrations are not ready'] });

    expect(() => registry.gauge(ACADEMIC_METRICS.publicationBlockers, -1)).toThrow(
      AcademicObservabilityError,
    );
  });

  it('declares the exact ordered five-migration ACAD manifest from the reviewed base', () => {
    const value = manifest();
    expect(value).toMatchObject({
      stream: 'ACAD-01',
      reviewedBaseSha: '8cc8ee1562ade672b14c1c44af935fe7e2307976',
    });
    expect(value.migrations.map((migration) => migration.id)).toEqual([
      '202607280201_ACAD-01_academic_structure',
      '202607280202_ACAD-01_timetable',
      '202607280203_ACAD-01_attendance',
      '202607280204_ACAD-01_gradebook',
      '202607280205_ACAD-01_records',
    ]);
    expect(new Set(value.migrations.map((migration) => migration.id)).size).toBe(5);
    expect(value.migrations.flatMap((migration) => migration.ownsSchemas)).toEqual([
      'academics',
      'scheduling',
      'attendance',
      'gradebook',
      'records',
    ]);
  });

  it('keeps every manifest path present, ledgered, tenant-forced and cross-module isolated', () => {
    for (const migration of manifest().migrations) {
      const absoluteUrl = new URL(`../../../../${migration.path}`, import.meta.url);
      expect(existsSync(absoluteUrl)).toBe(true);
      const sql = readFileSync(absoluteUrl, 'utf8');
      expect(sql).toContain(`'${migration.id}'`);
      expect(sql).toContain('FORCE ROW LEVEL SECURITY');
      expect(sql).toContain("current_setting(''app.tenant_id'', true)");
      expect(sql).not.toMatch(
        /REFERENCES\s+(student_lifecycle|billing|localization|integrations)\./iu,
      );
    }
  });

  it('ships non-mutating schema verification and rollback-only recovery probes', () => {
    const verification = readFileSync(
      new URL(
        '../../packages/modules/academics/verification/verify_acad_schema.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const recovery = readFileSync(
      new URL(
        '../../packages/modules/academics/verification/probe_acad_rls_and_recovery.sql',
        import.meta.url,
      ),
      'utf8',
    );

    expect(verification).toContain('ACAD schema verification passed');
    expect(verification).toContain('expected 53 ACAD tables');
    expect(verification).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/iu);

    expect(recovery).toContain('BEGIN;');
    expect(recovery).toContain('SET LOCAL ROLE app_runtime');
    expect(recovery).toContain('published academic versions are immutable');
    expect(recovery).toContain('ROLLBACK;');
    expect(recovery.trimEnd().endsWith('ROLLBACK;')).toBe(true);
  });
});
