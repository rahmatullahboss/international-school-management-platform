import { mkdir, readFile, writeFile } from 'node:fs/promises';

const rootManifest = JSON.parse(await readFile('package.json', 'utf8'));
const lockfile = JSON.parse(await readFile('package-lock.json', 'utf8'));

function packageUrl(name, version) {
  if (name.startsWith('@')) {
    const [scope, packageName] = name.split('/');
    return `pkg:npm/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${version}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${version}`;
}

const dependencies = Object.entries(lockfile.packages ?? {})
  .filter(([packagePath, metadata]) => packagePath.startsWith('node_modules/') && metadata.version)
  .map(([packagePath, metadata]) => {
    const name = packagePath.slice('node_modules/'.length);
    return {
      name,
      version: metadata.version,
      license: metadata.license,
      development: metadata.dev === true,
      optional: metadata.optional === true,
      purl: packageUrl(name, metadata.version),
    };
  })
  .sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.version.localeCompare(right.version),
  );

const licenceInventory = {
  schemaVersion: 1,
  root: { name: rootManifest.name, version: rootManifest.version },
  dependencies,
};

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: rootManifest.name,
      version: rootManifest.version,
      'bom-ref': `pkg:npm/${rootManifest.name}@${rootManifest.version}`,
    },
  },
  components: dependencies.map((dependency) => ({
    type: 'library',
    name: dependency.name,
    version: dependency.version,
    purl: dependency.purl,
    'bom-ref': dependency.purl,
    scope: dependency.optional ? 'optional' : 'required',
    licenses: [{ expression: dependency.license }],
    properties: [{ name: 'school:development-only', value: String(dependency.development) }],
  })),
};

const counts = new Map();
for (const dependency of dependencies) {
  counts.set(dependency.license, (counts.get(dependency.license) ?? 0) + 1);
}

const notices = [
  '# Third-Party Notices',
  '',
  'Generated deterministically from `package-lock.json` by `npm run provenance:generate`.',
  'Package source distributions remain the authoritative location for full licence text and attribution.',
  '',
  '## Licence summary',
  '',
  '| Licence expression | Packages |',
  '|---|---:|',
  ...[...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([license, count]) => `| ${license.replaceAll('|', '\\|')} | ${count} |`),
  '',
  '## Dependency inventory',
  '',
  '| Package | Version | Licence | Development only | Optional |',
  '|---|---|---|---:|---:|',
  ...dependencies.map(
    (dependency) =>
      `| ${dependency.name.replaceAll('|', '\\|')} | ${dependency.version} | ${dependency.license.replaceAll('|', '\\|')} | ${dependency.development ? 'yes' : 'no'} | ${dependency.optional ? 'yes' : 'no'} |`,
  ),
  '',
].join('\n');

await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/dependency-licenses.json',
  JSON.stringify(licenceInventory, null, 2) + '\n',
);
await writeFile('artifacts/sbom.cdx.json', JSON.stringify(sbom, null, 2) + '\n');
await writeFile('THIRD_PARTY_NOTICES.md', notices);

console.log(`provenance generation: PASS (${dependencies.length} packages)`);
