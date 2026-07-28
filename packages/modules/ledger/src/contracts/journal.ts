export type JournalEntryStatus = 'draft' | 'posted' | 'reversed';
export type JournalLineSide = 'debit' | 'credit';

export interface JournalBatch {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly bookId: string;
  readonly fiscalPeriodId: string;
  readonly description: string;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface JournalEntry {
  readonly id: string;
  readonly batchId: string;
  readonly entryNumber: number;
  readonly description: string;
  readonly reference: string | null;
  readonly entryDate: Date;
  readonly status: JournalEntryStatus;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly postedAt: Date | null;
  readonly postedBy: string | null;
  readonly reversedAt: Date | null;
  readonly reversedBy: string | null;
  readonly reversalReason: string | null;
  readonly sourceDocumentId: string | null;
  readonly sourceDocumentType: string | null;
  readonly idempotencyKey?: string;
}

export interface JournalLine {
  readonly id: string;
  readonly entryId: string;
  readonly lineNumber: number;
  readonly accountId: string;
  readonly side: JournalLineSide;
  readonly amount: number;
  readonly currency: string;
  readonly description: string | null;
  readonly dimensionValues: ReadonlyMap<string, string>;
  readonly createdAt: Date;
}

export interface BalancedJournalEntry extends JournalEntry {
  readonly lines: readonly JournalLine[];
  readonly totalDebits: number;
  readonly totalCredits: number;
  readonly isBalanced: true;
}

export interface JournalValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

export function calculateTotals(lines: readonly JournalLine[]): { debits: number; credits: number } {
  return lines.reduce((totals, line) => {
    if (line.side === 'debit') totals.debits += line.amount;
    else totals.credits += line.amount;
    return totals;
  }, { debits: 0, credits: 0 });
}

export function validateJournalEntry(_entry: JournalEntry, lines: readonly JournalLine[]): JournalValidationResult {
  const errors: string[] = [];
  if (lines.length < 2) errors.push('Journal entry must have at least 2 lines');
  const currencies = new Set<string>();
  const lineNumbers = new Set<number>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.amount) || line.amount <= 0) errors.push(`Line ${line.lineNumber}: amount must be a positive safe integer`);
    if (lineNumbers.has(line.lineNumber)) errors.push(`Duplicate line number: ${line.lineNumber}`);
    lineNumbers.add(line.lineNumber);
    currencies.add(line.currency);
  }
  if (currencies.size > 1) errors.push('Journal entry lines must use one currency');
  const totals = calculateTotals(lines);
  if (totals.debits !== totals.credits) errors.push(`Entry is not balanced: debits=${totals.debits}, credits=${totals.credits}`);
  return Object.freeze({ isValid: errors.length === 0, errors: Object.freeze(errors) });
}

export function isBalanced(lines: readonly JournalLine[]): boolean {
  const totals = calculateTotals(lines);
  return lines.length >= 2 && totals.debits === totals.credits && lines.every((line) => Number.isSafeInteger(line.amount) && line.amount > 0);
}

export function createReversalEntry(original: JournalEntry, lines: readonly JournalLine[], reversedBy: string, reason: string, now = new Date()): { entry: JournalEntry; lines: readonly JournalLine[] } {
  if (original.status !== 'posted') throw new Error('Only posted entries may be reversed');
  if (reason.trim().length < 3) throw new Error('Reversal reason is required');
  const reversalId = crypto.randomUUID();
  const reversal: JournalEntry = Object.freeze({
    ...original,
    id: reversalId,
    description: `Reversal: ${original.description}`,
    reference: original.id,
    entryDate: now,
    status: 'posted',
    createdBy: reversedBy,
    createdAt: now,
    postedAt: now,
    postedBy: reversedBy,
    reversedAt: null,
    reversedBy: null,
    reversalReason: reason,
    sourceDocumentId: original.id,
    sourceDocumentType: 'journal-reversal',
    idempotencyKey: `reversal:${original.id}`,
  });
  const reversalLines = lines.map((line, index) => Object.freeze({
    ...line,
    id: crypto.randomUUID(),
    entryId: reversalId,
    lineNumber: index + 1,
    side: line.side === 'debit' ? 'credit' as const : 'debit' as const,
    description: `Reversal of line ${line.lineNumber}`,
    createdAt: now,
  }));
  return Object.freeze({ entry: reversal, lines: Object.freeze(reversalLines) });
}
