import type { CurrencyCode, MinorUnit } from './money.js';

export type SourceDocumentType = 'fee-assignment' | 'invoice' | 'credit-note' | 'payment' | 'refund' | 'cashier-deposit' | 'manual-journal';
export type SourceDocumentState = 'draft' | 'pending-approval' | 'posted' | 'voided' | 'reversed';

export interface SourceDocumentRef {
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly documentType: SourceDocumentType;
  readonly documentId: string;
  readonly documentNumber: string;
  readonly state: SourceDocumentState;
  readonly currency: CurrencyCode;
  readonly totalMinor: MinorUnit;
  readonly idempotencyKey: string;
}

export interface SourceDocumentTrace {
  readonly source: SourceDocumentRef;
  readonly journalEntryIds: readonly string[];
  readonly causationId: string | null;
  readonly correlationId: string;
}

export type FinanceErrorCode =
  | 'FIN_FORBIDDEN' | 'FIN_SCOPE_MISMATCH' | 'FIN_STEP_UP_REQUIRED' | 'FIN_SOD_VIOLATION'
  | 'FIN_CURRENCY_MISMATCH' | 'FIN_INVALID_AMOUNT' | 'FIN_UNBALANCED_JOURNAL' | 'FIN_PERIOD_CLOSED'
  | 'FIN_DUPLICATE_COMMAND' | 'FIN_INVALID_STATE' | 'FIN_REFUND_EXCEEDS_AVAILABLE' | 'FIN_NOT_FOUND';

export interface FinanceError {
  readonly code: FinanceErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export function isFinanceError(value: unknown): value is FinanceError {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value && 'retryable' in value;
}

export type FinanceEventName =
  | 'finance.invoice.posted.v1' | 'finance.credit-note.posted.v1' | 'finance.payment.received.v1'
  | 'finance.payment.allocated.v1' | 'finance.refund.approved.v1' | 'finance.journal.posted.v1'
  | 'finance.journal.reversed.v1' | 'finance.fiscal-period.closed.v1' | 'finance.bank-reconciliation.completed.v1';

export interface EventEnvelope<TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  readonly eventId: string;
  readonly eventName: FinanceEventName;
  readonly eventVersion: 1;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAt: string;
  readonly producer: 'billing' | 'ledger';
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly idempotencyKey: string;
  readonly classification: 'internal' | 'confidential' | 'restricted';
  readonly payload: TPayload;
}
