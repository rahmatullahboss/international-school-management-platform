import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  GradebookDomainError,
  GradebookRegistry,
  type Assessment,
  type GradingPolicyVersion,
} from '../../packages/modules/gradebook/src/index.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const sectionId = 'section-math';
const reportingPeriodId = 'term-1';

function createPolicy(registry: GradebookRegistry): GradingPolicyVersion {
  const policy = registry.createPolicy({
    tenantId: tenantA,
    policyKey: 'secondary-default',
    versionLabel: '2026.1',
    calculationMode: 'hybrid',
    missingScoreTreatment: 'zero',
    roundingDecimals: 2,
    categories: [
      { code: 'CW', label: 'Coursework', weightPercent: 60 },
      { code: 'EX', label: 'Examinations', weightPercent: 40 },
    ],
    scale: [
      { label: 'A', minimumPercent: 80, maximumPercent: 100, gradePoint: 4, passing: true },
      { label: 'B', minimumPercent: 70, maximumPercent: 79.9999, gradePoint: 3, passing: true },
      { label: 'C', minimumPercent: 60, maximumPercent: 69.9999, gradePoint: 2, passing: true },
      { label: 'F', minimumPercent: 0, maximumPercent: 59.9999, gradePoint: 0, passing: false },
    ],
    correlationId: 'corr-policy',
  }).value;
  return registry.publishPolicy({
    tenantId: tenantA,
    policyVersionId: policy.policyVersionId,
    correlationId: 'corr-publish-policy',
  }).value;
}

function createAssessment(
  registry: GradebookRegistry,
  policy: GradingPolicyVersion,
  categoryIndex: number,
  title: string,
  maximumPoints: number,
): Assessment {
  const assessment = registry.createAssessment({
    tenantId: tenantA,
    sectionId,
    reportingPeriodId,
    policyVersionId: policy.policyVersionId,
    categoryId: policy.categories[categoryIndex]!.categoryId,
    title,
    maximumPoints,
    dueAt: '2026-10-01T09:00:00+06:00',
    standardIds: ['standard-algebra'],
    correlationId: `corr-${title}`,
  }).value;
  return registry.publishAssessment({
    tenantId: tenantA,
    assessmentId: assessment.assessmentId,
    correlationId: `corr-publish-${title}`,
  }).value;
}

describe('ACAD-01 gradebook', () => {
  it('validates category weights and immutable published policy versions', () => {
    const registry = new GradebookRegistry();
    expect(() =>
      registry.createPolicy({
        tenantId: tenantA,
        policyKey: 'invalid',
        versionLabel: '1',
        calculationMode: 'traditional',
        missingScoreTreatment: 'zero',
        roundingDecimals: 2,
        categories: [{ code: 'CW', label: 'Coursework', weightPercent: 90 }],
        scale: [{ label: 'Pass', minimumPercent: 0, maximumPercent: 100, passing: true }],
        correlationId: 'corr-invalid',
      }),
    ).toThrowError(expect.objectContaining({ code: 'GRADE_POLICY_INVALID' }));

    const policy = createPolicy(registry);
    expect(policy.state).toBe('published');
    expect(policy.categories.reduce((sum, category) => sum + category.weightPercent, 0)).toBe(100);
  });

  it('keeps raw score and result state separate while retaining standards evidence', () => {
    const registry = new GradebookRegistry();
    const policy = createPolicy(registry);
    const assessment = createAssessment(registry, policy, 0, 'Algebra Investigation', 50);

    expect(() =>
      registry.enterResult({
        tenantId: tenantA,
        assessmentId: assessment.assessmentId,
        studentProfileId: 'student-a',
        state: 'missing',
        rawScore: 0,
        enteredBy: 'teacher-a',
        correlationId: 'corr-invalid-result',
      }),
    ).toThrowError(expect.objectContaining({ code: 'GRADE_RESULT_STATE_SCORE_CONFLICT' }));

    const result = registry.enterResult({
      tenantId: tenantA,
      assessmentId: assessment.assessmentId,
      studentProfileId: 'student-a',
      state: 'scored',
      rawScore: 42,
      outcomeScores: [{ standardId: 'standard-algebra', level: 3, evidence: 'Rubric criterion 2' }],
      enteredBy: 'teacher-a',
      correlationId: 'corr-result',
    }).value;
    expect(result).toMatchObject({ state: 'scored', rawScore: 42 });
    expect(result.outcomeScores).toEqual([
      { standardId: 'standard-algebra', level: 3, evidence: 'Rubric criterion 2' },
    ]);
  });

  it('creates an explainable weighted snapshot with missing-score treatment', () => {
    const registry = new GradebookRegistry();
    const policy = createPolicy(registry);
    const coursework = createAssessment(registry, policy, 0, 'Coursework', 50);
    const exam = createAssessment(registry, policy, 1, 'Exam', 100);
    registry.enterResult({
      tenantId: tenantA,
      assessmentId: coursework.assessmentId,
      studentProfileId: 'student-a',
      state: 'scored',
      rawScore: 40,
      enteredBy: 'teacher-a',
      correlationId: 'corr-coursework-result',
    });
    registry.enterResult({
      tenantId: tenantA,
      assessmentId: exam.assessmentId,
      studentProfileId: 'student-a',
      state: 'scored',
      rawScore: 90,
      enteredBy: 'teacher-a',
      correlationId: 'corr-exam-result',
    });

    const snapshot = registry.calculate({
      tenantId: tenantA,
      sectionId,
      reportingPeriodId,
      studentProfileId: 'student-a',
      policyVersionId: policy.policyVersionId,
      correlationId: 'corr-calculate',
    }).value;
    expect(snapshot.calculatedPercent).toBe(84);
    expect(snapshot.displayedGrade).toBe('A');
    expect(snapshot.gradePoint).toBe(4);
    expect(snapshot.formula).toBe('weighted-categories; missing=zero; rounding=2');
    expect(snapshot.inputs).toHaveLength(2);
    expect(snapshot.categoryPercentages).toEqual({
      [policy.categories[0]!.categoryId]: 80,
      [policy.categories[1]!.categoryId]: 90,
    });
  });

  it('requires moderation before lock, publishes snapshots by window and approves locked changes', () => {
    const registry = new GradebookRegistry();
    const policy = createPolicy(registry);
    const assessment = createAssessment(registry, policy, 0, 'Project', 100);
    const result = registry.enterResult({
      tenantId: tenantA,
      assessmentId: assessment.assessmentId,
      studentProfileId: 'student-a',
      state: 'scored',
      rawScore: 75,
      enteredBy: 'teacher-a',
      correlationId: 'corr-result',
    }).value;
    const snapshot = registry.calculate({
      tenantId: tenantA,
      sectionId,
      reportingPeriodId,
      studentProfileId: 'student-a',
      policyVersionId: policy.policyVersionId,
      correlationId: 'corr-snapshot',
    }).value;

    expect(() =>
      registry.lock({
        tenantId: tenantA,
        sectionId,
        reportingPeriodId,
        lockedBy: 'academic-director',
        correlationId: 'corr-lock-denied',
      }),
    ).toThrowError(expect.objectContaining({ code: 'GRADE_MODERATION_REQUIRED' }));

    registry.moderateAssessment({
      tenantId: tenantA,
      assessmentId: assessment.assessmentId,
      moderatedBy: 'department-head',
      correlationId: 'corr-moderate',
    });
    registry.closeAssessment({
      tenantId: tenantA,
      assessmentId: assessment.assessmentId,
      correlationId: 'corr-close',
    });
    registry.lock({
      tenantId: tenantA,
      sectionId,
      reportingPeriodId,
      lockedBy: 'academic-director',
      correlationId: 'corr-lock',
    });
    const publication = registry.publishSnapshot({
      tenantId: tenantA,
      snapshotId: snapshot.snapshotId,
      availableFrom: '2026-12-20T08:00:00+06:00',
      availableTo: '2027-01-31T23:59:59+06:00',
      publishedBy: 'academic-director',
      correlationId: 'corr-publish-snapshot',
    }).value;
    expect(publication.snapshotId).toBe(snapshot.snapshotId);

    const request = registry.requestGradeChange({
      tenantId: tenantA,
      assessmentResultId: result.assessmentResultId,
      requestedRawScore: 82,
      requestedState: 'scored',
      reason: 'Moderation transcription correction',
      requestedBy: 'teacher-a',
      correlationId: 'corr-change-request',
    }).value;
    registry.decideGradeChange({
      tenantId: tenantA,
      requestId: request.requestId,
      decision: 'approved',
      decidedBy: 'academic-director',
      decisionNote: 'Verified against signed rubric',
      correlationId: 'corr-change-approve',
    });
    expect(registry.result(tenantA, result.assessmentResultId)).toMatchObject({
      rawScore: 82,
      version: 2,
      enteredBy: 'academic-director',
    });
  });

  it('enforces tenant boundaries and declares append-only forced-RLS migration evidence', () => {
    const registry = new GradebookRegistry();
    const policy = createPolicy(registry);
    expect(() => registry.snapshot(tenantB, policy.policyVersionId)).toThrow(GradebookDomainError);

    const migration = readFileSync(
      new URL(
        '../../packages/modules/gradebook/migrations/202607280204_ACAD-01_gradebook.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS gradebook');
    expect(migration).toContain('UNIQUE (tenant_id, assessment_id, student_profile_id)');
    expect(migration).toContain('grade calculation and publication evidence is append-only');
    expect(migration).toContain('ALTER TABLE gradebook.%I FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("'202607280204_ACAD-01_gradebook'");
    expect(migration).not.toContain('REFERENCES academics.');
    expect(migration).not.toContain('REFERENCES student_lifecycle.');
  });
});
