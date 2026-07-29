import type {
  CounsellingCase,
  PastoralReferral,
  WellbeingPlanReview,
  WellbeingRiskAssessment,
} from './domain.js';

export interface WellbeingReportInput {
  tenantId: string;
  referrals: readonly PastoralReferral[];
  cases: readonly CounsellingCase[];
  riskAssessments: readonly WellbeingRiskAssessment[];
  planReviews: readonly WellbeingPlanReview[];
  from: Date;
  to: Date;
  minimumCohortSize?: number;
}

export interface WellbeingSuppressedCount {
  value: number | null;
  suppressed: boolean;
}

export interface WellbeingOperationalReport {
  tenantId: string;
  from: Date;
  to: Date;
  referrals: WellbeingSuppressedCount;
  urgentReferrals: WellbeingSuppressedCount;
  openCases: WellbeingSuppressedCount;
  highOrImmediateRisk: WellbeingSuppressedCount;
  escalatedReviews: WellbeingSuppressedCount;
}

function safeCount(value: number, minimum: number): WellbeingSuppressedCount {
  return value === 0 || value >= minimum
    ? { value, suppressed: false }
    : { value: null, suppressed: true };
}

export function buildWellbeingOperationalReport(
  input: WellbeingReportInput,
): WellbeingOperationalReport {
  if (input.to < input.from) throw new Error('Report end must not precede start');
  const minimum = input.minimumCohortSize ?? 5;
  if (minimum < 3) throw new Error('Minimum cohort size must be at least 3');
  const referrals = input.referrals.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      item.createdAt >= input.from &&
      item.createdAt <= input.to,
  );
  const cases = input.cases.filter(
    (item) => item.tenantId === input.tenantId && item.openedAt <= input.to,
  );
  const riskAssessments = input.riskAssessments.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      item.assessedAt >= input.from &&
      item.assessedAt <= input.to,
  );
  const reviews = input.planReviews.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      item.reviewedAt >= input.from &&
      item.reviewedAt <= input.to,
  );
  return {
    tenantId: input.tenantId,
    from: input.from,
    to: input.to,
    referrals: safeCount(referrals.length, minimum),
    urgentReferrals: safeCount(
      referrals.filter((item) => item.urgency === 'urgent').length,
      minimum,
    ),
    openCases: safeCount(cases.filter((item) => item.status === 'open').length, minimum),
    highOrImmediateRisk: safeCount(
      riskAssessments.filter((item) => item.riskLevel === 'high' || item.riskLevel === 'immediate')
        .length,
      minimum,
    ),
    escalatedReviews: safeCount(
      reviews.filter((item) => item.outcomeCode === 'escalate').length,
      minimum,
    ),
  };
}
