import { readFile } from 'node:fs/promises';
import process from 'node:process';

const allowedLicenses = new Set([
  '0BSD',
  'Apache-2.0',
  'Apache-2.0 AND LGPL-3.0-or-later',
  'Apache-2.0 AND LGPL-3.0-or-later AND MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'CC-BY-4.0',
  'CC0-1.0',
  'ISC',
  'LGPL-3.0-or-later',
  'MIT',
  'MIT OR Apache-2.0',
  'MPL-2.0',
]);

const lockfile = JSON.parse(await readFile('package-lock.json', 'utf8'));
const failures = [];
let checked = 0;

for (const [packagePath, metadata] of Object.entries(lockfile.packages ?? {})) {
  if (!packagePath.startsWith('node_modules/') || !metadata.version) continue;
  checked += 1;
  const name = packagePath.slice('node_modules/'.length);
  const license = metadata.license;
  if (typeof license !== 'string' || !allowedLicenses.has(license)) {
    failures.push(`${name}@${metadata.version}: ${license ?? 'UNKNOWN'}`);
  }
}

if (failures.length > 0) {
  console.error('Unapproved dependency licences:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`licence validation: PASS (${checked} packages)`);
}
