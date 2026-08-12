ALTER FUNCTION billing.allocate_document_number(uuid, text, text)
  SET search_path TO pg_catalog, billing, pg_temp;
ALTER FUNCTION ledger.post_journal_entry(uuid, text)
  SET search_path TO pg_catalog, ledger, pg_temp;
ALTER FUNCTION ledger.close_period(uuid, text)
  SET search_path TO pg_catalog, ledger, pg_temp;
ALTER FUNCTION ledger.reopen_period(uuid, text, text)
  SET search_path TO pg_catalog, ledger, pg_temp;

REVOKE EXECUTE ON FUNCTION billing.allocate_document_number(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ledger.post_journal_entry(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ledger.close_period(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ledger.reopen_period(uuid, text, text) FROM PUBLIC;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608120801_PROD-08_security_definer_hygiene',
  'PROD-08',
  'Pin pg_catalog-first search paths and revoke PUBLIC execute on privileged billing and ledger functions'
)
ON CONFLICT (migration_id) DO NOTHING;
