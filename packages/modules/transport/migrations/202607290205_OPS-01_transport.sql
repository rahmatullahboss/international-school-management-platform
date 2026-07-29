CREATE SCHEMA IF NOT EXISTS transport;
GRANT USAGE ON SCHEMA transport TO app_runtime;

CREATE TABLE IF NOT EXISTS transport.vehicle (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  vehicle_id uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_number citext NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 1900 AND 9999),
  status text NOT NULL CHECK (status IN ('active', 'maintenance', 'inactive')),
  next_inspection_on date NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, vehicle_id),
  UNIQUE (tenant_id, registration_number)
);
CREATE INDEX IF NOT EXISTS transport_vehicle_status_inspection_idx
  ON transport.vehicle (tenant_id, status, next_inspection_on);

CREATE TABLE IF NOT EXISTS transport.driver (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  driver_id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_ref text NOT NULL,
  licence_number citext NOT NULL,
  licence_expires_on date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, driver_id),
  UNIQUE (tenant_id, staff_ref),
  UNIQUE (tenant_id, licence_number)
);

CREATE TABLE IF NOT EXISTS transport.route (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  route_id uuid NOT NULL DEFAULT gen_random_uuid(),
  code citext NOT NULL,
  name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, route_id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS transport.route_stop (
  tenant_id uuid NOT NULL,
  stop_id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  name text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  scheduled_offset_minutes integer NOT NULL CHECK (scheduled_offset_minutes >= 0),
  PRIMARY KEY (tenant_id, stop_id),
  UNIQUE (tenant_id, route_id, sequence),
  FOREIGN KEY (tenant_id, route_id) REFERENCES transport.route (tenant_id, route_id)
);
CREATE INDEX IF NOT EXISTS transport_route_stop_order_idx
  ON transport.route_stop (tenant_id, route_id, sequence);

CREATE TABLE IF NOT EXISTS transport.rider_assignment (
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  rider_ref text NOT NULL,
  guardian_ref text NOT NULL,
  pickup_stop_id uuid NOT NULL,
  dropoff_stop_id uuid NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, assignment_id),
  FOREIGN KEY (tenant_id, route_id) REFERENCES transport.route (tenant_id, route_id),
  FOREIGN KEY (tenant_id, vehicle_id) REFERENCES transport.vehicle (tenant_id, vehicle_id),
  FOREIGN KEY (tenant_id, pickup_stop_id) REFERENCES transport.route_stop (tenant_id, stop_id),
  FOREIGN KEY (tenant_id, dropoff_stop_id) REFERENCES transport.route_stop (tenant_id, stop_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (pickup_stop_id <> dropoff_stop_id)
);
CREATE INDEX IF NOT EXISTS transport_assignment_capacity_idx
  ON transport.rider_assignment (tenant_id, vehicle_id, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS transport_assignment_rider_idx
  ON transport.rider_assignment (tenant_id, rider_ref, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS transport.trip_run (
  tenant_id uuid NOT NULL,
  trip_id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  service_date date NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('in-progress', 'completed', 'cancelled')),
  unreconciled_rider_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, trip_id),
  FOREIGN KEY (tenant_id, route_id) REFERENCES transport.route (tenant_id, route_id),
  FOREIGN KEY (tenant_id, vehicle_id) REFERENCES transport.vehicle (tenant_id, vehicle_id),
  FOREIGN KEY (tenant_id, driver_id) REFERENCES transport.driver (tenant_id, driver_id),
  CHECK (completed_at IS NULL OR completed_at >= started_at),
  CHECK (jsonb_typeof(unreconciled_rider_refs) = 'array')
);
CREATE INDEX IF NOT EXISTS transport_trip_service_status_idx
  ON transport.trip_run (tenant_id, service_date, status, route_id);
CREATE UNIQUE INDEX IF NOT EXISTS transport_vehicle_single_active_trip_idx
  ON transport.trip_run (tenant_id, vehicle_id) WHERE status = 'in-progress';
CREATE UNIQUE INDEX IF NOT EXISTS transport_driver_single_active_trip_idx
  ON transport.trip_run (tenant_id, driver_id) WHERE status = 'in-progress';

CREATE TABLE IF NOT EXISTS transport.rider_event (
  tenant_id uuid NOT NULL,
  rider_event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  rider_ref text NOT NULL,
  stop_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('boarded', 'alighted', 'absent')),
  occurred_at timestamptz NOT NULL,
  recorded_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, rider_event_id),
  FOREIGN KEY (tenant_id, trip_id) REFERENCES transport.trip_run (tenant_id, trip_id),
  FOREIGN KEY (tenant_id, stop_id) REFERENCES transport.route_stop (tenant_id, stop_id)
);
CREATE INDEX IF NOT EXISTS transport_rider_event_trip_rider_idx
  ON transport.rider_event (tenant_id, trip_id, rider_ref, occurred_at);

CREATE TABLE IF NOT EXISTS transport.incident (
  tenant_id uuid NOT NULL,
  incident_id text NOT NULL,
  vehicle_id uuid NOT NULL,
  trip_id uuid,
  category text NOT NULL CHECK (category IN ('operational', 'safeguarding')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  occurred_at timestamptz NOT NULL,
  description text NOT NULL,
  persons_involved_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('open', 'resolved')),
  recorded_by text NOT NULL,
  resolved_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, incident_id),
  FOREIGN KEY (tenant_id, vehicle_id) REFERENCES transport.vehicle (tenant_id, vehicle_id),
  FOREIGN KEY (tenant_id, trip_id) REFERENCES transport.trip_run (tenant_id, trip_id),
  CHECK (jsonb_typeof(persons_involved_refs) = 'array')
);
CREATE INDEX IF NOT EXISTS transport_incident_open_idx
  ON transport.incident (tenant_id, category, severity, occurred_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS transport.maintenance (
  tenant_id uuid NOT NULL,
  maintenance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  scheduled_on date NOT NULL,
  completed_on date,
  description text NOT NULL,
  supplier_ref text NOT NULL,
  cost_minor bigint NOT NULL DEFAULT 0 CHECK (cost_minor >= 0),
  recorded_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, maintenance_id),
  FOREIGN KEY (tenant_id, vehicle_id) REFERENCES transport.vehicle (tenant_id, vehicle_id),
  CHECK (completed_on IS NULL OR completed_on >= scheduled_on)
);
CREATE INDEX IF NOT EXISTS transport_maintenance_vehicle_open_idx
  ON transport.maintenance (tenant_id, vehicle_id, scheduled_on) WHERE completed_on IS NULL;

DO $ops_transport_rls$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'vehicle', 'driver', 'route', 'route_stop', 'rider_assignment',
    'trip_run', 'rider_event', 'incident', 'maintenance'
  ]
  LOOP
    EXECUTE format('ALTER TABLE transport.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE transport.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON transport.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON transport.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON transport.%I TO app_runtime', table_name);
  END LOOP;
END
$ops_transport_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607290205_OPS-01_transport',
  'OPS-01',
  'Transport fleet, drivers, routes, rider assignments, trip attendance, safeguarding incidents and maintenance'
)
ON CONFLICT (migration_id) DO NOTHING;
