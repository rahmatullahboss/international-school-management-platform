CREATE SCHEMA IF NOT EXISTS billing;
GRANT USAGE ON SCHEMA billing TO app_runtime;

CREATE TABLE IF NOT EXISTS billing.billing_account (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  billing_account_id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_holder_ref text NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id, billing_account_id),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES tenancy.legal_entity (tenant_id, legal_entity_id)
);

CREATE TABLE IF NOT EXISTS billing.responsible_party (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  billing_account_id uuid NOT NULL,
  person_ref text NOT NULL,
  responsibility_basis_points integer NOT NULL CHECK (responsibility_basis_points > 0 AND responsibility_basis_points <= 10000),
  priority integer NOT NULL CHECK (priority > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id, billing_account_id, person_ref),
  FOREIGN KEY (tenant_id, legal_entity_id, billing_account_id)
    REFERENCES billing.billing_account (tenant_id, legal_entity_id, billing_account_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS billing.fee_item (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  fee_item_id uuid NOT NULL DEFAULT gen_random_uuid(),
  code citext NOT NULL,
  name text NOT NULL,
  description text,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  income_account_id uuid NOT NULL,
  tax_basis_points integer NOT NULL DEFAULT 0 CHECK (tax_basis_points BETWEEN 0 AND 10000),
  tax_account_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id, fee_item_id),
  UNIQUE (tenant_id, legal_entity_id, code),
  FOREIGN KEY (tenant_id, legal_entity_id, income_account_id) REFERENCES ledger.account (tenant_id, legal_entity_id, account_id),
  FOREIGN KEY (tenant_id, legal_entity_id, tax_account_id) REFERENCES ledger.account (tenant_id, legal_entity_id, account_id),
  CHECK (tax_basis_points = 0 OR tax_account_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS billing.fee_schedule (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  fee_schedule_id uuid NOT NULL DEFAULT gen_random_uuid(),
  fee_item_id uuid NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('one-time', 'weekly', 'monthly', 'termly', 'annually')),
  starts_on date NOT NULL,
  ends_on date,
  due_days integer NOT NULL DEFAULT 0 CHECK (due_days BETWEEN 0 AND 365),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id, fee_schedule_id),
  FOREIGN KEY (tenant_id, legal_entity_id, fee_item_id) REFERENCES billing.fee_item (tenant_id, legal_entity_id, fee_item_id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS billing.fee_assignment (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  fee_assignment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL,
  fee_schedule_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  starts_on date NOT NULL,
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id, fee_assignment_id),
  FOREIGN KEY (tenant_id, legal_entity_id, billing_account_id) REFERENCES billing.billing_account (tenant_id, legal_entity_id, billing_account_id),
  FOREIGN KEY (tenant_id, legal_entity_id, fee_schedule_id) REFERENCES billing.fee_schedule (tenant_id, legal_entity_id, fee_schedule_id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS billing.fee_assignment_adjustment (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  fee_assignment_id uuid NOT NULL,
  adjustment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  adjustment_kind text NOT NULL CHECK (adjustment_kind IN ('discount', 'scholarship', 'waiver')),
  basis_points integer NOT NULL CHECK (basis_points BETWEEN 0 AND 10000),
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  approved_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id, adjustment_id),
  FOREIGN KEY (tenant_id, legal_entity_id, fee_assignment_id)
    REFERENCES billing.fee_assignment (tenant_id, legal_entity_id, fee_assignment_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS billing.document_sequence (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('invoice', 'credit-note', 'receipt', 'refund')),
  prefix text NOT NULL,
  next_value bigint NOT NULL DEFAULT 1 CHECK (next_value > 0),
  min_length integer NOT NULL DEFAULT 6 CHECK (min_length BETWEEN 1 AND 20),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id, document_type)
);

CREATE TABLE IF NOT EXISTS billing.document_number_allocation (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  document_type text NOT NULL,
  idempotency_key text NOT NULL,
  allocated_value bigint NOT NULL,
  document_number text NOT NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id, document_type, idempotency_key),
  UNIQUE (tenant_id, legal_entity_id, document_type, document_number),
  FOREIGN KEY (tenant_id, legal_entity_id, document_type)
    REFERENCES billing.document_sequence (tenant_id, legal_entity_id, document_type)
);

CREATE TABLE IF NOT EXISTS billing.invoice (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  invoice_id uuid NOT NULL DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL,
  invoice_number text NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'partially-paid', 'paid', 'credited', 'voided')),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  adjustment_minor bigint NOT NULL DEFAULT 0 CHECK (adjustment_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor > 0),
  allocated_minor bigint NOT NULL DEFAULT 0 CHECK (allocated_minor >= 0),
  credited_minor bigint NOT NULL DEFAULT 0 CHECK (credited_minor >= 0),
  balance_minor bigint NOT NULL CHECK (balance_minor >= 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_by text,
  posted_at timestamptz,
  journal_entry_id uuid,
  idempotency_key text NOT NULL,
  PRIMARY KEY (tenant_id, legal_entity_id, invoice_id),
  UNIQUE (tenant_id, legal_entity_id, invoice_number),
  UNIQUE (tenant_id, legal_entity_id, idempotency_key),
  FOREIGN KEY (tenant_id, legal_entity_id, billing_account_id) REFERENCES billing.billing_account (tenant_id, legal_entity_id, billing_account_id),
  FOREIGN KEY (tenant_id, legal_entity_id, journal_entry_id) REFERENCES ledger.journal_entry (tenant_id, legal_entity_id, journal_entry_id),
  CHECK (due_date >= issue_date),
  CHECK (subtotal_minor - adjustment_minor + tax_minor = total_minor),
  CHECK (allocated_minor + credited_minor + balance_minor = total_minor),
  CHECK (
    (status = 'draft' AND posted_by IS NULL AND posted_at IS NULL AND journal_entry_id IS NULL) OR
    (status = 'voided' AND posted_at IS NULL) OR
    (status IN ('posted', 'partially-paid', 'paid', 'credited') AND posted_by IS NOT NULL AND posted_at IS NOT NULL AND journal_entry_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS billing.invoice_line (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  invoice_line_id uuid NOT NULL DEFAULT gen_random_uuid(),
  line_number integer NOT NULL CHECK (line_number > 0),
  fee_item_id uuid NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_amount_minor bigint NOT NULL CHECK (unit_amount_minor > 0),
  gross_minor bigint NOT NULL CHECK (gross_minor > 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  scholarship_minor bigint NOT NULL DEFAULT 0 CHECK (scholarship_minor >= 0),
  waiver_minor bigint NOT NULL DEFAULT 0 CHECK (waiver_minor >= 0),
  taxable_minor bigint NOT NULL CHECK (taxable_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  income_account_id uuid NOT NULL,
  tax_account_id uuid,
  PRIMARY KEY (tenant_id, legal_entity_id, invoice_line_id),
  UNIQUE (tenant_id, legal_entity_id, invoice_id, line_number),
  FOREIGN KEY (tenant_id, legal_entity_id, invoice_id) REFERENCES billing.invoice (tenant_id, legal_entity_id, invoice_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, legal_entity_id, fee_item_id) REFERENCES billing.fee_item (tenant_id, legal_entity_id, fee_item_id),
  FOREIGN KEY (tenant_id, legal_entity_id, income_account_id) REFERENCES ledger.account (tenant_id, legal_entity_id, account_id),
  FOREIGN KEY (tenant_id, legal_entity_id, tax_account_id) REFERENCES ledger.account (tenant_id, legal_entity_id, account_id),
  CHECK (gross_minor = unit_amount_minor * quantity),
  CHECK (gross_minor - discount_minor - scholarship_minor - waiver_minor = taxable_minor),
  CHECK (taxable_minor + tax_minor = total_minor)
);

CREATE TABLE IF NOT EXISTS billing.invoice_instalment (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  instalment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  sequence integer NOT NULL CHECK (sequence > 0),
  due_on date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  allocated_minor bigint NOT NULL DEFAULT 0 CHECK (allocated_minor BETWEEN 0 AND amount_minor),
  PRIMARY KEY (tenant_id, legal_entity_id, instalment_id),
  UNIQUE (tenant_id, legal_entity_id, invoice_id, sequence),
  FOREIGN KEY (tenant_id, legal_entity_id, invoice_id) REFERENCES billing.invoice (tenant_id, legal_entity_id, invoice_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS billing.credit_note (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  credit_note_id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  credit_note_number text NOT NULL,
  issue_date date NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'voided')),
  reason text NOT NULL CHECK (length(trim(reason)) >= 5),
  total_minor bigint NOT NULL CHECK (total_minor > 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_by text,
  posted_at timestamptz,
  journal_entry_id uuid,
  idempotency_key text NOT NULL,
  PRIMARY KEY (tenant_id, legal_entity_id, credit_note_id),
  UNIQUE (tenant_id, legal_entity_id, credit_note_number),
  UNIQUE (tenant_id, legal_entity_id, idempotency_key),
  FOREIGN KEY (tenant_id, legal_entity_id, invoice_id) REFERENCES billing.invoice (tenant_id, legal_entity_id, invoice_id),
  FOREIGN KEY (tenant_id, legal_entity_id, journal_entry_id) REFERENCES ledger.journal_entry (tenant_id, legal_entity_id, journal_entry_id),
  CHECK (
    (status = 'draft' AND posted_by IS NULL AND posted_at IS NULL AND journal_entry_id IS NULL) OR
    (status = 'voided' AND posted_at IS NULL) OR
    (status = 'posted' AND posted_by IS NOT NULL AND posted_at IS NOT NULL AND journal_entry_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS billing.credit_note_line (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  credit_note_id uuid NOT NULL,
  credit_note_line_id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_line_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  income_account_id uuid NOT NULL,
  tax_account_id uuid,
  PRIMARY KEY (tenant_id, legal_entity_id, credit_note_line_id),
  FOREIGN KEY (tenant_id, legal_entity_id, credit_note_id) REFERENCES billing.credit_note (tenant_id, legal_entity_id, credit_note_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, legal_entity_id, invoice_line_id) REFERENCES billing.invoice_line (tenant_id, legal_entity_id, invoice_line_id),
  FOREIGN KEY (tenant_id, legal_entity_id, income_account_id) REFERENCES ledger.account (tenant_id, legal_entity_id, account_id),
  FOREIGN KEY (tenant_id, legal_entity_id, tax_account_id) REFERENCES ledger.account (tenant_id, legal_entity_id, account_id)
);

CREATE INDEX IF NOT EXISTS billing_invoice_account_date_idx ON billing.invoice (tenant_id, legal_entity_id, billing_account_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS billing_invoice_due_open_idx ON billing.invoice (tenant_id, legal_entity_id, due_date) WHERE status IN ('posted', 'partially-paid');
CREATE INDEX IF NOT EXISTS billing_assignment_account_idx ON billing.fee_assignment (tenant_id, legal_entity_id, billing_account_id) WHERE active;
CREATE INDEX IF NOT EXISTS billing_credit_invoice_idx ON billing.credit_note (tenant_id, legal_entity_id, invoice_id) WHERE status = 'posted';

CREATE OR REPLACE FUNCTION billing.allocate_document_number(
  p_legal_entity_id uuid,
  p_document_type text,
  p_idempotency_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = billing, pg_temp AS $$
DECLARE
  tenant uuid := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
  existing text;
  sequence_row billing.document_sequence;
  allocated bigint;
  result text;
BEGIN
  SELECT document_number INTO existing
  FROM billing.document_number_allocation
  WHERE tenant_id = tenant
    AND legal_entity_id = p_legal_entity_id
    AND document_type = p_document_type
    AND idempotency_key = p_idempotency_key;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  SELECT * INTO sequence_row
  FROM billing.document_sequence
  WHERE tenant_id = tenant
    AND legal_entity_id = p_legal_entity_id
    AND document_type = p_document_type
  FOR UPDATE;
  IF sequence_row.document_type IS NULL THEN RAISE EXCEPTION 'FIN_NUMBERING_SEQUENCE_NOT_FOUND'; END IF;

  allocated := sequence_row.next_value;
  result := sequence_row.prefix || lpad(allocated::text, sequence_row.min_length, '0');
  UPDATE billing.document_sequence
  SET next_value = next_value + 1, updated_at = now()
  WHERE tenant_id = tenant AND legal_entity_id = p_legal_entity_id AND document_type = p_document_type;
  INSERT INTO billing.document_number_allocation (
    tenant_id, legal_entity_id, document_type, idempotency_key, allocated_value, document_number
  ) VALUES (tenant, p_legal_entity_id, p_document_type, p_idempotency_key, allocated, result);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION billing.reject_posted_document_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('posted', 'partially-paid', 'paid', 'credited') THEN
    RAISE EXCEPTION 'FIN_POSTED_DOCUMENT_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS invoice_reject_posted_delete ON billing.invoice;
CREATE TRIGGER invoice_reject_posted_delete BEFORE DELETE ON billing.invoice
FOR EACH ROW EXECUTE FUNCTION billing.reject_posted_document_delete();

DROP TRIGGER IF EXISTS credit_note_reject_posted_delete ON billing.credit_note;
CREATE TRIGGER credit_note_reject_posted_delete BEFORE DELETE ON billing.credit_note
FOR EACH ROW EXECUTE FUNCTION billing.reject_posted_document_delete();

CREATE OR REPLACE FUNCTION billing.reject_posted_line_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_status text;
BEGIN
  SELECT status INTO invoice_status
  FROM billing.invoice
  WHERE tenant_id = OLD.tenant_id AND legal_entity_id = OLD.legal_entity_id AND invoice_id = OLD.invoice_id;
  IF invoice_status IN ('posted', 'partially-paid', 'paid', 'credited') THEN
    RAISE EXCEPTION 'FIN_POSTED_INVOICE_LINE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS invoice_line_immutable_when_posted ON billing.invoice_line;
CREATE TRIGGER invoice_line_immutable_when_posted BEFORE UPDATE OR DELETE ON billing.invoice_line
FOR EACH ROW EXECUTE FUNCTION billing.reject_posted_line_mutation();

DO $rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'billing_account','responsible_party','fee_item','fee_schedule','fee_assignment','fee_assignment_adjustment',
    'document_sequence','document_number_allocation','invoice','invoice_line','invoice_instalment','credit_note','credit_note_line'
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
GRANT EXECUTE ON FUNCTION billing.allocate_document_number(uuid, text, text) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607280102_FIN-01_billing', 'FIN-01', 'Billing accounts, fee assignments, invoices, instalments, adjustments and credit notes')
ON CONFLICT (migration_id) DO NOTHING;
