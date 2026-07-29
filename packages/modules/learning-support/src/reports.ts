import type {
  LearningSupportPlan,
  LearningSupportPlanReview,
  LearningSupportReferral,
} from './domain.js';

export interface LearningSupportReportInput {
  tenantId: string;
  referrals: readonly LearningSupportReferral[];
  plans: readonly LearningSupportPlan[];
  reviews: readonly LearningSupportPlanReview[];
  from: Date;
  to: Date;
  minimumCohortSize?: number;
}

export interface LearningSupportSuppressedCount {
  value: number | null;
  suppressed: boolean;
}

export interface LearningSupportOperationalReport {
  tenantId: string;
  from: Date;
  to: Date;
  referrals: LearningSupportSuppressedCount;
  urgentReferrals: LearningSupportSuppressedCount;
  activePlans: LearningSupportSuppressedCount;
  overdueReviews: LearningSupportSuppressedCount;
  escalatedReviews: LearningSupportSuppressedCount;
}

function safeCount(value: number, minimum: number): LearningSupportSuppressedCount {
  return value === 0 || value >= minimum
    ? { value, suppressed: false }
    : { value: null, suppressed: true };
}

export function buildLearningSupportOperationalReport(
  input: LearningSupportReportInput,
): LearningSupportOperationalReport {
  if (input.to < input.from) throw new Error('Report end must not precede start');
  const minimum = input.minimumCohortSize ?? 5;
  if (minimum < 3) throw new Error('Minimum cohort size must be at least 3');

  const referrals = input.referrals.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      item.createdAt >= input.from &&
      item.createdAt <= input.to,
  );
  const plans = input.plans.filter(
    (item) => item.tenantId === input.tenantId && item.createdAt <= input.to,
  );
  const reviews = input.reviews.filter(
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
      referrals.filter((item) => item.priority === 'urgent').length,
      minimum,
    ),
    activePlans: safeCount(plans.filter((item) => item.status === 'active').length, minimum),
    overdueReviews: safeCount(
      plans.filter((item) => item.status === 'active' && item.reviewAt < input.to).length,
      minimum,
    ),
    escalatedReviews: safeCount(
      reviews.filter((item) => item.outcomeCode === 'escalate').length,
      minimum,
    ),
  };
}
