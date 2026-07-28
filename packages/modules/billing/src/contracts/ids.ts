export type OpaqueId<T extends string> = string & { readonly __brand: T };

export type BillingAccountId = OpaqueId<'billing-account'>;
export type FeeCatalogId = OpaqueId<'fee-catalog'>;
export type FeeScheduleId = OpaqueId<'fee-schedule'>;
export type FeeAssignmentId = OpaqueId<'fee-assignment'>;
export type InvoiceId = OpaqueId<'invoice'>;
export type InvoiceLineId = OpaqueId<'invoice-line'>;
export type InstalmentId = OpaqueId<'instalment'>;
export type PaymentIntentId = OpaqueId<'payment-intent'>;
export type PaymentRecordId = OpaqueId<'payment-record'>;
export type ReceiptId = OpaqueId<'receipt'>;
export type AllocationId = OpaqueId<'allocation'>;
export type CreditNoteId = OpaqueId<'credit-note'>;
export type RefundId = OpaqueId<'refund'>;
export type DiscountId = OpaqueId<'discount'>;
export type ScholarshipId = OpaqueId<'scholarship'>;
export type WaiverId = OpaqueId<'waiver'>;
export type TaxRuleId = OpaqueId<'tax-rule'>;
export type StatementId = OpaqueId<'statement'>;
export type SourceDocumentId = OpaqueId<'source-document'>;
export type NumberingSequenceId = OpaqueId<'numbering-sequence'>;
export type NumberingSequenceAssignmentId = OpaqueId<'numbering-sequence-assignment'>;
export type JournalBatchId = OpaqueId<'journal-batch'>;
export type JournalEntryId = OpaqueId<'journal-entry'>;
export type JournalLineId = OpaqueId<'journal-line'>;
export type AccountId = OpaqueId<'account'>;
export type DimensionId = OpaqueId<'dimension'>;
export type FiscalYearId = OpaqueId<'fiscal-year'>;
export type FiscalPeriodId = OpaqueId<'fiscal-period'>;
export type PostingRuleVersionId = OpaqueId<'posting-rule-version'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createId<T extends string>(prefix: T, uuid: string): OpaqueId<T> {
  if (!UUID_PATTERN.test(uuid)) throw new Error(`Invalid UUID: ${uuid}`);
  return `${prefix}_${uuid}` as OpaqueId<T>;
}

export function parseId<T extends string>(id: OpaqueId<T>): { prefix: T; uuid: string } {
  const separator = id.indexOf('_');
  if (separator < 1) throw new Error(`Invalid ID format: ${id}`);
  const prefix = id.slice(0, separator) as T;
  const uuid = id.slice(separator + 1);
  if (!UUID_PATTERN.test(uuid)) throw new Error(`Invalid UUID in ID: ${id}`);
  return { prefix, uuid };
}

export function formatId<T extends string>(id: OpaqueId<T>): string {
  return id;
}

export function isValidId<T extends string>(id: string, prefix: T): id is OpaqueId<T> {
  return id.startsWith(`${prefix}_`) && UUID_PATTERN.test(id.slice(prefix.length + 1));
}
