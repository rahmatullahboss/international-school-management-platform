CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS asset;
GRANT USAGE ON SCHEMA inventory, asset TO app_runtime;

CREATE TABLE IF NOT EXISTS inventory.item (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  item_id uuid NOT NULL DEFAULT gen_random_uuid(),
  sku citext NOT NULL,
  name text NOT NULL,
  unit_code text NOT NULL,
  standard_cost_minor bigint NOT NULL CHECK (standard_cost_minor >= 0),
  currency char(3) NOT NULL,
  reorder_point integer NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  track_serial boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, item_id),
  UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory.location (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  location_id uuid NOT NULL DEFAULT gen_random_uuid(),
  code citext NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('store', 'room', 'vehicle', 'hostel', 'cafeteria')),
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, location_id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS inventory.stock_movement (
  tenant_id uuid NOT NULL,
  movement_id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('receipt', 'issue', 'transfer', 'adjustment')),
  from_location_id uuid,
  to_location_id uuid,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost_minor bigint NOT NULL CHECK (unit_cost_minor >= 0),
  source_document_ref text NOT NULL,
  occurred_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, movement_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, item_id),
  FOREIGN KEY (tenant_id, from_location_id) REFERENCES inventory.location (tenant_id, location_id),
  FOREIGN KEY (tenant_id, to_location_id) REFERENCES inventory.location (tenant_id, location_id),
  CHECK (from_location_id IS NOT NULL OR to_location_id IS NOT NULL),
  CHECK (from_location_id IS DISTINCT FROM to_location_id)
);
CREATE INDEX IF NOT EXISTS inventory_movement_item_time_idx
  ON inventory.stock_movement (tenant_id, item_id, occurred_at, movement_id);
CREATE INDEX IF NOT EXISTS inventory_movement_from_idx
  ON inventory.stock_movement (tenant_id, from_location_id, item_id) WHERE from_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_movement_to_idx
  ON inventory.stock_movement (tenant_id, to_location_id, item_id) WHERE to_location_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory.stock_reservation (
  tenant_id uuid NOT NULL,
  reservation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  location_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  purpose_ref text NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'released', 'consumed', 'expired')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, reservation_id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, item_id),
  FOREIGN KEY (tenant_id, location_id) REFERENCES inventory.location (tenant_id, location_id)
);
CREATE INDEX IF NOT EXISTS inventory_reservation_availability_idx
  ON inventory.stock_reservation (tenant_id, item_id, location_id, status, expires_at);

CREATE TABLE IF NOT EXISTS inventory.stock_count (
  tenant_id uuid NOT NULL,
  stock_count_id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  location_id uuid NOT NULL,
  counted_quantity integer NOT NULL CHECK (counted_quantity >= 0),
  expected_quantity integer NOT NULL,
  variance_quantity integer NOT NULL,
  counted_at timestamptz NOT NULL,
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending-approval', 'approved', 'rejected')),
  created_by text NOT NULL,
  approved_by text,
  adjustment_movement_id uuid,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, stock_count_id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, item_id),
  FOREIGN KEY (tenant_id, location_id) REFERENCES inventory.location (tenant_id, location_id),
  FOREIGN KEY (tenant_id, adjustment_movement_id)
    REFERENCES inventory.stock_movement (tenant_id, movement_id),
  CHECK (variance_quantity = counted_quantity - expected_quantity),
  CHECK (created_by IS DISTINCT FROM approved_by)
);

CREATE TABLE IF NOT EXISTS asset.asset_register (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  legal_entity_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  asset_id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_tag citext NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  acquired_on date NOT NULL,
  acquisition_cost_minor bigint NOT NULL CHECK (acquisition_cost_minor > 0),
  currency char(3) NOT NULL,
  useful_life_months integer NOT NULL CHECK (useful_life_months > 0),
  salvage_value_minor bigint NOT NULL DEFAULT 0 CHECK (salvage_value_minor >= 0),
  location_ref text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'under-maintenance', 'disposed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, asset_id),
  UNIQUE (tenant_id, asset_tag),
  CHECK (salvage_value_minor < acquisition_cost_minor)
);
CREATE INDEX IF NOT EXISTS asset_register_status_category_idx
  ON asset.asset_register (tenant_id, campus_id, status, category);

CREATE TABLE IF NOT EXISTS asset.assignment (
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  custodian_ref text NOT NULL,
  assigned_on date NOT NULL,
  returned_on date,
  assigned_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, assignment_id),
  FOREIGN KEY (tenant_id, asset_id) REFERENCES asset.asset_register (tenant_id, asset_id),
  CHECK (returned_on IS NULL OR returned_on >= assigned_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS asset_single_current_assignment_idx
  ON asset.assignment (tenant_id, asset_id) WHERE returned_on IS NULL;

CREATE TABLE IF NOT EXISTS asset.maintenance (
  tenant_id uuid NOT NULL,
  maintenance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  performed_on date NOT NULL,
  supplier_ref text NOT NULL,
  cost_minor bigint NOT NULL CHECK (cost_minor >= 0),
  description text NOT NULL,
  recorded_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, maintenance_id),
  FOREIGN KEY (tenant_id, asset_id) REFERENCES asset.asset_register (tenant_id, asset_id)
);
CREATE INDEX IF NOT EXISTS asset_maintenance_asset_date_idx
  ON asset.maintenance (tenant_id, asset_id, performed_on);

CREATE TABLE IF NOT EXISTS asset.disposal (
  tenant_id uuid NOT NULL,
  disposal_id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  reason text NOT NULL,
  proceeds_minor bigint NOT NULL DEFAULT 0 CHECK (proceeds_minor >= 0),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, disposal_id),
  UNIQUE (tenant_id, asset_id),
  FOREIGN KEY (tenant_id, asset_id) REFERENCES asset.asset_register (tenant_id, asset_id),
  CHECK (requested_by IS DISTINCT FROM approved_by)
);

DO $ops_inventory_asset_rls$
DECLARE
  qualified_name text;
  schema_name text;
  table_name text;
BEGIN
  FOREACH qualified_name IN ARRAY ARRAY[
    'inventory.item',
    'inventory.location',
    'inventory.stock_movement',
    'inventory.stock_reservation',
    'inventory.stock_count',
    'asset.asset_register',
    'asset.assignment',
    'asset.maintenance',
    'asset.disposal'
  ]
  LOOP
    schema_name := split_part(qualified_name, '.', 1);
    table_name := split_part(qualified_name, '.', 2);
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', schema_name, table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', schema_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON %I.%I', schema_name, table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON %I.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      schema_name,
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO app_runtime', schema_name, table_name);
  END LOOP;
END
$ops_inventory_asset_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280203_OPS-01_inventory_assets',
  'OPS-01',
  'Immutable inventory movement ledger, reservations, counts, asset custody, maintenance and disposal'
)
ON CONFLICT (migration_id) DO NOTHING;
