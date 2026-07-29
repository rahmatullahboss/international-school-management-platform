import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AcademicRecordsRegistry,
  RecordsDomainError,
  type ReportCardSnapshot,
} from '../../packages/modules/records/src/index.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

function createClosedPeriodAndTemplate(registry: AcademicRecordsRegistry) {
  const period = registry.createReportingPeriod({
    tenantId: tenantA,
    academicYearId: 'academic-year-2026',
    termId: 'term-1',
    code: 'T1',
    name: 'Term 1',
    startsOn: '2026-08-01',
    endsOn: '2026-12-18',
    correlationId: 'corr-period',
  }).value;
  registry.closeReportingPeriod({
    tenantId: tenantA,
    reportingPeriodId: period.reportingPeriodId,
    correlationId: 'corr-close-period',
  });
  const template = registry.createReportCardTemplate({
    tenantId: tenantA,
    templateKey: 'secondary-term',
    versionLabel: '2026.1',
    locale: 'en-GB',
    title: 'Term Report',
    sections: [
      { sectionKey: 'courses', label: 'Course Results', required: true },
      { sectionKey: 'attendance', label: 'Attendance', required: true },
      { sectionKey: 'comments', label: 'Comments', required: false },
    ],
    correlationId: 'corr-template',
  }).value;
  registry.publishReportCardTemplate({
    tenantId: tenantA,
    templateVersionId: template.templateVersionId,
    correlationId: 'corr-publish-template',
  });
  return { period, template };
}

function createPublishedReportCard(registry: AcademicRecordsRegistry): ReportCardSnapshot {
  const { period, template } = createClosedPeriodAndTemplate(registry);
  const card = registry.createReportCard({
    tenantId: tenantA,
    idempotencyKey: 'student-a-term-1',
    studentProfileId: 'student-a',
    reportingPeriodId: period.reportingPeriodId,
    templateVersionId: template.templateVersionId,
    courseResults: [
      {
        courseVersionId: 'course-math-v1',
        courseCode: 'MATH-G5',
        courseTitle: 'Mathematics Grade 5',
        gradeSnapshotId: 'grade-snapshot-math',
        calculatedPercent: 84,
        displayedGrade: 'A',
        gradePoint: 4,
        creditsAttempted: 1,
        creditsEarned: 1,
        teacherComment: 'Strong mathematical reasoning.',
      },
    ],
    attendance: {
      attendancePolicyVersionId: 'attendance-policy-v1',
      sessions: 50,
      present: 46,
      absent: 2,
      late: 2,
      excused: 0,
      remote: 0,
      attendancePercent: 92,
    },
    advisorComment: 'Consistent progress.',
    correlationId: 'corr-report-card',
  }).value;
  registry.approveReportCard({
    tenantId: tenantA,
    reportCardId: card.reportCardId,
    approvedBy: 'principal-a',
    correlationId: 'corr-approve-card',
  });
  return registry.publishReportCard({
    tenantId: tenantA,
    reportCardId: card.reportCardId,
    availableFrom: '2026-12-20T08:00:00+06:00',
    availableTo: '2027-01-31T23:59:59+06:00',
    publishedBy: 'records-officer',
    correlationId: 'corr-publish-card',
  }).value;
}

function createCreditPolicy(registry: AcademicRecordsRegistry) {
  const policy = registry.createCreditPolicy({
    tenantId: tenantA,
    policyKey: 'secondary-credits',
    versionLabel: '2026.1',
    minimumPassingPercent: 60,
    minimumPassingGradePoint: 2,
    gpaDecimals: 2,
    correlationId: 'corr-credit-policy',
  }).value;
  return registry.publishCreditPolicy({
    tenantId: tenantA,
    creditPolicyVersionId: policy.creditPolicyVersionId,
    correlationId: 'corr-publish-credit-policy',
  }).value;
}

function calculateGpa(
  registry: AcademicRecordsRegistry,
  creditPolicyVersionId: string,
  mathPercent = 90,
) {
  return registry.calculateGpa({
    tenantId: tenantA,
    studentProfileId: 'student-a',
    creditPolicyVersionId,
    courseOutcomes: [
      {
        courseVersionId: 'course-math-v1',
        courseCode: 'MATH-10',
        courseTitle: 'Mathematics 10',
        academicYearLabel: '2026/27',
        termLabel: 'Term 1',
        creditsAttempted: 3,
        displayedGrade: mathPercent >= 80 ? 'A' : 'B',
        gradePoint: mathPercent >= 80 ? 4 : 3,
        calculatedPercent: mathPercent,
        gradeSnapshotId: `grade-math-${mathPercent}`,
      },
      {
        courseVersionId: 'course-history-v1',
        courseCode: 'HIST-10',
        courseTitle: 'History 10',
        academicYearLabel: '2026/27',
        termLabel: 'Term 1',
        creditsAttempted: 2,
        displayedGrade: 'C',
        gradePoint: 2,
        calculatedPercent: 68,
        gradeSnapshotId: 'grade-history-68',
      },
    ],
    correlationId: `corr-gpa-${mathPercent}`,
  }).value;
}

describe('ACAD-01 academic records', () => {
  it('validates reporting periods and versioned localized report-card templates', () => {
    const registry = new AcademicRecordsRegistry();
    expect(() =>
      registry.createReportingPeriod({
        tenantId: tenantA,
        academicYearId: 'academic-year-2026',
        code: 'BAD',
        name: 'Invalid',
        startsOn: '2026-12-01',
        endsOn: '2026-08-01',
        correlationId: 'corr-invalid-period',
      }),
    ).toThrowError(expect.objectContaining({ code: 'RECORDS_PERIOD_INVALID' }));

    const { template } = createClosedPeriodAndTemplate(registry);
    expect(template.sections.map((section) => section.sequence)).toEqual([1, 2, 3]);
    expect(template.locale).toBe('en-GB');
  });

  it('creates idempotent report-card snapshots and requires approval before immutable publication', () => {
    const registry = new AcademicRecordsRegistry();
    const card = createPublishedReportCard(registry);
    expect(card).toMatchObject({
      state: 'published',
      version: 3,
      approvedBy: 'principal-a',
      publishedBy: 'records-officer',
    });
    expect(card.courseResults[0]).toMatchObject({
      gradeSnapshotId: 'grade-snapshot-math',
      displayedGrade: 'A',
    });

    expect(() =>
      registry.approveReportCard({
        tenantId: tenantA,
        reportCardId: card.reportCardId,
        approvedBy: 'another-principal',
        correlationId: 'corr-change-published',
      }),
    ).toThrowError(expect.objectContaining({ code: 'RECORDS_REPORT_CARD_PUBLISHED_IMMUTABLE' }));

    const proposal = registry.proposePromotion({
      tenantId: tenantA,
      studentProfileId: 'student-a',
      academicYearId: 'academic-year-2026',
      fromGradeLevel: 'G5',
      proposedGradeLevel: 'G6',
      recommendation: 'promote',
      rationale: 'Published academic evidence meets promotion policy.',
      evidenceReportCardIds: [card.reportCardId],
      proposedBy: 'advisor-a',
      correlationId: 'corr-promotion',
    }).value;
    const decision = registry.decidePromotion({
      tenantId: tenantA,
      proposalId: proposal.proposalId,
      decision: 'approved',
      effectiveOn: '2027-08-01',
      decidedBy: 'principal-a',
      decisionNote: 'Approved after records review.',
      correlationId: 'corr-promotion-decision',
    }).value;
    expect(decision).toMatchObject({ decision: 'approved', effectiveOn: '2027-08-01' });
  });

  it('calculates earned credits and GPA with an explainable policy snapshot', () => {
    const registry = new AcademicRecordsRegistry();
    const policy = createCreditPolicy(registry);
    const gpa = calculateGpa(registry, policy.creditPolicyVersionId);

    expect(gpa).toMatchObject({
      creditsAttempted: 5,
      creditsEarned: 5,
      qualityPoints: 16,
      gpa: 3.2,
    });
    expect(gpa.formula).toBe('sum(gradePoint*credits)/gradedCredits; passPercent=60; decimals=2');
    expect(
      gpa.courseOutcomes.every(
        (outcome) => outcome.creditPolicyVersionId === policy.creditPolicyVersionId,
      ),
    ).toBe(true);
  });

  it('issues and reissues transcripts without rewriting historical artifact content', () => {
    const registry = new AcademicRecordsRegistry();
    const policy = createCreditPolicy(registry);
    const originalGpa = calculateGpa(registry, policy.creditPolicyVersionId, 90);
    const original = registry.issueTranscript({
      tenantId: tenantA,
      idempotencyKey: 'student-a-transcript-v1',
      transcriptNumber: 'TR-2027-0001',
      studentProfileId: 'student-a',
      locale: 'en-GB',
      schoolName: 'International School',
      studentDisplayName: 'Student A',
      gpaSnapshotId: originalGpa.gpaSnapshotId,
      issuedBy: 'registrar-a',
      correlationId: 'corr-transcript',
    }).value;
    const correctedGpa = calculateGpa(registry, policy.creditPolicyVersionId, 78);

    expect(() =>
      registry.amendTranscript({
        tenantId: tenantA,
        transcriptId: original.transcriptId,
        replacementTranscriptNumber: 'TR-2027-0001-R1',
        replacementGpaSnapshotId: correctedGpa.gpaSnapshotId,
        reason: 'Corrected source grade',
        amendedBy: 'registrar-a',
        approvedBy: 'registrar-a',
        correlationId: 'corr-self-approved',
      }),
    ).toThrowError(expect.objectContaining({ code: 'RECORDS_TRANSCRIPT_AMENDMENT_INVALID' }));

    const replacement = registry.amendTranscript({
      tenantId: tenantA,
      transcriptId: original.transcriptId,
      replacementTranscriptNumber: 'TR-2027-0001-R1',
      replacementGpaSnapshotId: correctedGpa.gpaSnapshotId,
      reason: 'Approved correction to mathematics source grade.',
      amendedBy: 'registrar-a',
      approvedBy: 'academic-director',
      correlationId: 'corr-reissue',
    }).value;
    const history = registry.transcriptHistory(tenantA, 'student-a');

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      transcriptId: original.transcriptId,
      status: 'superseded',
      versionNumber: 1,
      artifactDigest: original.artifactDigest,
      cumulativeGpa: 3.2,
    });
    expect(history[1]).toMatchObject({
      transcriptId: replacement.transcriptId,
      status: 'issued',
      versionNumber: 2,
      supersedesTranscriptId: original.transcriptId,
      correctionReason: 'Approved correction to mathematics source grade.',
    });
    expect(history[0]!.courseOutcomes[0]!.calculatedPercent).toBe(90);
    expect(history[1]!.courseOutcomes[0]!.calculatedPercent).toBe(78);
    expect(registry.transcriptAmendments(tenantA, original.transcriptId)).toHaveLength(1);
  });

  it('enforces tenant boundaries and declares forced-RLS immutable record migration evidence', () => {
    const registry = new AcademicRecordsRegistry();
    const card = createPublishedReportCard(registry);
    expect(() => registry.reportCard(tenantB, card.reportCardId)).toThrow(RecordsDomainError);

    const migration = readFileSync(
      new URL(
        '../../packages/modules/records/migrations/202607280205_ACAD-01_records.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS records');
    expect(migration).toContain('published report cards are immutable snapshots');
    expect(migration).toContain('issued transcript content is immutable; reissue a new version');
    expect(migration).toContain('ALTER TABLE records.%I FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("'202607280205_ACAD-01_records'");
    expect(migration).not.toContain('REFERENCES gradebook.');
    expect(migration).not.toContain('REFERENCES student_lifecycle.');
  });
});
