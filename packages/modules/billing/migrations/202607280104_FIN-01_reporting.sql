CREATE OR REPLACE VIEW billing.receivable_subledger_v
WITH (security_invoker = true)
AS
SELECT
  invoice.tenant_id,
  invoice.legal_entity_id,
  invoice.billing_account_id,
  invoice.invoice_id,
  invoice.invoice_number,
  invoice.issue_date,
  invoice.due_date,
  invoice.currency,
  invoice.total_minor,
  COALESCE(credit.credited_minor, 0)::bigint AS credited_minor,
  COALESCE(allocation.allocated_minor, 0)::bigint AS allocated_minor,
  GREATEST(
    invoice.total_minor - COALESCE(credit.credited_minor, 0) - COALESCE(allocation.allocated_minor, 0),
    0
  )::bigint AS outstanding_minor
FROM billing.invoice AS invoice
LEFT JOIN LATERAL (
  SELECT COALESCE(sum(note.total_minor), 0)::bigint AS credited_minor
  FROM billing.credit_note AS note
  WHERE note.tenant_id = invoice.tenant_id
    AND note.legal_entity_id = invoice.legal_entity_id
    AND note.invoice_id = invoice.invoice_id
    AND note.status = 'posted'
) AS credit ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(sum(item.amount_minor), 0)::bigint AS allocated_minor
  FROM billing.payment_allocation AS item
  WHERE item.tenant_id = invoice.tenant_id
    AND item.legal_entity_id = invoice.legal_entity_id
    AND item.invoice_id = invoice.invoice_id
    AND item.reversed_at IS NULL
) AS allocation ON true
WHERE invoice.status IN ('posted', 'partially-paid', 'paid', 'credited');

CREATE OR REPLACE VIEW billing.unapplied_cash_v
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  legal_entity_id,
  billing_account_id,
  payment_id,
  receipt_number,
  received_at,
  currency,
  amount_minor,
  allocated_minor,
  refunded_minor,
  unapplied_minor,
  status
FROM billing.payment_record
WHERE unapplied_minor > 0
  AND status IN ('settled', 'partially-refunded');

CREATE OR REPLACE VIEW ledger.trial_balance_v
WITH (security_invoker = true)
AS
SELECT
  account.tenant_id,
  account.legal_entity_id,
  account.book_id,
  account.account_id,
  account.account_code,
  account.account_name,
  account.account_type,
  account.natural_balance,
  line.currency,
  COALESCE(sum(line.amount_minor) FILTER (WHERE line.side = 'debit'), 0)::bigint AS debit_minor,
  COALESCE(sum(line.amount_minor) FILTER (WHERE line.side = 'credit'), 0)::bigint AS credit_minor,
  CASE
    WHEN account.natural_balance = 'debit' THEN
      COALESCE(sum(line.amount_minor) FILTER (WHERE line.side = 'debit'), 0)
      - COALESCE(sum(line.amount_minor) FILTER (WHERE line.side = 'credit'), 0)
    ELSE
      COALESCE(sum(line.amount_minor) FILTER (WHERE line.side = 'credit'), 0)
      - COALESCE(sum(line.amount_minor) FILTER (WHERE line.side = 'debit'), 0)
  END::bigint AS balance_minor
FROM ledger.account AS account
JOIN ledger.journal_line AS line
  ON line.tenant_id = account.tenant_id
 AND line.legal_entity_id = account.legal_entity_id
 AND line.account_id = account.account_id
JOIN ledger.journal_entry AS entry
  ON entry.tenant_id = line.tenant_id
 AND entry.legal_entity_id = line.legal_entity_id
 AND entry.journal_entry_id = line.journal_entry_id
WHERE entry.status = 'posted'
GROUP BY
  account.tenant_id,
  account.legal_entity_id,
  account.book_id,
  account.account_id,
  account.account_code,
  account.account_name,
  account.account_type,
  account.natural_balance,
  line.currency;

CREATE OR REPLACE VIEW ledger.general_ledger_v
WITH (security_invoker = true)
AS
SELECT
  entry.tenant_id,
  entry.legal_entity_id,
  entry.book_id,
  entry.fiscal_period_id,
  entry.journal_entry_id,
  entry.entry_number,
  entry.entry_date,
  entry.source_document_type,
  entry.source_document_id,
  entry.correlation_id,
  line.journal_line_id,
  line.line_number,
  line.account_id,
  line.side,
  line.amount_minor,
  line.currency,
  COALESCE(line.description, entry.description) AS description,
  line.dimensions
FROM ledger.journal_entry AS entry
JOIN ledger.journal_line AS line
  ON line.tenant_id = entry.tenant_id
 AND line.legal_entity_id = entry.legal_entity_id
 AND line.journal_entry_id = entry.journal_entry_id
WHERE entry.status = 'posted';

GRANT SELECT ON billing.receivable_subledger_v TO app_runtime;
GRANT SELECT ON billing.unapplied_cash_v TO app_runtime;
GRANT SELECT ON ledger.trial_balance_v TO app_runtime;
GRANT SELECT ON ledger.general_ledger_v TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280104_FIN-01_reporting', 'FIN-01', 'Security-invoker finance reconciliation and reporting views')
ON CONFLICT (migration_id) DO NOTHING;
