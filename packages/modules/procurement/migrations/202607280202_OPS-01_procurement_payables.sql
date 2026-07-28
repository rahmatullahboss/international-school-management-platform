CREATE SCHEMA IF NOT EXISTS procurement;
GRANT USAGE ON SCHEMA procurement TO app_runtime;

CREATE TABLE IF NOT EXISTS procurement.supplier (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  supplier_id uuid NOT NULL DEFAULT gen_random_uuid(),
  code citext NOT NULL,
  name text NOT NULL,
  tax_reference text NOT NULL,
  currency char(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'suspended', 'inactive')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, supplier_id),
  UNIQUE (tenant_id, code),
  CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS procurement.budget_envelope (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  legal_entity_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  budget_envelope_id uuid NOT NULL DEFAULT gen_random_uuid(),
  fiscal_period_ref text NOT NULL,
  cost_center_ref text NOT NULL,
  account_ref text NOT NULL,
  currency char(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  committed_minor bigint NOT NULL DEFAULT 0 CHECK (committed_minor >= 0),
  spent_minor bigint NOT NULL DEFAULT 0 CHECK (spent_minor >= 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, budget_envelope_id),
  CHECK (committed_minor + spent_minor <= amount_minor)
);
CREATE INDEX IF NOT EXISTS procurement_budget_period_cost_idx
  ON procurement.budget_envelope (tenant_id, fiscal_period_ref, cost_center_ref, account_ref);

CREATE TABLE IF NOT EXISTS procurement.requisition (
  tenant_id uuid NOT NULL,
  requisition_id uuid NOT NULL DEFAULT gen_random_uuid(),
  budget_envelope_id uuid NOT NULL,
  requested_by_staff_ref text NOT NULL,
  needed_by date NOT NULL,
  purpose text NOT NULL,
  currency char(3) NOT NULL,
  total_minor bigint NOT NULL CHECK (total_minor > 0),
  status text NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'ordered', 'cancelled')),
  created_by text NOT NULL,
  approved_by text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, requisition_id),
  FOREIGN KEY (tenant_id, budget_envelope_id)
    REFERENCES procurement.budget_envelope (tenant_id, budget_envelope_id),
  CHECK (length(btrim(purpose)) >= 5),
  CHECK (created_by IS DISTINCT FROM approved_by)
);
CREATE INDEX IF NOT EXISTS procurement_requisition_status_needed_idx
  ON procurement.requisition (tenant_id, status, needed_by);

CREATE TABLE IF NOT EXISTS procurement.requisition_line (
  tenant_id uuid NOT NULL,
  requisition_line_id uuid NOT NULL DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  estimated_unit_minor bigint NOT NULL CHECK (estimated_unit_minor > 0),
  estimated_total_minor bigint NOT NULL CHECK (estimated_total_minor > 0),
  account_ref text NOT NULL,
  PRIMARY KEY (tenant_id, requisition_line_id),
  FOREIGN KEY (tenant_id, requisition_id)
    REFERENCES procurement.requisition (tenant_id, requisition_id) ON DELETE RESTRICT,
  CHECK (estimated_total_minor = quantity * estimated_unit_minor)
);
CREATE INDEX IF NOT EXISTS procurement_requisition_line_req_idx
  ON procurement.requisition_line (tenant_id, requisition_id);

CREATE TABLE IF NOT EXISTS procurement.purchase_order (
  tenant_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  budget_envelope_id uuid NOT NULL,
  order_number citext NOT NULL,
  ordered_on date NOT NULL,
  expected_on date NOT NULL,
  currency char(3) NOT NULL,
  total_minor bigint NOT NULL CHECK (total_minor > 0),
  status text NOT NULL CHECK (status IN ('issued', 'partially-received', 'received', 'closed', 'cancelled')),
  issued_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, purchase_order_id),
  UNIQUE (tenant_id, order_number),
  FOREIGN KEY (tenant_id, requisition_id)
    REFERENCES procurement.requisition (tenant_id, requisition_id),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES procurement.supplier (tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, budget_envelope_id)
    REFERENCES procurement.budget_envelope (tenant_id, budget_envelope_id),
  CHECK (expected_on >= ordered_on)
);
CREATE INDEX IF NOT EXISTS procurement_po_supplier_status_idx
  ON procurement.purchase_order (tenant_id, supplier_id, status, expected_on);

CREATE TABLE IF NOT EXISTS procurement.goods_receipt (
  tenant_id uuid NOT NULL,
  goods_receipt_id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL,
  received_on date NOT NULL,
  received_by_staff_ref text NOT NULL,
  recorded_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, goods_receipt_id),
  FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES procurement.purchase_order (tenant_id, purchase_order_id)
);
CREATE INDEX IF NOT EXISTS procurement_receipt_po_date_idx
  ON procurement.goods_receipt (tenant_id, purchase_order_id, received_on);

CREATE TABLE IF NOT EXISTS procurement.goods_receipt_line (
  tenant_id uuid NOT NULL,
  goods_receipt_line_id uuid NOT NULL DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL,
  requisition_line_id uuid NOT NULL,
  quantity_received integer NOT NULL CHECK (quantity_received > 0),
  PRIMARY KEY (tenant_id, goods_receipt_line_id),
  FOREIGN KEY (tenant_id, goods_receipt_id)
    REFERENCES procurement.goods_receipt (tenant_id, goods_receipt_id),
  FOREIGN KEY (tenant_id, requisition_line_id)
    REFERENCES procurement.requisition_line (tenant_id, requisition_line_id)
);

CREATE TABLE IF NOT EXISTS procurement.supplier_invoice (
  tenant_id uuid NOT NULL,
  supplier_invoice_id uuid NOT NULL DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL,
  supplier_invoice_number citext NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  currency char(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  match_status text NOT NULL
    CHECK (match_status IN ('matched', 'quantity-mismatch', 'amount-mismatch', 'currency-mismatch')),
  status text NOT NULL
    CHECK (status IN ('pending-match', 'matched', 'approved', 'exported', 'rejected')),
  idempotency_key text NOT NULL,
  created_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  finance_document_ref text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, supplier_invoice_id),
  UNIQUE (tenant_id, supplier_id, supplier_invoice_number),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES procurement.supplier (tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES procurement.purchase_order (tenant_id, purchase_order_id),
  CHECK (due_date >= invoice_date),
  CHECK (created_by IS DISTINCT FROM approved_by)
);
CREATE INDEX IF NOT EXISTS procurement_invoice_match_due_idx
  ON procurement.supplier_invoice (tenant_id, match_status, status, due_date);

CREATE TABLE IF NOT EXISTS procurement.finance_export (
  tenant_id uuid NOT NULL,
  finance_export_id uuid NOT NULL DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL,
  contract_version text NOT NULL,
  source_document jsonb NOT NULL,
  finance_document_ref text NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, finance_export_id),
  UNIQUE (tenant_id, supplier_invoice_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, supplier_invoice_id)
    REFERENCES procurement.supplier_invoice (tenant_id, supplier_invoice_id)
);

DO $ops_procurement_rls$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'supplier',
    'budget_envelope',
    'requisition',
    'requisition_line',
    'purchase_order',
    'goods_receipt',
    'goods_receipt_line',
    'supplier_invoice',
    'finance_export'
  ]
  LOOP
    EXECUTE format('ALTER TABLE procurement.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE procurement.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON procurement.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON procurement.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON procurement.%I TO app_runtime', table_name);
  END LOOP;
END
$ops_procurement_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280202_OPS-01_procurement_payables',
  'OPS-01',
  'Suppliers, budgets, requisitions, purchase orders, receipts, three-way matching and finance payable exports'
)
ON CONFLICT (migration_id) DO NOTHING;
