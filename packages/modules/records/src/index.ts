import { AppendOnlyAuditLog, createDomainEvent, type DomainEvent } from '@school/events';

export interface ReportingPeriod {
  tenantId: string;
  reportingPeriodId: string;
  academicYearId: string;
  termId?: string;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
  state: 'draft' | 'closed';
  version: number;
}

export interface ReportCardTemplateSection {
  sectionKey: string;
  label: string;
  required: boolean;
  sequence: number;
}

export interface ReportCardTemplateVersion {
  tenantId: string;
  templateVersionId: string;
  templateKey: string;
  versionLabel: string;
  locale: string;
  title: string;
  sections: readonly ReportCardTemplateSection[];
  state: 'draft' | 'published';
  version: number;
}

export interface ReportCardCourseResult {
  courseVersionId: string;
  courseCode: string;
  courseTitle: string;
  gradeSnapshotId: string;
  calculatedPercent: number;
  displayedGrade: string;
  gradePoint?: number;
  creditsAttempted: number;
  creditsEarned: number;
  teacherComment?: string;
}

export interface ReportCardAttendanceSummary {
  attendancePolicyVersionId: string;
  sessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  remote: number;
  attendancePercent: number;
}

export interface ReportCardSnapshot {
  tenantId: string;
  reportCardId: string;
  studentProfileId: string;
  reportingPeriodId: string;
  templateVersionId: string;
  courseResults: readonly ReportCardCourseResult[];
  attendance: ReportCardAttendanceSummary;
  advisorComment?: string;
  principalComment?: string;
  state: 'draft' | 'approved' | 'published';
  approvedBy?: string;
  approvedAt?: string;
  publishedBy?: string;
  publishedAt?: string;
  availableFrom?: string;
  availableTo?: string;
  version: number;
}

export interface PromotionProposal {
  tenantId: string;
  proposalId: string;
  studentProfileId: string;
  academicYearId: string;
  fromGradeLevel: string;
  proposedGradeLevel: string;
  recommendation: 'promote' | 'retain' | 'complete' | 'review';
  rationale: string;
  evidenceReportCardIds: readonly string[];
  proposedBy: string;
  proposedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PromotionDecision {
  decisionId: string;
  proposalId: string;
  decision: 'approved' | 'rejected';
  effectiveOn: string;
  decidedBy: string;
  decisionNote: string;
  decidedAt: string;
}

export interface AcademicCreditPolicyVersion {
  tenantId: string;
  creditPolicyVersionId: string;
  policyKey: string;
  versionLabel: string;
  minimumPassingPercent: number;
  minimumPassingGradePoint?: number;
  gpaDecimals: number;
  state: 'draft' | 'published';
  version: number;
}

export interface TranscriptCourseOutcome {
  courseVersionId: string;
  courseCode: string;
  courseTitle: string;
  academicYearLabel: string;
  termLabel: string;
  creditsAttempted: number;
  creditsEarned: number;
  displayedGrade: string;
  gradePoint?: number;
  calculatedPercent: number;
  gradeSnapshotId: string;
  creditPolicyVersionId: string;
}

export interface GpaCalculationSnapshot {
  tenantId: string;
  gpaSnapshotId: string;
  studentProfileId: string;
  creditPolicyVersionId: string;
  courseOutcomes: readonly TranscriptCourseOutcome[];
  qualityPoints: number;
  creditsAttempted: number;
  creditsEarned: number;
  gpa?: number;
  formula: string;
  calculatedAt: string;
  version: number;
}

export interface TranscriptRecord {
  tenantId: string;
  transcriptId: string;
  transcriptNumber: string;
  studentProfileId: string;
  versionNumber: number;
  supersedesTranscriptId?: string;
  status: 'issued' | 'superseded' | 'revoked';
  locale: string;
  schoolName: string;
  studentDisplayName: string;
  gpaSnapshotId: string;
  courseOutcomes: readonly TranscriptCourseOutcome[];
  cumulativeGpa?: number;
  creditsAttempted: number;
  creditsEarned: number;
  issuedBy: string;
  issuedAt: string;
  artifactDigest: string;
  correctionReason?: string;
}

export interface TranscriptAmendment {
  amendmentId: string;
  originalTranscriptId: string;
  replacementTranscriptId: string;
  reason: string;
  approvedBy: string;
  amendedBy: string;
  amendedAt: string;
}

export interface RecordsCommandResult<T> {
  value: T;
  events: readonly DomainEvent<unknown>[];
}

export class RecordsDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RecordsDomainError';
  }
}

function assertPeriod(startsOn: string, endsOn?: string): void {
  if (endsOn !== undefined && endsOn < startsOn) {
    throw new RecordsDomainError('RECORDS_PERIOD_INVALID', 'The effective period is invalid');
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function cloneTemplate(template: ReportCardTemplateVersion): ReportCardTemplateVersion {
  return { ...template, sections: template.sections.map((section) => ({ ...section })) };
}

function cloneReportCard(card: ReportCardSnapshot): ReportCardSnapshot {
  return {
    ...card,
    courseResults: card.courseResults.map((result) => ({ ...result })),
    attendance: { ...card.attendance },
  };
}

function cloneOutcome(outcome: TranscriptCourseOutcome): TranscriptCourseOutcome {
  return { ...outcome };
}

function cloneGpa(snapshot: GpaCalculationSnapshot): GpaCalculationSnapshot {
  return { ...snapshot, courseOutcomes: snapshot.courseOutcomes.map(cloneOutcome) };
}

function cloneTranscript(transcript: TranscriptRecord): TranscriptRecord {
  return { ...transcript, courseOutcomes: transcript.courseOutcomes.map(cloneOutcome) };
}

function stableDigest(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export class AcademicRecordsRegistry {
  readonly #periods = new Map<string, ReportingPeriod>();
  readonly #templates = new Map<string, ReportCardTemplateVersion>();
  readonly #reportCards = new Map<string, ReportCardSnapshot>();
  readonly #promotionProposals = new Map<string, PromotionProposal>();
  readonly #promotionDecisions = new Map<string, PromotionDecision>();
  readonly #creditPolicies = new Map<string, AcademicCreditPolicyVersion>();
  readonly #gpaSnapshots = new Map<string, GpaCalculationSnapshot>();
  readonly #transcripts = new Map<string, TranscriptRecord>();
  readonly #amendments: TranscriptAmendment[] = [];
  readonly #idempotency = new Map<string, string>();
  readonly #audit = new AppendOnlyAuditLog();

  get auditLog(): AppendOnlyAuditLog {
    return this.#audit;
  }

  createReportingPeriod(input: {
    tenantId: string;
    academicYearId: string;
    termId?: string;
    code: string;
    name: string;
    startsOn: string;
    endsOn: string;
    correlationId: string;
  }): RecordsCommandResult<ReportingPeriod> {
    assertPeriod(input.startsOn, input.endsOn);
    const duplicate = [...this.#periods.values()].some(
      (period) =>
        period.tenantId === input.tenantId &&
        period.academicYearId === input.academicYearId &&
        period.code === input.code,
    );
    if (duplicate) {
      throw new RecordsDomainError('RECORDS_PERIOD_EXISTS', 'Reporting period already exists');
    }
    const period: ReportingPeriod = {
      tenantId: input.tenantId,
      reportingPeriodId: crypto.randomUUID(),
      academicYearId: input.academicYearId,
      ...(input.termId === undefined ? {} : { termId: input.termId }),
      code: input.code,
      name: input.name,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      state: 'draft',
      version: 1,
    };
    this.#periods.set(period.reportingPeriodId, period);
    return this.#result(period, 'records.reporting-period.created.v1', input.correlationId);
  }

  closeReportingPeriod(input: {
    tenantId: string;
    reportingPeriodId: string;
    correlationId: string;
  }): RecordsCommandResult<ReportingPeriod> {
    const period = this.#requirePeriod(input.tenantId, input.reportingPeriodId);
    if (period.state === 'closed') return { value: { ...period }, events: [] };
    period.state = 'closed';
    period.version += 1;
    return this.#result({ ...period }, 'records.reporting-period.closed.v1', input.correlationId);
  }

  createReportCardTemplate(input: {
    tenantId: string;
    templateKey: string;
    versionLabel: string;
    locale: string;
    title: string;
    sections: readonly Omit<ReportCardTemplateSection, 'sequence'>[];
    correlationId: string;
  }): RecordsCommandResult<ReportCardTemplateVersion> {
    const keys = new Set(input.sections.map((section) => section.sectionKey));
    if (input.sections.length === 0 || keys.size !== input.sections.length) {
      throw new RecordsDomainError(
        'RECORDS_TEMPLATE_INVALID',
        'Template sections must be unique and non-empty',
      );
    }
    const duplicate = [...this.#templates.values()].some(
      (template) =>
        template.tenantId === input.tenantId &&
        template.templateKey === input.templateKey &&
        template.versionLabel === input.versionLabel,
    );
    if (duplicate) {
      throw new RecordsDomainError('RECORDS_TEMPLATE_EXISTS', 'Template version already exists');
    }
    const template: ReportCardTemplateVersion = {
      tenantId: input.tenantId,
      templateVersionId: crypto.randomUUID(),
      templateKey: input.templateKey,
      versionLabel: input.versionLabel,
      locale: input.locale,
      title: input.title,
      sections: input.sections.map((section, index) => ({ ...section, sequence: index + 1 })),
      state: 'draft',
      version: 1,
    };
    this.#templates.set(template.templateVersionId, template);
    return this.#result(
      cloneTemplate(template),
      'records.report-card-template.created.v1',
      input.correlationId,
    );
  }

  publishReportCardTemplate(input: {
    tenantId: string;
    templateVersionId: string;
    correlationId: string;
  }): RecordsCommandResult<ReportCardTemplateVersion> {
    const template = this.#requireTemplate(input.tenantId, input.templateVersionId);
    if (template.state === 'published') return { value: cloneTemplate(template), events: [] };
    template.state = 'published';
    template.version += 1;
    return this.#result(
      cloneTemplate(template),
      'records.report-card-template.published.v1',
      input.correlationId,
    );
  }

  createReportCard(input: {
    tenantId: string;
    idempotencyKey: string;
    studentProfileId: string;
    reportingPeriodId: string;
    templateVersionId: string;
    courseResults: readonly ReportCardCourseResult[];
    attendance: ReportCardAttendanceSummary;
    advisorComment?: string;
    principalComment?: string;
    correlationId: string;
  }): RecordsCommandResult<ReportCardSnapshot> {
    const retryKey = `${input.tenantId}:report-card:${input.idempotencyKey}`;
    const replayId = this.#idempotency.get(retryKey);
    if (replayId) {
      return {
        value: cloneReportCard(this.#requireReportCard(input.tenantId, replayId)),
        events: [],
      };
    }
    const period = this.#requirePeriod(input.tenantId, input.reportingPeriodId);
    if (period.state !== 'closed') {
      throw new RecordsDomainError(
        'RECORDS_PERIOD_NOT_CLOSED',
        'Report card requires a closed reporting period',
      );
    }
    const template = this.#requireTemplate(input.tenantId, input.templateVersionId);
    if (template.state !== 'published') {
      throw new RecordsDomainError(
        'RECORDS_TEMPLATE_NOT_PUBLISHED',
        'Report card requires a published template',
      );
    }
    if (input.courseResults.length === 0) {
      throw new RecordsDomainError(
        'RECORDS_REPORT_CARD_EMPTY',
        'Report card requires course results',
      );
    }
    const uniqueCourses = new Set(input.courseResults.map((result) => result.courseVersionId));
    if (
      uniqueCourses.size !== input.courseResults.length ||
      input.courseResults.some(
        (result) =>
          !result.gradeSnapshotId ||
          result.creditsAttempted < 0 ||
          result.creditsEarned < 0 ||
          result.creditsEarned > result.creditsAttempted,
      )
    ) {
      throw new RecordsDomainError(
        'RECORDS_REPORT_CARD_RESULTS_INVALID',
        'Report card results are invalid',
      );
    }
    const card: ReportCardSnapshot = {
      tenantId: input.tenantId,
      reportCardId: crypto.randomUUID(),
      studentProfileId: input.studentProfileId,
      reportingPeriodId: input.reportingPeriodId,
      templateVersionId: input.templateVersionId,
      courseResults: input.courseResults.map((result) => ({ ...result })),
      attendance: { ...input.attendance },
      ...(input.advisorComment === undefined ? {} : { advisorComment: input.advisorComment }),
      ...(input.principalComment === undefined ? {} : { principalComment: input.principalComment }),
      state: 'draft',
      version: 1,
    };
    this.#reportCards.set(card.reportCardId, card);
    this.#idempotency.set(retryKey, card.reportCardId);
    return this.#result(
      cloneReportCard(card),
      'records.report-card.created.v1',
      input.correlationId,
    );
  }

  approveReportCard(input: {
    tenantId: string;
    reportCardId: string;
    approvedBy: string;
    correlationId: string;
  }): RecordsCommandResult<ReportCardSnapshot> {
    const card = this.#requireReportCard(input.tenantId, input.reportCardId);
    if (card.state === 'published') {
      throw new RecordsDomainError(
        'RECORDS_REPORT_CARD_PUBLISHED_IMMUTABLE',
        'Published report card is immutable',
      );
    }
    if (card.state === 'approved') return { value: cloneReportCard(card), events: [] };
    card.state = 'approved';
    card.approvedBy = input.approvedBy;
    card.approvedAt = new Date().toISOString();
    card.version += 1;
    return this.#result(
      cloneReportCard(card),
      'records.report-card.approved.v1',
      input.correlationId,
    );
  }

  publishReportCard(input: {
    tenantId: string;
    reportCardId: string;
    availableFrom: string;
    availableTo?: string;
    publishedBy: string;
    correlationId: string;
  }): RecordsCommandResult<ReportCardSnapshot> {
    const card = this.#requireReportCard(input.tenantId, input.reportCardId);
    if (card.state === 'published') return { value: cloneReportCard(card), events: [] };
    if (card.state !== 'approved') {
      throw new RecordsDomainError(
        'RECORDS_REPORT_CARD_NOT_APPROVED',
        'Report card requires approval',
      );
    }
    assertPeriod(input.availableFrom, input.availableTo);
    card.state = 'published';
    card.availableFrom = input.availableFrom;
    if (input.availableTo !== undefined) card.availableTo = input.availableTo;
    card.publishedBy = input.publishedBy;
    card.publishedAt = new Date().toISOString();
    card.version += 1;
    return this.#result(
      cloneReportCard(card),
      'records.report-card.published.v1',
      input.correlationId,
    );
  }

  proposePromotion(input: {
    tenantId: string;
    studentProfileId: string;
    academicYearId: string;
    fromGradeLevel: string;
    proposedGradeLevel: string;
    recommendation: 'promote' | 'retain' | 'complete' | 'review';
    rationale: string;
    evidenceReportCardIds: readonly string[];
    proposedBy: string;
    correlationId: string;
  }): RecordsCommandResult<PromotionProposal> {
    if (!input.rationale.trim() || input.evidenceReportCardIds.length === 0) {
      throw new RecordsDomainError(
        'RECORDS_PROMOTION_EVIDENCE_REQUIRED',
        'Promotion requires rationale and evidence',
      );
    }
    for (const reportCardId of input.evidenceReportCardIds) {
      const card = this.#requireReportCard(input.tenantId, reportCardId);
      if (card.studentProfileId !== input.studentProfileId || card.state !== 'published') {
        throw new RecordsDomainError(
          'RECORDS_PROMOTION_EVIDENCE_INVALID',
          'Promotion evidence is invalid',
        );
      }
    }
    const proposal: PromotionProposal = {
      tenantId: input.tenantId,
      proposalId: crypto.randomUUID(),
      studentProfileId: input.studentProfileId,
      academicYearId: input.academicYearId,
      fromGradeLevel: input.fromGradeLevel,
      proposedGradeLevel: input.proposedGradeLevel,
      recommendation: input.recommendation,
      rationale: input.rationale,
      evidenceReportCardIds: [...new Set(input.evidenceReportCardIds)],
      proposedBy: input.proposedBy,
      proposedAt: new Date().toISOString(),
      status: 'pending',
    };
    this.#promotionProposals.set(proposal.proposalId, proposal);
    return this.#result(proposal, 'records.promotion.proposed.v1', input.correlationId);
  }

  decidePromotion(input: {
    tenantId: string;
    proposalId: string;
    decision: 'approved' | 'rejected';
    effectiveOn: string;
    decidedBy: string;
    decisionNote: string;
    correlationId: string;
  }): RecordsCommandResult<PromotionDecision> {
    const proposal = this.#requirePromotion(input.tenantId, input.proposalId);
    if (proposal.status !== 'pending') {
      throw new RecordsDomainError(
        'RECORDS_PROMOTION_ALREADY_DECIDED',
        'Promotion proposal is already decided',
      );
    }
    const decision: PromotionDecision = {
      decisionId: crypto.randomUUID(),
      proposalId: proposal.proposalId,
      decision: input.decision,
      effectiveOn: input.effectiveOn,
      decidedBy: input.decidedBy,
      decisionNote: input.decisionNote,
      decidedAt: new Date().toISOString(),
    };
    proposal.status = input.decision;
    this.#promotionDecisions.set(decision.decisionId, decision);
    return this.#result(
      decision,
      `records.promotion.${input.decision}.v1`,
      input.correlationId,
      input.tenantId,
    );
  }

  createCreditPolicy(input: {
    tenantId: string;
    policyKey: string;
    versionLabel: string;
    minimumPassingPercent: number;
    minimumPassingGradePoint?: number;
    gpaDecimals: number;
    correlationId: string;
  }): RecordsCommandResult<AcademicCreditPolicyVersion> {
    if (
      input.minimumPassingPercent < 0 ||
      input.minimumPassingPercent > 100 ||
      input.gpaDecimals < 0 ||
      input.gpaDecimals > 4
    ) {
      throw new RecordsDomainError('RECORDS_CREDIT_POLICY_INVALID', 'Credit policy is invalid');
    }
    const policy: AcademicCreditPolicyVersion = {
      tenantId: input.tenantId,
      creditPolicyVersionId: crypto.randomUUID(),
      policyKey: input.policyKey,
      versionLabel: input.versionLabel,
      minimumPassingPercent: input.minimumPassingPercent,
      ...(input.minimumPassingGradePoint === undefined
        ? {}
        : { minimumPassingGradePoint: input.minimumPassingGradePoint }),
      gpaDecimals: input.gpaDecimals,
      state: 'draft',
      version: 1,
    };
    this.#creditPolicies.set(policy.creditPolicyVersionId, policy);
    return this.#result(policy, 'records.credit-policy.created.v1', input.correlationId);
  }

  publishCreditPolicy(input: {
    tenantId: string;
    creditPolicyVersionId: string;
    correlationId: string;
  }): RecordsCommandResult<AcademicCreditPolicyVersion> {
    const policy = this.#requireCreditPolicy(input.tenantId, input.creditPolicyVersionId);
    if (policy.state === 'published') return { value: { ...policy }, events: [] };
    policy.state = 'published';
    policy.version += 1;
    return this.#result({ ...policy }, 'records.credit-policy.published.v1', input.correlationId);
  }

  calculateGpa(input: {
    tenantId: string;
    studentProfileId: string;
    creditPolicyVersionId: string;
    courseOutcomes: readonly Omit<
      TranscriptCourseOutcome,
      'creditsEarned' | 'creditPolicyVersionId'
    >[];
    correlationId: string;
  }): RecordsCommandResult<GpaCalculationSnapshot> {
    const policy = this.#requireCreditPolicy(input.tenantId, input.creditPolicyVersionId);
    if (policy.state !== 'published') {
      throw new RecordsDomainError(
        'RECORDS_CREDIT_POLICY_NOT_PUBLISHED',
        'GPA requires a published credit policy',
      );
    }
    if (input.courseOutcomes.length === 0) {
      throw new RecordsDomainError('RECORDS_GPA_OUTCOMES_REQUIRED', 'GPA requires course outcomes');
    }
    const outcomes = input.courseOutcomes.map((outcome) => {
      const passedByPercent = outcome.calculatedPercent >= policy.minimumPassingPercent;
      const passedByPoint =
        policy.minimumPassingGradePoint === undefined ||
        (outcome.gradePoint !== undefined && outcome.gradePoint >= policy.minimumPassingGradePoint);
      return {
        ...outcome,
        creditsEarned: passedByPercent && passedByPoint ? outcome.creditsAttempted : 0,
        creditPolicyVersionId: policy.creditPolicyVersionId,
      };
    });
    const creditsAttempted = outcomes.reduce((sum, outcome) => sum + outcome.creditsAttempted, 0);
    const creditsEarned = outcomes.reduce((sum, outcome) => sum + outcome.creditsEarned, 0);
    const graded = outcomes.filter((outcome) => outcome.gradePoint !== undefined);
    const gradedCredits = graded.reduce((sum, outcome) => sum + outcome.creditsAttempted, 0);
    const qualityPoints = graded.reduce(
      (sum, outcome) => sum + (outcome.gradePoint ?? 0) * outcome.creditsAttempted,
      0,
    );
    const gpa =
      gradedCredits === 0 ? undefined : round(qualityPoints / gradedCredits, policy.gpaDecimals);
    const snapshot: GpaCalculationSnapshot = {
      tenantId: input.tenantId,
      gpaSnapshotId: crypto.randomUUID(),
      studentProfileId: input.studentProfileId,
      creditPolicyVersionId: policy.creditPolicyVersionId,
      courseOutcomes: outcomes,
      qualityPoints: round(qualityPoints, policy.gpaDecimals + 2),
      creditsAttempted,
      creditsEarned,
      ...(gpa === undefined ? {} : { gpa }),
      formula: `sum(gradePoint*credits)/gradedCredits; passPercent=${policy.minimumPassingPercent}; decimals=${policy.gpaDecimals}`,
      calculatedAt: new Date().toISOString(),
      version: 1,
    };
    this.#gpaSnapshots.set(snapshot.gpaSnapshotId, snapshot);
    return this.#result(cloneGpa(snapshot), 'records.gpa.snapshot-created.v1', input.correlationId);
  }

  issueTranscript(input: {
    tenantId: string;
    idempotencyKey: string;
    transcriptNumber: string;
    studentProfileId: string;
    locale: string;
    schoolName: string;
    studentDisplayName: string;
    gpaSnapshotId: string;
    issuedBy: string;
    correlationId: string;
  }): RecordsCommandResult<TranscriptRecord> {
    const retryKey = `${input.tenantId}:transcript:${input.idempotencyKey}`;
    const replayId = this.#idempotency.get(retryKey);
    if (replayId) {
      return {
        value: cloneTranscript(this.#requireTranscript(input.tenantId, replayId)),
        events: [],
      };
    }
    const gpa = this.#requireGpa(input.tenantId, input.gpaSnapshotId);
    if (gpa.studentProfileId !== input.studentProfileId) {
      throw new RecordsDomainError(
        'RECORDS_TRANSCRIPT_STUDENT_MISMATCH',
        'GPA snapshot belongs to another student',
      );
    }
    const duplicateNumber = [...this.#transcripts.values()].some(
      (transcript) =>
        transcript.tenantId === input.tenantId &&
        transcript.transcriptNumber === input.transcriptNumber,
    );
    if (duplicateNumber) {
      throw new RecordsDomainError(
        'RECORDS_TRANSCRIPT_NUMBER_EXISTS',
        'Transcript number already exists',
      );
    }
    const issuedAt = new Date().toISOString();
    const artifact = {
      transcriptNumber: input.transcriptNumber,
      studentProfileId: input.studentProfileId,
      locale: input.locale,
      schoolName: input.schoolName,
      studentDisplayName: input.studentDisplayName,
      gpaSnapshotId: gpa.gpaSnapshotId,
      courseOutcomes: gpa.courseOutcomes,
      cumulativeGpa: gpa.gpa,
      creditsAttempted: gpa.creditsAttempted,
      creditsEarned: gpa.creditsEarned,
      issuedAt,
    };
    const transcript: TranscriptRecord = {
      tenantId: input.tenantId,
      transcriptId: crypto.randomUUID(),
      transcriptNumber: input.transcriptNumber,
      studentProfileId: input.studentProfileId,
      versionNumber: 1,
      status: 'issued',
      locale: input.locale,
      schoolName: input.schoolName,
      studentDisplayName: input.studentDisplayName,
      gpaSnapshotId: gpa.gpaSnapshotId,
      courseOutcomes: gpa.courseOutcomes.map(cloneOutcome),
      ...(gpa.gpa === undefined ? {} : { cumulativeGpa: gpa.gpa }),
      creditsAttempted: gpa.creditsAttempted,
      creditsEarned: gpa.creditsEarned,
      issuedBy: input.issuedBy,
      issuedAt,
      artifactDigest: stableDigest(artifact),
    };
    this.#transcripts.set(transcript.transcriptId, transcript);
    this.#idempotency.set(retryKey, transcript.transcriptId);
    return this.#result(
      cloneTranscript(transcript),
      'records.transcript.issued.v1',
      input.correlationId,
    );
  }

  amendTranscript(input: {
    tenantId: string;
    transcriptId: string;
    replacementTranscriptNumber: string;
    replacementGpaSnapshotId: string;
    reason: string;
    amendedBy: string;
    approvedBy: string;
    correlationId: string;
  }): RecordsCommandResult<TranscriptRecord> {
    const original = this.#requireTranscript(input.tenantId, input.transcriptId);
    if (
      original.status !== 'issued' ||
      !input.reason.trim() ||
      input.amendedBy === input.approvedBy
    ) {
      throw new RecordsDomainError(
        'RECORDS_TRANSCRIPT_AMENDMENT_INVALID',
        'Transcript amendment requires an issued source, reason and independent approval',
      );
    }
    const gpa = this.#requireGpa(input.tenantId, input.replacementGpaSnapshotId);
    if (gpa.studentProfileId !== original.studentProfileId) {
      throw new RecordsDomainError(
        'RECORDS_TRANSCRIPT_STUDENT_MISMATCH',
        'Replacement GPA belongs to another student',
      );
    }
    const issuedAt = new Date().toISOString();
    const replacement: TranscriptRecord = {
      tenantId: input.tenantId,
      transcriptId: crypto.randomUUID(),
      transcriptNumber: input.replacementTranscriptNumber,
      studentProfileId: original.studentProfileId,
      versionNumber: original.versionNumber + 1,
      supersedesTranscriptId: original.transcriptId,
      status: 'issued',
      locale: original.locale,
      schoolName: original.schoolName,
      studentDisplayName: original.studentDisplayName,
      gpaSnapshotId: gpa.gpaSnapshotId,
      courseOutcomes: gpa.courseOutcomes.map(cloneOutcome),
      ...(gpa.gpa === undefined ? {} : { cumulativeGpa: gpa.gpa }),
      creditsAttempted: gpa.creditsAttempted,
      creditsEarned: gpa.creditsEarned,
      issuedBy: input.amendedBy,
      issuedAt,
      artifactDigest: stableDigest({
        supersedesTranscriptId: original.transcriptId,
        transcriptNumber: input.replacementTranscriptNumber,
        gpaSnapshotId: gpa.gpaSnapshotId,
        courseOutcomes: gpa.courseOutcomes,
        issuedAt,
      }),
      correctionReason: input.reason,
    };
    original.status = 'superseded';
    this.#transcripts.set(replacement.transcriptId, replacement);
    this.#amendments.push({
      amendmentId: crypto.randomUUID(),
      originalTranscriptId: original.transcriptId,
      replacementTranscriptId: replacement.transcriptId,
      reason: input.reason,
      approvedBy: input.approvedBy,
      amendedBy: input.amendedBy,
      amendedAt: issuedAt,
    });
    return this.#result(
      cloneTranscript(replacement),
      'records.transcript.reissued.v1',
      input.correlationId,
    );
  }

  reportCard(tenantId: string, reportCardId: string): ReportCardSnapshot {
    return cloneReportCard(this.#requireReportCard(tenantId, reportCardId));
  }

  transcript(tenantId: string, transcriptId: string): TranscriptRecord {
    return cloneTranscript(this.#requireTranscript(tenantId, transcriptId));
  }

  transcriptHistory(tenantId: string, studentProfileId: string): readonly TranscriptRecord[] {
    return [...this.#transcripts.values()]
      .filter(
        (transcript) =>
          transcript.tenantId === tenantId && transcript.studentProfileId === studentProfileId,
      )
      .sort((left, right) => left.versionNumber - right.versionNumber)
      .map(cloneTranscript);
  }

  transcriptAmendments(tenantId: string, transcriptId: string): readonly TranscriptAmendment[] {
    this.#requireTranscript(tenantId, transcriptId);
    return this.#amendments
      .filter(
        (amendment) =>
          amendment.originalTranscriptId === transcriptId ||
          amendment.replacementTranscriptId === transcriptId,
      )
      .map((amendment) => ({ ...amendment }));
  }

  #requirePeriod(tenantId: string, reportingPeriodId: string): ReportingPeriod {
    const period = this.#periods.get(reportingPeriodId);
    if (!period || period.tenantId !== tenantId) {
      throw new RecordsDomainError('RECORDS_PERIOD_NOT_FOUND', 'Reporting period was not found');
    }
    return period;
  }

  #requireTemplate(tenantId: string, templateVersionId: string): ReportCardTemplateVersion {
    const template = this.#templates.get(templateVersionId);
    if (!template || template.tenantId !== tenantId) {
      throw new RecordsDomainError(
        'RECORDS_TEMPLATE_NOT_FOUND',
        'Report-card template was not found',
      );
    }
    return template;
  }

  #requireReportCard(tenantId: string, reportCardId: string): ReportCardSnapshot {
    const card = this.#reportCards.get(reportCardId);
    if (!card || card.tenantId !== tenantId) {
      throw new RecordsDomainError('RECORDS_REPORT_CARD_NOT_FOUND', 'Report card was not found');
    }
    return card;
  }

  #requirePromotion(tenantId: string, proposalId: string): PromotionProposal {
    const proposal = this.#promotionProposals.get(proposalId);
    if (!proposal || proposal.tenantId !== tenantId) {
      throw new RecordsDomainError(
        'RECORDS_PROMOTION_NOT_FOUND',
        'Promotion proposal was not found',
      );
    }
    return proposal;
  }

  #requireCreditPolicy(
    tenantId: string,
    creditPolicyVersionId: string,
  ): AcademicCreditPolicyVersion {
    const policy = this.#creditPolicies.get(creditPolicyVersionId);
    if (!policy || policy.tenantId !== tenantId) {
      throw new RecordsDomainError(
        'RECORDS_CREDIT_POLICY_NOT_FOUND',
        'Credit policy was not found',
      );
    }
    return policy;
  }

  #requireGpa(tenantId: string, gpaSnapshotId: string): GpaCalculationSnapshot {
    const snapshot = this.#gpaSnapshots.get(gpaSnapshotId);
    if (!snapshot || snapshot.tenantId !== tenantId) {
      throw new RecordsDomainError('RECORDS_GPA_NOT_FOUND', 'GPA snapshot was not found');
    }
    return snapshot;
  }

  #requireTranscript(tenantId: string, transcriptId: string): TranscriptRecord {
    const transcript = this.#transcripts.get(transcriptId);
    if (!transcript || transcript.tenantId !== tenantId) {
      throw new RecordsDomainError('RECORDS_TRANSCRIPT_NOT_FOUND', 'Transcript was not found');
    }
    return transcript;
  }

  #result<T extends object>(
    value: T,
    eventType: string,
    correlationId: string,
    explicitTenantId?: string,
  ): RecordsCommandResult<T> {
    const tenantId =
      explicitTenantId ??
      ('tenantId' in value && typeof value.tenantId === 'string' ? value.tenantId : undefined);
    if (!tenantId) throw new RecordsDomainError('RECORDS_TENANT_REQUIRED', 'Tenant is required');
    const aggregateId =
      ('reportCardId' in value && typeof value.reportCardId === 'string'
        ? value.reportCardId
        : undefined) ??
      ('transcriptId' in value && typeof value.transcriptId === 'string'
        ? value.transcriptId
        : undefined) ??
      ('gpaSnapshotId' in value && typeof value.gpaSnapshotId === 'string'
        ? value.gpaSnapshotId
        : undefined) ??
      ('proposalId' in value && typeof value.proposalId === 'string'
        ? value.proposalId
        : undefined) ??
      ('reportingPeriodId' in value && typeof value.reportingPeriodId === 'string'
        ? value.reportingPeriodId
        : undefined) ??
      crypto.randomUUID();
    this.#audit.append({ tenantId, action: eventType, subjectId: aggregateId });
    return {
      value,
      events: [
        createDomainEvent({
          eventType,
          schemaVersion: 1,
          tenantId,
          aggregateType: 'academic-record',
          aggregateId,
          aggregateVersion:
            'version' in value && typeof value.version === 'number' ? value.version : 1,
          correlationId,
          payload: value,
        }),
      ],
    };
  }
}
