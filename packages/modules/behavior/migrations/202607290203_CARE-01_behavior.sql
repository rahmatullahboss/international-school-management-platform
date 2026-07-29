BEGIN;

CREATE SCHEMA IF NOT EXISTS behavior;
GRANT USAGE ON SCHEMA behavior TO app_runtime;

CREATE TABLE IF NOT EXISTS behavior.incident (
  tenant_id uuid NOT NULL,
  incident_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_person_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  category_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','moderate','high','critical')),
  classification text NOT NULL DEFAULT 'CARE-C2'
    CHECK (classification IN ('CARE-C2','CARE-C3')),
  occurred_at timestamptz NOT NULL,
  location_category text NOT NULL,
  source_narrative text NOT NULL,
  reporter_principal_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','under-review','actioned','resolved','closed')),
  idempotency_key text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, incident_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id),
  CHECK (severity <> 'critical' OR classification = 'CARE-C3')
);

CREATE INDEX IF NOT EXISTS behavior_incident_queue_idx
  ON behavior.incident (tenant_id, campus_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS behavior.status_history (
  tenant_id uuid NOT NULL,
  status_history_id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL
    CHECK (to_status IN ('draft','submitted','under-review','actioned','resolved','closed')),
  changed_by_principal_id uuid NOT NULL,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, status_history_id),
  FOREIGN KEY (tenant_id, incident_id)
    REFERENCES behavior.incident (tenant_id, incident_id)
);

CREATE TABLE IF NOT EXISTS behavior.action (
  tenant_id uuid NOT NULL,
  action_id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  action_type text NOT NULL
    CHECK (action_type IN ('warning','reflection','restorative','restriction','support-referral')),
  summary text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  assigned_by_principal_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('planned','active','completed','cancelled')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, action_id),
  FOREIGN KEY (tenant_id, incident_id)
    REFERENCES behavior.incident (tenant_id, incident_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS behavior.restorative_plan (
  tenant_id uuid NOT NULL,
  restorative_plan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  goals jsonb NOT NULL CHECK (jsonb_typeof(goals) = 'array'),
  participant_role_codes jsonb NOT NULL CHECK (jsonb_typeof(participant_role_codes) = 'array'),
  planned_at timestamptz NOT NULL,
  completed_at timestamptz,
  outcome_summary text,
  status text NOT NULL CHECK (status IN ('planned','completed','cancelled')),
  created_by_principal_id uuid NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, restorative_plan_id),
  FOREIGN KEY (tenant_id, incident_id)
    REFERENCES behavior.incident (tenant_id, incident_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (
    (status = 'planned' AND completed_at IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL AND outcome_summary IS NOT NULL)
    OR status = 'cancelled'
  )
);

CREATE TABLE IF NOT EXISTS behavior.follow_up (
  tenant_id uuid NOT NULL,
  follow_up_id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  outcome_code text CHECK (outcome_code IN ('improving','stable','escalated','closed')),
  restricted_note text,
  assigned_principal_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('open','completed','cancelled')),
  classification text NOT NULL DEFAULT 'CARE-C3' CHECK (classification = 'CARE-C3'),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, follow_up_id),
  FOREIGN KEY (tenant_id, incident_id)
    REFERENCES behavior.incident (tenant_id, incident_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (
    (status = 'open' AND completed_at IS NULL AND outcome_code IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL AND outcome_code IS NOT NULL)
    OR status = 'cancelled'
  )
);

CREATE TABLE IF NOT EXISTS behavior.correction (
  tenant_id uuid NOT NULL,
  correction_id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  field_name text NOT NULL
    CHECK (field_name IN ('categoryCode','severity','occurredAt','locationCategory')),
  replacement_value text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  corrected_by_principal_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, correction_id),
  FOREIGN KEY (tenant_id, incident_id)
    REFERENCES behavior.incident (tenant_id, incident_id)
);

CREATE TABLE IF NOT EXISTS behavior.publication (
  tenant_id uuid NOT NULL,
  publication_id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  audience text NOT NULL CHECK (audience IN ('student','guardian')),
  version bigint NOT NULL CHECK (version > 0),
  category_label text NOT NULL,
  action_summary text,
  restorative_summary text,
  prepared_by_principal_id uuid NOT NULL,
  approved_by_principal_id uuid NOT NULL,
  effective_from timestamptz NOT NULL,
  expires_at timestamptz,
  supersedes_publication_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, publication_id),
  UNIQUE (tenant_id, incident_id, audience, version),
  FOREIGN KEY (tenant_id, incident_id)
    REFERENCES behavior.incident (tenant_id, incident_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, supersedes_publication_id)
    REFERENCES behavior.publication (tenant_id, publication_id),
  CHECK (prepared_by_principal_id <> approved_by_principal_id),
  CHECK (expires_at IS NULL OR expires_at > effective_from)
);

CREATE TABLE IF NOT EXISTS behavior.publication_revocation (
  tenant_id uuid NOT NULL,
  publication_revocation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL,
  revoked_by_principal_id uuid NOT NULL,
  reason_code text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, publication_revocation_id),
  UNIQUE (tenant_id, publication_id),
  FOREIGN KEY (tenant_id, publication_id)
    REFERENCES behavior.publication (tenant_id, publication_id)
);

CREATE OR REPLACE FUNCTION behavior.prevent_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'CARE_BEHAVIOR_APPEND_ONLY_RECORD';
END
$function$;

DO $care_behavior_append_only$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'status_history','correction','publication','publication_revocation'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS append_only ON behavior.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON behavior.%I FOR EACH ROW EXECUTE FUNCTION behavior.prevent_append_only_mutation()',
      table_name
    );
  END LOOP;
END
$care_behavior_append_only$;

CREATE OR REPLACE FUNCTION behavior.prevent_incident_source_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.student_person_id <> NEW.student_person_id
    OR OLD.campus_id <> NEW.campus_id
    OR OLD.category_code <> NEW.category_code
    OR OLD.severity <> NEW.severity
    OR OLD.classification <> NEW.classification
    OR OLD.occurred_at <> NEW.occurred_at
    OR OLD.location_category <> NEW.location_category
    OR OLD.source_narrative <> NEW.source_narrative
    OR OLD.reporter_principal_id <> NEW.reporter_principal_id
    OR OLD.idempotency_key <> NEW.idempotency_key THEN
    RAISE EXCEPTION 'CARE_BEHAVIOR_SOURCE_IMMUTABLE_USE_CORRECTION';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'CARE_BEHAVIOR_VERSION_REQUIRED';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS incident_source_immutable ON behavior.incident;
CREATE TRIGGER incident_source_immutable
  BEFORE UPDATE ON behavior.incident
  FOR EACH ROW EXECUTE FUNCTION behavior.prevent_incident_source_rewrite();

DO $care_behavior_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'incident','status_history','action','restorative_plan','follow_up',
    'correction','publication','publication_revocation'
  ] LOOP
    EXECUTE format('ALTER TABLE behavior.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE behavior.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON behavior.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON behavior.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END
$care_behavior_rls$;

GRANT SELECT, INSERT, UPDATE ON behavior.incident TO app_runtime;
GRANT SELECT, INSERT ON behavior.status_history TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON behavior.action TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON behavior.restorative_plan TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON behavior.follow_up TO app_runtime;
GRANT SELECT, INSERT ON behavior.correction TO app_runtime;
GRANT SELECT, INSERT ON behavior.publication TO app_runtime;
GRANT SELECT, INSERT ON behavior.publication_revocation TO app_runtime;

CREATE OR REPLACE VIEW behavior.operational_monthly_counts_v
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  campus_id,
  date_trunc('month', occurred_at) AS incident_month,
  severity,
  count(*)::bigint AS incident_count
FROM behavior.incident
WHERE status <> 'draft'
GROUP BY tenant_id, campus_id, date_trunc('month', occurred_at), severity
HAVING count(*) >= 5;

GRANT SELECT ON behavior.operational_monthly_counts_v TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607290203_CARE-01_behavior',
  'CARE-01',
  'Behavior incidents, actions, restorative follow-up, corrections and independently approved publication projections'
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
