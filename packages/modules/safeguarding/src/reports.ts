import type {
  MandatoryReport,
  SafeguardingCaseFile,
  SafeguardingClosureReview,
  SafeguardingConcern,
} from './domain.js';

export interface SafeguardingReportInput {
  tenantId: string;
  concerns: readonly SafeguardingConcern[];
  cases: readonly SafeguardingCaseFile[];
  mandatoryReports: readonly MandatoryReport[];
  closureReviews: readonly SafeguardingClosureReview[];
  from: Date;
  to: Date;
  minimumCohortSize?: number;
}

export interface SafeguardingSuppressedCount {
  value: number | null;
  suppressed: boolean;
}

export interface SafeguardingOperationalReport {
  tenantId: string;
  from: Date;
  to: Date;
  concernsReceived: SafeguardingSuppressedCount;
  immediateConcerns: SafeguardingSuppressedCount;
  openCases: SafeguardingSuppressedCount;
  criticalCases: SafeguardingSuppressedCount;
  mandatoryReportsSubmitted: SafeguardingSuppressedCount;
  casesClosed: SafeguardingSuppressedCount;
}

function safeCount(value: number, minimum: number): SafeguardingSuppressedCount {
  return value === 0 || value >= minimum
    ? { value, suppressed: false }
    : { value: null, suppressed: true };
}

export function buildSafeguardingOperationalReport(
  input: SafeguardingReportInput,
): SafeguardingOperationalReport {
  if (input.to < input.from) throw new Error('Report end must not precede start');
  const minimum = input.minimumCohortSize ?? 10;
  if (minimum < 10) throw new Error('Safeguarding minimum cohort size must be at least 10');

  const concerns = input.concerns.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      item.reportedAt >= input.from &&
      item.reportedAt <= input.to,
  );
  const cases = input.cases.filter(
    (item) => item.tenantId === input.tenantId && item.openedAt <= input.to,
  );
  const reports = input.mandatoryReports.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      item.createdAt >= input.from &&
      item.createdAt <= input.to,
  );
  const closures = input.closureReviews.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      item.reviewedAt >= input.from &&
      item.reviewedAt <= input.to,
  );

  return {
    tenantId: input.tenantId,
    from: input.from,
    to: input.to,
    concernsReceived: safeCount(concerns.length, minimum),
    immediateConcerns: safeCount(
      concerns.filter((item) => item.urgency === 'immediate').length,
      minimum,
    ),
    openCases: safeCount(
      cases.filter((item) => item.status === 'open' || item.status === 'monitoring').length,
      minimum,
    ),
    criticalCases: safeCount(
      cases.filter((item) => item.riskBand === 'critical' && item.status !== 'closed').length,
      minimum,
    ),
    mandatoryReportsSubmitted: safeCount(
      reports.filter((item) => item.status === 'submitted' || item.status === 'acknowledged')
        .length,
      minimum,
    ),
    casesClosed: safeCount(closures.filter((item) => item.outcome === 'close').length, minimum),
  };
}
