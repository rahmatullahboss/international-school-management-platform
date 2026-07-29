BEGIN;

CREATE SCHEMA IF NOT EXISTS safeguarding;

GRANT USAGE ON SCHEMA safeguarding TO app_runtime;

CREATE TABLE IF NOT EXISTS safeguarding.case_memberships (
  tenant_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  case_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  case_role text NOT NULL,
  purpose_code text NOT NULL,
  effective_from timestamptz NOT NULL,
  expires_at timestamptz,
  status text NOT NULL CHECK (status IN ('active', 'revoked', 'expired', 'closed')),
  granted_by uuid NOT NULL,
  approval_reference text NOT NULL,
  revoked_at timestamptz,
  revocation_reason text,
  PRIMARY KEY (tenant_id, membership_id),
  UNIQUE (tenant_id, case_id, principal_id, purpose_code)
);

CREATE TABLE IF NOT EXISTS safeguarding.break_glass_grants (
  tenant_id uuid NOT NULL,
  grant_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  approved_by uuid NOT NULL,
  purpose_code text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 12),
  resource_scope jsonb NOT NULL,
  classification_scope text[] NOT NULL,
  effective_from timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'revoked', 'expired', 'reviewed')),
  review_due_at timestamptz NOT NULL,
  reviewed_at timestamptz,
  review_outcome text,
  PRIMARY KEY (tenant_id, grant_id),
  CHECK (requested_by <> approved_by),
  CHECK (expires_at > effective_from)
);

CREATE TABLE IF NOT EXISTS safeguarding.access_evidence (
  tenant_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  linked_person_id uuid,
  effective_role text NOT NULL,
  action text NOT NULL,
  resource_id uuid NOT NULL,
  classification text NOT NULL CHECK (classification IN ('CARE-C1','CARE-C2','CARE-C3','CARE-C4','CARE-E')),
  field_categories text[] NOT NULL DEFAULT '{}',
  purpose_code text NOT NULL,
  assurance_level text NOT NULL CHECK (assurance_level IN ('aal1','aal2')),
  policy_outcome text NOT NULL,
  correlation_id text NOT NULL,
  recipient_reference text,
  grant_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS safeguarding.high_risk_exports (
  tenant_id uuid NOT NULL,
  export_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  approved_by uuid,
  purpose_code text NOT NULL,
  subject_scope jsonb NOT NULL,
  field_allowlist text[] NOT NULL,
  recipient_reference text NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('requested','approved','generated','downloaded','revoked','expired')),
  object_reference text,
  PRIMARY KEY (tenant_id, export_id),
  CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

CREATE INDEX IF NOT EXISTS care_case_membership_lookup
  ON safeguarding.case_memberships (tenant_id, case_id, principal_id, status, expires_at);
CREATE INDEX IF NOT EXISTS care_access_evidence_scope
  ON safeguarding.access_evidence (tenant_id, resource_id, occurred_at DESC);

ALTER TABLE safeguarding.case_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeguarding.case_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE safeguarding.break_glass_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeguarding.break_glass_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE safeguarding.access_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeguarding.access_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE safeguarding.high_risk_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeguarding.high_risk_exports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_case_memberships_tenant ON safeguarding.case_memberships;
CREATE POLICY care_case_memberships_tenant ON safeguarding.case_memberships
  FOR ALL TO app_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS care_break_glass_tenant ON safeguarding.break_glass_grants;
CREATE POLICY care_break_glass_tenant ON safeguarding.break_glass_grants
  FOR ALL TO app_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS care_access_evidence_select ON safeguarding.access_evidence;
CREATE POLICY care_access_evidence_select ON safeguarding.access_evidence
  FOR SELECT TO app_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS care_access_evidence_insert ON safeguarding.access_evidence;
CREATE POLICY care_access_evidence_insert ON safeguarding.access_evidence
  FOR INSERT TO app_runtime
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS care_high_risk_exports_tenant ON safeguarding.high_risk_exports;
CREATE POLICY care_high_risk_exports_tenant ON safeguarding.high_risk_exports
  FOR ALL TO app_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

REVOKE UPDATE, DELETE ON safeguarding.access_evidence FROM app_runtime;

GRANT SELECT, INSERT, UPDATE ON safeguarding.case_memberships TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON safeguarding.break_glass_grants TO app_runtime;
GRANT SELECT, INSERT ON safeguarding.access_evidence TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON safeguarding.high_risk_exports TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607290201_CARE-01_security_contract',
  'CARE-01',
  'Need-to-know case membership, break-glass, immutable access evidence and high-risk export controls'
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
