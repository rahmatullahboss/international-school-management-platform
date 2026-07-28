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

export interface SequenceAllocation {
  readonly sequenceId: string;
  readonly allocatedValue: number;
  readonly formatted: string;
  readonly idempotencyKey: string;
}

export function createNumberingPolicy(sequences: readonly NumberingSequence[], rules: readonly NumberingRule[]): NumberingPolicy {
  const sequenceIds = new Set(sequences.map((sequence) => sequence.sequenceId));
  if (sequenceIds.size !== sequences.length) throw new Error('Numbering sequence IDs must be unique');
  if (rules.some((rule) => !sequenceIds.has(rule.sequenceId))) throw new Error('Numbering rule references an unknown sequence');
  return Object.freeze({ sequences: Object.freeze([...sequences]), rules: Object.freeze([...rules]) });
}

export function allocateSequenceNumber(policy: NumberingPolicy, documentType: string, idempotencyKey: string): SequenceAllocation {
  if (idempotencyKey.trim().length < 8) throw new Error('Idempotency key must contain at least 8 characters');
  const rule = [...policy.rules].filter((candidate) => candidate.documentType === documentType)
    .sort((left, right) => right.priority - left.priority)[0];
  if (!rule) throw new Error(`No numbering rule for document type: ${documentType}`);
  const sequence = policy.sequences.find((candidate) => candidate.sequenceId === rule.sequenceId);
  if (!sequence) throw new Error(`Sequence not found: ${rule.sequenceId}`);
  if (!Number.isSafeInteger(sequence.nextValue) || sequence.nextValue < 1) throw new Error('Sequence next value must be a positive safe integer');
  return Object.freeze({
    sequenceId: sequence.sequenceId,
    allocatedValue: sequence.nextValue,
    formatted: `${sequence.prefix}${String(sequence.nextValue).padStart(sequence.minLength, '0')}${sequence.suffix}`,
    idempotencyKey,
  });
}
