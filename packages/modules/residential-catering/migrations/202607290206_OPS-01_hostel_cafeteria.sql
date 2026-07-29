CREATE SCHEMA IF NOT EXISTS hostel;
CREATE SCHEMA IF NOT EXISTS cafeteria;
GRANT USAGE ON SCHEMA hostel, cafeteria TO app_runtime;

CREATE TABLE IF NOT EXISTS hostel.building (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  building_id uuid NOT NULL DEFAULT gen_random_uuid(),
  code citext NOT NULL,
  name text NOT NULL,
  resident_category text NOT NULL CHECK (resident_category IN ('boys', 'girls', 'mixed')),
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, building_id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS hostel.room (
  tenant_id uuid NOT NULL,
  room_id uuid NOT NULL DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  code citext NOT NULL,
  floor integer NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, room_id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, building_id) REFERENCES hostel.building (tenant_id, building_id)
);
CREATE INDEX IF NOT EXISTS hostel_room_building_active_idx
  ON hostel.room (tenant_id, building_id, active, floor);

CREATE TABLE IF NOT EXISTS hostel.bed (
  tenant_id uuid NOT NULL,
  bed_id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  code citext NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, bed_id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, room_id) REFERENCES hostel.room (tenant_id, room_id)
);
CREATE INDEX IF NOT EXISTS hostel_bed_room_active_idx
  ON hostel.bed (tenant_id, room_id, active);

CREATE TABLE IF NOT EXISTS hostel.allocation (
  tenant_id uuid NOT NULL,
  allocation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  bed_id uuid NOT NULL,
  resident_ref text NOT NULL,
  guardian_ref text NOT NULL,
  medical_note_ref text,
  starts_on date NOT NULL,
  ends_on date,
  status text NOT NULL CHECK (status IN ('active', 'ended')),
  allocated_by text NOT NULL,
  checked_out_by text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, allocation_id),
  FOREIGN KEY (tenant_id, bed_id) REFERENCES hostel.bed (tenant_id, bed_id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS hostel_single_active_bed_allocation_idx
  ON hostel.allocation (tenant_id, bed_id) WHERE status = 'active' AND ends_on IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hostel_single_active_resident_allocation_idx
  ON hostel.allocation (tenant_id, resident_ref) WHERE status = 'active' AND ends_on IS NULL;
CREATE INDEX IF NOT EXISTS hostel_allocation_resident_dates_idx
  ON hostel.allocation (tenant_id, resident_ref, starts_on, ends_on, status);

CREATE TABLE IF NOT EXISTS hostel.visitor (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  visitor_id uuid NOT NULL DEFAULT gen_random_uuid(),
  resident_ref text NOT NULL,
  visitor_name text NOT NULL,
  relationship text NOT NULL,
  checked_in_at timestamptz NOT NULL,
  checked_out_at timestamptz,
  recorded_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, visitor_id),
  CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at)
);
CREATE INDEX IF NOT EXISTS hostel_visitor_open_idx
  ON hostel.visitor (tenant_id, resident_ref, checked_in_at) WHERE checked_out_at IS NULL;

CREATE TABLE IF NOT EXISTS hostel.incident (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  incident_id uuid NOT NULL DEFAULT gen_random_uuid(),
  resident_ref text NOT NULL,
  category text NOT NULL CHECK (category IN ('safeguarding', 'health', 'discipline', 'facility')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  occurred_at timestamptz NOT NULL,
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'resolved')),
  recorded_by text NOT NULL,
  resolved_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, incident_id)
);
CREATE INDEX IF NOT EXISTS hostel_incident_open_idx
  ON hostel.incident (tenant_id, category, severity, occurred_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS hostel.maintenance (
  tenant_id uuid NOT NULL,
  maintenance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  opened_on date NOT NULL,
  completed_on date,
  description text NOT NULL,
  supplier_ref text,
  cost_minor bigint NOT NULL DEFAULT 0 CHECK (cost_minor >= 0),
  recorded_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, maintenance_id),
  FOREIGN KEY (tenant_id, room_id) REFERENCES hostel.room (tenant_id, room_id),
  CHECK (completed_on IS NULL OR completed_on >= opened_on)
);
CREATE INDEX IF NOT EXISTS hostel_maintenance_open_idx
  ON hostel.maintenance (tenant_id, room_id, opened_on) WHERE completed_on IS NULL;

CREATE TABLE IF NOT EXISTS cafeteria.menu_item (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  menu_item_id uuid NOT NULL DEFAULT gen_random_uuid(),
  code citext NOT NULL,
  name text NOT NULL,
  meal_types jsonb NOT NULL,
  allergen_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_minor bigint NOT NULL CHECK (price_minor >= 0),
  currency char(3) NOT NULL,
  inventory_item_refs jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, menu_item_id),
  UNIQUE (tenant_id, code),
  CHECK (jsonb_typeof(meal_types) = 'array'),
  CHECK (jsonb_array_length(meal_types) > 0),
  CHECK (jsonb_typeof(allergen_codes) = 'array'),
  CHECK (jsonb_typeof(inventory_item_refs) = 'array'),
  CHECK (jsonb_array_length(inventory_item_refs) > 0)
);
CREATE INDEX IF NOT EXISTS cafeteria_menu_allergen_gin_idx
  ON cafeteria.menu_item USING gin (allergen_codes);
CREATE INDEX IF NOT EXISTS cafeteria_menu_inventory_gin_idx
  ON cafeteria.menu_item USING gin (inventory_item_refs);

CREATE TABLE IF NOT EXISTS cafeteria.meal_plan (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  meal_plan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_ref text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  entitled_meal_types jsonb NOT NULL,
  excluded_allergen_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_meals_per_day integer NOT NULL CHECK (max_meals_per_day > 0),
  billing_mode text NOT NULL CHECK (billing_mode IN ('included', 'pay-per-meal')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, meal_plan_id),
  CHECK (ends_on >= starts_on),
  CHECK (jsonb_typeof(entitled_meal_types) = 'array'),
  CHECK (jsonb_array_length(entitled_meal_types) > 0),
  CHECK (jsonb_typeof(excluded_allergen_codes) = 'array')
);
CREATE INDEX IF NOT EXISTS cafeteria_plan_person_dates_idx
  ON cafeteria.meal_plan (tenant_id, person_ref, starts_on, ends_on);

CREATE TABLE IF NOT EXISTS cafeteria.meal_order (
  tenant_id uuid NOT NULL,
  meal_order_id uuid NOT NULL DEFAULT gen_random_uuid(),
  meal_plan_id uuid NOT NULL,
  person_ref text NOT NULL,
  service_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
  menu_item_ids jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('ordered', 'served', 'cancelled')),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  currency char(3) NOT NULL,
  billing_mode text NOT NULL CHECK (billing_mode IN ('included', 'pay-per-meal')),
  placed_by text NOT NULL,
  finance_document_ref text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, meal_order_id),
  FOREIGN KEY (tenant_id, meal_plan_id) REFERENCES cafeteria.meal_plan (tenant_id, meal_plan_id),
  CHECK (jsonb_typeof(menu_item_ids) = 'array'),
  CHECK (jsonb_array_length(menu_item_ids) > 0)
);
CREATE INDEX IF NOT EXISTS cafeteria_order_person_date_idx
  ON cafeteria.meal_order (tenant_id, person_ref, service_date, status);

CREATE TABLE IF NOT EXISTS cafeteria.meal_service (
  tenant_id uuid NOT NULL,
  meal_service_id uuid NOT NULL DEFAULT gen_random_uuid(),
  meal_order_id uuid NOT NULL,
  served_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  served_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, meal_service_id),
  UNIQUE (tenant_id, meal_order_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, meal_order_id) REFERENCES cafeteria.meal_order (tenant_id, meal_order_id)
);

CREATE TABLE IF NOT EXISTS cafeteria.charge_source (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  charge_source_id uuid NOT NULL DEFAULT gen_random_uuid(),
  contract_version text NOT NULL,
  source_type text NOT NULL CHECK (source_type = 'cafeteria-meal'),
  source_id text NOT NULL,
  person_ref text NOT NULL,
  service_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  finance_document_ref text,
  exported_at timestamptz,
  PRIMARY KEY (tenant_id, charge_source_id),
  UNIQUE (tenant_id, source_id),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS cafeteria_charge_export_idx
  ON cafeteria.charge_source (tenant_id, exported_at) WHERE exported_at IS NULL;

DO $ops_residential_catering_rls$
DECLARE
  qualified_name text;
  schema_name text;
  table_name text;
BEGIN
  FOREACH qualified_name IN ARRAY ARRAY[
    'hostel.building',
    'hostel.room',
    'hostel.bed',
    'hostel.allocation',
    'hostel.visitor',
    'hostel.incident',
    'hostel.maintenance',
    'cafeteria.menu_item',
    'cafeteria.meal_plan',
    'cafeteria.meal_order',
    'cafeteria.meal_service',
    'cafeteria.charge_source'
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
$ops_residential_catering_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607290206_OPS-01_hostel_cafeteria',
  'OPS-01',
  'Hostel occupancy, visitors, incidents and maintenance plus cafeteria menus, allergens, meal plans, orders, service and finance charge source records'
)
ON CONFLICT (migration_id) DO NOTHING;
