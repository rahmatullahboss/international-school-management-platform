CREATE TABLE IF NOT EXISTS integration.lti_registration (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  registration_id uuid NOT NULL DEFAULT gen_random_uuid(),
  issuer text NOT NULL,
  client_id text NOT NULL,
  authorization_endpoint text NOT NULL,
  access_endpoint text NOT NULL,
  key_set_url text NOT NULL,
  deployment_ids jsonb NOT NULL,
  allowed_target_link_uris jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, registration_id),
  UNIQUE (tenant_id, issuer, client_id)
);

CREATE TABLE IF NOT EXISTS integration.lti_launch_session (
  tenant_id uuid NOT NULL,
  launch_session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL,
  state_digest text NOT NULL,
  nonce_digest text NOT NULL,
  target_link_uri text NOT NULL,
  login_hint_reference text NOT NULL,
  message_hint_reference text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  state_consumed_at timestamptz,
  nonce_consumed_at timestamptz,
  PRIMARY KEY (tenant_id, launch_session_id),
  UNIQUE (tenant_id, state_digest),
  UNIQUE (tenant_id, nonce_digest),
  FOREIGN KEY (tenant_id, registration_id)
    REFERENCES integration.lti_registration (tenant_id, registration_id) ON DELETE CASCADE,
  CHECK (expires_at > issued_at)
);

CREATE TABLE IF NOT EXISTS integration.lti_launch_audit (
  tenant_id uuid NOT NULL,
  launch_audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL,
  subject_reference text NOT NULL,
  deployment_id text NOT NULL,
  message_type text NOT NULL,
  target_link_uri text NOT NULL,
  context_reference text,
  resource_link_reference text,
  result text NOT NULL CHECK (result IN ('accepted', 'rejected')),
  failure_code text,
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, launch_audit_id),
  FOREIGN KEY (tenant_id, registration_id)
    REFERENCES integration.lti_registration (tenant_id, registration_id)
);

CREATE TABLE IF NOT EXISTS integration.sso_connection (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  connection_id uuid NOT NULL DEFAULT gen_random_uuid(),
  protocol text NOT NULL CHECK (protocol IN ('oidc', 'saml')),
  display_name text NOT NULL,
  issuer_or_entity_id text NOT NULL,
  client_or_audience_id text NOT NULL,
  authorization_endpoint text,
  redirect_or_recipient_uri text NOT NULL,
  key_set_or_metadata_url text,
  allowed_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  attribute_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, connection_id),
  UNIQUE (tenant_id, protocol, issuer_or_entity_id, client_or_audience_id)
);

CREATE TABLE IF NOT EXISTS integration.saml_assertion_receipt (
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  assertion_id text NOT NULL,
  request_id text NOT NULL,
  subject_reference text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, connection_id, assertion_id),
  UNIQUE (tenant_id, connection_id, assertion_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.sso_connection (tenant_id, connection_id) ON DELETE CASCADE,
  CHECK (expires_at > received_at)
);

CREATE TABLE IF NOT EXISTS integration.scim_resource_mapping (
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('User', 'Group')),
  external_resource_id text NOT NULL,
  internal_resource_id text NOT NULL,
  resource_version bigint NOT NULL CHECK (resource_version > 0),
  active boolean NOT NULL DEFAULT true,
  last_synchronized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, connection_id, resource_type, external_resource_id),
  UNIQUE (tenant_id, connection_id, resource_type, internal_resource_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES integration.sso_connection (tenant_id, connection_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION integration.prevent_lti_launch_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'LTI launch audit records are append-only';
END
$function$;

DROP TRIGGER IF EXISTS lti_launch_audit_append_only ON integration.lti_launch_audit;
CREATE TRIGGER lti_launch_audit_append_only
  BEFORE UPDATE OR DELETE ON integration.lti_launch_audit
  FOR EACH ROW EXECUTE FUNCTION integration.prevent_lti_launch_audit_mutation();

DO $tenant_isolation$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'lti_registration',
    'lti_launch_session',
    'lti_launch_audit',
    'sso_connection',
    'saml_assertion_receipt',
    'scim_resource_mapping'
  ]
  LOOP
    EXECUTE format('ALTER TABLE integration.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE integration.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON integration.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON integration.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON integration.%I TO app_runtime', table_name);
  END LOOP;
END
$tenant_isolation$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280106_INT-01_lti_sso_scim',
  'INT-01',
  'LTI registration and replay evidence, OIDC/SAML connections and SCIM mappings'
)
ON CONFLICT (migration_id) DO NOTHING;
