CREATE TABLE IF NOT EXISTS billing.payment_intent (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  payment_intent_id uuid NOT NULL DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider text NOT NULL,
  provider_intent_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'cancelled', 'expired')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  PRIMARY KEY (tenant_id, legal_entity_id, payment_intent_id),
  UNIQUE (tenant_id, legal_entity_id, idempotency_key),
  UNIQUE (tenant_id, legal_entity_id, provider, provider_intent_id),
  FOREIGN KEY (tenant_id, legal_entity_id, billing_account_id)
    REFERENCES billing.billing_account (tenant_id, legal_entity_id, billing_account_id),
  CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS billing.provider_event (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('payment.settled', 'payment.failed', 'payment.reversed')),
  provider_payment_id text NOT NULL,
  payment_intent_id uuid NOT NULL,
  payload_hash text NOT NULL,
  signature_verified boolean NOT NULL,
  occurred_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  processing_result text NOT NULL CHECK (processing_result IN ('settled', 'failed', 'reversed', 'duplicate')),
  PRIMARY KEY (tenant_id, legal_entity_id, provider, provider_event_id),
  FOREIGN KEY (tenant_id, legal_entity_id, payment_intent_id)
    REFERENCES billing.payment_intent (tenant_id, legal_entity_id, payment_intent_id)
);

CREATE TABLE IF NOT EXISTS billing.cashier_session (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  cashier_session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  cashier_id text NOT NULL,
  opened_by text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_float_minor bigint NOT NULL CHECK (opening_float_minor >= 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'deposited')),
  expected_cash_minor bigint NOT NULL CHECK (expected_cash_minor >= 0),
  counted_cash_minor bigint CHECK (counted_cash_minor >= 0),
  variance_minor bigint,
  closed_by text,
  closed_at timestamptz,
  PRIMARY KEY (tenant_id, legal_entity_id, cashier_session_id),
  CHECK (
    (status = 'open' AND counted_cash_minor IS NULL AND variance_minor IS NULL AND closed_by IS NULL AND closed_at IS NULL) OR
    (status IN ('closed', 'deposited') AND counted_cash_minor IS NOT NULL AND variance_minor = counted_cash_minor - expected_cash_minor AND closed_by IS NOT NULL AND closed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_one_open_cashier_session_idx
  ON billing.cashier_session (tenant_id, legal_entity_id, cashier_id)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS billing.payment_record (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  payment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL,
  payment_intent_id uuid NOT NULL,
  provider text NOT NULL,
  provider_payment_id text NOT NULL,
  provider_event_id text NOT NULL,
  receipt_number text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('settled', 'partially-refunded', 'refunded', 'reversed')),
  allocated_minor bigint NOT NULL DEFAULT 0 CHECK (allocated_minor >= 0),
  refunded_minor bigint NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
  unapplied_minor bigint NOT NULL CHECK (unapplied_minor >= 0),
  received_at timestamptz NOT NULL,
  verified_by text NOT NULL,
  journal_entry_id uuid NOT NULL,
  cashier_session_id uuid,
  PRIMARY KEY (tenant_id, legal_entity_id, payment_id),
  UNIQUE (tenant_id, legal_entity_id, provider, provider_payment_id),
  UNIQUE (tenant_id, legal_entity_id, receipt_number),
  FOREIGN KEY (tenant_id, legal_entity_id, billing_account_id)
    REFERENCES billing.billing_account (tenant_id, legal_entity_id, billing_account_id),
  FOREIGN KEY (tenant_id, legal_entity_id, payment_intent_id)
    REFERENCES billing.payment_intent (tenant_id, legal_entity_id, payment_intent_id),
  FOREIGN KEY (tenant_id, legal_entity_id, journal_entry_id)
    REFERENCES ledger.journal_entry (tenant_id, legal_entity_id, journal_entry_id),
  FOREIGN KEY (tenant_id, legal_entity_id, cashier_session_id)
    REFERENCES billing.cashier_session (tenant_id, legal_entity_id, cashier_session_id),
  CHECK (allocated_minor + refunded_minor + unapplied_minor = amount_minor)
);

CREATE TABLE IF NOT EXISTS billing.payment_allocation (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  allocation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  allocated_at timestamptz NOT NULL DEFAULT now(),
  allocated_by text NOT NULL,
  reversed_at timestamptz,
  reversed_by text,
  reversal_reason text,
  journal_entry_id uuid NOT NULL,
  reversal_journal_entry_id uuid,
  idempotency_key text NOT NULL,
  PRIMARY KEY (tenant_id, legal_entity_id, allocation_id),
  UNIQUE (tenant_id, legal_entity_id, idempotency_key),
  FOREIGN KEY (tenant_id, legal_entity_id, payment_id)
    REFERENCES billing.payment_record (tenant_id, legal_entity_id, payment_id),
  FOREIGN KEY (tenant_id, legal_entity_id, invoice_id)
    REFERENCES billing.invoice (tenant_id, legal_entity_id, invoice_id),
  FOREIGN KEY (tenant_id, legal_entity_id, journal_entry_id)
    REFERENCES ledger.journal_entry (tenant_id, legal_entity_id, journal_entry_id),
  FOREIGN KEY (tenant_id, legal_entity_id, reversal_journal_entry_id)
    REFERENCES ledger.journal_entry (tenant_id, legal_entity_id, journal_entry_id),
  CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL AND reversal_journal_entry_id IS NULL) OR
    (reversed_at IS NOT NULL AND reversed_by IS NOT NULL AND length(trim(reversal_reason)) >= 8 AND reversal_journal_entry_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS billing.refund (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  refund_id uuid NOT NULL DEFAULT gen_random_uuid(),
  refund_number text NOT NULL,
  payment_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  status text NOT NULL DEFAULT 'pending-approval' CHECK (status IN ('pending-approval', 'approved', 'rejected', 'settled')),
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  settled_at timestamptz,
  journal_entry_id uuid,
  idempotency_key text NOT NULL,
  PRIMARY KEY (tenant_id, legal_entity_id, refund_id),
  UNIQUE (tenant_id, legal_entity_id, refund_number),
  UNIQUE (tenant_id, legal_entity_id, idempotency_key),
  FOREIGN KEY (tenant_id, legal_entity_id, payment_id)
    REFERENCES billing.payment_record (tenant_id, legal_entity_id, payment_id),
  FOREIGN KEY (tenant_id, legal_entity_id, journal_entry_id)
    REFERENCES ledger.journal_entry (tenant_id, legal_entity_id, journal_entry_id),
  CHECK (approved_by IS NULL OR approved_by <> requested_by),
  CHECK (
    (status = 'pending-approval' AND approved_by IS NULL AND approved_at IS NULL AND settled_at IS NULL AND journal_entry_id IS NULL) OR
    (status = 'rejected' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND settled_at IS NULL AND journal_entry_id IS NULL) OR
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND settled_at IS NULL AND journal_entry_id IS NULL) OR
    (status = 'settled' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND settled_at IS NOT NULL AND journal_entry_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS billing.cashier_deposit (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  cashier_deposit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  cashier_session_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  prepared_by text NOT NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  journal_entry_id uuid,
  PRIMARY KEY (tenant_id, legal_entity_id, cashier_deposit_id),
  UNIQUE (tenant_id, legal_entity_id, cashier_session_id),
  FOREIGN KEY (tenant_id, legal_entity_id, cashier_session_id)
    REFERENCES billing.cashier_session (tenant_id, legal_entity_id, cashier_session_id),
  FOREIGN KEY (tenant_id, legal_entity_id, journal_entry_id)
    REFERENCES ledger.journal_entry (tenant_id, legal_entity_id, journal_entry_id),
  CHECK (approved_by IS NULL OR approved_by <> prepared_by),
  CHECK ((approved_at IS NULL AND journal_entry_id IS NULL) OR (approved_at IS NOT NULL AND approved_by IS NOT NULL AND journal_entry_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS billing.bank_statement_line (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  bank_statement_line_id uuid NOT NULL DEFAULT gen_random_uuid(),
  bank_account_ref text NOT NULL,
  statement_ref text NOT NULL,
  line_number integer NOT NULL CHECK (line_number > 0),
  booking_date date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  description text NOT NULL,
  external_reference text,
  import_hash text NOT NULL,
  status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'reconciled', 'ignored')),
  matched_payment_id uuid,
  matched_by text,
  matched_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id, bank_statement_line_id),
  UNIQUE (tenant_id, legal_entity_id, import_hash),
  UNIQUE (tenant_id, legal_entity_id, bank_account_ref, statement_ref, line_number),
  FOREIGN KEY (tenant_id, legal_entity_id, matched_payment_id)
    REFERENCES billing.payment_record (tenant_id, legal_entity_id, payment_id),
  CHECK (
    (status IN ('unmatched', 'ignored') AND matched_payment_id IS NULL AND matched_by IS NULL AND matched_at IS NULL) OR
    (status IN ('matched', 'reconciled') AND matched_payment_id IS NOT NULL AND matched_by IS NOT NULL AND matched_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS billing_payment_account_received_idx
  ON billing.payment_record (tenant_id, legal_entity_id, billing_account_id, received_at DESC);
CREATE INDEX IF NOT EXISTS billing_payment_unapplied_idx
  ON billing.payment_record (tenant_id, legal_entity_id, received_at)
  WHERE unapplied_minor > 0 AND status IN ('settled', 'partially-refunded');
CREATE INDEX IF NOT EXISTS billing_allocation_invoice_idx
  ON billing.payment_allocation (tenant_id, legal_entity_id, invoice_id, allocated_at)
  WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS billing_refund_pending_idx
  ON billing.refund (tenant_id, legal_entity_id, requested_at)
  WHERE status = 'pending-approval';
CREATE INDEX IF NOT EXISTS billing_bank_unmatched_idx
  ON billing.bank_statement_line (tenant_id, legal_entity_id, bank_account_ref, booking_date)
  WHERE status = 'unmatched';

CREATE OR REPLACE FUNCTION billing.prevent_provider_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'FIN_PROVIDER_EVENT_IMMUTABLE' USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS provider_event_append_only ON billing.provider_event;
CREATE TRIGGER provider_event_append_only
  BEFORE UPDATE OR DELETE ON billing.provider_event
  FOR EACH ROW EXECUTE FUNCTION billing.prevent_provider_event_mutation();

CREATE OR REPLACE FUNCTION billing.prevent_settled_payment_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'FIN_PAYMENT_IMMUTABLE' USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS payment_record_no_delete ON billing.payment_record;
CREATE TRIGGER payment_record_no_delete
  BEFORE DELETE ON billing.payment_record
  FOR EACH ROW EXECUTE FUNCTION billing.prevent_settled_payment_delete();

DO $rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'payment_intent','provider_event','cashier_session','payment_record','payment_allocation',
    'refund','cashier_deposit','bank_statement_line'
  ] LOOP
    EXECUTE format('ALTER TABLE billing.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE billing.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON billing.%I', table_name || '_tenant_policy', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON billing.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name || '_tenant_policy', table_name
    );
  END LOOP;
END
$rls$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA billing TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280103_FIN-01_payments', 'FIN-01', 'Payment events, receipts, allocations, refunds, cashier deposits and bank reconciliation inputs')
ON CONFLICT (migration_id) DO NOTHING;
