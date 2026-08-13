import { readFileSync } from 'node:fs';

const ledgerPath = 'packages/modules/ledger/migrations/202607280101_FIN-01_ledger.sql';
const billingPath = 'packages/modules/billing/migrations/202607280102_FIN-01_billing.sql';

const ledger = readFileSync(ledgerPath, 'utf8');
const billing = readFileSync(billingPath, 'utf8');

const requiredFragments = [
  [
    ledgerPath,
    ledger,
    'CREATE OR REPLACE FUNCTION ledger.post_journal_entry',
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ledger, pg_temp AS $$',
  ],
  [
    ledgerPath,
    ledger,
    'CREATE OR REPLACE FUNCTION ledger.close_period',
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ledger, pg_temp AS $$',
  ],
  [
    ledgerPath,
    ledger,
    'CREATE OR REPLACE FUNCTION ledger.reopen_period',
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ledger, pg_temp AS $$',
  ],
  [
    billingPath,
    billing,
    'CREATE OR REPLACE FUNCTION billing.allocate_document_number',
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, billing, pg_temp AS $$',
  ],
];

for (const [path, source, functionMarker, safeDefinition] of requiredFragments) {
  const functionStart = source.indexOf(functionMarker);
  if (functionStart < 0) {
    throw new Error(`missing privileged function definition in ${path}: ${functionMarker}`);
  }
  const functionEnd = source.indexOf('$$;', functionStart);
  if (functionEnd < 0) {
    throw new Error(`unterminated privileged function definition in ${path}: ${functionMarker}`);
  }
  const definition = source.slice(functionStart, functionEnd + 3);
  if (!definition.includes(safeDefinition)) {
    throw new Error(
      `privileged function replay would not preserve pg_catalog-first search_path in ${path}: ${functionMarker}`,
    );
  }
}

const deniedFragments = [
  [ledgerPath, ledger, 'SECURITY DEFINER SET search_path = ledger, pg_temp'],
  [billingPath, billing, 'SECURITY DEFINER SET search_path = billing, pg_temp'],
];

for (const [path, source, denied] of deniedFragments) {
  if (source.includes(denied)) {
    throw new Error(`unsafe privileged search_path remains in ${path}: ${denied}`);
  }
}

console.log('FIN SECURITY DEFINER replay source validation passed.');
