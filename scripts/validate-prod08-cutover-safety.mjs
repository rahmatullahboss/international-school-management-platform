import { readFileSync } from 'node:fs';

const runnerPath = 'scripts/integ-01-neon-gate.sh';
const prod08Path =
  'infra/database/post-integration-migrations/202608120801_PROD-08_security_definer_hygiene.sql';

const runner = readFileSync(runnerPath, 'utf8');
const prod08 = readFileSync(prod08Path, 'utf8');

for (const requirement of [
  'migration_exists() {',
  'if migration_exists "$url" "$id"; then',
  'echo "skip $id"',
  'continue',
]) {
  if (!runner.includes(requirement)) {
    throw new Error(
      `canonical Neon runner no longer prevents applied-migration replay: ${requirement}`,
    );
  }
}

for (const requirement of [
  'ALTER FUNCTION billing.allocate_document_number(uuid, text, text)\n  SET search_path TO pg_catalog, billing, pg_temp;',
  'ALTER FUNCTION ledger.post_journal_entry(uuid, text)\n  SET search_path TO pg_catalog, ledger, pg_temp;',
  'ALTER FUNCTION ledger.close_period(uuid, text)\n  SET search_path TO pg_catalog, ledger, pg_temp;',
  'ALTER FUNCTION ledger.reopen_period(uuid, text, text)\n  SET search_path TO pg_catalog, ledger, pg_temp;',
  'REVOKE EXECUTE ON FUNCTION billing.allocate_document_number(uuid, text, text) FROM PUBLIC;',
  'REVOKE EXECUTE ON FUNCTION ledger.post_journal_entry(uuid, text) FROM PUBLIC;',
  'REVOKE EXECUTE ON FUNCTION ledger.close_period(uuid, text) FROM PUBLIC;',
  'REVOKE EXECUTE ON FUNCTION ledger.reopen_period(uuid, text, text) FROM PUBLIC;',
]) {
  if (!prod08.includes(requirement)) {
    throw new Error(
      `PROD-08 no longer enforces reviewed privileged-function hygiene: ${requirement}`,
    );
  }
}

console.log('Canonical FIN replay-prevention and PROD-08 hygiene validation passed.');
