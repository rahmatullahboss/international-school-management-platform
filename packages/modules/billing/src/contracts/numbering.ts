export type NumberingScope = 'tenant' | 'legal-entity' | 'campus';
export type NumberingResetFrequency = 'never' | 'daily' | 'monthly' | 'annually' | 'fiscal-year';

export interface NumberingSequence {
  readonly sequenceId: string;
  readonly scope: NumberingScope;
  readonly scopeRef: string;
  readonly prefix: string;
  readonly suffix: string;
  readonly minLength: number;
  readonly nextValue: number;
  readonly resetFrequency: NumberingResetFrequency;
}

export interface NumberingRule {
  readonly ruleId: string;
  readonly documentType: string;
  readonly sequenceId: string;
  readonly priority: number;
}

export interface NumberingPolicy {
  readonly sequences: readonly NumberingSequence[];
  readonly rules: readonly NumberingRule[];
}

export interface NumberingContext {
  readonly tenantId: string;
  readonly legalEntityId?: string;
  readonly campusId?: string;
  readonly date?: Date;
}

export interface SequenceAllocation {
  readonly sequenceId: string;
  readonly allocatedValue: number;
  readonly formatted: string;
  readonly idempotencyKey: string;
}

export function createNumberingPolicy(
  sequences: readonly NumberingSequence[],
  rules: readonly NumberingRule[],
): NumberingPolicy {
  const sequenceIds = new Set(sequences.map((sequence) => sequence.sequenceId));
  if (sequenceIds.size !== sequences.length)
    throw new Error('Numbering sequence IDs must be unique');
  if (rules.some((rule) => !sequenceIds.has(rule.sequenceId)))
    throw new Error('Numbering rule references an unknown sequence');
  return Object.freeze({
    sequences: Object.freeze([...sequences]),
    rules: Object.freeze([...rules]),
  });
}

export function createDefaultInvoiceNumberingPolicy(tenantId: string): NumberingPolicy {
  if (tenantId.trim().length === 0) throw new Error('Tenant reference is required');
  return createNumberingPolicy(
    [
      {
        sequenceId: `invoice:${tenantId}`,
        scope: 'tenant',
        scopeRef: tenantId,
        prefix: 'INV-',
        suffix: '',
        minLength: 6,
        nextValue: 1,
        resetFrequency: 'never',
      },
    ],
    [
      {
        ruleId: `invoice:${tenantId}`,
        documentType: 'invoice',
        sequenceId: `invoice:${tenantId}`,
        priority: 100,
      },
    ],
  );
}

export function allocateSequenceNumber(
  policy: NumberingPolicy,
  documentType: string,
  idempotencyKey: string,
): SequenceAllocation;
export function allocateSequenceNumber(
  policy: NumberingPolicy,
  documentType: string,
  context: NumberingContext,
  idempotencyKey: string,
): SequenceAllocation;
export function allocateSequenceNumber(
  policy: NumberingPolicy,
  documentType: string,
  contextOrIdempotencyKey: NumberingContext | string,
  maybeIdempotencyKey?: string,
): SequenceAllocation {
  const idempotencyKey =
    typeof contextOrIdempotencyKey === 'string' ? contextOrIdempotencyKey : maybeIdempotencyKey;
  const context = typeof contextOrIdempotencyKey === 'string' ? undefined : contextOrIdempotencyKey;
  const rule = [...policy.rules]
    .filter((candidate) => candidate.documentType === documentType)
    .sort((left, right) => right.priority - left.priority)[0];
  if (!rule) throw new Error(`No numbering rule for document type: ${documentType}`);
  if (idempotencyKey === undefined || idempotencyKey.trim().length < 8)
    throw new Error('Idempotency key must contain at least 8 characters');
  const sequence = policy.sequences.find((candidate) => candidate.sequenceId === rule.sequenceId);
  if (!sequence) throw new Error(`Sequence not found: ${rule.sequenceId}`);
  if (context !== undefined) {
    if (sequence.scope === 'tenant' && context.tenantId !== sequence.scopeRef)
      throw new Error('Numbering scope mismatch');
    if (sequence.scope === 'legal-entity' && context.legalEntityId !== sequence.scopeRef)
      throw new Error('Numbering scope mismatch');
    if (sequence.scope === 'campus' && context.campusId !== sequence.scopeRef)
      throw new Error('Numbering scope mismatch');
  }
  if (!Number.isSafeInteger(sequence.nextValue) || sequence.nextValue < 1)
    throw new Error('Sequence next value must be a positive safe integer');
  return Object.freeze({
    sequenceId: sequence.sequenceId,
    allocatedValue: sequence.nextValue,
    formatted: `${sequence.prefix}${String(sequence.nextValue).padStart(sequence.minLength, '0')}${sequence.suffix}`,
    idempotencyKey,
  });
}
