export type PostingRuleTrigger =
  | 'invoice-posted'
  | 'invoice-voided'
  | 'credit-note-posted'
  | 'payment-received'
  | 'payment-refunded'
  | 'allocation-created'
  | 'allocation-reversed'
  | 'cashier-deposit-recorded'
  | 'manual-journal';

export interface PostingCondition {
  readonly field: string;
  readonly operator: 'equals' | 'not-equals' | 'in' | 'greater-than' | 'less-than';
  readonly value: string | number | boolean | readonly (string | number | boolean)[];
}

export interface PostingRuleLine {
  readonly lineNumber: number;
  readonly accountId: string;
  readonly side: 'debit' | 'credit';
  readonly amountExpression: string;
  readonly dimensionExpressions: ReadonlyMap<string, string>;
  readonly descriptionTemplate: string;
}

export interface PostingRule {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly trigger: PostingRuleTrigger;
  readonly conditions: readonly PostingCondition[];
  readonly lines: readonly PostingRuleLine[];
  readonly active: boolean;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface PostingRuleVersion {
  readonly ruleId: string;
  readonly version: number;
  readonly rule: PostingRule;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly changeDescription: string;
}

function scalar(value: unknown): string | number | boolean | undefined {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : undefined;
}

export function evaluateConditions(
  conditions: readonly PostingCondition[],
  context: Readonly<Record<string, unknown>>,
): boolean {
  return conditions.every((condition) => {
    const actual = scalar(context[condition.field]);
    if (actual === undefined) return false;
    const expected = Array.isArray(condition.value) ? condition.value : [condition.value];
    switch (condition.operator) {
      case 'equals':
        return expected.includes(actual);
      case 'not-equals':
        return !expected.includes(actual);
      case 'in':
        return expected.includes(actual);
      case 'greater-than':
        return (
          typeof actual === 'number' &&
          expected.every((value) => typeof value === 'number' && actual > value)
        );
      case 'less-than':
        return (
          typeof actual === 'number' &&
          expected.every((value) => typeof value === 'number' && actual < value)
        );
    }
  });
}

export function calculateLineAmount(
  expression: string,
  context: Readonly<Record<string, unknown>>,
): number {
  const trimmed = expression.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    const value = context[trimmed];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(`Unknown numeric variable: ${trimmed}`);
    return value;
  }
  const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*([*/])\s*(-?\d+(?:\.\d+)?)$/.exec(trimmed);
  if (!match) throw new Error(`Failed to evaluate amount expression: ${expression}`);
  const [, variableName, operator, operandText] = match;
  const value = variableName === undefined ? undefined : context[variableName];
  const operand = operandText === undefined ? Number.NaN : Number(operandText);
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isFinite(operand) ||
    (operator === '/' && operand === 0)
  ) {
    throw new Error(`Failed to evaluate amount expression: ${expression}`);
  }
  return operator === '*' ? value * operand : value / operand;
}

export function validatePostingRule(rule: PostingRule): {
  isValid: boolean;
  errors: readonly string[];
} {
  const errors: string[] = [];
  if (rule.version < 1 || !Number.isInteger(rule.version))
    errors.push('Posting rule version must be a positive integer');
  if (rule.lines.length < 2) errors.push('Posting rule must contain at least two lines');
  if (!rule.lines.some((line) => line.side === 'debit'))
    errors.push('Posting rule requires a debit line');
  if (!rule.lines.some((line) => line.side === 'credit'))
    errors.push('Posting rule requires a credit line');
  if (new Set(rule.lines.map((line) => line.lineNumber)).size !== rule.lines.length)
    errors.push('Posting rule line numbers must be unique');
  return Object.freeze({ isValid: errors.length === 0, errors: Object.freeze(errors) });
}
