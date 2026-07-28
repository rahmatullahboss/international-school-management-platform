import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'packages/modules/integrations/migrations/202607280106_INT-01_lti_sso_scim.sql',
);

describe('LTI, SSO and SCIM migration', () => {
  test('creates tenant-scoped registration, replay and provisioning evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of [
      'lti_registration',
      'lti_launch_session',
      'lti_launch_audit',
      'sso_connection',
      'saml_assertion_receipt',
      'scim_resource_mapping',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS integration.${table}`);
    }
    expect(sql).toContain('state_digest text NOT NULL');
    expect(sql).toContain('nonce_digest text NOT NULL');
    expect(sql).toContain('UNIQUE (tenant_id, issuer, client_id)');
    expect(sql).toContain('UNIQUE (tenant_id, connection_id, assertion_id)');
    expect(sql).toContain('resource_version bigint NOT NULL');
    expect(sql).toContain("'202607280106_INT-01_lti_sso_scim'");
  });
});
