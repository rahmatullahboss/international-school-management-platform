import { AppendOnlyAuditLog, createDomainEvent, type DomainEvent } from '@school/events';

export type AssessmentResultState = 'scored' | 'missing' | 'exempt' | 'late';
export type GradebookState = 'open' | 'locked';

export interface GradeScaleLevel {
  levelId: string;
  label: string;
  minimumPercent: number;
  maximumPercent: number;
  gradePoint?: number;
  passing: boolean;
}

export interface AssessmentCategory {
  categoryId: string;
  code: string;
  label: string;
  weightPercent: number;
}

export interface GradingPolicyVersion {
  tenantId: string;
  policyVersionId: string;
  policyKey: string;
  versionLabel: string;
  calculationMode: 'traditional' | 'standards' | 'hybrid';
  missingScoreTreatment: 'zero' | 'exclude';
  roundingDecimals: number;
  categories: readonly AssessmentCategory[];
  scale: readonly GradeScaleLevel[];
  state: 'draft' | 'published';
  version: number;
}

export interface RubricCriterion {
  criterionId: string;
  code: string;
  label: string;
  maximumPoints: number;
  standardIds: readonly string[];
}

export interface Rubric {
  tenantId: string;
  rubricId: string;
  title: string;
  criteria: readonly RubricCriterion[];
  version: number;
}

export interface Assessment {
  tenantId: string;
  assessmentId: string;
  sectionId: string;
  reportingPeriodId: string;
  policyVersionId: string;
  categoryId: string;
  title: string;
  maximumPoints: number;
  dueAt: string;
  rubricId?: string;
  standardIds: readonly string[];
  state: 'draft' | 'published' | 'closed';
  moderatedBy?: string;
  moderatedAt?: string;
  version: number;
}

export interface OutcomeScore {
  standardId: string;
  level: number;
  evidence?: string;
}

export interface AssessmentResult {
  tenantId: string;
  assessmentResultId: string;
  assessmentId: string;
  studentProfileId: string;
  state: AssessmentResultState;
  rawScore?: number;
  comment?: string;
  outcomeScores: readonly OutcomeScore[];
  enteredBy: string;
  enteredAt: string;
  version: number;
}

export interface GradeCalculationInput {
  assessmentId: string;
  categoryId: string;
  state: AssessmentResultState;
  rawScore?: number;
  maximumPoints: number;
  included: boolean;
  normalizedPercent?: number;
}

export interface GradeCalculationSnapshot {
  tenantId: string;
  snapshotId: string;
  sectionId: string;
  reportingPeriodId: string;
  studentProfileId: string;
  policyVersionId: string;
  inputs: readonly GradeCalculationInput[];
  categoryPercentages: Readonly<Record<string, number | null>>;
  calculatedPercent: number;
  displayedGrade: string;
  gradePoint?: number;
  formula: string;
  calculatedAt: string;
  version: number;
}

export interface GradebookLock {
  tenantId: string;
  lockId: string;
  sectionId: string;
  reportingPeriodId: string;
  state: GradebookState;
  lockedBy?: string;
  lockedAt?: string;
  version: number;
}

export interface GradePublication {
  publicationId: string;
  snapshotId: string;
  availableFrom: string;
  availableTo?: string;
  publishedBy: string;
  publishedAt: string;
}

export interface GradeChangeRequest {
  requestId: string;
  assessmentResultId: string;
  requestedRawScore?: number;
  requestedState: AssessmentResultState;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export interface GradebookCommandResult<T> {
  value: T;
  events: readonly DomainEvent<unknown>[];
}

export class GradebookDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GradebookDomainError';
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clonePolicy(policy: GradingPolicyVersion): GradingPolicyVersion {
  return {
    ...policy,
    categories: policy.categories.map((category) => ({ ...category })),
    scale: policy.scale.map((level) => ({ ...level })),
  };
}

function cloneAssessment(assessment: Assessment): Assessment {
  return { ...assessment, standardIds: [...assessment.standardIds] };
}

function cloneResult(result: AssessmentResult): AssessmentResult {
  return {
    ...result,
    outcomeScores: result.outcomeScores.map((score) => ({ ...score })),
  };
}

function cloneSnapshot(snapshot: GradeCalculationSnapshot): GradeCalculationSnapshot {
  return {
    ...snapshot,
    inputs: snapshot.inputs.map((input) => ({ ...input })),
    categoryPercentages: { ...snapshot.categoryPercentages },
  };
}

export class GradebookRegistry {
  readonly #policies = new Map<string, GradingPolicyVersion>();
  readonly #rubrics = new Map<string, Rubric>();
  readonly #assessments = new Map<string, Assessment>();
  readonly #results = new Map<string, AssessmentResult>();
  readonly #resultByAssessmentStudent = new Map<string, string>();
  readonly #snapshots = new Map<string, GradeCalculationSnapshot>();
  readonly #locks = new Map<string, GradebookLock>();
  readonly #publications = new Map<string, GradePublication>();
  readonly #changeRequests = new Map<string, GradeChangeRequest>();
  readonly #audit = new AppendOnlyAuditLog();

  get auditLog(): AppendOnlyAuditLog {
    return this.#audit;
  }

  createPolicy(input: {
    tenantId: string;
    policyKey: string;
    versionLabel: string;
    calculationMode: 'traditional' | 'standards' | 'hybrid';
    missingScoreTreatment: 'zero' | 'exclude';
    roundingDecimals: number;
    categories: readonly Omit<AssessmentCategory, 'categoryId'>[];
    scale: readonly Omit<GradeScaleLevel, 'levelId'>[];
    correlationId: string;
  }): GradebookCommandResult<GradingPolicyVersion> {
    const weight = input.categories.reduce((sum, category) => sum + category.weightPercent, 0);
    if (
      input.categories.length === 0 ||
      Math.abs(weight - 100) > 0.0001 ||
      input.roundingDecimals < 0 ||
      input.roundingDecimals > 4
    ) {
      throw new GradebookDomainError(
        'GRADE_POLICY_INVALID',
        'Grading policy categories or rounding are invalid',
      );
    }
    const categories = input.categories.map((category) => ({
      ...category,
      categoryId: crypto.randomUUID(),
    }));
    const scale = input.scale
      .map((level) => ({ ...level, levelId: crypto.randomUUID() }))
      .sort((left, right) => right.minimumPercent - left.minimumPercent);
    if (
      scale.length === 0 ||
      scale.some(
        (level) =>
          level.minimumPercent < 0 ||
          level.maximumPercent > 100 ||
          level.maximumPercent < level.minimumPercent,
      )
    ) {
      throw new GradebookDomainError('GRADE_SCALE_INVALID', 'Grade scale is invalid');
    }
    const duplicate = [...this.#policies.values()].some(
      (policy) =>
        policy.tenantId === input.tenantId &&
        policy.policyKey === input.policyKey &&
        policy.versionLabel === input.versionLabel,
    );
    if (duplicate)
      throw new GradebookDomainError('GRADE_POLICY_EXISTS', 'Policy version already exists');
    const policy: GradingPolicyVersion = {
      tenantId: input.tenantId,
      policyVersionId: crypto.randomUUID(),
      policyKey: input.policyKey,
      versionLabel: input.versionLabel,
      calculationMode: input.calculationMode,
      missingScoreTreatment: input.missingScoreTreatment,
      roundingDecimals: input.roundingDecimals,
      categories,
      scale,
      state: 'draft',
      version: 1,
    };
    this.#policies.set(policy.policyVersionId, policy);
    return this.#result(clonePolicy(policy), 'gradebook.policy.created.v1', input.correlationId);
  }

  publishPolicy(input: {
    tenantId: string;
    policyVersionId: string;
    correlationId: string;
  }): GradebookCommandResult<GradingPolicyVersion> {
    const policy = this.#requirePolicy(input.tenantId, input.policyVersionId);
    if (policy.state === 'published') return { value: clonePolicy(policy), events: [] };
    policy.state = 'published';
    policy.version += 1;
    return this.#result(clonePolicy(policy), 'gradebook.policy.published.v1', input.correlationId);
  }

  createRubric(input: {
    tenantId: string;
    title: string;
    criteria: readonly Omit<RubricCriterion, 'criterionId'>[];
    correlationId: string;
  }): GradebookCommandResult<Rubric> {
    if (
      input.criteria.length === 0 ||
      input.criteria.some((criterion) => criterion.maximumPoints <= 0)
    ) {
      throw new GradebookDomainError('GRADE_RUBRIC_INVALID', 'Rubric criteria are invalid');
    }
    const rubric: Rubric = {
      tenantId: input.tenantId,
      rubricId: crypto.randomUUID(),
      title: input.title,
      criteria: input.criteria.map((criterion) => ({
        ...criterion,
        criterionId: crypto.randomUUID(),
        standardIds: [...criterion.standardIds],
      })),
      version: 1,
    };
    this.#rubrics.set(rubric.rubricId, rubric);
    return this.#result(rubric, 'gradebook.rubric.created.v1', input.correlationId);
  }

  createAssessment(input: {
    tenantId: string;
    sectionId: string;
    reportingPeriodId: string;
    policyVersionId: string;
    categoryId: string;
    title: string;
    maximumPoints: number;
    dueAt: string;
    rubricId?: string;
    standardIds?: readonly string[];
    correlationId: string;
  }): GradebookCommandResult<Assessment> {
    const policy = this.#requirePolicy(input.tenantId, input.policyVersionId);
    if (policy.state !== 'published') {
      throw new GradebookDomainError(
        'GRADE_POLICY_NOT_PUBLISHED',
        'Assessment requires a published policy',
      );
    }
    if (!policy.categories.some((category) => category.categoryId === input.categoryId)) {
      throw new GradebookDomainError(
        'GRADE_CATEGORY_NOT_FOUND',
        'Assessment category was not found',
      );
    }
    if (input.maximumPoints <= 0) {
      throw new GradebookDomainError(
        'GRADE_ASSESSMENT_POINTS_INVALID',
        'Maximum points must be positive',
      );
    }
    if (input.rubricId !== undefined) this.#requireRubric(input.tenantId, input.rubricId);
    this.#requireUnlocked(input.tenantId, input.sectionId, input.reportingPeriodId);
    const assessment: Assessment = {
      tenantId: input.tenantId,
      assessmentId: crypto.randomUUID(),
      sectionId: input.sectionId,
      reportingPeriodId: input.reportingPeriodId,
      policyVersionId: input.policyVersionId,
      categoryId: input.categoryId,
      title: input.title,
      maximumPoints: input.maximumPoints,
      dueAt: input.dueAt,
      ...(input.rubricId === undefined ? {} : { rubricId: input.rubricId }),
      standardIds: [...new Set(input.standardIds ?? [])],
      state: 'draft',
      version: 1,
    };
    this.#assessments.set(assessment.assessmentId, assessment);
    return this.#result(
      cloneAssessment(assessment),
      'gradebook.assessment.created.v1',
      input.correlationId,
    );
  }

  publishAssessment(input: {
    tenantId: string;
    assessmentId: string;
    correlationId: string;
  }): GradebookCommandResult<Assessment> {
    const assessment = this.#requireAssessment(input.tenantId, input.assessmentId);
    this.#requireUnlocked(input.tenantId, assessment.sectionId, assessment.reportingPeriodId);
    if (assessment.state === 'published') return { value: cloneAssessment(assessment), events: [] };
    if (assessment.state !== 'draft') {
      throw new GradebookDomainError(
        'GRADE_ASSESSMENT_STATE_INVALID',
        'Assessment cannot be published',
      );
    }
    assessment.state = 'published';
    assessment.version += 1;
    return this.#result(
      cloneAssessment(assessment),
      'gradebook.assessment.published.v1',
      input.correlationId,
    );
  }

  enterResult(input: {
    tenantId: string;
    assessmentId: string;
    studentProfileId: string;
    state: AssessmentResultState;
    rawScore?: number;
    comment?: string;
    outcomeScores?: readonly OutcomeScore[];
    enteredBy: string;
    correlationId: string;
  }): GradebookCommandResult<AssessmentResult> {
    const assessment = this.#requireAssessment(input.tenantId, input.assessmentId);
    this.#requireUnlocked(input.tenantId, assessment.sectionId, assessment.reportingPeriodId);
    if (assessment.state === 'draft') {
      throw new GradebookDomainError(
        'GRADE_ASSESSMENT_NOT_PUBLISHED',
        'Assessment is not published',
      );
    }
    this.#validateResult(input.state, input.rawScore, assessment.maximumPoints);
    const key = `${input.tenantId}:${input.assessmentId}:${input.studentProfileId}`;
    const existingId = this.#resultByAssessmentStudent.get(key);
    if (existingId) {
      throw new GradebookDomainError(
        'GRADE_RESULT_EXISTS',
        'Use a grade-change workflow to modify an existing result',
      );
    }
    const result: AssessmentResult = {
      tenantId: input.tenantId,
      assessmentResultId: crypto.randomUUID(),
      assessmentId: input.assessmentId,
      studentProfileId: input.studentProfileId,
      state: input.state,
      ...(input.rawScore === undefined ? {} : { rawScore: input.rawScore }),
      ...(input.comment === undefined ? {} : { comment: input.comment }),
      outcomeScores: (input.outcomeScores ?? []).map((score) => ({ ...score })),
      enteredBy: input.enteredBy,
      enteredAt: new Date().toISOString(),
      version: 1,
    };
    this.#results.set(result.assessmentResultId, result);
    this.#resultByAssessmentStudent.set(key, result.assessmentResultId);
    return this.#result(cloneResult(result), 'gradebook.result.entered.v1', input.correlationId);
  }

  moderateAssessment(input: {
    tenantId: string;
    assessmentId: string;
    moderatedBy: string;
    correlationId: string;
  }): GradebookCommandResult<Assessment> {
    const assessment = this.#requireAssessment(input.tenantId, input.assessmentId);
    this.#requireUnlocked(input.tenantId, assessment.sectionId, assessment.reportingPeriodId);
    if (assessment.state !== 'published') {
      throw new GradebookDomainError(
        'GRADE_MODERATION_STATE_INVALID',
        'Only published assessments can be moderated',
      );
    }
    assessment.moderatedBy = input.moderatedBy;
    assessment.moderatedAt = new Date().toISOString();
    assessment.version += 1;
    return this.#result(
      cloneAssessment(assessment),
      'gradebook.assessment.moderated.v1',
      input.correlationId,
    );
  }

  closeAssessment(input: {
    tenantId: string;
    assessmentId: string;
    correlationId: string;
  }): GradebookCommandResult<Assessment> {
    const assessment = this.#requireAssessment(input.tenantId, input.assessmentId);
    this.#requireUnlocked(input.tenantId, assessment.sectionId, assessment.reportingPeriodId);
    if (!assessment.moderatedBy) {
      throw new GradebookDomainError(
        'GRADE_MODERATION_REQUIRED',
        'Assessment requires moderation before closing',
      );
    }
    assessment.state = 'closed';
    assessment.version += 1;
    return this.#result(
      cloneAssessment(assessment),
      'gradebook.assessment.closed.v1',
      input.correlationId,
    );
  }

  calculate(input: {
    tenantId: string;
    sectionId: string;
    reportingPeriodId: string;
    studentProfileId: string;
    policyVersionId: string;
    correlationId: string;
  }): GradebookCommandResult<GradeCalculationSnapshot> {
    const policy = this.#requirePolicy(input.tenantId, input.policyVersionId);
    if (policy.state !== 'published') {
      throw new GradebookDomainError(
        'GRADE_POLICY_NOT_PUBLISHED',
        'Grade calculation requires published policy',
      );
    }
    const assessments = [...this.#assessments.values()].filter(
      (assessment) =>
        assessment.tenantId === input.tenantId &&
        assessment.sectionId === input.sectionId &&
        assessment.reportingPeriodId === input.reportingPeriodId &&
        assessment.policyVersionId === input.policyVersionId &&
        assessment.state !== 'draft',
    );
    if (assessments.length === 0) {
      throw new GradebookDomainError(
        'GRADE_NO_ASSESSMENTS',
        'No assessments are available for calculation',
      );
    }
    const inputs: GradeCalculationInput[] = [];
    const categoryPercentages: Record<string, number | null> = {};
    let weightedPercent = 0;
    let includedWeight = 0;
    for (const category of policy.categories) {
      const categoryAssessments = assessments.filter(
        (assessment) => assessment.categoryId === category.categoryId,
      );
      let earned = 0;
      let possible = 0;
      for (const assessment of categoryAssessments) {
        const result = this.#findResult(
          input.tenantId,
          assessment.assessmentId,
          input.studentProfileId,
        );
        const state = result?.state ?? 'missing';
        const include =
          state !== 'exempt' &&
          !(state === 'missing' && policy.missingScoreTreatment === 'exclude');
        const rawScore = result?.rawScore ?? (state === 'missing' ? 0 : undefined);
        const normalizedPercent =
          include && rawScore !== undefined
            ? round((rawScore / assessment.maximumPoints) * 100, policy.roundingDecimals)
            : undefined;
        inputs.push({
          assessmentId: assessment.assessmentId,
          categoryId: category.categoryId,
          state,
          ...(rawScore === undefined ? {} : { rawScore }),
          maximumPoints: assessment.maximumPoints,
          included: include,
          ...(normalizedPercent === undefined ? {} : { normalizedPercent }),
        });
        if (include) {
          possible += assessment.maximumPoints;
          earned += rawScore ?? 0;
        }
      }
      if (possible === 0) {
        categoryPercentages[category.categoryId] = null;
        continue;
      }
      const categoryPercent = round((earned / possible) * 100, policy.roundingDecimals);
      categoryPercentages[category.categoryId] = categoryPercent;
      weightedPercent += categoryPercent * (category.weightPercent / 100);
      includedWeight += category.weightPercent;
    }
    const calculatedPercent =
      includedWeight === 0
        ? 0
        : round(weightedPercent / (includedWeight / 100), policy.roundingDecimals);
    const scaleLevel = policy.scale.find(
      (level) =>
        calculatedPercent >= level.minimumPercent && calculatedPercent <= level.maximumPercent,
    );
    if (!scaleLevel) {
      throw new GradebookDomainError(
        'GRADE_SCALE_NO_MATCH',
        'Calculated grade does not match the scale',
      );
    }
    const snapshot: GradeCalculationSnapshot = {
      tenantId: input.tenantId,
      snapshotId: crypto.randomUUID(),
      sectionId: input.sectionId,
      reportingPeriodId: input.reportingPeriodId,
      studentProfileId: input.studentProfileId,
      policyVersionId: input.policyVersionId,
      inputs,
      categoryPercentages,
      calculatedPercent,
      displayedGrade: scaleLevel.label,
      ...(scaleLevel.gradePoint === undefined ? {} : { gradePoint: scaleLevel.gradePoint }),
      formula: `weighted-categories; missing=${policy.missingScoreTreatment}; rounding=${policy.roundingDecimals}`,
      calculatedAt: new Date().toISOString(),
      version: 1,
    };
    this.#snapshots.set(snapshot.snapshotId, snapshot);
    return this.#result(
      cloneSnapshot(snapshot),
      'gradebook.calculation.snapshot-created.v1',
      input.correlationId,
    );
  }

  lock(input: {
    tenantId: string;
    sectionId: string;
    reportingPeriodId: string;
    lockedBy: string;
    correlationId: string;
  }): GradebookCommandResult<GradebookLock> {
    const key = this.#lockKey(input.tenantId, input.sectionId, input.reportingPeriodId);
    const existing = this.#locks.get(key);
    if (existing?.state === 'locked') return { value: { ...existing }, events: [] };
    const unmoderated = [...this.#assessments.values()].some(
      (assessment) =>
        assessment.tenantId === input.tenantId &&
        assessment.sectionId === input.sectionId &&
        assessment.reportingPeriodId === input.reportingPeriodId &&
        assessment.state !== 'draft' &&
        !assessment.moderatedBy,
    );
    if (unmoderated) {
      throw new GradebookDomainError(
        'GRADE_MODERATION_REQUIRED',
        'All assessments require moderation before lock',
      );
    }
    const lock: GradebookLock = {
      tenantId: input.tenantId,
      lockId: existing?.lockId ?? crypto.randomUUID(),
      sectionId: input.sectionId,
      reportingPeriodId: input.reportingPeriodId,
      state: 'locked',
      lockedBy: input.lockedBy,
      lockedAt: new Date().toISOString(),
      version: (existing?.version ?? 0) + 1,
    };
    this.#locks.set(key, lock);
    return this.#result(lock, 'gradebook.lock.created.v1', input.correlationId);
  }

  publishSnapshot(input: {
    tenantId: string;
    snapshotId: string;
    availableFrom: string;
    availableTo?: string;
    publishedBy: string;
    correlationId: string;
  }): GradebookCommandResult<GradePublication> {
    const snapshot = this.#requireSnapshot(input.tenantId, input.snapshotId);
    if (input.availableTo !== undefined && input.availableTo < input.availableFrom) {
      throw new GradebookDomainError(
        'GRADE_PUBLICATION_WINDOW_INVALID',
        'Publication window is invalid',
      );
    }
    const key = this.#lockKey(input.tenantId, snapshot.sectionId, snapshot.reportingPeriodId);
    if (this.#locks.get(key)?.state !== 'locked') {
      throw new GradebookDomainError(
        'GRADEBOOK_NOT_LOCKED',
        'Gradebook must be locked before publication',
      );
    }
    const existing = [...this.#publications.values()].find(
      (publication) => publication.snapshotId === input.snapshotId,
    );
    if (existing) return { value: { ...existing }, events: [] };
    const publication: GradePublication = {
      publicationId: crypto.randomUUID(),
      snapshotId: input.snapshotId,
      availableFrom: input.availableFrom,
      ...(input.availableTo === undefined ? {} : { availableTo: input.availableTo }),
      publishedBy: input.publishedBy,
      publishedAt: new Date().toISOString(),
    };
    this.#publications.set(publication.publicationId, publication);
    return this.#result(
      publication,
      'gradebook.snapshot.published.v1',
      input.correlationId,
      input.tenantId,
    );
  }

  requestGradeChange(input: {
    tenantId: string;
    assessmentResultId: string;
    requestedRawScore?: number;
    requestedState: AssessmentResultState;
    reason: string;
    requestedBy: string;
    correlationId: string;
  }): GradebookCommandResult<GradeChangeRequest> {
    const result = this.#requireResult(input.tenantId, input.assessmentResultId);
    const assessment = this.#requireAssessment(input.tenantId, result.assessmentId);
    const key = this.#lockKey(input.tenantId, assessment.sectionId, assessment.reportingPeriodId);
    if (this.#locks.get(key)?.state !== 'locked') {
      throw new GradebookDomainError(
        'GRADE_CHANGE_REQUEST_NOT_REQUIRED',
        'Grade-change requests are for locked gradebooks',
      );
    }
    this.#validateResult(input.requestedState, input.requestedRawScore, assessment.maximumPoints);
    if (!input.reason.trim()) {
      throw new GradebookDomainError(
        'GRADE_CHANGE_REASON_REQUIRED',
        'Grade-change reason is required',
      );
    }
    const request: GradeChangeRequest = {
      requestId: crypto.randomUUID(),
      assessmentResultId: input.assessmentResultId,
      ...(input.requestedRawScore === undefined
        ? {}
        : { requestedRawScore: input.requestedRawScore }),
      requestedState: input.requestedState,
      reason: input.reason,
      requestedBy: input.requestedBy,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    this.#changeRequests.set(request.requestId, request);
    return this.#result(
      request,
      'gradebook.grade-change.requested.v1',
      input.correlationId,
      input.tenantId,
    );
  }

  decideGradeChange(input: {
    tenantId: string;
    requestId: string;
    decision: 'approved' | 'rejected';
    decidedBy: string;
    decisionNote: string;
    correlationId: string;
  }): GradebookCommandResult<GradeChangeRequest> {
    const request = this.#changeRequests.get(input.requestId);
    if (!request) {
      throw new GradebookDomainError(
        'GRADE_CHANGE_REQUEST_NOT_FOUND',
        'Grade-change request was not found',
      );
    }
    const result = this.#requireResult(input.tenantId, request.assessmentResultId);
    if (request.status !== 'pending') {
      throw new GradebookDomainError(
        'GRADE_CHANGE_ALREADY_DECIDED',
        'Grade-change request is already decided',
      );
    }
    request.status = input.decision;
    request.decidedBy = input.decidedBy;
    request.decidedAt = new Date().toISOString();
    request.decisionNote = input.decisionNote;
    if (input.decision === 'approved') {
      result.state = request.requestedState;
      if (request.requestedRawScore === undefined) delete result.rawScore;
      else result.rawScore = request.requestedRawScore;
      result.enteredBy = input.decidedBy;
      result.enteredAt = request.decidedAt;
      result.version += 1;
    }
    return this.#result(
      { ...request },
      `gradebook.grade-change.${input.decision}.v1`,
      input.correlationId,
      input.tenantId,
    );
  }

  result(tenantId: string, assessmentResultId: string): AssessmentResult {
    return cloneResult(this.#requireResult(tenantId, assessmentResultId));
  }

  snapshot(tenantId: string, snapshotId: string): GradeCalculationSnapshot {
    return cloneSnapshot(this.#requireSnapshot(tenantId, snapshotId));
  }

  #validateResult(
    state: AssessmentResultState,
    rawScore: number | undefined,
    maximumPoints: number,
  ): void {
    if (state === 'scored' || state === 'late') {
      if (rawScore === undefined || rawScore < 0 || rawScore > maximumPoints) {
        throw new GradebookDomainError('GRADE_RESULT_SCORE_INVALID', 'Raw score is invalid');
      }
      return;
    }
    if (rawScore !== undefined) {
      throw new GradebookDomainError(
        'GRADE_RESULT_STATE_SCORE_CONFLICT',
        'Missing and exempt states cannot contain a raw score',
      );
    }
  }

  #findResult(
    tenantId: string,
    assessmentId: string,
    studentProfileId: string,
  ): AssessmentResult | undefined {
    const id = this.#resultByAssessmentStudent.get(
      `${tenantId}:${assessmentId}:${studentProfileId}`,
    );
    return id ? this.#results.get(id) : undefined;
  }

  #lockKey(tenantId: string, sectionId: string, reportingPeriodId: string): string {
    return `${tenantId}:${sectionId}:${reportingPeriodId}`;
  }

  #requireUnlocked(tenantId: string, sectionId: string, reportingPeriodId: string): void {
    if (
      this.#locks.get(this.#lockKey(tenantId, sectionId, reportingPeriodId))?.state === 'locked'
    ) {
      throw new GradebookDomainError('GRADEBOOK_LOCKED', 'Gradebook is locked');
    }
  }

  #requirePolicy(tenantId: string, policyVersionId: string): GradingPolicyVersion {
    const policy = this.#policies.get(policyVersionId);
    if (!policy || policy.tenantId !== tenantId) {
      throw new GradebookDomainError('GRADE_POLICY_NOT_FOUND', 'Grading policy was not found');
    }
    return policy;
  }

  #requireRubric(tenantId: string, rubricId: string): Rubric {
    const rubric = this.#rubrics.get(rubricId);
    if (!rubric || rubric.tenantId !== tenantId) {
      throw new GradebookDomainError('GRADE_RUBRIC_NOT_FOUND', 'Rubric was not found');
    }
    return rubric;
  }

  #requireAssessment(tenantId: string, assessmentId: string): Assessment {
    const assessment = this.#assessments.get(assessmentId);
    if (!assessment || assessment.tenantId !== tenantId) {
      throw new GradebookDomainError('GRADE_ASSESSMENT_NOT_FOUND', 'Assessment was not found');
    }
    return assessment;
  }

  #requireResult(tenantId: string, assessmentResultId: string): AssessmentResult {
    const result = this.#results.get(assessmentResultId);
    if (!result || result.tenantId !== tenantId) {
      throw new GradebookDomainError('GRADE_RESULT_NOT_FOUND', 'Assessment result was not found');
    }
    return result;
  }

  #requireSnapshot(tenantId: string, snapshotId: string): GradeCalculationSnapshot {
    const snapshot = this.#snapshots.get(snapshotId);
    if (!snapshot || snapshot.tenantId !== tenantId) {
      throw new GradebookDomainError('GRADE_SNAPSHOT_NOT_FOUND', 'Grade snapshot was not found');
    }
    return snapshot;
  }

  #result<T extends object>(
    value: T,
    eventType: string,
    correlationId: string,
    explicitTenantId?: string,
  ): GradebookCommandResult<T> {
    const tenantId =
      explicitTenantId ??
      ('tenantId' in value && typeof value.tenantId === 'string' ? value.tenantId : undefined);
    if (!tenantId) throw new GradebookDomainError('GRADE_TENANT_REQUIRED', 'Tenant is required');
    const aggregateId =
      ('assessmentId' in value && typeof value.assessmentId === 'string'
        ? value.assessmentId
        : undefined) ??
      ('assessmentResultId' in value && typeof value.assessmentResultId === 'string'
        ? value.assessmentResultId
        : undefined) ??
      ('snapshotId' in value && typeof value.snapshotId === 'string'
        ? value.snapshotId
        : undefined) ??
      ('policyVersionId' in value && typeof value.policyVersionId === 'string'
        ? value.policyVersionId
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
          aggregateType: 'gradebook',
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
