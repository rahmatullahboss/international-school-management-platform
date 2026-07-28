/**
 * Fiscal Period Contracts
 * 
 * Fiscal years, periods, open/close status with authorization controls.
 */

export type FiscalPeriodStatus = 'open' | 'closed' | 'closing' | 'reopening';

export interface FiscalYear {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly name: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FiscalPeriod {
  readonly id: string;
  readonly fiscalYearId: string;
  readonly periodNumber: number;
  readonly name: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly status: FiscalPeriodStatus;
  readonly closedAt: Date | null;
  readonly closedBy: string | null;
  readonly reopenedAt: Date | null;
  readonly reopenedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FiscalPeriodTransition {
  readonly periodId: string;
  readonly fromStatus: FiscalPeriodStatus;
  readonly toStatus: FiscalPeriodStatus;
  readonly authorizedBy: string;
  readonly authorizedAt: Date;
  readonly reason: string;
}

export const VALID_PERIOD_TRANSITIONS: ReadonlyMap<FiscalPeriodStatus, readonly FiscalPeriodStatus[]> = new Map([
  ['open', ['closing', 'closed']],
  ['closing', ['closed']],
  ['closed', ['reopening']],
  ['reopening', ['open']],
]);

export function canTransitionPeriod(
  currentStatus: FiscalPeriodStatus,
  targetStatus: FiscalPeriodStatus
): boolean {
  const allowed = VALID_PERIOD_TRANSITIONS.get(currentStatus) ?? [];
  return allowed.includes(targetStatus);
}

export function validatePeriodTransition(
  period: FiscalPeriod,
  targetStatus: FiscalPeriodStatus,
  authorizedBy: string,
  reason: string
): { isValid: boolean; errors: readonly string[] } {
  const errors: string[] = [];
  
  if (!canTransitionPeriod(period.status, targetStatus)) {
    errors.push(`Cannot transition from ${period.status} to ${targetStatus}`);
  }
  
  if (!authorizedBy || authorizedBy.trim().length === 0) {
    errors.push('Authorizing principal is required');
  }

  if (!reason || reason.trim().length === 0) {
    errors.push('Transition reason is required');
  }
  
  if (targetStatus === 'closed' && period.status !== 'closing') {
    errors.push('Period must be in closing status before closing');
  }
  
  if (targetStatus === 'open' && period.status !== 'reopening') {
    errors.push('Period must be in reopening status before reopening');
  }
  
  return {
    isValid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

export function getCurrentPeriod(periods: readonly FiscalPeriod[], date: Date = new Date()): FiscalPeriod | null {
  return periods.find(p => p.startDate <= date && p.endDate >= date) ?? null;
}

export function getPeriodsForYear(periods: readonly FiscalPeriod[], fiscalYearId: string): FiscalPeriod[] {
  return periods
    .filter(p => p.fiscalYearId === fiscalYearId)
    .sort((a, b) => a.periodNumber - b.periodNumber);
}