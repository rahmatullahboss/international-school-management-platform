import { describe, expect, test } from 'vitest';

import {
  MigrationStudio,
  SourceTemplateRegistry,
  type MigrationSourceTemplate,
} from '../../packages/modules/migration-studio/src/index.js';

const template: MigrationSourceTemplate = {
  templateKey: 'legacy-sis-students',
  version: 1,
  sourceProduct: 'Synthetic Legacy SIS',
  entities: [
    {
      entityType: 'student',
      filePattern: 'students.csv',
      requiredColumns: ['student_id', 'name'],
      naturalKeyColumns: ['student_id'],
    },
  ],
};

describe('migration studio', () => {
  test('publishes immutable repeatable source templates', () => {
    const registry = new SourceTemplateRegistry();
    const published = registry.publish(template);

    expect(Object.isFrozen(published)).toBe(true);
    expect(registry.resolve('legacy-sis-students', 1)).toBe(published);
    expect(() => registry.publish(template)).toThrow(
      'Migration source-template version is immutable',
    );
  });

  test('creates versioned projects with frozen mapping and transformation snapshots', async () => {
    const studio = new MigrationStudio({ idFactory: () => 'project-1' });
    studio.templates.publish(template);
    const project = studio.createProject({
      tenantId: 'tenant-1',
      name: 'Legacy SIS cutover',
      sourceSystem: 'Synthetic Legacy SIS',
      targetEnvironment: 'pilot',
    });
    const version = await studio.createVersion({
      projectId: project.projectId,
      templateKey: 'legacy-sis-students',
      templateVersion: 1,
      mappingSnapshot: { student_id: 'externalId', name: 'displayName' },
      transformationSnapshot: { name: ['trim'] },
      createdBy: 'operator-1',
    });

    expect(version.version).toBe(1);
    expect(version.templateReference).toBe('legacy-sis-students@1');
    expect(version.configurationChecksum).toMatch(/^[a-f0-9]{64}$/u);
    await expect(
      studio.createVersion({
        projectId: project.projectId,
        templateKey: 'legacy-sis-students',
        templateVersion: 1,
        mappingSnapshot: { student_id: 'externalId', name: 'displayName' },
        transformationSnapshot: { name: ['trim'] },
        createdBy: 'operator-1',
      }),
    ).resolves.toMatchObject({ version: 2, configurationChecksum: version.configurationChecksum });
  });

  test('registers source files with SHA-256 evidence and detects conflicting names', async () => {
    const studio = new MigrationStudio({ idFactory: () => 'project-2' });
    studio.templates.publish(template);
    const project = studio.createProject({
      tenantId: 'tenant-1',
      name: 'Legacy migration',
      sourceSystem: 'Synthetic Legacy SIS',
      targetEnvironment: 'pilot',
    });
    const version = await studio.createVersion({
      projectId: project.projectId,
      templateKey: 'legacy-sis-students',
      templateVersion: 1,
      mappingSnapshot: {},
      transformationSnapshot: {},
      createdBy: 'operator-1',
    });

    const first = await studio.registerFile({
      projectId: project.projectId,
      version: version.version,
      fileName: 'students.csv',
      bytes: new TextEncoder().encode('student_id,name\nS-1,Jane\n'),
      mediaType: 'text/csv',
    });
    const repeated = await studio.registerFile({
      projectId: project.projectId,
      version: version.version,
      fileName: 'students.csv',
      bytes: new TextEncoder().encode('student_id,name\nS-1,Jane\n'),
      mediaType: 'text/csv',
    });

    expect(first.checksum).toMatch(/^[a-f0-9]{64}$/u);
    expect(repeated).toBe(first);
    await expect(
      studio.registerFile({
        projectId: project.projectId,
        version: version.version,
        fileName: 'students.csv',
        bytes: new TextEncoder().encode('student_id,name\nS-2,John\n'),
        mediaType: 'text/csv',
      }),
    ).rejects.toThrow('Migration file name is already registered with another checksum');
  });

  test('creates repeatable runs and records entity reconciliation', async () => {
    const ids = ['project-3', 'run-1'];
    const studio = new MigrationStudio({ idFactory: () => ids.shift() ?? 'generated' });
    studio.templates.publish(template);
    const project = studio.createProject({
      tenantId: 'tenant-1',
      name: 'Repeatable migration',
      sourceSystem: 'Synthetic Legacy SIS',
      targetEnvironment: 'pilot',
    });
    const version = await studio.createVersion({
      projectId: project.projectId,
      templateKey: 'legacy-sis-students',
      templateVersion: 1,
      mappingSnapshot: { student_id: 'externalId' },
      transformationSnapshot: {},
      createdBy: 'operator-1',
    });
    await studio.registerFile({
      projectId: project.projectId,
      version: version.version,
      fileName: 'students.csv',
      bytes: new TextEncoder().encode('student_id,name\nS-1,Jane\n'),
      mediaType: 'text/csv',
    });

    const run = await studio.startRun(project.projectId, version.version);
    const repeated = await studio.startRun(project.projectId, version.version);
    const reconciled = studio.recordReconciliation({
      runId: run.runId,
      entityType: 'student',
      metric: 'records',
      expected: 1,
      actual: 1,
    });

    expect(repeated).toBe(run);
    expect(run.runKey).toMatch(/^[a-f0-9]{64}$/u);
    expect(reconciled.passed).toBe(true);
    expect(studio.completeRun(run.runId).status).toBe('completed');
  });

  test('blocks cutover until required evidence passes and records sign-off', async () => {
    const ids = ['project-4', 'run-2', 'cutover-1'];
    const studio = new MigrationStudio({ idFactory: () => ids.shift() ?? 'generated' });
    studio.templates.publish(template);
    const project = studio.createProject({
      tenantId: 'tenant-1',
      name: 'Cutover migration',
      sourceSystem: 'Synthetic Legacy SIS',
      targetEnvironment: 'pilot',
    });
    const version = await studio.createVersion({
      projectId: project.projectId,
      templateKey: 'legacy-sis-students',
      templateVersion: 1,
      mappingSnapshot: {},
      transformationSnapshot: {},
      createdBy: 'operator-1',
    });
    await studio.registerFile({
      projectId: project.projectId,
      version: version.version,
      fileName: 'students.csv',
      bytes: new TextEncoder().encode('student_id,name\nS-1,Jane\n'),
      mediaType: 'text/csv',
    });
    const run = await studio.startRun(project.projectId, version.version);
    studio.recordReconciliation({
      runId: run.runId,
      entityType: 'student',
      metric: 'records',
      expected: 1,
      actual: 0,
    });
    studio.completeRun(run.runId);

    const cutover = studio.createCutover({
      projectId: project.projectId,
      version: version.version,
      runId: run.runId,
      checklist: ['source frozen', 'stakeholders notified', 'rollback tested'],
      rollbackPlan: 'Restore the pre-cutover branch and reopen the legacy system.',
    });
    expect(() => studio.signOffCutover(cutover.cutoverId, 'owner-1', 'approved')).toThrow(
      'Cutover reconciliation has unresolved failures',
    );

    studio.recordReconciliation({
      runId: run.runId,
      entityType: 'student',
      metric: 'records',
      expected: 1,
      actual: 1,
    });
    studio.completeChecklist(cutover.cutoverId, 'source frozen', 'operator-1');
    studio.completeChecklist(cutover.cutoverId, 'stakeholders notified', 'operator-1');
    studio.completeChecklist(cutover.cutoverId, 'rollback tested', 'operator-1');
    const signed = studio.signOffCutover(cutover.cutoverId, 'owner-1', 'approved');

    expect(signed.status).toBe('approved');
    expect(signed.signedBy).toBe('owner-1');
    expect(Object.isFrozen(signed)).toBe(true);
  });
});
